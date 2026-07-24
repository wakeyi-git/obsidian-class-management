import { Notice, type App, type TFile } from "obsidian";
import { addDays, dayStatus, mondayOf, semesterForDate, semesterRange } from "@core/academic-calendar";
import { isRemovedSubject, plannedHoursBySubject, resolveDay, subjectSlots } from "@core/timetable";
import { assignProgress, buildAssignedSlotContents } from "@core/progress";
import { buildHoursAudit } from "@core/hours-audit";
import { scanOperationalTasks } from "@core/task-scan";
import { auditCurriculumAlignment, emptyCurriculumUnit, taughtHoursForUnit } from "@core/curriculum";
import {
  achievementStandardMarkdown,
  extractStandardCodes,
  linkifyStandardCell,
  resolveAssessmentDate,
  unitScaffoldsFromProgress
} from "@core/planning";
import { buildWeeklyPlanDays, buildWeeklyPlanMarkdown } from "@core/weekly-plan";
import { localDate } from "@core/utils";
import type {
  BaseTimetable,
  ClassManagementSettings,
  CurriculumLesson,
  CurriculumUnitLink,
  ProgressTable,
  TimetableOverride
} from "@core/types";
import { StudentSuggestModal } from "./modals";
import { ProgressPinModal } from "./progress-pin-modal";
import type { ClassRepository } from "./class-repository";
import type ClassManagementPlugin from "./main";

/**
 * 교육과정 도메인 플로 — main.ts 분해 2단계(§7 백로그).
 * 뷰가 쓰는 진입점은 플러그인의 위임 메서드로 유지되고, 본문은 여기에 산다.
 */
export class CurriculumFlows {
  constructor(private readonly plugin: ClassManagementPlugin) {}

  private get app(): App {
    return this.plugin.app;
  }

  private get repository(): ClassRepository {
    return this.plugin.repository;
  }

  private get settings(): ClassManagementSettings {
    return this.plugin.settings;
  }

  /** R0-1 일반 단원 스캐폴드 — 진도표 단원 묶음으로 단원 노트 초안을 만든다(기존 이름은 건너뜀). */
  async scaffoldRegularUnits(
    semester: string,
    subjects: string[]
  ): Promise<{ created: string[]; skipped: string[] }> {
    const existing = this.repository.getCurriculumUnits();
    const tables = await this.repository.getProgressTables(semester);
    const created: string[] = [];
    const skipped: string[] = [];
    for (const subject of subjects) {
      const table = tables.find((item) => item.subject === subject);
      if (!table) continue;
      for (const scaffold of unitScaffoldsFromProgress(table)) {
        const duplicate = existing.some(
          (unit) =>
            unit.subject === subject &&
            unit.semester === semester &&
            unit.unitName === scaffold.unitName
        );
        if (duplicate) {
          skipped.push(`${subject} ${scaffold.unitName}`);
          continue;
        }
        await this.repository.createCurriculumUnit({
          ...emptyCurriculumUnit(this.settings),
          subject,
          semester,
          unitName: scaffold.unitName,
          theme: scaffold.summary,
          designApproach: "within-subject",
          startDate: scaffold.startDate,
          endDate: scaffold.endDate,
          // 원장 규칙: 일반 단원 시수는 자체 운영분 — 통합 이관 시수는 프로젝트 단원이 계상해
          // 일반 합 + 프로젝트 합 = 시간표 편성이 되게 한다.
          plannedHours: scaffold.plannedHours - scaffold.integratedHours,
          achievementStandards: scaffold.standards.join("\n"),
          learningPlan: scaffold.learningPlan,
          unitOverview: scaffold.summary
        });
        created.push(`${subject} ${scaffold.unitName}`);
      }
    }
    return { created, skipped };
  }

