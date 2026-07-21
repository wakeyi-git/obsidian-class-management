import { App, TAbstractFile, TFile, TFolder } from "obsidian";
import { formatAttendanceTableRow, parseAttendanceMetadata } from "./attendance";
import { formatAssignmentTableRow, parseAssignmentTable } from "./assignment";
import { formatNoticeTableRow, parseNoticeTable } from "./notice";
import {
  parseRoutineInstanceItems,
  parseRoutineItems,
  routineRunsOn
} from "./routine";
import { nextRecurringDate } from "./task";
import {
  curriculumLessonMarkdown,
  curriculumUnitMarkdown,
  parseCurriculumLesson,
  parseCurriculumUnit
} from "./curriculum";
import {
  applySchoolRecordEvidenceToFrontmatter,
  parseSchoolRecordEvidence,
  schoolRecordEvidenceBody,
  schoolRecordEvidenceFrontmatter
} from "./school-record-evidence";
import { academicCalendarMarkdown, parseAcademicCalendar } from "./academic-calendar";
import { baseTimetableMarkdown, parseBaseTimetable } from "./timetable";
import { formatAssignedSlots, parseProgressTable, progressTableMarkdown } from "./progress";
import { hoursStandardMarkdown, parseHoursStandard } from "./hours-audit";
import type {
  AcademicCalendar,
  BaseTimetable,
  HoursStandard,
  ProgressAssignment,
  ProgressRow,
  ProgressTable
} from "./types";
import type {
  AttendanceMark,
  AssignmentMark,
  AssignmentSheet,
  AssignmentSummary,
  ClassManagementSettings,
  CurriculumLesson,
  CurriculumUnit,
  NewCurriculumLesson,
  NewCurriculumUnit,
  NewTask,
  NewRecord,
  NewStudent,
  NoticeMark,
  NoticeSheet,
  NoticeSummary,
  RecordEntry,
  RoutineFrequency,
  RoutineInstance,
  RoutineTemplate,
  RosterImportSummary,
  StudentEntry,
  StudentStatus,
  TaskEntry,
  TaskStatus
} from "./types";
import type { SchoolRecordEvidence, SchoolRecordReviewStatus } from "./types";
import {
  compareStudentNumber,
  joinVaultPath,
  localDate,
  localTimeForFile,
  safeFileSegment,
  yamlString
} from "./utils";

export class ClassRepository {
  constructor(
    private readonly app: App,
    private readonly getSettings: () => ClassManagementSettings
  ) {}

  get baseFolderPath(): string {
    return joinVaultPath(this.getSettings().baseFolder);
  }

