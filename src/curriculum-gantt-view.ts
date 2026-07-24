import { ItemView, Menu, WorkspaceLeaf, setIcon } from "obsidian";
import { registerLongPress, scaffoldView } from "./dom";
import { dayStatus, listDates, semesterForDate, semesterRange } from "@core/academic-calendar";
import { localDate } from "@core/utils";
import type ClassManagementPlugin from "./main";
import type { AcademicCalendar, AssignmentSummary, CurriculumUnit } from "@core/types";

export const CURRICULUM_GANTT_VIEW_TYPE = "class-management-curriculum-gantt";

/**
 * 일체화 로드맵 — 학기 시간축 위에 단원(일반·통합) 막대, 수행평가·행사 마커를 겹쳐
 * 교육과정-수업-평가의 흐름을 한눈에 보여 준다. 막대·마커 클릭으로 해당 노트로 이동.
 */
export class CurriculumGanttView extends ItemView {
  private semester = "";
  private integratedOnly = false;
  private rangeFrom = "";
  private rangeTo = "";
  private todaySuffix = "";

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CURRICULUM_GANTT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "교육과정 로드맵";
  }

  getIcon(): string {
    return "gantt-chart";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.contentEl.empty();
    const { toolbar, body: container } = scaffoldView(this.contentEl, {
      cls: "class-management-gantt-view",
      title: "교육과정 로드맵",
      description: "학기 단원·평가·행사 배치를 한눈에 검토합니다."
    });

    const calendar = await this.plugin.repository.getAcademicCalendar();
    if (!calendar) {
      container.createEl("p", { text: "학사일정 노트가 필요합니다." });
      return;
    }
    if (!this.semester) this.semester = this.plugin.settings.semester;
    const range = semesterRange(calendar, this.semester);
    if (!range.from || !range.to) {
      container.createEl("p", { text: `${this.semester} 기간이 학사일정에 없습니다.` });
      return;
    }
    this.rangeFrom = range.from;
    this.rangeTo = range.to;
    const days = listDates(range.from, range.to);
    const total = days.length;
    const pos = (date: string): number => {
      if (date <= range.from) return 0;
      if (date >= range.to) return 100;
      return (listDates(range.from, date).length - 1) / (total - 1) * 100;
    };

    {
      const today = localDate();
      const status = dayStatus(calendar, today);
      const todaySemester = semesterForDate(calendar, today);
      if (today >= this.rangeFrom && today <= this.rangeTo) {
        this.todaySuffix = status.kind === "vacation" ? ` · ${status.name}` : "";
      } else if (todaySemester) {
        this.todaySuffix = ` · ${todaySemester}${status.kind === "vacation" ? `(${status.name})` : ""}`;
      } else {
        this.todaySuffix = " · 학기 범위 밖";
      }
    }
    this.renderToolbar(toolbar);

    const units = this.plugin.repository
      .getCurriculumUnits()
      .filter((unit) =>
        unit.semester === this.semester &&
        unit.startDate && unit.endDate &&
        unit.endDate >= range.from && unit.startDate <= range.to &&
        (!this.integratedOnly || unit.conceptInquiryEnabled)
      );
    if (!units.length) {
      container.createEl("p", {
        cls: "class-management-today-hint",
        text: "표시할 단원이 없습니다. 단원 설계에 시작일·종료일을 입력하면 나타납니다."
      });
      return;
    }

    const assignments = this.plugin.repository.getAssignmentSummaries()
      .filter((item) => item.date >= range.from && item.date <= range.to);

    const body = container.createDiv({ cls: "class-management-gantt-body" });
    this.renderTimeHeader(body, days, pos);
    this.renderEventRow(body, calendar, range.from, range.to, pos);

    const bySubject = new Map<string, CurriculumUnit[]>();
    for (const unit of units) {
      const list = bySubject.get(unit.subject) ?? [];
      list.push(unit);
      bySubject.set(unit.subject, list);
    }
    const subjectOrder = [
      ...this.plugin.settings.schoolSubjects,
      ...[...bySubject.keys()].filter((s) => !this.plugin.settings.schoolSubjects.includes(s))
    ];
    for (const subject of subjectOrder) {
      const list = bySubject.get(subject);
      if (!list) continue;
      body.createDiv({ cls: "class-management-gantt-subject", text: subject });
      for (const unit of list.sort((a, b) => a.startDate.localeCompare(b.startDate))) {
        this.renderUnitRow(body, unit, assignments, pos);
      }
    }

    const today = localDate();
    if (today >= range.from && today <= range.to) {
      // 라벨 폭(190px) 이후 트랙 영역만 덮는 오버레이 안에 두어 막대와 같은 좌표계를 쓴다.
      const overlay = body.createDiv({ cls: "class-management-gantt-overlay" });
      const line = overlay.createDiv({ cls: "class-management-gantt-today" });
      line.style.left = `${pos(today)}%`;
      line.setAttribute("title", `오늘 ${today}`);
      const flag = overlay.createDiv({ cls: "class-management-gantt-today-flag", text: "오늘" });
      flag.style.left = `${pos(today)}%`;
    }
  }

  /** 클릭 가능한 요소에 키보드·터치 동등 동작을 부여한다 (DESIGN §7.4, UIUX §1 터치 등가). */
  private actionable(el: HTMLElement, label: string, run: () => void): void {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    el.setAttribute("aria-label", label);
    el.addEventListener("click", run);
    el.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        run();
      }
    });
    // 작은 막대·마커는 터치로 정확히 탭하기 어렵고 호버 title도 없으므로,
    // 길게 누르면 전체 라벨을 메뉴로 보여 주고 열기 동작을 제공한다.
    registerLongPress(el, (x, y) => {
      const menu = new Menu();
      menu.addItem((item) => item.setTitle(label).setIcon("book-open").onClick(run));
      menu.showAtPosition({ x, y });
    });
  }

  private renderToolbar(container: HTMLElement): void {
    const bar = container.createDiv({ cls: "class-management-gantt-toolbar" });
    for (const semester of ["1학기", "2학기"]) {
      const button = bar.createEl("button", { text: semester });
      if (semester === this.semester) button.addClass("is-active");
      button.addEventListener("click", () => {
        this.semester = semester;
        void this.refresh();
      });
    }
    const filter = bar.createEl("button", { text: "통합 단원만" });
    if (this.integratedOnly) filter.addClass("is-active");
    filter.addEventListener("click", () => {
      this.integratedOnly = !this.integratedOnly;
      void this.refresh();
    });
    bar.createSpan({
      cls: "class-management-gantt-todaychip",
      text: `오늘 ${localDate()}${this.todaySuffix}`
    });
    const legend = bar.createDiv({ cls: "class-management-gantt-legend" });
    legend.createSpan({ cls: "legend-integrated", text: "통합" });
    legend.createSpan({ cls: "legend-regular", text: "일반" });
    legend.createSpan({ cls: "legend-assessment", text: "◆ 과제" });
    legend.createSpan({ cls: "legend-event", text: "● 행사" });
  }

  private renderTimeHeader(
    body: HTMLElement,
    days: string[],
    pos: (date: string) => number
  ): void {
    const row = body.createDiv({ cls: "class-management-gantt-row is-header" });
    row.createDiv({ cls: "class-management-gantt-label" });
    const track = row.createDiv({ cls: "class-management-gantt-track" });
    let month = "";
    for (const date of days) {
      const m = date.slice(0, 7);
      if (m !== month) {
        month = m;
        const label = track.createDiv({ cls: "class-management-gantt-month" });
        label.style.left = `${pos(date)}%`;
        label.setText(`${Number(date.slice(5, 7))}월`);
      }
      if (new Date(`${date}T12:00:00`).getDay() === 1) {
        const tick = track.createDiv({ cls: "class-management-gantt-week" });
        tick.style.left = `${pos(date)}%`;
      }
    }
  }

  private renderEventRow(
    body: HTMLElement,
    calendar: AcademicCalendar,
    from: string,
    to: string,
    pos: (date: string) => number
  ): void {
    const events = calendar.events.filter((event) => event.date >= from && event.date <= to);
    if (!events.length) return;
    const row = body.createDiv({ cls: "class-management-gantt-row is-events" });
    row.createDiv({ cls: "class-management-gantt-label", text: "행사" });
    const track = row.createDiv({ cls: "class-management-gantt-track" });
    for (const event of events) {
      const dot = track.createDiv({ cls: "class-management-gantt-event" });
      dot.style.left = `${pos(event.date)}%`;
      dot.setAttribute("title", `${event.date} ${event.name}`);
      this.actionable(dot, `${event.date} ${event.name} 행사 노트 열기`, () => void this.plugin.openEventNote(event));
    }
  }

  private renderUnitRow(
    body: HTMLElement,
    unit: CurriculumUnit,
    assignments: AssignmentSummary[],
    pos: (date: string) => number
  ): void {
    const row = body.createDiv({ cls: "class-management-gantt-row" });
    const label = row.createDiv({ cls: "class-management-gantt-label" });
    if (unit.conceptInquiryEnabled) {
      const icon = label.createSpan({ cls: "class-management-nav-icon" });
      setIcon(icon, "sparkles");
    }
    label.createSpan({ text: unit.unitName });
    label.setAttribute("title", `${unit.subject} · ${unit.unitName} (${unit.startDate}~${unit.endDate}, ${unit.plannedHours}시수)`);
    this.actionable(label, `${unit.unitName} 단원 노트 열기`, () => void this.plugin.openFile(unit.file));

    const track = row.createDiv({ cls: "class-management-gantt-track" });
    const left = pos(unit.startDate);
    const width = Math.max(pos(unit.endDate) - left, 0.8);
    const bar = track.createDiv({
      cls: `class-management-gantt-bar${unit.conceptInquiryEnabled ? " is-integrated" : ""}`
    });
    bar.style.left = `${left}%`;
    bar.style.width = `${width}%`;
    bar.setAttribute("title", `${unit.unitName} · ${unit.startDate}~${unit.endDate} · ${unit.plannedHours}시수`);
    this.actionable(bar, `${unit.unitName} (${unit.startDate}~${unit.endDate}) 단원 노트 열기`, () => void this.plugin.openFile(unit.file));
    if (width > 7) bar.createSpan({ text: `${unit.plannedHours}시수` });

    const today = localDate();
    if (today > unit.startDate) {
      const elapsed = bar.createDiv({ cls: "class-management-gantt-elapsed" });
      const ratio = today >= unit.endDate
        ? 100
        : (pos(today) - left) / Math.max(width, 0.001) * 100;
      elapsed.style.width = `${Math.min(Math.max(ratio, 0), 100)}%`;
    }

    // 과제(수행평가) 마커 — 단원 연계 우선, 아니면 과목·기간으로 이 단원(일반) 소속 추정
    const subjectOf = (title: string): string => title.split(" 수행평가")[0] ?? "";
    for (const item of assignments) {
      const belongs = item.unitId
        ? item.unitId === unit.id
        : !unit.conceptInquiryEnabled &&
          subjectOf(item.title) === unit.subject &&
          item.date >= unit.startDate && item.date <= unit.endDate;
      if (!belongs) continue;
      const mark = track.createDiv({ cls: "class-management-gantt-assessment" });
      mark.style.left = `${pos(item.date)}%`;
      mark.setAttribute("title", `${item.date} ${item.title}`);
      this.actionable(mark, `${item.date} ${item.title} 열기`, () => void this.plugin.openFile(item.file));
    }
  }
}
