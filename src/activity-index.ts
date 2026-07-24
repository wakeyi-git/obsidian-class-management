import { App, TFile } from "obsidian";
import type { ClassRepository } from "./class-repository";
import type { ActivityEntry, RecordEntry } from "@core/types";

export class ActivityIndex {
  private cache?: ActivityEntry[];
  private pending?: Promise<ActivityEntry[]>;
  /** 빌드 도중 무효화를 감지하는 세대 번호 — 낡은 빌드 결과가 캐시를 채우지 않게 한다. */
  private generation = 0;
  /** 파일 단위 증분 캐시 — mtime이 같으면 지난 빌드의 항목을 재사용한다(§7 부분 갱신 2단계). */
  private readonly fileCache = new Map<string, { mtime: number; entries: ActivityEntry[] }>();

  constructor(
    private readonly app: App,
    private readonly repository: ClassRepository
  ) {}

  invalidate(): void {
    this.generation += 1;
    this.cache = undefined;
  }

  async getEntries(): Promise<ActivityEntry[]> {
    if (this.cache) return this.cache;
    if (this.pending) return this.pending;

    const generation = this.generation;
    this.pending = this.build();
    try {
      const entries = await this.pending;
      if (generation === this.generation) this.cache = entries;
      return entries;
    } finally {
      this.pending = undefined;
    }
  }

