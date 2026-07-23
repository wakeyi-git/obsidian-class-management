import { ItemView, WorkspaceLeaf } from "obsidian";
import {
  auditCurriculumAlignment,
  auditConceptInquiryDesign,
  CONCEPT_INQUIRY_PHASE_LABELS,
  CURRICULUM_DESIGN_APPROACH_LABELS,
  CURRICULUM_LESSON_STATUS_LABELS,
  CURRICULUM_UNIT_STATUS_LABELS,
  taughtHoursForUnit
} from "@core/curriculum";
import { localDate } from "@core/utils";
import { filterLabel } from "@core/dom";
import type ClassManagementPlugin from "./main";
import type { CurriculumLesson, CurriculumUnit, CurriculumUnitStatus, RecordEntry } from "@core/types";

export const CURRICULUM_VIEW_TYPE = "class-management-curriculum";

export class CurriculumView extends ItemView {
  private subjectFilter = "";
  private query = "";
  private typeFilter: "" | "regular" | "project" = "";
  private incompleteOnly = false;
  private boardHost: HTMLElement | null = null;
  private data: {
    units: CurriculumUnit[];
    lessons: CurriculumLesson[];
    records: RecordEntry[];
  } | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CURRICULUM_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "단원 설계 및 운영";
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
    // 필터 변경 시 입력창(한글 조합·포커스)을 보존하려고 보드 영역만 다시 그린다.
    this.boardHost = container.createDiv();
    this.data = { units, lessons, records };
    this.renderBoard();
  }

  private renderBoard(): void {
    if (!this.boardHost || !this.data) return;
    this.boardHost.empty();
    const { units, lessons, records } = this.data;
    const container = this.boardHost;
    const filtered = units.filter((unit) =>
      (!this.subjectFilter || unit.subject === this.subjectFilter) &&
      (!this.typeFilter ||
        (this.typeFilter === "project") === unit.conceptInquiryEnabled) &&
      (!this.incompleteOnly || auditCurriculumAlignment(unit).score < 100) &&
      (!this.query.trim() ||
        `${unit.subject} ${unit.unitName} ${unit.theme} ${unit.achievementStandards}`
          .toLocaleLowerCase("ko")
          .includes(this.query.trim().toLocaleLowerCase("ko")))
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
    const newButton = actions.createEl("button", { text: "새 단원 설계", cls: "mod-cta" });
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
      ["단원", `${units.length}개`],
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
    const filters = container.createDiv({ cls: "class-management-filter-bar" });

    const searchLabel = filterLabel(filters, "검색");
    const search = searchLabel.createEl("input", { attr: { placeholder: "예: 곱셈, 4과05-01" } });
    search.type = "search";
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderBoard();
    });

    const subjectLabel = filterLabel(filters, "교과");
    const subject = subjectLabel.createEl("select");
    subject.createEl("option", { text: "모든 교과", value: "" });
    this.plugin.settings.schoolSubjects.forEach((entry) => subject.createEl("option", { text: entry, value: entry }));
    subject.value = this.subjectFilter;
    subject.addEventListener("change", () => {
      this.subjectFilter = subject.value;
      this.renderBoard();
    });

    const typeLabel = filterLabel(filters, "구분");
    const type = typeLabel.createEl("select");
    type.createEl("option", { text: "전체", value: "" });
    type.createEl("option", { text: "일반", value: "regular" });
    type.createEl("option", { text: "프로젝트", value: "project" });
    type.value = this.typeFilter;
    type.addEventListener("change", () => {
      this.typeFilter = type.value as "" | "regular" | "project";
      this.renderBoard();
    });

    const incompleteLabel = filterLabel(filters, "연결도");
    const incomplete = incompleteLabel.createEl("select");
    incomplete.createEl("option", { text: "전체", value: "" });
    incomplete.createEl("option", { text: "미완만 (100% 미만)", value: "incomplete" });
    incomplete.value = this.incompleteOnly ? "incomplete" : "";
    incomplete.addEventListener("change", () => {
      this.incompleteOnly = incomplete.value === "incomplete";
      this.renderBoard();
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
      empty.createEl("h3", { text: "단원 설계가 없습니다." });
      empty.createEl("p", { text: "성취기준과 학생 요구를 바탕으로 첫 단원을 설계해 보세요." });
      const button = empty.createEl("button", { text: "첫 단원 설계 만들기", cls: "mod-cta" });
      button.addEventListener("click", () => this.plugin.openCurriculumUnitModal());
      return;
    }
    // 칸반 보드 — 기간이 시작되면 운영 중, 지나면 운영 완료로 자동 배치(노트는 다시 쓰지 않음).
    const board = container.createDiv({ cls: "class-management-curriculum-board" });
    const today = localDate();
    for (const [status, label] of Object.entries(CURRICULUM_UNIT_STATUS_LABELS)) {
      const column = board.createDiv({ cls: "class-management-curriculum-column" });
      const items = units
        .filter((unit) => this.stageOf(unit, today) === status)
        .sort((a, b) => (a.startDate || "9999").localeCompare(b.startDate || "9999"));
      column.createEl("h3", { text: `${label} ${items.length}` });
      if (items.length === 0) {
        column.createEl("p", { text: "해당 단계 단원이 없습니다.", cls: "setting-item-description" });
      }
      items.forEach((unit) => this.renderUnitCard(column, unit, lessons, records, label));
    }
  }

  /** 표시 단계 — 기간(운영 중·완료)은 날짜로 파생하고, 기간 전에는 노트의 설계 상태를 따른다. */
  private stageOf(unit: CurriculumUnit, today: string): CurriculumUnitStatus {
    if (unit.startDate && unit.endDate) {
      if (today > unit.endDate) return "completed";
      if (today >= unit.startDate) return "in-progress";
    }
    return unit.status === "draft" ? "draft" : "ready";
  }

  private renderUnitCard(
    container: HTMLElement,
    unit: CurriculumUnit,
    allLessons: CurriculumLesson[],
    records: RecordEntry[],
    stageLabel?: string
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
    heading.createEl("span", { text: `${unit.subject} · ${stageLabel ?? CURRICULUM_UNIT_STATUS_LABELS[unit.status]}`, cls: "class-management-curriculum-badge" });
    if (unit.conceptInquiryEnabled) {
      heading.createEl("span", { text: "개념기반 탐구", cls: "class-management-curriculum-badge is-concept" });
    }
    const titleButton = heading.createEl("button", {
      text: unit.unitName,
      cls: "class-management-curriculum-title-button class-management-link-text",
      attr: { "aria-label": `${unit.unitName} 단원 노트 열기` }
    });
    titleButton.addEventListener("click", () => void this.plugin.openFile(unit.file));
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
    const lesson = actions.createEl("button", { text: "수업일지" });
    lesson.addEventListener("click", () => this.plugin.openCurriculumLessonModal(unit));
    const evidenceButton = actions.createEl("button", { text: "학생 개별 기록" });
    evidenceButton.addEventListener("click", () => this.plugin.openCurriculumEvidenceFlow(unit));
    const batchEvidenceButton = actions.createEl("button", { text: "학급 일괄 기록" });
    batchEvidenceButton.addEventListener("click", () => this.plugin.openSchoolRecordBatch("subject-development", unit));

    if (lessons.length) {
      const list = card.createDiv({ cls: "class-management-curriculum-lessons" });
      list.createEl("strong", { text: "수업일지" });
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
  const short = (date: string): string =>
    date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : "";
  if (start && end) return `${short(start)}~${short(end)}`;
  return short(start) || short(end) || "미정";
}
