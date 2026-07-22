import { ItemView, WorkspaceLeaf } from "obsidian";
import { addOption } from "@core/dom";
import { ACTIVITY_KIND_LABELS, filterActivities } from "@core/activity";
import type ClassManagementPlugin from "./main";
import type { ActivityEntry, ActivityKind, StudentEntry } from "@core/types";

export const STUDENT_TIMELINE_VIEW_TYPE = "class-management-student-timeline";

export class StudentTimelineView extends ItemView {
  private student?: StudentEntry;
  private activities: ActivityEntry[] = [];
  private query = "";
  private kind: "" | ActivityKind = "";
  private resultsEl?: HTMLElement;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return STUDENT_TIMELINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return this.student ? `${this.student.name} 타임라인` : "학생 타임라인";
  }

  getIcon(): string {
    return "history";
  }

  async onOpen(): Promise<void> {
    this.render();
  }

  async setStudent(student: StudentEntry): Promise<void> {
    this.student = student;
    this.activities = await this.plugin.activityIndex.getEntries();
    this.render();
  }

  async refresh(): Promise<void> {
    if (!this.student) return;
    this.activities = await this.plugin.activityIndex.getEntries();
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("class-management-timeline-view");

    if (!this.student) {
      this.contentEl.createEl("p", {
        text: "대시보드나 명령 팔레트에서 학생을 선택해 주세요.",
        cls: "class-management-empty"
      });
      return;
    }

    const ownActivities = this.activities.filter(
      (activity) => activity.studentNumber === this.student?.number
    );
    const header = this.contentEl.createDiv({ cls: "class-management-view-heading" });
    const headingText = header.createDiv();
    headingText.createEl("h2", {
      text: `${this.student.number}번 ${this.student.name}`
    });
    headingText.createEl("p", { text: "학생별 기록·출결·과제 통합 타임라인" });
    const noteButton = header.createEl("button", { text: "학생 노트 열기" });
    noteButton.addEventListener("click", () => void this.plugin.openFile(this.student!.file));

    this.renderSummary(ownActivities);
    this.renderControls();
    this.resultsEl = this.contentEl.createDiv({ cls: "class-management-timeline" });
    this.renderResults();
  }

  private renderSummary(activities: ActivityEntry[]): void {
    const records = activities.filter((activity) => activity.kind === "record").length;
    const attendanceExceptions = activities.filter(
      (activity) => activity.kind === "attendance" && activity.status !== "출석"
    ).length;
    const incompleteAssignments = activities.filter(
      (activity) => activity.kind === "assignment" && activity.status !== "제출"
    ).length;
    const summary = this.contentEl.createDiv({ cls: "class-management-summary" });
    [
      ["학생 기록", `${records}건`],
      ["출결 예외", `${attendanceExceptions}건`],
      ["과제 확인", `${incompleteAssignments}건`]
    ].forEach(([label, value]) => {
      const card = summary.createDiv({ cls: "class-management-summary-card" });
      card.createEl("span", { text: label ?? "" });
      card.createEl("strong", { text: value ?? "" });
    });
  }

  private renderControls(): void {
    const controls = this.contentEl.createDiv({ cls: "class-management-filter-bar" });
    const searchLabel = controls.createEl("label");
    searchLabel.createEl("span", { text: "검색" });
    const search = searchLabel.createEl("input");
    search.type = "search";
    search.placeholder = "타임라인 검색";
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderResults();
    });

    const kindLabel = controls.createEl("label");
    kindLabel.createEl("span", { text: "유형" });
    const kind = kindLabel.createEl("select");
    addOption(kind, "", "전체 유형");
    (Object.entries(ACTIVITY_KIND_LABELS) as Array<[ActivityKind, string]>).forEach(
      ([value, text]) => addOption(kind, value, text)
    );
    kind.value = this.kind;
    kind.addEventListener("change", () => {
      this.kind = kind.value as "" | ActivityKind;
      this.renderResults();
    });
  }

  private renderResults(): void {
    if (!this.resultsEl || !this.student) return;
    this.resultsEl.empty();
    const filtered = filterActivities(this.activities, {
      query: this.query,
      studentNumber: this.student.number,
      kind: this.kind,
      status: "",
      dateFrom: "",
      dateTo: ""
    });

    if (filtered.length === 0) {
      this.resultsEl.createEl("p", {
        text: "표시할 활동이 없습니다.",
        cls: "class-management-empty"
      });
      return;
    }

    let previousDate = "";
    filtered.forEach((activity) => {
      if (activity.date !== previousDate) {
        this.resultsEl?.createEl("h3", {
          text: activity.date,
          cls: "class-management-timeline-date"
        });
        previousDate = activity.date;
      }

      const item = this.resultsEl?.createDiv({ cls: "class-management-timeline-item" });
      if (!item) return;
      const marker = item.createDiv({
        cls: `class-management-timeline-marker is-${activity.kind}`
      });
      marker.setAttr("aria-hidden", "true");
      const body = item.createDiv({ cls: "class-management-timeline-body" });
      const meta = body.createDiv({ cls: "class-management-timeline-meta" });
      meta.createEl("span", { text: ACTIVITY_KIND_LABELS[activity.kind] });
      meta.createEl("strong", { text: activity.status || activity.title });
      body.createEl("p", { text: activity.detail || activity.title });
      const open = body.createEl("button", { text: "원본 열기" });
      open.addEventListener("click", () => void this.plugin.openFile(activity.file));
    });
  }
}