  private async build(): Promise<ActivityEntry[]> {
    const visited = new Set<string>();
    const [records, attendance, assignments, tasks, notices, routines, curriculum, workJournals] = await Promise.all([
      this.buildRecords(visited),
      this.buildAttendance(visited),
      this.buildAssignments(visited),
      this.buildTasks(visited),
      this.buildNotices(visited),
      this.buildRoutines(visited),
      this.buildCurriculumLessons(visited),
      this.buildWorkJournals(visited)
    ]);
    // 이번 빌드에서 안 쓰인 파일(삭제·이동·프로필 전환)은 증분 캐시에서 걷어낸다.
    for (const path of [...this.fileCache.keys()]) {
      if (!visited.has(path)) this.fileCache.delete(path);
    }

    return [...records, ...attendance, ...assignments, ...tasks, ...notices, ...routines, ...curriculum, ...workJournals].sort(
      (a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt
    );
  }

  private async buildWorkJournals(visited: Set<string>): Promise<ActivityEntry[]> {
    const journals = this.repository.getWorkJournals();
    const groups = await mapWithConcurrency(journals, 8, ({ file, date }) =>
      this.memoized(file, visited, async () => {
        const content = await this.app.vault.cachedRead(file);
        const detail = extractSection(content, "기록");
        return [{
          id: file.path,
          file,
          date,
          studentNumber: "",
          studentName: "",
          kind: "work-journal" as const,
          title: "업무일지",
          status: "",
          detail,
          searchText: activitySearchText(file, [date, "업무일지", detail, content]),
          createdAt: file.stat.ctime
        }];
      })
    );
    return groups.flat();
  }

  /** mtime이 같으면 캐시 항목을 재사용하고, 다르면 다시 계산한다 — 재빌드 비용을 변경 파일로 한정. */
  private async memoized(
    file: TFile,
    visited: Set<string>,
    compute: () => Promise<ActivityEntry[]> | ActivityEntry[]
  ): Promise<ActivityEntry[]> {
    visited.add(file.path);
    const mtime = file.stat.mtime;
    const cached = this.fileCache.get(file.path);
    if (cached && cached.mtime === mtime) return cached.entries;
    const entries = await compute();
    this.fileCache.set(file.path, { mtime, entries });
    return entries;
  }

  private async buildRecords(visited: Set<string>): Promise<ActivityEntry[]> {
    const records = this.repository.getRecords();
    const groups = await mapWithConcurrency(records, 8, (record) =>
      this.memoized(record.file, visited, async () => [await this.recordActivity(record)])
    );
    return groups.flat();
  }

  private async recordActivity(record: RecordEntry): Promise<ActivityEntry> {
    const content = await this.app.vault.cachedRead(record.file);
    const detail = extractSection(content, "내용");

    return {
      id: record.file.path,
      file: record.file,
      date: record.date,
      studentNumber: record.studentNumber,
      studentName: record.studentName,
      kind: "record",
      title: record.recordType,
      status: record.recordType,
      detail,
      schoolRecordEvidence: record.schoolRecordEvidence,
      searchText: activitySearchText(record.file, [
        record.date,
        record.studentNumber,
        record.studentName,
        record.recordType,
        detail,
        ...schoolRecordSearchValues(record),
        content
      ]),
      createdAt: record.file.stat.ctime
    };
  }

  private async buildAttendance(visited: Set<string>): Promise<ActivityEntry[]> {
    const summaries = this.repository.getAttendanceSummaries();
    const groups = await mapWithConcurrency(
      summaries,
      8,
      ({ file, date }) => this.memoized(file, visited, async () => {
        const content = await this.app.vault.cachedRead(file);
        const marks = this.repository.parseAttendanceContent(content);
        return marks.map((mark) => ({
          id: `${file.path}#${mark.studentNumber}`,
          file,
          date,
          studentNumber: mark.studentNumber,
          studentName: mark.studentName,
          kind: "attendance" as const,
          title: mark.status,
          status: mark.status,
          detail: mark.reason ?? "",
          searchText: activitySearchText(file, [
            date,
            mark.studentNumber,
            mark.studentName,
            mark.status,
            mark.reason ?? ""
          ]),
          createdAt: file.stat.ctime
        }));
      })
    );
    return groups.flat();
  }

  private async buildAssignments(visited: Set<string>): Promise<ActivityEntry[]> {
    const summaries = this.repository.getAssignmentSummaries();
    const groups = await mapWithConcurrency(
      summaries,
      8,
      (summary) => this.memoized(summary.file, visited, async () => {
        const assignment = await this.repository.loadAssignment(summary);
        return assignment.marks.map((mark) => ({
          id: `${assignment.file.path}#${mark.studentNumber}`,
          file: assignment.file,
          date: assignment.date,
          studentNumber: mark.studentNumber,
          studentName: mark.studentName,
          kind: "assignment" as const,
          title: assignment.title,
          status: mark.status,
          detail: mark.note ?? "",
          searchText: activitySearchText(assignment.file, [
            assignment.date,
            assignment.title,
            mark.studentNumber,
            mark.studentName,
            mark.status,
            mark.note ?? ""
          ]),
          createdAt: assignment.file.stat.ctime
        }));
      })
    );
    return groups.flat();
  }

  private async buildTasks(visited: Set<string>): Promise<ActivityEntry[]> {
    const groups = await mapWithConcurrency(this.repository.getTasks(), 8, (task) =>
      this.memoized(task.file, visited, async () => {
      const content = await this.app.vault.cachedRead(task.file);
      const detail = content.replace(/^---[\s\S]*?---\s*/m, "").replace(/^#.*$/m, "").trim();
      const date = task.dueDate || task.startDate || fileDate(task.file);
      return [{
        id: task.file.path,
        file: task.file,
        date,
        studentNumber: task.studentNumber,
        studentName: task.studentName,
        kind: "task" as const,
        title: task.title,
        status: task.status,
        detail,
        searchText: activitySearchText(task.file, [
          task.title, task.status, task.project, task.context, task.dueDate,
          task.recurrence, task.studentNumber, task.studentName, detail
        ]),
        createdAt: task.createdAt
      }];
      })
    );
    return groups.flat();
  }

  private async buildNotices(visited: Set<string>): Promise<ActivityEntry[]> {
    const groups = await mapWithConcurrency(this.repository.getNoticeSummaries(), 8, (summary) =>
      this.memoized(summary.file, visited, async () => {
      const notice = await this.repository.loadNotice(summary);
      const date = notice.dueDate || notice.sentDate;
      return notice.marks.map((mark) => ({
        id: `${notice.file.path}#${mark.studentNumber}`,
        file: notice.file,
        date,
        studentNumber: mark.studentNumber,
        studentName: mark.studentName,
        kind: "notice" as const,
        title: notice.title,
        status: mark.status,
        detail: [mark.responseDate, mark.note].filter(Boolean).join(" · "),
        searchText: activitySearchText(notice.file, [
          notice.title, notice.sentDate, notice.dueDate, mark.studentNumber,
          mark.studentName, mark.status, mark.responseDate ?? "", mark.note ?? ""
        ]),
        createdAt: notice.file.stat.ctime
      }));
      })
    );
    return groups.flat();
  }

  private async buildRoutines(visited: Set<string>): Promise<ActivityEntry[]> {
    const groups = await mapWithConcurrency(
      this.repository.getRoutineInstanceSummaries(),
      8,
      (summary) => this.memoized(summary.file, visited, async () => {
        const instance = await this.repository.loadRoutineInstance(summary.file, summary.date);
        return instance.items.map((item) => ({
          id: `${instance.file.path}#${item.line}`,
          file: instance.file,
          date: instance.date,
          studentNumber: "",
          studentName: "",
          kind: "routine" as const,
          title: `${item.templateTitle} · ${item.text}`,
          status: item.completed ? "완료" : "미완료",
          detail: item.templateTitle,
          searchText: activitySearchText(instance.file, [
            instance.date, item.templateTitle, item.text, item.completed ? "완료" : "미완료"
          ]),
          createdAt: instance.file.stat.ctime
        }));
      })
    );
    return groups.flat();
  }

  private async buildCurriculumLessons(visited: Set<string>): Promise<ActivityEntry[]> {
    const lessons = this.repository.getCurriculumLessons().filter((lesson) => Boolean(lesson.date));
    const groups = await Promise.all(lessons.map((lesson) =>
      this.memoized(lesson.file, visited, () => [{
        id: lesson.file.path,
        file: lesson.file,
        date: lesson.date,
        studentNumber: "",
        studentName: "",
        kind: "curriculum" as const,
        title: `${lesson.subject} · ${lesson.unitTitle} ${lesson.sequence}차시`,
        status: lesson.status === "completed" ? "실행 완료" : "계획",
        detail: [lesson.period, lesson.objective, lesson.assessmentEvidence].filter(Boolean).join(" · "),
        searchText: activitySearchText(lesson.file, [
          lesson.date,
          lesson.subject,
          lesson.unitTitle,
          lesson.objective,
          lesson.activities,
          lesson.assessmentEvidence,
          lesson.conceptInquiryPhase,
          lesson.conceptInquiryStrandTitle,
          lesson.studentGeneralization,
          lesson.transferEvidence,
          lesson.feedback,
          lesson.reflection
        ]),
        createdAt: lesson.createdAt
      }])
    ));
    return groups.flat();
  }
}

function schoolRecordSearchValues(record: RecordEntry): string[] {
  if (!record.schoolRecordEvidence) return [];
  return Object.values(record.schoolRecordEvidence)
    .filter((value): value is string => typeof value === "string");
}

function extractSection(content: string, heading: string): string {
  const marker = new RegExp(`^##\\s+${escapeRegExp(heading)}\\s*$`, "m");
  const match = marker.exec(content);
  if (!match) return "";
  const rest = content.slice(match.index + match[0].length).trim();
  return rest.split(/^##\s+/m, 1)[0]?.trim() ?? "";
}

function activitySearchText(file: TFile, values: string[]): string {
  return [file.path, file.basename, ...values].join(" ");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fileDate(file: TFile): string {
  const date = new Date(file.stat.ctime);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      const item = items[index];
      if (item !== undefined) results[index] = await mapper(item, index);
    }
  });
  await Promise.all(workers);
  return results;
}
