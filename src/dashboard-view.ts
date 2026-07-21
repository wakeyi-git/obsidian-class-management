import { ItemView, WorkspaceLeaf } from "obsidian";
import type ClassManagementPlugin from "./main";
import type { AttendanceMark, RecordEntry, StudentEntry } from "./types";
import { localDate } from "./utils";

export const DASHBOARD_VIEW_TYPE = "class-management-dashboard";

export class ClassDashboardView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "학급 대시보드";
  }

  getIcon(): string {
    return "school";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("class-management-dashboard");

    const students = this.plugin.repository.getStudents();
    const records = this.plugin.repository.getRecords();
    const today = localDate();
    const attendance = await this.plugin.repository.getAttendance(today);

    this.renderHeader(container);
    this.renderSummary(container, students, records, attendance, today);

    const grid = container.createDiv({ cls: "class-management-grid" });
    this.renderStudents(grid, students);
    this.renderRecentRecords(grid, records);
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "class-management-header" });
    const heading = header.createDiv();
    heading.createEl("h2", { text: this.plugin.settings.className });
    heading.createEl("p", {
      text: `${this.plugin.settings.schoolYear} ${this.plugin.settings.semester} · ${this.plugin.settings.grade}학년 · 학생 기록과 학급 운영 업무를 한눈에 확인합니다.${this.plugin.activeClassProfile.archived ? " · 읽기 전용 보관" : ""}`
    });

    const actions = header.createDiv({ cls: "class-management-actions" });
    const listButton = actions.createEl("button", { text: "통합 목록" });
    listButton.addEventListener("click", () => void this.plugin.openActivityList());

    const calendarButton = actions.createEl("button", { text: "캘린더" });
    calendarButton.addEventListener("click", () => void this.plugin.openCalendar());

    const curriculumButton = actions.createEl("button", { text: "교육과정 일체화" });
    curriculumButton.addEventListener("click", () => void this.plugin.openCurriculum());

    const taskButton = actions.createEl("button", { text: "할 일" });
    taskButton.addEventListener("click", () => void this.plugin.openTasks());

    const noticeButton = actions.createEl("button", { text: "가정통신문" });
    noticeButton.addEventListener("click", () => this.plugin.openNoticeFlow());

    const routineButton = actions.createEl("button", { text: "루틴" });
    routineButton.addEventListener("click", () => void this.plugin.openRoutines());

    const reportButton = actions.createEl("button", { text: "분석·보고서" });
    reportButton.addEventListener("click", () => void this.plugin.openReports());

    const dataButton = actions.createEl("button", { text: "학급·데이터" });
    dataButton.addEventListener("click", () => void this.plugin.openDataManagement());

    const studentButton = actions.createEl("button", { text: "학생 추가" });
    studentButton.addEventListener("click", () => this.plugin.openStudentModal());

    const attendanceButton = actions.createEl("button", { text: "출결 체크" });
    attendanceButton.addEventListener("click", () => this.plugin.openAttendanceModal());

    const assignmentButton = actions.createEl("button", { text: "과제 체크" });
    assignmentButton.addEventListener("click", () => this.plugin.openAssignmentFlow());

    const recordButton = actions.createEl("button", {
      text: "빠른 기록",
      cls: "mod-cta"
    });
    recordButton.addEventListener("click", () => this.plugin.openRecordFlow());

    const schoolRecordButton = actions.createEl("button", { text: "학생부 근거" });
    schoolRecordButton.addEventListener("click", () => this.plugin.openSchoolRecordEvidenceFlow());

    const schoolRecordBatchButton = actions.createEl("button", { text: "학생부 일괄" });
    schoolRecordBatchButton.addEventListener("click", () => this.plugin.openSchoolRecordBatch());
  }

  private renderSummary(
    container: HTMLElement,
    students: StudentEntry[],
    records: RecordEntry[],
    attendance: AttendanceMark[],
    today: string
  ): void {
    const summary = container.createDiv({ cls: "class-management-summary" });
    const values = [
      ["학생", `${students.length}명`],
      [
        "오늘 출결",
        attendance.length > 0
          ? `${attendance.filter((mark) => mark.status === "출석").length}/${attendance.length}명`
          : "미체크"
      ],
      ["오늘 기록", `${records.filter((record) => record.date === today).length}건`],
      ["전체 기록", `${records.length}건`]
    ];

    values.forEach(([label, value]) => {
      const card = summary.createDiv({ cls: "class-management-summary-card" });
      card.createEl("span", { text: label ?? "" });
      card.createEl("strong", { text: value ?? "" });
    });
  }

  private renderStudents(container: HTMLElement, students: StudentEntry[]): void {
    const section = container.createDiv({ cls: "class-management-panel" });
    section.createEl("h3", { text: "학생 명단" });

    if (students.length === 0) {
      this.renderEmpty(section, "아직 등록한 학생이 없습니다.", "첫 학생 추가", () =>
        this.plugin.openStudentModal()
      );
      return;
    }

    const list = section.createDiv({ cls: "class-management-student-list" });
    students.forEach((student) => {
      const row = list.createDiv({ cls: "class-management-student-row" });
      const note = row.createEl("button", { cls: "class-management-student-note" });
      note.createEl("span", {
        text: student.number,
        cls: "class-management-student-number"
      });
      note.createEl("span", { text: student.name });
      note.addEventListener("click", () => void this.plugin.openFile(student.file));
      const timeline = row.createEl("button", {
        text: "타임라인",
        cls: "class-management-timeline-button"
      });
      timeline.addEventListener("click", () => void this.plugin.openStudentTimeline(student));
    });
  }

  private renderRecentRecords(container: HTMLElement, records: RecordEntry[]): void {
    const section = container.createDiv({ cls: "class-management-panel" });
    section.createEl("h3", { text: "최근 기록" });

    if (records.length === 0) {
      this.renderEmpty(section, "아직 작성한 기록이 없습니다.", "첫 기록 작성", () =>
        this.plugin.openRecordFlow()
      );
      return;
    }

    const list = section.createDiv({ cls: "class-management-record-list" });
    records.slice(0, 10).forEach((record) => {
      const row = list.createEl("button", { cls: "class-management-record-row" });
      const meta = row.createDiv({ cls: "class-management-record-meta" });
      meta.createEl("strong", {
        text: `${record.studentNumber}번 ${record.studentName}`
      });
      meta.createEl("span", { text: `${record.date} · ${record.recordType}` });
      row.addEventListener("click", () => void this.plugin.openFile(record.file));
    });
  }

  private renderEmpty(
    container: HTMLElement,
    message: string,
    buttonText: string,
    onClick: () => void
  ): void {
    const empty = container.createDiv({ cls: "class-management-empty" });
    empty.createEl("p", { text: message });
    const button = empty.createEl("button", { text: buttonText });
    button.addEventListener("click", onClick);
  }
}
