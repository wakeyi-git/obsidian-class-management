import { ItemView, WorkspaceLeaf } from "obsidian";
import { scaffoldView } from "./dom";
import type ClassManagementPlugin from "./main";
import type { AttendanceMark, RecordEntry, StudentEntry } from "@core/types";
import { localDate } from "@core/utils";

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
    const settings = this.plugin.settings;
    const { body } = scaffoldView(container, {
      cls: "class-management-dashboard",
      // 표준 골격의 예외: 대시보드 제목은 뷰 이름 대신 학급 이름이다 (DESIGN §6.5).
      title: settings.className,
      description: `${settings.schoolYear} ${settings.semester} · ${settings.grade}학년 · 학생 기록과 학급 운영 업무를 한눈에 확인합니다.${this.plugin.activeClassProfile.archived ? " · 읽기 전용 보관" : ""}`
    });

    const students = this.plugin.repository.getStudents();
    const records = this.plugin.repository.getRecords();
    const today = localDate();
    const attendance = await this.plugin.repository.getAttendance(today);

    this.renderSummary(body, students, records, attendance, today);

    const grid = body.createDiv({ cls: "class-management-grid" });
    this.renderStudents(grid, students);
    this.renderRecentRecords(grid, records);
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
      const note = row.createEl("button", {
        cls: "class-management-student-note",
        attr: { "aria-label": `${student.number}번 ${student.name} 학생 인스펙터 열기` }
      });
      note.createEl("span", {
        text: student.number,
        cls: "class-management-student-number"
      });
      note.createEl("span", { text: student.name });
      note.addEventListener("click", () => void this.plugin.inspectStudent(student.number));
      const timeline = row.createEl("button", {
        text: "타임라인",
        cls: "class-management-timeline-button",
        attr: { "aria-label": `${student.number}번 ${student.name} 타임라인 열기` }
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
      const row = list.createEl("button", {
        cls: "class-management-record-row",
        attr: { "aria-label": `${record.studentNumber}번 ${record.studentName} ${record.date} 기록 열기` }
      });
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