  /** R0-2 평가 계획 가져오기 — 항목별로 날짜를 정하고 과제 노트 생성·단원 연계·진도표 기입까지. */
  async importAssessmentPlan(
    subject: string,
    semester: string,
    items: Array<{ timing: string; unit: string; element: string; criteria: string; method: string }>
  ): Promise<{ created: number; skipped: number; issues: string[] }> {
    const calendar = await this.repository.getAcademicCalendar();
    const range = calendar ? semesterRange(calendar, semester) : { from: "", to: "" };
    const tables = await this.repository.getProgressTables(semester);
    const table = tables.find((item) => item.subject === subject) ?? null;
    const units = this.repository
      .getCurriculumUnits()
      .filter((unit) => unit.subject === subject && unit.semester === semester);
    const students = this.repository.getStudents();
    const normalize = (value: string): string => value.replace(/[\d.\s()·\-~]/g, "");

    let created = 0;
    let skipped = 0;
    const issues: string[] = [];
    for (const item of items) {
      const resolved = resolveAssessmentDate(item.timing, item.unit, {
        semesterFrom: range.from ?? "",
        semesterTo: range.to ?? "",
        rows: table?.rows ?? []
      });
      if (!resolved.date) {
        issues.push(`"${item.element}": ${resolved.issue ?? "시기를 해석하지 못했습니다."}`);
        continue;
      }
      const unit =
        units.find(
          (candidate) =>
            item.unit &&
            normalize(candidate.unitName) &&
            (normalize(candidate.unitName).includes(normalize(item.unit)) ||
              normalize(item.unit).includes(normalize(candidate.unitName)))
        ) ??
        units.find(
          (candidate) =>
            candidate.startDate &&
            candidate.endDate &&
            resolved.date >= candidate.startDate &&
            resolved.date <= candidate.endDate
        ) ?? null;
      const unitLink = unit
        ? { id: unit.id, title: unit.unitName, path: unit.file.path }
        : null;
      const title = `${subject} 수행평가 - ${item.element}`;
      const marks = students.map((student) => ({
        studentNumber: student.number,
        studentName: student.name,
        status: "미제출" as const,
        note: ""
      }));
      const tailSections = [
        "",
        "## 평가 정보",
        "",
        `- 시기: ${item.timing || "미입력"} → ${resolved.date} (${resolved.source})`,
        `- 단원: ${item.unit || "미입력"}`,
        `- 평가 방법: ${item.method || "미입력"}`,
        "",
        "## 평가 기준",
        "",
        `> ${item.criteria || "미입력"}`
      ];
      try {
        const file = await this.repository.saveAssignment(
          resolved.date,
          title,
          marks,
          unitLink,
          undefined,
          tailSections
        );
        await this.linkAssignmentToProgress(resolved.date, title, unitLink, file);
        created += 1;
      } catch (error) {
        if (error instanceof Error && error.message.includes("이미 있습니다")) skipped += 1;
        else issues.push(`"${item.element}": ${error instanceof Error ? error.message : "저장 실패"}`);
      }
    }
    await this.plugin.refreshAllViews();
    return { created, skipped, issues };
  }

