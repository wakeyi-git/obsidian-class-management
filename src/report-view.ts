import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { createAiDraft } from "./ai-collaboration";
import type ClassManagementPlugin from "./main";
import {
  analyzeActivities,
  buildActivitiesCsv,
  buildReportMarkdown,
  selectReportActivities
} from "./report";
import { SchoolRecordDraftModal } from "./school-record-modal";
import { LegacyRecordMigrationModal } from "./legacy-record-migration-modal";
import { SchoolRecordReviewModal } from "./school-record-review-modal";
import {
  buildSchoolRecordCoverage,
  normalizeSubjects
} from "./school-record-evidence";
import type {
  ActivityEntry,
  AiDraftKind,
  ReportOptions,
  SchoolRecordArea
} from "./types";
import { localDate } from "./utils";

export const REPORT_VIEW_TYPE = "class-management-report-view";

export class ReportView extends ItemView {
  private activities: ActivityEntry[] = [];
  private options: ReportOptions = {
    title: "학급 운영 월간 보고서",
    dateFrom: monthStart(),
    dateTo: localDate(),
    studentNumber: ""
  };

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return REPORT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "분석과 보고서";
  }

  getIcon(): string {
    return "chart-no-axes-combined";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.activities = await this.plugin.activityIndex.getEntries();
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("class-management-report-view");
    const header = this.contentEl.createDiv({ cls: "class-management-view-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "분석과 보고서" });
    title.createEl("p", { text: "기간과 학생을 선택해 현황을 집계하고 근거 링크가 포함된 검토 자료를 만듭니다." });
    const aiSetup = header.createEl("button", { text: "AI 협업 설정" });
    aiSetup.addEventListener("click", () => this.plugin.openAiSetup());

    this.renderFilters();
    const selected = selectReportActivities(this.activities, this.options);
    this.renderAnalytics(selected);
    this.renderActions(selected);
    this.renderSchoolRecordCoverage();
    this.renderPreview(selected);
  }

  private renderFilters(): void {
    const filters = this.contentEl.createDiv({ cls: "class-management-filter-bar" });
    const title = filter(filters, "보고서 제목").createEl("input");
    title.value = this.options.title;
    title.addEventListener("input", () => (this.options.title = title.value));
    const from = filter(filters, "시작일").createEl("input");
    from.type = "date";
    from.value = this.options.dateFrom;
    from.addEventListener("change", () => {
      this.options.dateFrom = from.value;
      this.render();
    });
    const to = filter(filters, "종료일").createEl("input");
    to.type = "date";
    to.value = this.options.dateTo;
    to.addEventListener("change", () => {
      this.options.dateTo = to.value;
      this.render();
    });
    const student = filter(filters, "대상").createEl("select");
    addOption(student, "", "학급 전체");
    this.plugin.repository.getStudents().forEach((entry) =>
      addOption(student, entry.number, `${entry.number}번 ${entry.name}`)
    );
    student.value = this.options.studentNumber;
    student.addEventListener("change", () => {
      this.options.studentNumber = student.value;
      this.render();
    });
    const presets = filters.createDiv({ cls: "class-management-report-presets" });
    [["오늘", "day"], ["이번 주", "week"], ["이번 달", "month"]].forEach(([label, range]) => {
      const button = presets.createEl("button", { text: label });
      button.addEventListener("click", () => this.applyRange(range as "day" | "week" | "month"));
    });
  }

  private renderAnalytics(activities: ActivityEntry[]): void {
    const analytics = analyzeActivities(activities);
    const cards = this.contentEl.createDiv({ cls: "class-management-summary" });
    [
      ["전체 자료", `${analytics.total}건`],
      ["출결 예외", `${analytics.attendanceExceptions}건`],
      ["과제 예외", `${analytics.assignmentsPending}건`],
      ["미회신", `${analytics.noticePending}건`],
      ["미완료 할 일", `${analytics.tasksOpen}건`],
      ["미완료 루틴", `${analytics.routinesIncomplete}건`]
    ].forEach(([label, value]) => {
      const card = cards.createDiv({ cls: "class-management-summary-card" });
      card.createEl("span", { text: label });
      card.createEl("strong", { text: value });
    });
  }

  private renderActions(activities: ActivityEntry[]): void {
    const actions = this.contentEl.createDiv({ cls: "class-management-report-actions" });
    const markdown = actions.createEl("button", { text: "Markdown 보고서 저장", cls: "mod-cta" });
    markdown.addEventListener("click", () => void this.saveMarkdown());
    const csv = actions.createEl("button", { text: "현재 자료 CSV 내보내기" });
    csv.addEventListener("click", () => void this.saveCsv(activities));
    const feedback = actions.createEl("button", { text: "학생 피드백 초안" });
    feedback.disabled = !this.options.studentNumber || !this.plugin.settings.aiCollaborationEnabled;
    feedback.addEventListener("click", () => void this.saveAiDraft("feedback"));
    const schoolRecord = actions.createEl("button", { text: "생활기록부 영역별 초안" });
    schoolRecord.disabled = !this.options.studentNumber || !this.plugin.settings.aiCollaborationEnabled;
    schoolRecord.addEventListener("click", () => this.openSchoolRecordDraft());
    if (!this.plugin.settings.aiCollaborationEnabled) {
      actions.createEl("span", { text: "초안 생성은 AI 협업 설정에서 명시적으로 활성화합니다.", cls: "setting-item-description" });
    }
  }

  private renderPreview(activities: ActivityEntry[]): void {
    const panel = this.contentEl.createDiv({ cls: "class-management-panel" });
    panel.createEl("h3", { text: `선택 자료 미리보기 ${activities.length}건` });
    if (activities.length === 0) {
      panel.createEl("p", { text: "선택한 조건에 맞는 자료가 없습니다." });
      return;
    }
    const tableWrap = panel.createDiv({ cls: "class-management-table-wrap" });
    const table = tableWrap.createEl("table");
    const header = table.createEl("thead").createEl("tr");
    ["날짜", "학생", "유형", "상태", "내용"].forEach((text) => header.createEl("th", { text }));
    const body = table.createEl("tbody");
    activities.slice(0, 100).forEach((activity) => {
      const row = body.createEl("tr");
      row.createEl("td", { text: activity.date });
      row.createEl("td", { text: activity.studentNumber ? `${activity.studentNumber}번 ${activity.studentName}` : "학급 공통" });
      row.createEl("td", { text: activity.kind });
      row.createEl("td", { text: activity.status });
      row.createEl("td", { text: activity.detail || activity.title });
    });
  }

  private renderSchoolRecordCoverage(): void {
    const allStudents = this.plugin.repository.getStudents();
    const students = this.options.studentNumber
      ? allStudents.filter((student) => student.number === this.options.studentNumber)
      : allStudents;
    const coverage = buildSchoolRecordCoverage(
      students,
      this.plugin.repository.getRecords().filter((record) =>
        students.some((student) => student.number === record.studentNumber)
      ),
      normalizeSubjects(this.plugin.settings)
    );
    const panel = this.contentEl.createDiv({ cls: "class-management-panel class-management-coverage-panel" });
    const heading = panel.createDiv({ cls: "class-management-coverage-heading" });
    const text = heading.createDiv();
    text.createEl("h3", { text: "학교생활기록부 근거 누락 점검" });
    text.createEl("p", {
      text: `${this.plugin.settings.grade}학년 · ${this.plugin.settings.schoolRecordGuidelineYear} 기재요령 · 검토 제외가 아닌 구조화된 RAW 근거 기준`
    });
    const coverageActions = heading.createDiv({ cls: "class-management-coverage-actions" });
    const add = coverageActions.createEl("button", { text: "개별 근거 기록", cls: "mod-cta" });
    add.disabled = this.plugin.activeClassProfile.archived;
    add.addEventListener("click", () => this.plugin.openSchoolRecordEvidenceFlow(
      undefined,
      "creative-activities",
      students.length === 1 ? students[0] : undefined
    ));
    const batch = coverageActions.createEl("button", { text: "학급 일괄 입력" });
    batch.disabled = this.plugin.activeClassProfile.archived;
    batch.addEventListener("click", () => this.plugin.openSchoolRecordBatch());
    const review = coverageActions.createEl("button", { text: "근거 검토 상태" });
    review.addEventListener("click", () => {
      const studentNumbers = new Set(students.map((student) => student.number));
      const evidenceActivities = this.activities.filter((activity) =>
        activity.schoolRecordEvidence && studentNumbers.has(activity.studentNumber)
      );
      new SchoolRecordReviewModal(this.plugin, evidenceActivities, () => this.refresh()).open();
    });

    if (!students.length) {
      panel.createEl("p", { text: "점검할 재적 학생이 없습니다." });
      return;
    }
    const cards = panel.createDiv({ cls: "class-management-coverage-grid" });
    coverage.areas.forEach((area) => {
      const card = cards.createDiv({ cls: "class-management-coverage-card" });
      card.createEl("strong", { text: area.label });
      card.createEl("span", { text: `${area.covered}/${area.total} 충족` });
      const meter = card.createDiv({ cls: "class-management-coverage-meter" });
      const fill = meter.createDiv();
      fill.style.width = `${area.total ? Math.round((area.covered / area.total) * 100) : 0}%`;
      const button = card.createEl("button", { text: `${area.gaps.length}건 누락 보기` });
      button.disabled = area.gaps.length === 0;
      button.addEventListener("click", () => this.renderCoverageGaps(panel, area.area, area.gaps));
    });
    const legacyInfo = panel.createDiv({ cls: "class-management-coverage-legacy" });
    legacyInfo.createEl("p", {
      text: coverage.legacyUnclassified
        ? `기존 자유서술 기록 ${coverage.legacyUnclassified}건은 누락 충족 자료로 자동 인정하지 않습니다. 초안 분류에서는 키워드 기반 보조 자료로만 제안됩니다.`
        : "모든 생활 기록이 구조화 여부에 따라 점검되었습니다.",
      cls: "setting-item-description"
    });
    if (coverage.legacyUnclassified) {
      const migrate = legacyInfo.createEl("button", { text: "기존 기록 분류 추천" });
      migrate.disabled = this.plugin.activeClassProfile.archived;
      migrate.addEventListener("click", () => {
        const studentNumbers = new Set(students.map((student) => student.number));
        const legacy = this.activities.filter((activity) =>
          activity.kind === "record" &&
          studentNumbers.has(activity.studentNumber) &&
          !activity.schoolRecordEvidence
        );
        new LegacyRecordMigrationModal(this.plugin, legacy, () => this.refresh()).open();
      });
    }
  }

  private renderCoverageGaps(
    panel: HTMLElement,
    area: SchoolRecordArea,
    gaps: Array<{ studentNumber: string; studentName: string; requirement: string }>
  ): void {
    panel.querySelector(".class-management-coverage-gaps")?.remove();
    const list = panel.createDiv({ cls: "class-management-coverage-gaps" });
    list.createEl("h4", { text: `누락 근거 ${gaps.length}건` });
    gaps.slice(0, 60).forEach((gap) => {
      const row = list.createDiv();
      row.createEl("span", { text: `${gap.studentNumber}번 ${gap.studentName} · ${gap.requirement}` });
      const add = row.createEl("button", { text: "기록" });
      add.disabled = this.plugin.activeClassProfile.archived;
      add.addEventListener("click", () => {
        const student = this.plugin.repository.getStudents().find(
          (entry) => entry.number === gap.studentNumber
        );
        if (student) this.plugin.openSchoolRecordEvidenceFlow(undefined, area, student);
      });
    });
    if (gaps.length > 60) list.createEl("p", { text: `나머지 ${gaps.length - 60}건은 학생 또는 영역을 선택해 확인하세요.` });
  }

  private async saveMarkdown(): Promise<void> {
    const title = this.options.title.trim() || "학급 운영 보고서";
    const content = buildReportMarkdown(
      this.activities,
      { ...this.options, title },
      this.plugin.settings.className,
      this.plugin.repository.getStudents()
    );
    const file = await this.plugin.repository.saveReport(title, content);
    new Notice("Markdown 보고서를 저장했습니다.");
    await this.plugin.openFile(file);
  }

  private async saveCsv(activities: ActivityEntry[]): Promise<void> {
    const file = await this.plugin.repository.saveReport(
      `${this.options.title || "학급 운영 보고서"} 자료`,
      buildActivitiesCsv(activities),
      "csv"
    );
    new Notice("CSV 자료를 저장했습니다.");
    await this.plugin.openFile(file);
  }

  private async saveAiDraft(
    kind: AiDraftKind,
    schoolRecordArea?: SchoolRecordArea
  ): Promise<void> {
    if (!this.plugin.settings.aiCollaborationEnabled) {
      new Notice("먼저 AI 협업 설정에서 기능을 활성화해 주세요.");
      return;
    }
    const student = this.plugin.repository.getStudents().find(
      (entry) => entry.number === this.options.studentNumber
    );
    if (!student) {
      new Notice("초안을 만들 학생을 선택해 주세요.");
      return;
    }
    const file = await createAiDraft(
      this.app,
      this.plugin.settings,
      student,
      this.activities,
      kind,
      this.options.dateFrom,
      this.options.dateTo,
      schoolRecordArea
    );
    new Notice("근거 링크가 포함된 검토용 초안을 만들었습니다.");
    await this.plugin.openFile(file);
  }

  private openSchoolRecordDraft(): void {
    if (!this.plugin.settings.aiCollaborationEnabled) {
      new Notice("먼저 AI 협업 설정에서 기능을 활성화해 주세요.");
      return;
    }
    const student = this.plugin.repository.getStudents().find(
      (entry) => entry.number === this.options.studentNumber
    );
    if (!student) {
      new Notice("초안을 만들 학생을 선택해 주세요.");
      return;
    }
    new SchoolRecordDraftModal(
      this.app,
      student,
      this.activities,
      this.options.dateFrom,
      this.options.dateTo,
      async (areas) => {
        const files = [];
        for (const area of areas) {
          files.push(await createAiDraft(
            this.app,
            this.plugin.settings,
            student,
            this.activities,
            "school-record",
            this.options.dateFrom,
            this.options.dateTo,
            area
          ));
        }
        new Notice(`학교생활기록부 영역별 검토용 초안 ${files.length}개를 만들었습니다.`);
        const first = files[0];
        if (first) await this.plugin.openFile(first);
      }
    ).open();
  }

  private applyRange(range: "day" | "week" | "month"): void {
    const today = new Date();
    const end = localDate();
    if (range === "day") this.options.dateFrom = end;
    else if (range === "month") this.options.dateFrom = `${end.slice(0, 7)}-01`;
    else {
      const day = today.getDay();
      const offset = day === 0 ? -6 : 1 - day;
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() + offset);
      this.options.dateFrom = formatDate(monday);
    }
    this.options.dateTo = end;
    this.options.title = range === "day"
      ? "학급 운영 일간 보고서"
      : range === "week"
        ? "학급 운영 주간 보고서"
        : "학급 운영 월간 보고서";
    this.render();
  }
}

function monthStart(): string {
  const today = localDate();
  return `${today.slice(0, 7)}-01`;
}

function filter(container: HTMLElement, label: string): HTMLLabelElement {
  const element = container.createEl("label");
  element.createEl("span", { text: label });
  return element;
}

function addOption(select: HTMLSelectElement, value: string, text: string): void {
  const option = select.createEl("option", { text });
  option.value = value;
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