  get studentsFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.studentsFolder);
  }

  get recordsFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.recordsFolder);
  }

  get attendanceFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.attendanceFolder);
  }

  get assignmentsFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.assignmentsFolder);
  }

  get tasksFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.tasksFolder);
  }

  get noticesFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.noticesFolder);
  }

  get routinesFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.routinesFolder);
  }

  get curriculumFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.curriculumFolder);
  }

  get curriculumUnitsFolderPath(): string {
    return joinVaultPath(this.curriculumFolderPath, "설계");
  }

  get curriculumLessonsFolderPath(): string {
    return joinVaultPath(this.curriculumFolderPath, "수업일지");
  }

  get academicCalendarFolderPath(): string {
    return joinVaultPath(this.curriculumFolderPath, "학사일정");
  }

  get timetableFolderPath(): string {
    return joinVaultPath(this.curriculumFolderPath, "시간표");
  }

  get progressFolderPath(): string {
    return joinVaultPath(this.curriculumFolderPath, "진도표");
  }

  get weeklyPlanFolderPath(): string {
    return joinVaultPath(this.curriculumFolderPath, "주간학습안내");
  }

  get routineTemplatesFolderPath(): string {
    return joinVaultPath(this.routinesFolderPath, "템플릿");
  }

  get routineInstancesFolderPath(): string {
    return joinVaultPath(this.routinesFolderPath, "실행");
  }

  get reportsFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.reportsFolder);
  }

  get aiOutputFolderPath(): string {
    return joinVaultPath(this.getSettings().aiOutputFolder);
  }

  get exportsFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.exportsFolder);
  }

  get backupsFolderPath(): string {
    const settings = this.getSettings();
    return joinVaultPath(settings.baseFolder, settings.backupsFolder);
  }

  async ensureWorkspace(): Promise<void> {
    await this.ensureFolder(this.baseFolderPath);
    await this.ensureFolder(this.studentsFolderPath);
    await this.ensureFolder(this.recordsFolderPath);
    await this.ensureFolder(this.attendanceFolderPath);
    await this.ensureFolder(this.assignmentsFolderPath);
    await this.ensureFolder(this.tasksFolderPath);
    await this.ensureFolder(this.noticesFolderPath);
    await this.ensureFolder(this.routineTemplatesFolderPath);
    await this.ensureFolder(this.routineInstancesFolderPath);
    await this.ensureFolder(this.curriculumUnitsFolderPath);
    await this.ensureFolder(this.curriculumLessonsFolderPath);
    await this.ensureFolder(this.reportsFolderPath);
    await this.ensureFolder(this.exportsFolderPath);
    await this.ensureHomeNote();
  }

  async createStudent(input: NewStudent): Promise<StudentEntry> {
    this.assertWritableClass();
    await this.ensureWorkspace();

    const name = input.name.trim();
    const number = input.number.trim();
    if (this.getStudents().some((student) => student.number === number)) {
      throw new Error(`${number}번 학생이 이미 있습니다.`);
    }

    const paddedNumber = /^\d+$/.test(number) ? number.padStart(2, "0") : number;
    const fileName = safeFileSegment(`${paddedNumber} ${name}`);
    const path = joinVaultPath(this.studentsFolderPath, `${fileName}.md`);

    if (this.app.vault.getAbstractFileByPath(path)) {
      throw new Error(`${number}번 ${name} 학생 노트가 이미 있습니다.`);
    }

    const settings = this.getSettings();
    const content = [
      "---",
      "class-management: student",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      `studentName: ${yamlString(name)}`,
      `studentNumber: ${yamlString(number)}`,
      "studentStatus: active",
      `created: ${localDate()}`,
      "tags:",
      "  - class-management/student",
      "---",
      "",
      `# ${number}번 ${name}`,
      "",
      "## 기본 정보",
      "",
      "- 보호자 연락처:",
      "- 특이사항:",
      "",
      "## 메모",
      ""
    ].join("\n");

    const file = await this.app.vault.create(path, content);
    return { file, name, number, status: "active" };
  }

  async createRecord(student: StudentEntry, input: NewRecord): Promise<RecordEntry> {
    this.assertWritableClass();
    await this.ensureWorkspace();

    const now = new Date();
    const typeSegment = safeFileSegment(input.recordType);
    const studentSegment = safeFileSegment(`${student.number} ${student.name}`);
    const baseName = `${input.date} ${localTimeForFile(now)} ${studentSegment} ${typeSegment}`;
    const path = this.availableMarkdownPath(this.recordsFolderPath, baseName);
    const settings = this.getSettings();
    const studentLink = student.file.path.replace(/\.md$/i, "");
    const body = input.content.trim();
    const evidenceFrontmatter = input.schoolRecordEvidence
      ? schoolRecordEvidenceFrontmatter(input.schoolRecordEvidence)
      : [];
    const evidenceBody = input.schoolRecordEvidence
      ? schoolRecordEvidenceBody(input.schoolRecordEvidence)
      : [];
    const content = [
      "---",
      "class-management: record",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      `studentName: ${yamlString(student.name)}`,
      `studentNumber: ${yamlString(student.number)}`,
      `studentPath: ${yamlString(`[[${studentLink}]]`)}`,
      `recordType: ${yamlString(input.recordType)}`,
      `date: ${yamlString(input.date)}`,
      ...evidenceFrontmatter,
      "tags:",
      "  - class-management/record",
      "---",
      "",
      `# ${input.date} · ${student.number}번 ${student.name} · ${input.recordType}`,
      "",
      `- 학생: [[${studentLink}|${student.number}번 ${student.name}]]`,
      `- 분류: ${input.recordType}`,
      `- 기록일: ${input.date}`,
      "",
      ...evidenceBody,
      "## 내용",
      "",
      body,
      ""
    ].join("\n");

    const file = await this.app.vault.create(path, content);
    return {
      file,
      studentName: student.name,
      studentNumber: student.number,
      recordType: input.recordType,
      date: input.date,
      schoolRecordEvidence: input.schoolRecordEvidence
    };
  }

  async updateRecordSchoolRecordEvidence(
    file: TFile,
    evidence: SchoolRecordEvidence
  ): Promise<void> {
    this.assertWritableClass();
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      applySchoolRecordEvidenceToFrontmatter(
        frontmatter as Record<string, unknown>,
        evidence
      );
    });
    await this.app.vault.process(file, (current) => {
      const heading = "## 학교생활기록부 근거 정보";
      if (current.includes(heading)) return current;
      const block = schoolRecordEvidenceBody(evidence).join("\n");
      if (/^## 내용\s*$/m.test(current)) {
        return current.replace(/^## 내용\s*$/m, `${block}\n## 내용`);
      }
      return `${current.trimEnd()}\n\n${block}\n`;
    });
  }

  async updateSchoolRecordEvidenceReviewStatus(
    file: TFile,
    status: SchoolRecordReviewStatus
  ): Promise<void> {
    this.assertWritableClass();
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      if (frontmatter.recordPurpose !== "school-record-evidence" && !frontmatter.schoolRecordArea) {
        throw new Error("구조화된 학교생활기록부 근거 기록이 아닙니다.");
      }
      frontmatter.reviewStatus = status;
    });
  }

  async createCurriculumUnit(input: NewCurriculumUnit): Promise<CurriculumUnit> {
    this.assertWritableClass();
    await this.ensureWorkspace();
    const baseName = `${input.subject} ${input.unitName}`;
    const path = this.availableMarkdownPath(this.curriculumUnitsFolderPath, baseName);
    const file = await this.app.vault.create(
      path,
      curriculumUnitMarkdown(input, this.getSettings())
    );
    return { ...input, file, createdAt: file.stat.ctime };
  }

  async updateCurriculumUnit(file: TFile, input: NewCurriculumUnit): Promise<CurriculumUnit> {
    this.assertWritableClass();
    await this.app.vault.modify(file, curriculumUnitMarkdown(input, this.getSettings()));
    return { ...input, file, createdAt: file.stat.ctime };
  }

  getCurriculumUnits(): CurriculumUnit[] {
    return this.markdownFilesIn(this.curriculumUnitsFolderPath)
      .map((file) => parseCurriculumUnit(
        file,
        this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined
      ))
      .filter((unit): unit is CurriculumUnit => unit !== null)
      .sort((a, b) =>
        a.startDate.localeCompare(b.startDate) ||
        a.subject.localeCompare(b.subject, "ko") ||
        a.unitName.localeCompare(b.unitName, "ko")
      );
  }

  async createCurriculumLesson(input: NewCurriculumLesson): Promise<CurriculumLesson> {
    this.assertWritableClass();
    await this.ensureWorkspace();
    const baseName = `${input.date || "날짜 미정"} ${input.subject} ${input.sequence}차시 ${input.unitTitle}`;
    const path = this.availableMarkdownPath(this.curriculumLessonsFolderPath, baseName);
    const file = await this.app.vault.create(
      path,
      curriculumLessonMarkdown(input, this.getSettings())
    );
    return { ...input, file, createdAt: file.stat.ctime };
  }

  async updateCurriculumLesson(file: TFile, input: NewCurriculumLesson): Promise<CurriculumLesson> {
    this.assertWritableClass();
    await this.app.vault.modify(file, curriculumLessonMarkdown(input, this.getSettings()));
    return { ...input, file, createdAt: file.stat.ctime };
  }

  getCurriculumLessons(): CurriculumLesson[] {
    return this.markdownFilesIn(this.curriculumLessonsFolderPath)
      .map((file) => parseCurriculumLesson(
        file,
        this.app.metadataCache.getFileCache(file)?.frontmatter as Record<string, unknown> | undefined
      ))
      .filter((lesson): lesson is CurriculumLesson => lesson !== null)
      .sort((a, b) =>
        a.date.localeCompare(b.date) || a.sequence - b.sequence || a.createdAt - b.createdAt
      );
  }

  async importStudents(students: NewStudent[]): Promise<RosterImportSummary> {
    await this.ensureWorkspace();

    const summary: RosterImportSummary = {
      created: [],
      skipped: [],
      failed: []
    };
    const existingNumbers = new Set(
      this.getStudents().map((student) => student.number.toLocaleLowerCase("ko"))
    );

    for (const student of students) {
      const numberKey = student.number.toLocaleLowerCase("ko");
      if (existingNumbers.has(numberKey)) {
        summary.skipped.push({
          student,
          reason: `${student.number}번 학생이 이미 있습니다.`
        });
        continue;
      }

      try {
        const created = await this.createStudent(student);
        summary.created.push(created);
        existingNumbers.add(numberKey);
      } catch (error) {
        summary.failed.push({
          student,
          reason: error instanceof Error ? error.message : "학생 노트를 만들지 못했습니다."
        });
      }
    }

    return summary;
  }

  async getAttendance(date: string): Promise<AttendanceMark[]> {
    const path = this.attendanceFilePath(date);
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) return [];

    const content = await this.app.vault.cachedRead(file);
    return parseAttendanceMetadata(content);
  }

  getAttendanceSummaries(): Array<{ file: TFile; date: string }> {
    return this.markdownFilesIn(this.attendanceFolderPath)
      .map((file): { file: TFile; date: string } | null => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        const metadataDate = frontmatter?.["class-management"] === "attendance"
          ? String(frontmatter.date ?? "")
          : "";
        const fallbackDate = file.basename.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ?? "";
        const date = metadataDate || fallbackDate;
        return date ? { file, date } : null;
      })
      .filter((summary): summary is { file: TFile; date: string } => summary !== null)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  parseAttendanceContent(content: string): AttendanceMark[] {
    return parseAttendanceMetadata(content);
  }

  async saveAttendance(date: string, marks: AttendanceMark[]): Promise<TFile> {
    this.assertWritableClass();
    await this.ensureWorkspace();

    const path = this.attendanceFilePath(date);
    const studentsByNumber = new Map(
      this.getStudents().map((student) => [student.number, student] as const)
    );
    const rows = marks.map((mark) => {
      const student = studentsByNumber.get(mark.studentNumber);
      return formatAttendanceTableRow(mark, student?.file.path);
    });
    const settings = this.getSettings();
    const content = [
      "---",
      "class-management: attendance",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      `date: ${yamlString(date)}`,
      "tags:",
      "  - class-management/attendance",
      "---",
      "",
      `# ${date} 출결`,
      "",
      "| 번호 | 학생 | 상태 | 사유 |",
      "| ---: | --- | --- | --- |",
      ...rows,
      ""
    ].join("\n");
    const existing = this.app.vault.getAbstractFileByPath(path);

    if (existing instanceof TFile) {
      await this.app.vault.process(existing, () => content);
      return existing;
    }

    return this.app.vault.create(path, content);
  }

  getAssignmentSummaries(): AssignmentSummary[] {
    return this.markdownFilesIn(this.assignmentsFolderPath)
      .map((file): AssignmentSummary | null => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.["class-management"] === "assignment") {
          return {
            file,
            title: String(frontmatter.assignmentTitle ?? file.basename),
            date: String(frontmatter.date ?? "")
          };
        }

        const fallback = file.basename.match(/^(\d{4}-\d{2}-\d{2})\s+(.+)$/);
        if (!fallback?.[1] || !fallback[2]) return null;
        return { file, date: fallback[1], title: fallback[2] };
      })
      .filter((summary): summary is AssignmentSummary => summary !== null)
      .sort((a, b) => b.date.localeCompare(a.date) || b.file.stat.ctime - a.file.stat.ctime);
  }

  async loadAssignment(summary: AssignmentSummary): Promise<AssignmentSheet> {
    const content = await this.app.vault.cachedRead(summary.file);
    return { ...summary, marks: parseAssignmentTable(content) };
  }

  async saveAssignment(
    date: string,
    title: string,
    marks: AssignmentMark[],
    existingFile?: TFile
  ): Promise<TFile> {
    this.assertWritableClass();
    await this.ensureWorkspace();

    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("과제명을 입력해 주세요.");
    const safeTitle = safeFileSegment(cleanTitle);
    if (!safeTitle) throw new Error("파일 이름으로 사용할 수 있는 과제명을 입력해 주세요.");
    const path = joinVaultPath(
      this.assignmentsFolderPath,
      `${safeFileSegment(date)} ${safeTitle}.md`
    );
    const target = existingFile ?? this.app.vault.getAbstractFileByPath(path);
    if (!existingFile && target instanceof TFile) {
      throw new Error("같은 날짜와 이름의 과제가 이미 있습니다.");
    }

    const studentsByNumber = new Map(
      this.getStudents().map((student) => [student.number, student] as const)
    );
    const rows = marks.map((mark) => {
      const student = studentsByNumber.get(mark.studentNumber);
      return formatAssignmentTableRow(mark, student?.file.path);
    });
    const settings = this.getSettings();
    const content = [
      "---",
      "class-management: assignment",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      `assignmentTitle: ${yamlString(cleanTitle)}`,
      `date: ${yamlString(date)}`,
      "tags:",
      "  - class-management/assignment",
      "---",
      "",
      `# ${date} · ${cleanTitle}`,
      "",
      "| 번호 | 학생 | 상태 | 메모 |",
      "| ---: | --- | --- | --- |",
      ...rows,
      ""
    ].join("\n");

    if (existingFile) {
      await this.app.vault.process(existingFile, () => content);
      return existingFile;
    }

    return this.app.vault.create(path, content);
  }

  getTasks(): TaskEntry[] {
    return this.markdownFilesIn(this.tasksFolderPath)
      .map((file): TaskEntry | null => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.["class-management"] !== "task") return null;
        const status = String(frontmatter.taskStatus ?? "inbox");
        if (!isTaskStatus(status)) return null;
        const priority = String(frontmatter.priority ?? "");
        return {
          file,
          title: String(frontmatter.taskTitle ?? file.basename),
          status,
          project: String(frontmatter.project ?? ""),
          context: String(frontmatter.context ?? ""),
          startDate: String(frontmatter.startDate ?? ""),
          dueDate: String(frontmatter.dueDate ?? ""),
          priority: isTaskPriority(priority) ? priority : "",
          recurrence: isTaskRecurrence(String(frontmatter.recurrence ?? "none"))
            ? String(frontmatter.recurrence ?? "none") as TaskEntry["recurrence"]
            : "none",
          studentNumber: String(frontmatter.studentNumber ?? ""),
          studentName: String(frontmatter.studentName ?? ""),
          detail: "",
          createdAt: file.stat.ctime
        };
      })
      .filter((task): task is TaskEntry => task !== null)
      .sort((a, b) => {
        if (a.status === "done" && b.status !== "done") return 1;
        if (a.status !== "done" && b.status === "done") return -1;
        return (a.dueDate || "9999").localeCompare(b.dueDate || "9999") ||
          b.createdAt - a.createdAt;
      });
  }

  async createTask(task: NewTask): Promise<TFile> {
    this.assertWritableClass();
    await this.ensureWorkspace();
    const title = task.title.trim();
    if (!title) throw new Error("할 일 제목을 입력해 주세요.");
    const settings = this.getSettings();
    const baseName = `${localDate()} ${localTimeForFile()} ${safeFileSegment(title)}`;
    const path = this.availableMarkdownPath(this.tasksFolderPath, baseName);
    const content = [
      "---",
      "class-management: task",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      `taskTitle: ${yamlString(title)}`,
      `taskStatus: ${yamlString(task.status)}`,
      `project: ${yamlString(task.project)}`,
      `context: ${yamlString(task.context)}`,
      `startDate: ${yamlString(task.startDate)}`,
      `dueDate: ${yamlString(task.dueDate)}`,
      `priority: ${yamlString(task.priority)}`,
      `recurrence: ${yamlString(task.recurrence)}`,
      `studentNumber: ${yamlString(task.studentNumber)}`,
      `studentName: ${yamlString(task.studentName)}`,
      `created: ${localDate()}`,
      "tags:",
      "  - class-management/task",
      "---",
      "",
      `# ${title}`,
      "",
      task.detail.trim(),
      ""
    ].join("\n");
    return this.app.vault.create(path, content);
  }

  async updateTaskStatus(file: TFile, status: TaskStatus): Promise<void> {
    this.assertWritableClass();
    const task = this.getTasks().find((entry) => entry.file.path === file.path);
    await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
      frontmatter.taskStatus = status;
      if (status === "done") frontmatter.completed = localDate();
      else delete frontmatter.completed;
    });
    if (status === "done" && task && task.recurrence !== "none") {
      const content = await this.app.vault.cachedRead(file);
      const detail = content.replace(/^---[\s\S]*?---\s*/m, "").replace(/^#.*$/m, "").trim();
      const basis = task.dueDate || task.startDate || localDate();
      const nextDate = nextRecurringDate(basis, task.recurrence);
      await this.createTask({
        ...task,
        status: "next",
        startDate: task.startDate ? nextDate : "",
        dueDate: task.dueDate ? nextDate : "",
        detail
      });
    }
  }

  getNoticeSummaries(): NoticeSummary[] {
    return this.markdownFilesIn(this.noticesFolderPath)
      .map((file): NoticeSummary | null => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.["class-management"] !== "notice") return null;
        return {
          file,
          title: String(frontmatter.noticeTitle ?? file.basename),
          sentDate: String(frontmatter.sentDate ?? ""),
          dueDate: String(frontmatter.dueDate ?? "")
        };
      })
      .filter((notice): notice is NoticeSummary => notice !== null)
      .sort((a, b) => b.dueDate.localeCompare(a.dueDate));
  }

  async loadNotice(summary: NoticeSummary): Promise<NoticeSheet> {
    const content = await this.app.vault.cachedRead(summary.file);
    return { ...summary, marks: parseNoticeTable(content) };
  }

  async saveNotice(
    sentDate: string,
    dueDate: string,
    title: string,
    marks: NoticeMark[],
    existingFile?: TFile
  ): Promise<TFile> {
    this.assertWritableClass();
    await this.ensureWorkspace();
    const cleanTitle = title.trim();
    if (!cleanTitle) throw new Error("가정통신문 제목을 입력해 주세요.");
    const path = joinVaultPath(
      this.noticesFolderPath,
      `${safeFileSegment(sentDate)} ${safeFileSegment(cleanTitle)}.md`
    );
    if (!existingFile && this.app.vault.getAbstractFileByPath(path)) {
      throw new Error("같은 발송일과 제목의 가정통신문이 이미 있습니다.");
    }
    const students = new Map(
      this.getStudents().map((student) => [student.number, student] as const)
    );
    const rows = marks.map((mark) =>
      formatNoticeTableRow(mark, students.get(mark.studentNumber)?.file.path)
    );
    const settings = this.getSettings();
    const content = [
      "---",
      "class-management: notice",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      `noticeTitle: ${yamlString(cleanTitle)}`,
      `sentDate: ${yamlString(sentDate)}`,
      `dueDate: ${yamlString(dueDate)}`,
      "tags:",
      "  - class-management/notice",
      "---",
      "",
      `# ${cleanTitle}`,
      "",
      `- 발송일: ${sentDate}`,
      `- 회신 마감일: ${dueDate}`,
      "",
      "| 번호 | 학생 | 상태 | 회신일 | 메모 |",
      "| ---: | --- | --- | --- | --- |",
      ...rows,
      ""
    ].join("\n");
    if (existingFile) {
      await this.app.vault.process(existingFile, () => content);
      return existingFile;
    }
    return this.app.vault.create(path, content);
  }

  async getRoutineTemplates(): Promise<RoutineTemplate[]> {
    const files = this.markdownFilesIn(this.routineTemplatesFolderPath);
    const templates = await Promise.all(
      files.map(async (file): Promise<RoutineTemplate | null> => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.["class-management"] !== "routine-template") return null;
        const frequency = String(frontmatter.frequency ?? "daily");
        if (!isRoutineFrequency(frequency)) return null;
        const content = await this.app.vault.cachedRead(file);
        return {
          file,
          title: String(frontmatter.routineTitle ?? file.basename),
          frequency,
          weekday: Number(frontmatter.weekday ?? 1),
          monthDay: Number(frontmatter.monthDay ?? 1),
          items: parseRoutineItems(content)
        };
      })
    );
    return templates.filter((template): template is RoutineTemplate => template !== null);
  }

  async createRoutineTemplate(input: {
    title: string;
    frequency: RoutineFrequency;
    weekday: number;
    monthDay: number;
    items: string[];
  }): Promise<TFile> {
    this.assertWritableClass();
    await this.ensureWorkspace();
    const title = input.title.trim();
    if (!title || input.items.length === 0) {
      throw new Error("루틴 이름과 한 개 이상의 항목을 입력해 주세요.");
    }
    const path = joinVaultPath(this.routineTemplatesFolderPath, `${safeFileSegment(title)}.md`);
    if (this.app.vault.getAbstractFileByPath(path)) {
      throw new Error("같은 이름의 루틴이 이미 있습니다.");
    }
    const settings = this.getSettings();
    const content = [
      "---",
      "class-management: routine-template",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      `routineTitle: ${yamlString(title)}`,
      `frequency: ${yamlString(input.frequency)}`,
      `weekday: ${input.weekday}`,
      `monthDay: ${input.monthDay}`,
      "tags:",
      "  - class-management/routine-template",
      "---",
      "",
      `# ${title}`,
      "",
      ...input.items.map((item) => `- [ ] ${item.trim()}`),
      ""
    ].join("\n");
    return this.app.vault.create(path, content);
  }

  async createDefaultRoutines(): Promise<number> {
    const defaults = [
      { title: "아침 준비", items: ["출석 확인", "알림장과 준비물 확인"] },
      { title: "하루 마무리", items: ["교실 정리", "내일 일정 확인"] },
      { title: "주간 기록 검토", items: ["미작성 학생 기록 확인", "다음 주 주요 일정 확인"], frequency: "weekly" as const }
    ];
    let created = 0;
    for (const routine of defaults) {
      try {
        await this.createRoutineTemplate({
          title: routine.title,
          items: routine.items,
          frequency: routine.frequency ?? "daily",
          weekday: 5,
          monthDay: 1
        });
        created += 1;
      } catch {
        // Existing defaults are intentionally skipped.
      }
    }
    return created;
  }

  async ensureRoutineInstance(date: string): Promise<RoutineInstance | null> {
    await this.ensureWorkspace();
    const path = joinVaultPath(this.routineInstancesFolderPath, `${date} 루틴.md`);
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return this.loadRoutineInstance(existing, date);

    this.assertWritableClass();

    const dateObject = new Date(`${date}T00:00:00`);
    const templates = (await this.getRoutineTemplates()).filter((template) =>
      routineRunsOn(template, dateObject)
    );
    const lines = templates.flatMap((template) =>
      template.items.map((item) => `- [ ] [${template.title}] ${item}`)
    );
    if (lines.length === 0) return null;
    const settings = this.getSettings();
    const content = [
      "---",
      "class-management: routine-instance",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      `date: ${yamlString(date)}`,
      "tags:",
      "  - class-management/routine",
      "---",
      "",
      `# ${date} 루틴`,
      "",
      ...lines,
      ""
    ].join("\n");
    const file = await this.app.vault.create(path, content);
    return this.loadRoutineInstance(file, date);
  }

  async loadRoutineInstance(file: TFile, date: string): Promise<RoutineInstance> {
    const content = await this.app.vault.cachedRead(file);
    return { file, date, items: parseRoutineInstanceItems(content) };
  }

  getRoutineInstanceSummaries(): Array<{ file: TFile; date: string }> {
    return this.markdownFilesIn(this.routineInstancesFolderPath)
      .map((file) => ({
        file,
        date: String(
          this.app.metadataCache.getFileCache(file)?.frontmatter?.date ??
          file.basename.match(/^(\d{4}-\d{2}-\d{2})/)?.[1] ??
          ""
        )
      }))
      .filter((summary) => Boolean(summary.date));
  }

  async toggleRoutineItem(file: TFile, line: number, completed: boolean): Promise<void> {
    this.assertWritableClass();
    await this.app.vault.process(file, (content) => {
      const lines = content.split("\n");
      const current = lines[line];
      if (!current) return content;
      lines[line] = current.replace(/^(\s*-\s+\[)[ xX](\])/, `$1${completed ? "x" : " "}$2`);
      return lines.join("\n");
    });
  }

  async saveReport(
    title: string,
    content: string,
    extension: "md" | "csv" = "md"
  ): Promise<TFile> {
    await this.ensureWorkspace();
    const baseName = `${localDate()} ${safeFileSegment(title)}`;
    const path = this.availablePath(this.reportsFolderPath, baseName, extension);
    return this.app.vault.create(path, content);
  }

  async saveExport(
    title: string,
    content: string,
    extension: "md" | "csv" = "csv"
  ): Promise<TFile> {
    await this.ensureWorkspace();
    const path = this.availablePath(
      this.exportsFolderPath,
      `${localDate()} ${safeFileSegment(title)}`,
      extension
    );
    return this.app.vault.create(path, content);
  }

  getRetentionCandidates(cutoff: Date): TFile[] {
    const managedFolders = [
      this.recordsFolderPath,
      this.attendanceFolderPath,
      this.assignmentsFolderPath,
      this.tasksFolderPath,
      this.noticesFolderPath,
      this.routineInstancesFolderPath,
      this.curriculumLessonsFolderPath
    ];
    const cutoffTime = cutoff.getTime();
    return managedFolders
      .flatMap((folder) => this.markdownFilesIn(folder))
      .filter((file) => file.stat.mtime < cutoffTime)
      .sort((a, b) => a.stat.mtime - b.stat.mtime);
  }

  getStudents(includeInactive = false): StudentEntry[] {
    return this.markdownFilesIn(this.studentsFolderPath)
      .map((file) => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.["class-management"] !== "student") return null;

        const rawStatus = String(frontmatter.studentStatus ?? "active");
        return {
          file,
          name: String(frontmatter.studentName ?? file.basename),
          number: String(frontmatter.studentNumber ?? ""),
          status: isStudentStatus(rawStatus) ? rawStatus : "active"
        };
      })
      .filter((student): student is StudentEntry => student !== null)
      .filter((student) => includeInactive || student.status === "active")
      .sort((a, b) => compareStudentNumber(a.number, b.number));
  }

  async updateStudent(
    student: StudentEntry,
    input: { name: string; number: string; status: StudentStatus }
  ): Promise<StudentEntry> {
    this.assertWritableClass();
    const name = input.name.trim();
    const number = input.number.trim();
    if (!name || !number) throw new Error("학생 번호와 이름을 입력해 주세요.");
    const duplicate = this.getStudents(true).find(
      (entry) => entry.file.path !== student.file.path && entry.number === number
    );
    if (duplicate) throw new Error(`${number}번 학생이 이미 있습니다.`);
    await this.app.fileManager.processFrontMatter(student.file, (frontmatter) => {
      frontmatter.studentName = name;
      frontmatter.studentNumber = number;
      frontmatter.studentStatus = input.status;
      if (input.status === "transferred") frontmatter.transferred = localDate();
      else delete frontmatter.transferred;
    });
    const padded = /^\d+$/.test(number) ? number.padStart(2, "0") : number;
    const target = joinVaultPath(
      this.studentsFolderPath,
      `${safeFileSegment(`${padded} ${name}`)}.md`
    );
    if (target !== student.file.path) await this.app.fileManager.renameFile(student.file, target);
    return { file: student.file, name, number, status: input.status };
  }

  getRecords(): RecordEntry[] {
    return this.markdownFilesIn(this.recordsFolderPath)
      .map((file): RecordEntry | null => {
        const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
        if (frontmatter?.["class-management"] !== "record") return null;

        return {
          file,
          studentName: String(frontmatter.studentName ?? ""),
          studentNumber: String(frontmatter.studentNumber ?? ""),
          recordType: String(frontmatter.recordType ?? "기타"),
          date: String(frontmatter.date ?? ""),
          schoolRecordEvidence: parseSchoolRecordEvidence(frontmatter as Record<string, unknown>)
        };
      })
      .filter((record): record is RecordEntry => record !== null)
      .sort((a, b) => b.date.localeCompare(a.date) || b.file.stat.ctime - a.file.stat.ctime);
  }

  private async ensureFolder(path: string): Promise<void> {
    if (!path || this.app.vault.getAbstractFileByPath(path)) return;

    const parts = path.split("/");
    let current = "";
    for (const part of parts) {
      current = joinVaultPath(current, part);
      if (!this.app.vault.getAbstractFileByPath(current)) {
        await this.app.vault.createFolder(current);
      }
    }
  }

  private async ensureHomeNote(): Promise<void> {
    const settings = this.getSettings();
    const path = joinVaultPath(this.baseFolderPath, "학급 홈.md");
    if (this.app.vault.getAbstractFileByPath(path)) return;

    const content = [
      "---",
      "class-management: home",
      `class: ${yamlString(settings.className)}`,
      `schoolYear: ${yamlString(settings.schoolYear)}`,
      `semester: ${yamlString(settings.semester)}`,
      "tags:",
      "  - class-management",
      "---",
      "",
      `# ${settings.className}`,
      "",
      "> Classroom Manager 플러그인의 리본 아이콘이나 명령 팔레트에서 대시보드를 열 수 있습니다.",
      "",
      "## 운영 원칙",
      "",
      "- 학생에 관한 사실과 해석을 구분해 기록합니다.",
      "- 민감한 개인정보는 꼭 필요한 범위에서만 작성합니다.",
      "- 정기적으로 보관·삭제 기준을 점검합니다.",
      ""
    ].join("\n");

    await this.app.vault.create(path, content);
  }

  async getAcademicCalendar(): Promise<AcademicCalendar | null> {
    const file = await this.findScheduleNote(
      this.academicCalendarFolderPath,
      "academic-calendar",
      (frontmatter) => String(frontmatter.schoolYear ?? "") === this.getSettings().schoolYear
    );
    if (!file) return null;
    const frontmatter = this.app.metadataCache.getFileCache(file.file)?.frontmatter ?? {};
    return parseAcademicCalendar(file.file, frontmatter as Record<string, unknown>, file.content);
  }

  async getHoursStandard(): Promise<HoursStandard | null> {
    const file = await this.findScheduleNote(
      this.academicCalendarFolderPath,
      "hours-standard",
      (frontmatter) => String(frontmatter.schoolYear ?? "") === this.getSettings().schoolYear
    );
    if (!file) return null;
    const frontmatter = this.app.metadataCache.getFileCache(file.file)?.frontmatter ?? {};
    return parseHoursStandard(file.file, frontmatter as Record<string, unknown>, file.content);
  }

  async getBaseTimetable(semester: string): Promise<BaseTimetable | null> {
    const settings = this.getSettings();
    const file = await this.findScheduleNote(
      this.timetableFolderPath,
      "timetable",
      (frontmatter) =>
        String(frontmatter.schoolYear ?? "") === settings.schoolYear &&
        String(frontmatter.semester ?? "") === semester
    );
    if (!file) return null;
    const frontmatter = this.app.metadataCache.getFileCache(file.file)?.frontmatter ?? {};
    return parseBaseTimetable(file.file, frontmatter as Record<string, unknown>, file.content);
  }

  async getProgressTables(semester: string): Promise<ProgressTable[]> {
    const settings = this.getSettings();
    const tables: ProgressTable[] = [];
    for (const file of this.markdownFilesIn(this.progressFolderPath)) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontmatter?.["class-management"] !== "subject-progress") continue;
      if (String(frontmatter.schoolYear ?? "") !== settings.schoolYear) continue;
      if (String(frontmatter.semester ?? "") !== semester) continue;
      const content = await this.app.vault.cachedRead(file);
      tables.push(parseProgressTable(file, frontmatter as Record<string, unknown>, content));
    }
    return tables.sort((a, b) => a.subject.localeCompare(b.subject, "ko"));
  }

  private async findScheduleNote(
    folderPath: string,
    kind: string,
    matches: (frontmatter: Record<string, unknown>) => boolean
  ): Promise<{ file: TFile; content: string } | null> {
    let fallback: TFile | null = null;
    for (const file of this.markdownFilesIn(folderPath)) {
      const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatter;
      if (frontmatter?.["class-management"] !== kind) continue;
      if (matches(frontmatter as Record<string, unknown>)) {
        return { file, content: await this.app.vault.cachedRead(file) };
      }
      fallback = fallback ?? file;
    }
    if (!fallback) return null;
    return { file: fallback, content: await this.app.vault.cachedRead(fallback) };
  }

  async ensureAcademicCalendarNote(): Promise<TFile> {
    this.assertWritableClass();
    const settings = this.getSettings();
    await this.ensureFolder(this.academicCalendarFolderPath);
    const path = joinVaultPath(
      this.academicCalendarFolderPath,
      `${safeFileSegment(settings.schoolYear)} 학사일정.md`
    );
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    return this.app.vault.create(
      path,
      academicCalendarMarkdown(settings.schoolYear, settings.className)
    );
  }

  async ensureHoursStandardNote(): Promise<TFile> {
    this.assertWritableClass();
    const settings = this.getSettings();
    await this.ensureFolder(this.academicCalendarFolderPath);
    const path = joinVaultPath(
      this.academicCalendarFolderPath,
      `${safeFileSegment(settings.schoolYear)} 기준 시수.md`
    );
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    return this.app.vault.create(
      path,
      hoursStandardMarkdown(settings.schoolYear, settings.className, settings.schoolSubjects)
    );
  }

  async ensureBaseTimetableNote(semester: string): Promise<TFile> {
    this.assertWritableClass();
    const settings = this.getSettings();
    await this.ensureFolder(this.timetableFolderPath);
    const path = joinVaultPath(
      this.timetableFolderPath,
      `${safeFileSegment(settings.schoolYear)} ${safeFileSegment(semester)} 기초시간표.md`
    );
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    const calendar = await this.getAcademicCalendar();
    return this.app.vault.create(
      path,
      baseTimetableMarkdown(
        settings.schoolYear,
        semester,
        settings.className,
        calendar?.weekdayPeriods ?? [5, 6, 5, 6, 5]
      )
    );
  }

  async ensureProgressTableNote(subject: string, semester: string): Promise<TFile> {
    this.assertWritableClass();
    const settings = this.getSettings();
    await this.ensureFolder(this.progressFolderPath);
    const path = joinVaultPath(
      this.progressFolderPath,
      `${safeFileSegment(settings.schoolYear)} ${safeFileSegment(semester)} ${safeFileSegment(subject)} 진도표.md`
    );
    const existing = this.app.vault.getAbstractFileByPath(path);
    if (existing instanceof TFile) return existing;
    return this.app.vault.create(
      path,
      progressTableMarkdown(settings.schoolYear, semester, subject, settings.className, [])
    );
  }

  async appendProgressRows(table: ProgressTable, rows: ProgressRow[]): Promise<void> {
    this.assertWritableClass();
    const settings = this.getSettings();
    await this.app.vault.modify(
      table.file,
      progressTableMarkdown(table.schoolYear, table.semester, table.subject, settings.className, [
        ...table.rows,
        ...rows
      ])
    );
  }

  async writeProgressAssignments(
    table: ProgressTable,
    assignment: ProgressAssignment
  ): Promise<void> {
    this.assertWritableClass();
    const settings = this.getSettings();
    const rows = table.rows.map((row) => {
      const entry = assignment.rows.find((item) => item.row === row);
      if (!entry) return row;
      const assigned = formatAssignedSlots(entry.slots);
      return {
        ...row,
        assigned: entry.shortage > 0 ? `${assigned}${assigned ? " " : ""}(부족 ${entry.shortage})` : assigned
      };
    });
    await this.app.vault.modify(
      table.file,
      progressTableMarkdown(table.schoolYear, table.semester, table.subject, settings.className, rows)
    );
  }

  async createWeeklyPlanNote(weekStart: string, markdown: string): Promise<TFile> {
    this.assertWritableClass();
    await this.ensureFolder(this.weeklyPlanFolderPath);
    const path = this.availableMarkdownPath(
      this.weeklyPlanFolderPath,
      `${safeFileSegment(weekStart)} 주간학습안내`
    );
    return this.app.vault.create(path, markdown);
  }

  private markdownFilesIn(folderPath: string): TFile[] {
    const folder = this.app.vault.getAbstractFileByPath(folderPath);
    if (!(folder instanceof TFolder)) return [];

    const results: TFile[] = [];
    const visit = (entry: TAbstractFile): void => {
      if (entry instanceof TFile && entry.extension === "md") {
        results.push(entry);
      } else if (entry instanceof TFolder) {
        entry.children.forEach(visit);
      }
    };

    folder.children.forEach(visit);
    return results;
  }

  private availableMarkdownPath(folder: string, baseName: string): string {
    return this.availablePath(folder, baseName, "md");
  }

  private availablePath(folder: string, baseName: string, extension: string): string {
    let suffix = 1;
    let path = joinVaultPath(folder, `${baseName}.${extension}`);

    while (this.app.vault.getAbstractFileByPath(path)) {
      suffix += 1;
      path = joinVaultPath(folder, `${baseName} ${suffix}.${extension}`);
    }

    return path;
  }

  private attendanceFilePath(date: string): string {
    return joinVaultPath(this.attendanceFolderPath, `${safeFileSegment(date)} 출결.md`);
  }

  private assertWritableClass(): void {
    const settings = this.getSettings();
    const active = settings.classProfiles.find(
      (profile) => profile.id === settings.activeClassId
    );
    if (active?.archived) {
      throw new Error("보관된 학급은 읽기 전용입니다. 학급 보관을 해제한 뒤 수정해 주세요.");
    }
  }
}

function isTaskStatus(value: string): value is TaskStatus {
  return ["inbox", "next", "waiting", "someday", "done"].includes(value);
}

function isTaskPriority(value: string): value is TaskEntry["priority"] {
  return ["", "low", "normal", "high"].includes(value);
}

function isTaskRecurrence(value: string): value is TaskEntry["recurrence"] {
  return ["none", "daily", "weekly", "monthly"].includes(value);
}

function isRoutineFrequency(value: string): value is RoutineFrequency {
  return ["daily", "weekly", "monthly"].includes(value);
}

function isStudentStatus(value: string): value is StudentStatus {
  return ["active", "transferred", "graduated"].includes(value);
}