  /** R0-3 성취기준 노트 생성 — 진도표·단원 노트의 코드를 모아 없는 노트만 만든다. */
  async scaffoldStandardNotes(): Promise<void> {
    if (!this.plugin.canWriteActiveClass()) return;
    try {
      const sources = new Map<string, Set<string>>();
      for (const semester of ["1학기", "2학기"]) {
        for (const table of await this.repository.getProgressTables(semester)) {
          for (const row of table.rows) {
            for (const code of extractStandardCodes(row.standard)) {
              const set = sources.get(code) ?? new Set<string>();
              set.add(table.file.basename);
              sources.set(code, set);
            }
          }
        }
      }
      for (const unit of this.repository.getCurriculumUnits()) {
        for (const code of extractStandardCodes(unit.achievementStandards)) {
          if (!sources.has(code)) sources.set(code, new Set<string>());
        }
      }
      if (sources.size === 0) {
        new Notice("진도표·단원 노트에서 성취기준 코드를 찾지 못했습니다.");
        return;
      }
      let created = 0;
      let existing = 0;
      for (const [code, links] of [...sources.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const result = await this.repository.ensureAchievementStandardNote(
          code,
          achievementStandardMarkdown({ code, statement: "", progressLinks: [...links].sort() })
        );
        if (result.created) created += 1;
        else existing += 1;
      }
      new Notice(
        `성취기준 노트 ${created}개를 만들었습니다. 기존 ${existing}개는 그대로 두었습니다. 전문은 노트에서 채워 주세요.`
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "성취기준 노트 생성에 실패했습니다.");
    }
  }

  /** R0-3 진도표 성취기준 링크화 — 두 학기 진도표의 코드 표기를 [[코드]]로 바꾼다(멱등). */
  async linkifyProgressStandardCodes(): Promise<void> {
    if (!this.plugin.canWriteActiveClass()) return;
    try {
      const targets: ProgressTable[] = [];
      for (const semester of ["1학기", "2학기"]) {
        for (const table of await this.repository.getProgressTables(semester)) {
          if (table.rows.some((row) => linkifyStandardCell(row.standard) !== row.standard)) {
            targets.push(table);
          }
        }
      }
      if (targets.length === 0) {
        new Notice("바꿀 성취기준 표기가 없습니다. 이미 모두 위키링크입니다.");
        return;
      }
      // 표 전체를 다시 쓰므로 변경 전 원본을 자동 스냅숏으로 남긴다 (UIUX §5).
      await this.repository.createTargetedSnapshot(
        targets.map((table) => table.file),
        "진도표 성취기준 링크화"
      );
      let changedRows = 0;
      for (const table of targets) {
        changedRows += await this.repository.linkifyProgressStandards(table);
      }
      new Notice(
        `진도표 ${targets.length}개에서 ${changedRows}행의 성취기준을 위키링크로 바꿨습니다 · 변경 전 스냅숏 저장.`
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "성취기준 링크화에 실패했습니다.");
    }
  }

  /** 학기 경계를 지나면 설정 학기 전환을 제안한다 (§3 안내 문형 — 자동 변경하지 않음). */
  async suggestSemesterSwitch(): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) return;
      // 방학·휴업일에는 제안하지 않는다 — 행정 학기에서는 방학도 학기 범위 안이라 오탐이 된다.
      if (dayStatus(calendar, localDate()).kind !== "class") return;
      const current = semesterForDate(calendar, localDate());
      if (!current || current === this.settings.semester) return;
      new Notice(
        `오늘은 ${current} 기간입니다. 설정에서 학기를 ${current}(으)로 바꾸면 시간표·진도가 맞게 표시됩니다.`,
        10000
      );
    } catch {
      // 제안 실패는 조용히 넘어간다 — 다음 로드에서 다시 시도된다.
    }
  }

  /** 1.30.0 폴더 이름 변경(기록→학생 기록, 설계→단원, 뷰→모아보기) 전 구조를 감지해 안내한다. */
  warnLegacyFolders(): void {
    const pairs: Array<[string, string]> = [
      [`${this.repository.baseFolderPath}/기록`, this.repository.recordsFolderPath],
      [`${this.repository.curriculumFolderPath}/설계`, this.repository.curriculumUnitsFolderPath],
      [`${this.repository.curriculumFolderPath}/뷰`, this.repository.basesFolderPath]
    ];
    const legacy = pairs.filter(
      ([oldPath, newPath]) =>
        oldPath !== newPath &&
        this.app.vault.getAbstractFileByPath(oldPath) &&
        !this.app.vault.getAbstractFileByPath(newPath)
    );
    if (legacy.length === 0) return;
    new Notice(
      `구버전 폴더 이름이 남아 있습니다: ${legacy.map(([oldPath]) => oldPath).join(", ")}. ` +
        "폴더 이름을 새 구조(학생 기록·단원·모아보기)로 바꿔 주세요 — CHANGELOG 1.30.0 이행 안내 참고.",
      12000
    );
  }

  /** 수동 작성 수업일지를 진도표 비고에 역링크한다(플러그인 생성분과 같은 형식, 멱등). */
  async backfillLessonProgressLinks(): Promise<void> {
    if (!this.plugin.canWriteActiveClass()) return;
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다. `학사일정 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const lessons = this.repository
        .getCurriculumLessons()
        .filter((lesson) => lesson.date && lesson.subject);
      if (lessons.length === 0) {
        new Notice("날짜·과목이 있는 수업일지가 없습니다.");
        return;
      }
      const tablesBySemester = new Map<string, ProgressTable[]>();
      let added = 0;
      let already = 0;
      let unmatched = 0;
      for (const lesson of lessons) {
        const semester = semesterForDate(calendar, lesson.date);
        if (!semester) {
          unmatched += 1;
          continue;
        }
        if (!tablesBySemester.has(semester)) {
          tablesBySemester.set(semester, await this.repository.getProgressTables(semester));
        }
        const table = (tablesBySemester.get(semester) ?? []).find(
          (item) => item.subject === lesson.subject
        );
        const candidates = table
          ? table.rows.filter((row) => row.assigned.includes(lesson.date))
          : [];
        const periodDigits = lesson.period.replace(/[^0-9]/g, "");
        const row =
          candidates.find(
            (item) => periodDigits && item.assigned.includes(`${lesson.date}(${periodDigits})`)
          ) ?? candidates[0];
        if (!table || !row) {
          unmatched += 1;
          continue;
        }
        const link = `[[${lesson.file.path.replace(/\.md$/i, "")}|수업일지]]`;
        if (row.note.includes(link)) {
          already += 1;
          continue;
        }
        await this.repository.appendProgressRowLink(table, row.order, "note", link);
        added += 1;
      }
      const parts = [`수업일지 ${lessons.length}건 중 ${added}건을 진도표 비고에 역링크했습니다.`];
      if (already > 0) parts.push(`이미 연결 ${already}건.`);
      if (unmatched > 0) parts.push(`배정 차시를 못 찾은 ${unmatched}건은 진도표 배정을 확인하세요.`);
      new Notice(parts.join(" "));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "역링크 채우기에 실패했습니다.");
    }
  }

  private async resolveSlotSubject(
    semester: string,
    date: string,
    period: number
  ): Promise<string> {
    const calendar = await this.repository.getAcademicCalendar();
    if (!calendar) return "";
    const timetable = await this.repository.getBaseTimetable(semester);
    const day = resolveDay(calendar, timetable, date);
    const slot = day.periods.find((item) => item.period === period);
    return slot && !slot.unmapped ? slot.subject.trim() : "";
  }

  /** 주간 시간표 수정에 영향받은 과목들의 진도 배정을 다시 계산해 진도표에 기록한다. */
  private async reassignProgressSubjects(semester: string, subjects: string[]): Promise<number> {
    const unique = [...new Set(subjects.map((s) => s.trim()).filter(Boolean))].filter(
      (subject) => !isRemovedSubject(subject)
    );
    if (unique.length === 0) return 0;
    const calendar = await this.repository.getAcademicCalendar();
    if (!calendar) return 0;
    const range = semesterRange(calendar, semester);
    if (!range.from || !range.to) return 0;
    const timetable = await this.repository.getBaseTimetable(semester);
    if (!timetable) return 0;
    const tables = await this.repository.getProgressTables(semester);
    let issues = 0;
    for (const subject of unique) {
      const table = tables.find((item) => item.subject === subject);
      if (!table) continue;
      const slots = subjectSlots(calendar, timetable, range.from, range.to, subject);
      const assignment = assignProgress(table.rows, slots);
      await this.repository.writeProgressAssignments(table, assignment);
      issues += assignment.issues.length;
    }
    return issues;
  }

  private async timetableSemesterForDate(date: string): Promise<string | null> {
    const calendar = await this.repository.getAcademicCalendar();
    if (!calendar) return this.settings.semester;
    const semester = semesterForDate(calendar, date);
    if (!semester) {
      new Notice(`${date}는 학기 기간 밖 날짜입니다. 학사일정 노트의 학기 범위를 확인하세요.`);
      return null;
    }
    return semester;
  }

  async pinProgressRowAt(date: string, period: number, subject: string): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다.");
        return;
      }
      const semester = semesterForDate(calendar, date);
      if (!semester) {
        new Notice(`${date}는 학기 기간 밖 날짜입니다.`);
        return;
      }
      const tables = await this.repository.getProgressTables(semester);
      const table = tables.find((item) => item.subject === subject);
      if (!table) {
        new Notice(`${subject} 진도표가 없습니다. 먼저 '진도표 차시 가져오기'로 만들어 주세요.`);
        return;
      }
      new ProgressPinModal(this.app, table.rows, { date, period, subject }, (row) => {
        void (async () => {
          try {
            const unpin = row.fixedDate === date && row.fixedPeriod === period;
            await this.repository.updateProgressRowFixed(
              table,
              row.order,
              unpin ? "" : date,
              unpin ? 0 : period
            );
            const range = semesterRange(calendar, semester);
            if (range.from && range.to) {
              const timetable = await this.repository.getBaseTimetable(semester);
              if (timetable) {
                const refreshed = (await this.repository.getProgressTables(semester)).find(
                  (item) => item.subject === subject
                );
                if (refreshed) {
                  const slots = subjectSlots(calendar, timetable, range.from, range.to, subject);
                  await this.repository.writeProgressAssignments(
                    refreshed,
                    assignProgress(refreshed.rows, slots)
                  );
                }
              }
            }
            new Notice(
              unpin
                ? `${row.order}. ${row.topic} 고정을 해제했습니다.`
                : `${row.order}. ${row.topic} → ${date} ${period}교시에 고정하고 재배정했습니다.`
            );
            await this.plugin.refreshAllViews();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "차시 고정에 실패했습니다.");
          }
        })();
      }).open();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "차시 고정에 실패했습니다.");
    }
  }

  async saveTimetableOverride(override: TimetableOverride): Promise<void> {
    const semester = await this.timetableSemesterForDate(override.date);
    if (!semester) return;
    const before = await this.resolveSlotSubject(semester, override.date, override.period);
    const file = await this.repository.ensureBaseTimetableNote(semester);
    await this.repository.upsertTimetableOverride(file, override);
    const after = await this.resolveSlotSubject(semester, override.date, override.period);
    const issues = await this.reassignProgressSubjects(semester, [before, after]);
    const reassignNote = issues > 0 ? ` · 진도 재배정(확인 ${issues}건)` : " · 진도 재배정";
    new Notice(
      isRemovedSubject(override.subject)
        ? `${override.date} ${override.period}교시를 삭제했습니다. (${semester})${reassignNote}`
        : `${override.date} ${override.period}교시 → ${override.subject} (${semester})${reassignNote}`
    );
    await this.plugin.refreshAllViews();
  }

  async removeTimetableOverrideAt(date: string, period: number): Promise<void> {
    const semester = await this.timetableSemesterForDate(date);
    if (!semester) return;
    const before = await this.resolveSlotSubject(semester, date, period);
    const file = await this.repository.ensureBaseTimetableNote(semester);
    await this.repository.removeTimetableOverride(file, date, period);
    const after = await this.resolveSlotSubject(semester, date, period);
    const issues = await this.reassignProgressSubjects(semester, [before, after]);
    const reassignNote = issues > 0 ? ` · 진도 재배정(확인 ${issues}건)` : " · 진도 재배정";
    new Notice(`${date} ${period}교시 변경을 제거했습니다. (${semester})${reassignNote}`);
    await this.plugin.refreshAllViews();
  }

  async runProgressAssignment(): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다. `학사일정 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const timetable = await this.repository.getBaseTimetable(this.settings.semester);
      if (!timetable) {
        new Notice("기초시간표 노트가 필요합니다. `기초시간표 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const tables = await this.repository.getProgressTables(this.settings.semester);
      if (tables.length === 0) {
        new Notice("진도표가 없습니다. `진도표 차시 가져오기`로 차시를 입력하세요.");
        return;
      }
      const range = semesterRange(calendar, this.settings.semester);
      if (!range.from || !range.to) {
        new Notice("학사일정 노트의 학기 시작·종료일을 확인하세요.");
        return;
      }
      // 수백 행을 다시 쓰므로 변경 전 원본을 자동 스냅숏으로 남긴다 (UIUX §5).
      await this.repository.createTargetedSnapshot(
        tables.map((table) => table.file),
        "진도 자동 배정"
      );
      const issues: string[] = [];
      for (const table of tables) {
        const slots = subjectSlots(calendar, timetable, range.from, range.to, table.subject);
        const assignment = assignProgress(table.rows, slots);
        await this.repository.writeProgressAssignments(table, assignment);
        issues.push(...assignment.issues.map((issue) => `${table.subject}: ${issue}`));
      }
      new Notice(
        issues.length > 0
          ? `${this.settings.semester} 진도 배정 완료 · 변경 전 스냅숏 저장. 확인할 항목 ${issues.length}건은 각 진도표의 배정 열을 확인하세요.`
          : `${this.settings.semester} 진도표 ${tables.length}개의 배정을 완료했습니다 · 변경 전 스냅숏 저장.`
      );
      await this.plugin.refreshAllViews();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "진도 배정에 실패했습니다.");
    }
  }

  async generateWeeklyPlan(weekStart?: string): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다. `학사일정 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const timetables: Record<string, BaseTimetable | null> = {
        "1학기": await this.repository.getBaseTimetable("1학기"),
        "2학기": await this.repository.getBaseTimetable("2학기")
      };
      if (!timetables["1학기"] && !timetables["2학기"]) {
        new Notice("기초시간표 노트가 필요합니다. `기초시간표 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const monday = weekStart ?? mondayOf(localDate());
      const days = [0, 1, 2, 3, 4].map((offset) => {
        const date = addDays(monday, offset);
        const semester = semesterForDate(calendar, date);
        return resolveDay(calendar, semester ? timetables[semester] ?? null : null, date);
      });
      const tablesBySemester: Record<string, ProgressTable[]> = {
        "1학기": await this.repository.getProgressTables("1학기"),
        "2학기": await this.repository.getProgressTables("2학기")
      };
      const contents = buildAssignedSlotContents(calendar, timetables, tablesBySemester);
      const weekSemester =
        days.map((day) => semesterForDate(calendar, day.date)).find(Boolean) ??
        this.settings.semester;
      const weekEnd = days[days.length - 1]?.date ?? monday;
      const notices = this.repository
        .getNoticeSummaries()
        .filter((notice) => notice.dueDate && notice.dueDate >= monday && notice.dueDate <= weekEnd)
        .map((notice) => `${notice.title} — 회신 마감 ${notice.dueDate}`);
      const morningActivities = (await this.repository.getRoutineTemplates())
        .filter((template) => template.frequency === "daily")
        .map((template) => template.title);
      const markdown = buildWeeklyPlanMarkdown({
        className: this.settings.className,
        schoolYear: this.settings.schoolYear,
        semester: weekSemester,
        weekStart: monday,
        weekEnd,
        days: buildWeeklyPlanDays(days, (date, period) => contents.get(`${date}|${period}`)),
        notices,
        morningActivities
      });
      const file = await this.repository.createWeeklyPlanNote(monday, markdown);
      new Notice(`${monday} 주간학습안내를 생성했습니다.`);
      await this.plugin.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "주간학습안내 생성에 실패했습니다.");
    }
  }

  /** 단원 연계 과제를 그 날짜에 배정된 해당 과목 진도표 행의 과제(평가) 칸에 링크한다. */
  async linkAssignmentToProgress(
    date: string,
    title: string,
    unitLink: CurriculumUnitLink | null,
    file: TFile
  ): Promise<void> {
    if (!unitLink || !date) return;
    try {
      const unit = this.repository.getCurriculumUnits().find((item) => item.id === unitLink.id);
      if (!unit) return;
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) return;
      const semester = semesterForDate(calendar, date);
      if (!semester) return;
      const tables = await this.repository.getProgressTables(semester);
      const table = tables.find((item) => item.subject === unit.subject);
      if (!table) return;
      const link = `[[${file.path.replace(/\.md$/i, "")}|${title}]]`;
      for (const row of table.rows) {
        if (!row.assigned.includes(date)) continue;
        await this.repository.appendProgressRowLink(table, row.order, "assignmentLink", link);
      }
    } catch {
      // 진도표 기입 실패는 과제 저장을 막지 않는다.
    }
  }

  /** 이 교시의 학생부 근거 기록 흐름 — 학생 선택 후 날짜·단원·수업일지가 채워진 모달을 연다. */
  async recordEvidenceAt(date: string, period: number): Promise<void> {
    try {
      const students = this.repository.getStudents();
      if (!students.length) {
        new Notice("먼저 학생을 추가해 주세요.");
        return;
      }
      const lesson = this.findLessonAt(date, period);
      const calendar = await this.repository.getAcademicCalendar();
      const semester = calendar ? semesterForDate(calendar, date) : "";
      const timetable = semester ? await this.repository.getBaseTimetable(semester) : null;
      const resolved = calendar && timetable
        ? resolveDay(calendar, timetable, date).periods.find((item) => item.period === period)
        : undefined;
      const subject = resolved?.subject.trim() ?? lesson?.subject ?? "";
      const units = this.repository.getCurriculumUnits();
      const unit =
        units.find((item) => item.id === lesson?.unitId) ??
        (() => {
          const candidates = units.filter((item) =>
            item.subject === subject &&
            item.startDate && item.endDate && item.startDate <= date && date <= item.endDate
          );
          return candidates.length === 1 ? candidates[0] : undefined;
        })();
      new StudentSuggestModal(
        this.app,
        students,
        (student) => this.plugin.openSchoolRecordEvidenceModal(
          student,
          date,
          "subject-development",
          unit,
          lesson
        ),
        `${date} ${period}교시${subject ? `(${subject})` : ""} 근거를 기록할 학생을 검색하세요`
      ).open();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "근거 기록을 열지 못했습니다.");
    }
  }

  /** 수업일지를 날짜·교시로 찾는다 (교시 문자열은 "3교시" 형태에서 숫자만 비교). */
  findLessonAt(date: string, period: number): CurriculumLesson | undefined {
    return this.repository.getCurriculumLessons().find(
      (lesson) =>
        lesson.date === date && Number.parseInt(lesson.period, 10) === period
    );
  }

  /**
   * 이 교시의 수업 기록(허브 노트)을 연다 — 있으면 노트를 열고,
   * 없으면 진도 맥락을 미리 채운 수업 기록 모달을 연다. 단원 연계는 선택.
   */
  async recordLessonAt(date: string, period: number): Promise<void> {
    try {
      const existing = this.findLessonAt(date, period);
      if (existing) {
        await this.plugin.openFile(existing.file);
        return;
      }
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다.");
        return;
      }
      const semester = semesterForDate(calendar, date);
      const timetable = semester ? await this.repository.getBaseTimetable(semester) : null;
      if (!semester || !timetable) {
        new Notice("해당 날짜 학기의 기초시간표가 필요합니다.");
        return;
      }
      const day = resolveDay(calendar, timetable, date);
      const resolved = day.periods.find((item) => item.period === period);
      const subject = resolved?.subject.trim() ?? "";
      if (!subject) {
        new Notice("이 교시에는 과목이 없습니다.");
        return;
      }
      const tables = await this.repository.getProgressTables(semester);
      const table = tables.find((item) => item.subject === subject);
      const contents = buildAssignedSlotContents(
        calendar,
        { [semester]: timetable },
        { [semester]: tables }
      );
      const row = contents.get(`${date}|${period}`);

      // 과목·기간이 맞는 단원이 하나로 좁혀지면 미리 연결해 준다(모달에서 바꿀 수 있음).
      const candidates = this.repository
        .getCurriculumUnits()
        .filter((unit) => unit.subject === subject);
      const dated = candidates.filter(
        (unit) => unit.startDate && unit.endDate && unit.startDate <= date && date <= unit.endDate
      );
      const preselect = dated.length === 1
        ? dated[0]
        : candidates.length === 1
          ? candidates[0]
          : null;

      this.plugin.openCurriculumLessonModal(preselect ?? null, undefined, {
        prefill: {
          date,
          period: `${period}교시`,
          subject,
          hours: row?.hours ?? 1,
          objective: row?.topic ?? "",
          activities: row ? [row.unit, row.topic].filter(Boolean).join(" · ") : ""
        },
        afterCreate: async (created) => {
          if (table && row) {
            await this.repository.appendProgressRowLink(
              table,
              row.order,
              "note",
              `[[${created.file.path.replace(/\.md$/i, "")}|수업일지]]`
            );
          }
        }
      });
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "수업일지를 열지 못했습니다.");
    }
  }

  async createBasesViews(): Promise<void> {
    try {
      const created = await this.repository.ensureBasesViews();
      new Notice(
        created.length > 0
          ? `Bases 보기 ${created.length}개를 만들었습니다: ${created.join(", ")}`
          : "Bases 보기가 이미 모두 있습니다."
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Bases 보기 생성에 실패했습니다.");
    }
  }

  async createAllEventNotes(): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다.");
        return;
      }
      const created = await this.repository.ensureAllEventNotes(calendar.events);
      new Notice(
        created.length > 0
          ? `행사 노트 ${created.length}개를 만들었습니다. (전체 ${calendar.events.length}개)`
          : `행사 노트가 이미 모두 있습니다. (${calendar.events.length}개)`
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "행사 노트 생성에 실패했습니다.");
    }
  }

  /** 실행 완료 수업일지 합계로 단원의 실시 시수(taughtHours)를 갱신한다 — 단원 노트 1개만 쓴다. */
  async refreshUnitProgress(unitId: string): Promise<void> {
    if (!unitId) return;
    try {
      const unit = this.repository.getCurriculumUnits().find((item) => item.id === unitId);
      if (!unit) return;
      const total = taughtHoursForUnit(unitId, this.repository.getCurriculumLessons());
      await this.app.fileManager.processFrontMatter(unit.file, (frontmatter) => {
        frontmatter.taughtHours = total;
      });
    } catch {
      // 진행률 갱신 실패는 수업일지 저장을 막지 않는다.
    }
  }

  /**
   * 어제 이전의 수업일지·행사 노트에 recordStatus: raw를 스탬프한다(§6 원칙 3).
   * 한 번 raw가 되면 플러그인은 다시 쓰지 않는다 — 과거는 불변. 교사 편집은 자유.
   * (R1 결정 2026-07-24: 행사는 경과 후 raw 대상, 과제는 학기 내 계속 갱신되는 확인표라 제외)
   */
  async stampRawLessonRecords(): Promise<void> {
    try {
      const today = localDate();
      const lessons = this.repository
        .getCurriculumLessons()
        .filter((lesson) => lesson.date && lesson.date < today && !lesson.recordStatus);
      for (const lesson of lessons) {
        await this.app.fileManager.processFrontMatter(lesson.file, (frontmatter) => {
          if (!frontmatter.recordStatus) frontmatter.recordStatus = "raw";
        });
      }
      const events = this.repository
        .getSchoolEventNotes()
        .filter((event) => event.date && event.date < today && !event.recordStatus);
      for (const event of events) {
        await this.app.fileManager.processFrontMatter(event.file, (frontmatter) => {
          if (!frontmatter.recordStatus) frontmatter.recordStatus = "raw";
        });
      }
      const parts = [
        lessons.length > 0 ? `수업일지 ${lessons.length}건` : "",
        events.length > 0 ? `행사 노트 ${events.length}건` : ""
      ].filter(Boolean);
      if (parts.length > 0) {
        new Notice(`지난 ${parts.join("·")}을 RAW로 확정했습니다.`);
      }
    } catch {
      // 스탬프 실패는 다음 로드에서 재시도된다.
    }
  }

  /**
   * 규칙 기반 할 일 자동 수집 — skills/task-scan 규칙표 7종의 플러그인 단독 경로.
   * sourceKey 멱등이라 스킬·자동·수동 어느 조합으로 반복 실행해도 중복 생성되지 않는다.
   */
  async scanOperationalTasks(auto = false): Promise<void> {
    try {
      const today = localDate();
      const repository = this.repository;

      const assignments = repository.getAssignmentSummaries().map((item) => ({
        fileName: item.file.basename,
        title: item.title,
        date: item.date
      }));

      const units = repository.getCurriculumUnits();
      const projects = units
        .filter((unit) => unit.conceptInquiryEnabled && unit.startDate)
        .map((unit) => ({
          fileName: unit.file.basename,
          title: unit.unitName,
          startDate: unit.startDate
        }));

      const calendar = await repository.getAcademicCalendar();
      const events = (calendar?.events ?? []).map((event) => ({
        date: event.date,
        name: event.name
      }));

      // 회신표 로드는 비용이 있어 마감 창(D-2)에 든 통신문만 연다.
      const notices: Array<{ fileName: string; title: string; dueDate: string; pendingCount: number }> = [];
      for (const summary of repository.getNoticeSummaries()) {
        if (!summary.dueDate || summary.dueDate < today || summary.dueDate > addDays(today, 2)) continue;
        const sheet = await repository.loadNotice(summary);
        notices.push({
          fileName: summary.file.basename,
          title: summary.title,
          dueDate: summary.dueDate,
          pendingCount: sheet.marks.filter((mark) => mark.status === "미회신").length
        });
      }

      // 시수 점검 — 시간표·시수 뷰와 같은 계산(기준·편성만, 상태 적정 아님 → 확인 할 일).
      const hoursIssues: Array<{ subject: string; statusLabel: string }> = [];
      if (calendar) {
        const standard = await repository.getHoursStandard();
        const semesterHours: Record<string, { planned: Record<string, number>; taught: Record<string, number> }> = {
          "1학기": { planned: {}, taught: {} },
          "2학기": { planned: {}, taught: {} }
        };
        for (const semester of ["1학기", "2학기"]) {
          const bucket = semesterHours[semester];
          const range = semesterRange(calendar, semester);
          if (!bucket || !range.from || !range.to) continue;
          const timetable = await repository.getBaseTimetable(semester);
          if (!timetable) continue;
          bucket.planned = plannedHoursBySubject(calendar, timetable, range.from, range.to);
        }
        const statusLabels: Record<string, string> = { over: "초과", under: "미달" };
        for (const row of buildHoursAudit(standard, semesterHours["1학기"], semesterHours["2학기"])) {
          if (row.kind !== "subject") continue;
          const label = statusLabels[row.status];
          if (label) hoursIssues.push({ subject: row.subject, statusLabel: label });
        }
      }

      const designIssues = units
        .filter((unit) => {
          if (!unit.startDate) return false;
          const running = unit.startDate <= today && (!unit.endDate || unit.endDate >= today);
          const upcoming = unit.startDate > today && unit.startDate <= addDays(today, 14);
          return running || upcoming;
        })
        .map((unit) => {
          const firstError = auditCurriculumAlignment(unit).issues.find(
            (issue) => issue.severity === "error"
          );
          return firstError
            ? {
                fileName: unit.file.basename,
                title: unit.unitName,
                startDate: unit.startDate,
                firstError: firstError.message
              }
            : null;
        })
        .filter((issue): issue is NonNullable<typeof issue> => issue !== null);

      const scanned = scanOperationalTasks({
        today,
        assignments,
        projects,
        events,
        notices,
        hoursIssues,
        designIssues,
        lastBackupDate: repository.lastBackupDate(),
        existingSourceKeys: repository.getTaskSourceKeys()
      });

      for (const task of scanned) {
        await repository.createTask(
          {
            title: task.title,
            status: "inbox",
            project: task.project,
            context: task.context,
            startDate: "",
            dueDate: task.dueDate,
            priority: "normal",
            recurrence: "none",
            studentNumber: "",
            studentName: "",
            detail: task.detail
          },
          { sourceKey: task.sourceKey }
        );
      }

      if (scanned.length > 0) {
        // 파일 생성이 볼트 변경 이벤트로 색인·뷰 갱신을 이미 유발한다 — 별도 갱신 불필요.
        new Notice(`할 일 ${scanned.length}건을 수집했습니다. — GTD 수집함`);
      } else if (!auto) {
        new Notice("새 할 일 없음 — 규칙에 해당하는 항목이 없습니다.");
      }
    } catch (error) {
      // 자동 실행 실패는 조용히 넘기고 다음 기회에 재시도한다(Notice 문형 §3).
      if (!auto) {
        new Notice(error instanceof Error ? error.message : "할 일을 수집하지 못했습니다.");
      }
    }
  }
}
