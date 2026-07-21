import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { addDays } from "./academic-calendar";
import { localDate } from "./utils";
import type ClassManagementPlugin from "./main";
import type { ActivityEntry, SchoolRecordArea } from "./types";

export const STUDENT_INSPECTOR_VIEW_TYPE = "class-management-student-inspector";

const AREA_LABELS: Record<SchoolRecordArea, string> = {
  "creative-activities": "창체",
  "subject-development": "교과",
  "behavior-summary": "행동"
};

export class StudentInspectorView extends ItemView {
  private studentNumber = "";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return STUDENT_INSPECTOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "학생 인스펙터";
  }

  getIcon(): string {
    return "user-search";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async setStudent(studentNumber: string): Promise<void> {
    this.studentNumber = studentNumber;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("class-management-today-view");

    const students = this.plugin.repository.getStudents(true);
    const student = students.find((entry) => entry.number === this.studentNumber);
    if (!student) {
      const hint = container.createDiv({ cls: "class-management-inspector-empty" });
      hint.createEl("p", {
        cls: "class-management-today-hint",
        text: "대시보드 명단에서 학생을 클릭하거나 아래에서 선택하세요."
      });
      const pick = hint.createEl("button", { text: "학생 선택", cls: "mod-cta" });
      pick.addEventListener("click", () => this.plugin.openStudentInspectorFlow());
      return;
    }

    const header = container.createDiv({ cls: "class-management-today-header" });
    const nameRow = header.createDiv({ cls: "class-management-inspector-name" });
    nameRow.createEl("span", {
      text: `${student.number}번 ${student.name}`,
      cls: "class-management-today-date"
    });
    if (student.status !== "active") {
      nameRow.createEl("span", {
        text: student.status === "transferred" ? "전출" : "졸업",
        cls: "class-management-today-badge is-warning"
      });
    }
    const buttons = header.createDiv({ cls: "class-management-inspector-buttons" });
    const pairs: Array<[string, string, () => void]> = [
      ["pencil", "빠른 기록", () => this.plugin.openRecordFlow()],
      ["file-text", "학생부 근거", () => this.plugin.openSchoolRecordEvidenceFlow()],
      ["history", "타임라인", () => void this.plugin.openStudentTimeline(student)],
      ["file", "학생 노트", () => void this.plugin.openFile(student.file)],
      ["user-search", "학생 변경", () => this.plugin.openStudentInspectorFlow()]
    ];
    for (const [icon, label, run] of pairs) {
      const button = buttons.createEl("button", { attr: { "aria-label": label, title: label } });
      setIcon(button, icon);
      button.addEventListener("click", run);
    }

    const entries = (await this.plugin.activityIndex.getEntries()).filter(
      (entry) => entry.studentNumber === student.number
    );
    const today = localDate();
    const monthAgo = addDays(today, -30);
    const recent = entries.filter((entry) => entry.date >= monthAgo);

    const summary = container.createDiv({ cls: "class-management-inspector-summary" });
    const cards: Array<[string, number]> = [
      ["30일 기록", recent.filter((entry) => entry.kind === "record").length],
      ["출결 예외", entries.filter((entry) => entry.kind === "attendance" && entry.status !== "출석").length],
      ["과제 예외", entries.filter((entry) => entry.kind === "assignment" && entry.status !== "제출").length],
      ["학생부 근거", entries.filter((entry) => entry.kind === "record" && entry.schoolRecordEvidence).length]
    ];
    for (const [label, count] of cards) {
      const card = summary.createDiv({ cls: "class-management-inspector-card" });
      card.createEl("strong", { text: String(count) });
      card.createEl("span", { text: label });
    }

    const evidence = entries.filter(
      (entry) => entry.kind === "record" && entry.schoolRecordEvidence
    );
    if (evidence.length > 0) {
      const counts = new Map<string, number>();
      for (const entry of evidence) {
        const area = entry.schoolRecordEvidence?.area;
        const label = area ? AREA_LABELS[area] : "기타";
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      const section = this.section(container, "file-text", "학생부 근거 분포");
      section.createEl("p", {
        cls: "class-management-today-hint",
        text: [...counts.entries()].map(([label, count]) => `${label} ${count}`).join(" · ")
      });
    }

    this.renderEntryList(
      container,
      "pencil",
      "최근 기록",
      entries.filter((entry) => entry.kind === "record").slice(0, 5),
      (entry) => `${entry.status} · ${entry.detail || entry.title}`
    );
    this.renderEntryList(
      container,
      "user-check",
      "출결 예외",
      entries
        .filter((entry) => entry.kind === "attendance" && entry.status !== "출석")
        .slice(0, 5),
      (entry) => `${entry.status}${entry.detail ? ` · ${entry.detail}` : ""}`
    );
    this.renderEntryList(
      container,
      "clipboard-check",
      "과제 예외",
      entries
        .filter((entry) => entry.kind === "assignment" && entry.status !== "제출")
        .slice(0, 5),
      (entry) => `${entry.status} · ${entry.title}`
    );
  }

  private section(container: HTMLElement, icon: string, title: string): HTMLElement {
    const section = container.createDiv({ cls: "class-management-today-section" });
    const heading = section.createDiv({ cls: "class-management-today-title" });
    const iconEl = heading.createSpan({ cls: "class-management-nav-icon" });
    setIcon(iconEl, icon);
    heading.createSpan({ text: title });
    return section;
  }

  private renderEntryList(
    container: HTMLElement,
    icon: string,
    title: string,
    entries: ActivityEntry[],
    describe: (entry: ActivityEntry) => string
  ): void {
    const section = this.section(container, icon, title);
    if (entries.length === 0) {
      section.createEl("p", { cls: "class-management-today-hint", text: "없음" });
      return;
    }
    for (const entry of entries) {
      const row = section.createDiv({ cls: "class-management-today-item" });
      row.createSpan({ text: entry.date.slice(5), cls: "class-management-today-badge" });
      row.createSpan({ text: describe(entry), cls: "class-management-nav-label" });
      row.addEventListener("click", () => void this.plugin.openFile(entry.file));
    }
  }
}
