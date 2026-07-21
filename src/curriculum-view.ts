import { ItemView, WorkspaceLeaf } from "obsidian";
import {
  auditCurriculumAlignment,
  auditConceptInquiryDesign,
  CONCEPT_INQUIRY_PHASE_LABELS,
  CURRICULUM_DESIGN_APPROACH_LABELS,
  CURRICULUM_LESSON_STATUS_LABELS,
  CURRICULUM_UNIT_STATUS_LABELS,
  taughtHoursForUnit
} from "./curriculum";
import type ClassManagementPlugin from "./main";
import type { CurriculumLesson, CurriculumUnit, RecordEntry } from "./types";

export const CURRICULUM_VIEW_TYPE = "class-management-curriculum";

export class CurriculumView extends ItemView {
  private subjectFilter = "";
  private statusFilter = "";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CURRICULUM_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "교육과정 일체화";
  }

  getIcon(): string {
    return "book-open-check";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("class-management-curriculum-view");
    const units = this.plugin.repository.getCurriculumUnits();
    const lessons = this.plugin.repository.getCurriculumLessons();
    const records = this.plugin.repository.getRecords();

    this.renderHeader(container);
    this.renderSummary(container, units, lessons, records);
    this.renderCycle(container, units);
    this.renderFilters(container);
    const filtered = units.filter((unit) =>
      (!this.subjectFilter || unit.subject === this.subjectFilter) &&
      (!this.statusFilter || unit.status === this.statusFilter)
    );
    this.renderUnits(container, filtered, lessons, records);
  }

  private renderHeader(container: HTMLElement): void {
    const header = container.createDiv({ cls: "class-management-header" });
    const heading = header.createDiv();
    heading.createEl("h2", { text: "교육과정-수업-평가-기록" });
    heading.createEl("p", {
      text: `${this.plugin.settings.grade}학년 ${this.plugin.settings.semester} · 성취기준에서 시작해 수업과 과정중심 평가, 학생별 기록까지 연결합니다.`
    });
    const actions = header.createDiv({ cls: "class-management-actions" });
    const newButton = actions.createEl("button", { text: "새 통합 단원", cls: "mod-cta" });
    newButton.addEventListener("click", () => this.plugin.openCurriculumUnitModal());
    const reportButton = actions.createEl("button", { text: "분석·보고서" });
    reportButton.addEventListener("click", () => void this.plugin.openReports());
  }

  private renderSummary(
    container: HTMLElement,
    units: CurriculumUnit[],
    lessons: CurriculumLesson[],
    records: RecordEntry[]
  ): void {
    const completedHours = lessons
      .filter((lesson) => lesson.status === "completed")
      .reduce((sum, lesson) => sum + lesson.hours, 0);
    const plannedHours = units.reduce((sum, unit) => sum + unit.plannedHours, 0);
    const linkedEvidence = records.filter((record) => record.schoolRecordEvidence?.curriculumUnitId).length;
    const average = units.length
      ? Math.round(units.reduce((sum, unit) => sum + auditCurriculumAlignment(unit).score, 0) / units.length)
      : 0;
    const summary = container.createDiv({ cls: "class-management-summary" });
    [
      ["통합 단원", `${units.length}개`],
      ["운영 시수", `${completedHours}/${plannedHours}시간`],
      ["연결된 학생 근거", `${linkedEvidence}건`],
      ["평균 연결도", `${average}%`]
    ].forEach(([label, value]) => {
      const card = summary.createDiv({ cls: "class-management-summary-card" });
      card.createEl("span", { text: label });
      card.createEl("strong", { text: value });
    });
  }

  private renderCycle(container: HTMLElement, units: CurriculumUnit[]): void {
    const section = container.createDiv({ cls: "class-management-curriculum-cycle" });
    const definitions: Array<[string, string, (unit: CurriculumUnit) => boolean]> = [
      ["교육과정", "성취기준·학생 요구·핵심 이해", (unit) => Boolean(unit.achievementStandards && unit.enduringUnderstanding)],
      ["수업", "핵심 질문·학생 중심 학습 경험", (unit) => Boolean(unit.essentialQuestion && unit.learningPlan)],
      ["평가", "수행 증거·평가 준거·평가방법", (unit) => Boolean(unit.assessmentTask && unit.evaluationCriteria && unit.evaluationMethods.length)],
      ["기록·환류", "피드백·학생별 관찰 초점", (unit) => Boolean(unit.feedbackPlan && unit.recordFocus)]
    ];
    definitions.forEach(([title, description, isLinked], index) => {
      const card = section.createDiv({ cls: "class-management-curriculum-stage" });
      card.createEl("span", { text: String(index + 1) });
      const text = card.createDiv();
      text.createEl("strong", { text: title });
      text.createEl("small", { text: description });
      const count = units.filter(isLinked).length;
      card.createEl("em", { text: units.length ? `${count}/${units.length}` : "0/0" });
    });
  }

  private renderFilters(container: HTMLElement): void {
    const filters = container.createDiv({ cls: "class-management-curriculum-filters" });
    const subject = filters.createEl("select");
    subject.createEl("option", { text: "모든 교과", value: "" });
    this.plugin.settings.schoolSubjects.forEach((entry) => subject.createEl("option", { text: entry, value: entry }));
    subject.value = this.subjectFilter;
    subject.addEventListener("change", () => {
      this.subjectFilter = subject.value;
      void this.refresh();
    });
    const status = filters.createEl("select");
    status.createEl("option", { text: "모든 상태", value: "" });
    Object.entries(CURRICULUM_UNIT_STATUS_LABELS).forEach(([value, label]) => status.createEl("option", { text: label, value }));
    status.value = this.statusFilter;
    status.addEventListener("change", () => {
      this.statusFilter = status.value;
      void this.refresh();
    });
  }

  private renderUnits(
    container: HTMLElement,
    units: CurriculumUnit[],
    lessons: CurriculumLesson[],
    records: RecordEntry[]
  ): void {
    if (!units.length) {
      const empty = container.createDiv({ cls: "class-management-empty class-management-panel" });
      empty.createEl("h3", { text: "통합 단원 설계가 없습니다." });
      empty.createEl("p", { text: "성취기준과 학생 요구를 바탕으로 첫 단원을 설계해 보세요." });
      const button = empty.createEl("button", { text: "첫 통합 단원 만들기", cls: "mod-cta" });
      button.addEventListener("click", () => this.plugin.openCurriculumUnitModal());
      return;
    }
    const grid = container.createDiv({ cls: "class-management-curriculum-units" });
    units.forEach((unit) => this.renderUnitCard(grid, unit, lessons, records));
  }

  private renderUnitCard(
    container: HTMLElement,
    unit: CurriculumUnit,
    allLessons: CurriculumLesson[],
    records: RecordEntry[]
  ): void {
    const lessons = allLessons.filter((lesson) => lesson.unitId === unit.id);
    const evidence = records.filter((record) => record.schoolRecordEvidence?.curriculumUnitId === unit.id);
    const reviewed = evidence.filter((record) => record.schoolRecordEvidence?.reviewStatus === "reviewed").length;
    const audit = auditCurriculumAlignment(unit);
    const conceptAudit = auditConceptInquiryDesign(unit);
    const completedHours = taughtHoursForUnit(unit.id, lessons);
    const card = container.createDiv({ cls: "class-management-curriculum-unit" });
    const top = card.createDiv({ cls: "class-management-curriculum-unit-top" });
    const heading = top.createDiv();
    heading.createEl("span", { text: `${unit.subject} · ${CURRICULUM_UNIT_STATUS_LABELS[unit.status]}`, cls: "class-management-curriculum-badge" });
    if (unit.conceptInquiryEnabled) {
      heading.createEl("span", { text: "개념기반 탐구", cls: "class-management-curriculum-badge is-concept" });
    }
    heading.createEl("h3", { text: unit.unitName });
    heading.createEl("p", { text: unit.theme || CURRICULUM_DESIGN_APPROACH_LABELS[unit.designApproach] });
    const score = top.createDiv({ cls: `class-management-alignment-score ${audit.score === 100 ? "is-complete" : ""}` });
    score.createEl("strong", { text: `${audit.score}%` });
    score.createEl("small", { text: "연결도" });

    const metrics = card.createDiv({ cls: "class-management-curriculum-metrics" });
    const metricValues = [["기간", dateRange(unit.startDate, unit.endDate)], ["시수", `${completedHours}/${unit.plannedHours}`], ["차시", `${lessons.length}개`], ["학생 근거", `${reviewed}/${evidence.length}`]];
    if (unit.conceptInquiryEnabled) metricValues.push(["탐구 설계", `${conceptAudit.score}%`]);
    metricValues
      .forEach(([label, value]) => {
        const item = metrics.createDiv();
        item.createEl("small", { text: label });
        item.createEl("strong", { text: value });
      });

    const issuesToShow = [...audit.issues, ...conceptAudit.issues];
    if (issuesToShow.length) {
      const issues = card.createEl("ul", { cls: "class-management-curriculum-issues" });
      issuesToShow.slice(0, 3).forEach((issue) => issues.createEl("li", { text: issue.message }));
    }

    const actions = card.createDiv({ cls: "class-management-actions" });
    const edit = actions.createEl("button", { text: "설계 수정" });
    edit.addEventListener("click", () => this.plugin.openCurriculumUnitModal(unit));
    const lesson = actions.createEl("button", { text: "차시 기록" });
    lesson.addEventListener("click", () => this.plugin.openCurriculumLessonModal(unit));
    const evidenceButton = actions.createEl("button", { text: "학생 근거" });
    evidenceButton.addEventListener("click", () => this.plugin.openCurriculumEvidenceFlow(unit));
    const batchEvidenceButton = actions.createEl("button", { text: "학급 근거" });
    batchEvidenceButton.addEventListener("click", () => this.plugin.openSchoolRecordBatch("subject-development", unit));
    const note = actions.createEl("button", { text: "노트 열기" });
    note.addEventListener("click", () => void this.plugin.openFile(unit.file));

    if (lessons.length) {
      const list = card.createDiv({ cls: "class-management-curriculum-lessons" });
      list.createEl("strong", { text: "차시 실행" });
      lessons.forEach((entry) => {
        const row = list.createEl("button");
        row.createEl("span", { text: `${entry.date} · ${entry.sequence}차시 · ${entry.objective}` });
        row.createEl("small", {
          text: [
            entry.conceptInquiryPhase ? CONCEPT_INQUIRY_PHASE_LABELS[entry.conceptInquiryPhase] : "",
            CURRICULUM_LESSON_STATUS_LABELS[entry.status]
          ].filter(Boolean).join(" · ")
        });
        row.addEventListener("click", () => this.plugin.openCurriculumLessonModal(unit, entry));
      });
    }
  }
}

function dateRange(start: string, end: string): string {
  if (start && end) return `${start} ~ ${end}`;
  return start || end || "미정";
}
