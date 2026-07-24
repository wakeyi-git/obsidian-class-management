import { registerLongPress, scaffoldView } from "./dom";
import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { showTimetableCellMenu, type TimetableCellContext } from "./timetable-cell-modal";
import {
  availableHours,
  countClassDays,
  mondayOf,
  semesterForDate,
  semesterRange,
  weekdayLabel
} from "@core/academic-calendar";
import { isRemovedSubject, plannedHoursBySubject, resolveDay, subjectSlots } from "@core/timetable";
import { buildAssignedSlotContents, crossCurricularThemes, reconstructionNotes } from "@core/progress";
import { wikiLinkText } from "@core/planning";
import { collectSubjectOptions } from "@core/subject-options";
import { buildHoursAudit, hoursAdjustmentSuggestions } from "@core/hours-audit";
import { addDays } from "@core/academic-calendar";
import { localDate } from "@core/utils";
import type ClassManagementPlugin from "./main";
import type {
  AcademicCalendar,
  BaseTimetable,
  HoursAuditRow,
  HoursStandard,
  ProgressRow,
  ProgressTable,
  SemesterHours } from "@core/types";

/**
 * 배정 차시의 프로젝트(✦ 강조색)·과제(◆ 주황) 연계를 칸에 표시한다 (§4 시각 언어).
 * 표식은 정보 표시이며 이동은 차시 인스펙터가 담당한다.
 */
export function appendSlotMarkers(container: HTMLElement, row: ProgressRow): void {
  const project = row.unitLink.trim();
  const assignments = [...row.assignmentLink.matchAll(/\[\[(?:[^\]]|\\\])*?\]\]/g)].map((m) => m[0]);
  if (!project && assignments.length === 0) return;
  const markers = container.createDiv({ cls: "class-management-slot-markers" });
  if (project) {
    const name = wikiLinkText(project);
    const chip = markers.createSpan({ cls: "is-project", text: `✦ ${name}` });
    chip.setAttribute("title", `프로젝트: ${name}`);
  }
  if (assignments.length > 0) {
    const names = assignments.map((link) => wikiLinkText(link)).join(", ");
    const chip = markers.createSpan({ cls: "is-assignment", text: "◆ 과제" });
    chip.setAttribute("title", `과제: ${names}`);
  }
}

export const CURRICULUM_OPS_VIEW_TYPE = "class-management-curriculum-ops";

const AUDIT_STATUS_LABELS: Record<HoursAuditRow["status"], string> = {
  ok: "적정",
  over: "초과",
  under: "미달",
  missing: "기준 없음"
};

export class CurriculumOpsView extends ItemView {
  private weekAnchor = mondayOf(localDate());

  /** 특정 주로 이동 — 주간학습안내 노트의 "시간표에서 수정" 동선이 사용한다. */
  setWeek(date: string): void {
    this.weekAnchor = mondayOf(date);
    if (this.data) this.render();
  }
  /** refresh()가 채우는 학기 데이터 캐시 — 주 이동은 이 캐시로 render()만 다시 한다. */
  private data?: {
    calendar: AcademicCalendar | null;
    standard: HoursStandard | null;
    timetables: Record<string, BaseTimetable | null>;
    tablesBySemester: Record<string, ProgressTable[]>;
  };

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CURRICULUM_OPS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "시간표·시수";
  }

  getIcon(): string {
    return "calendar-clock";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  /** 볼트 변경 시 학기 데이터를 다시 읽는다. 주 이동은 render()만 다시 해 캐시를 재사용한다(§7 부분 갱신). */
  async refresh(): Promise<void> {
    const repository = this.plugin.repository;
    this.data = {
      calendar: await repository.getAcademicCalendar(),
      standard: await repository.getHoursStandard(),
      timetables: {
        "1학기": await repository.getBaseTimetable("1학기"),
        "2학기": await repository.getBaseTimetable("2학기")
      },
      tablesBySemester: {
        "1학기": await repository.getProgressTables("1학기"),
        "2학기": await repository.getProgressTables("2학기")
      }
    };
    this.render();
  }

  private render(): void {
    if (!this.data) return;
    const { calendar, standard, timetables, tablesBySemester } = this.data;
    const settings = this.plugin.settings;
    this.contentEl.empty();
    const { body: container } = scaffoldView(this.contentEl, {
      cls: "class-management-ops-view",
      title: "시간표·시수",
      description: `${settings.schoolYear} ${settings.semester} · 계획 원장 상태와 주간 시간표, 시수 점검을 관리합니다.`
    });

    const currentTimetable = timetables[settings.semester] ?? null;
    const currentTables = tablesBySemester[settings.semester] ?? [];

    this.renderSetup(container, calendar, standard, currentTimetable, currentTables);
    if (!calendar) {
      container.createEl("p", {
        cls: "class-management-ops-hint",
        text: "학사일정 노트를 만들고 학기 시작·종료일, 휴업일, 행사를 입력하면 수업일수·시간표·진도 배정이 계산됩니다."
      });
      return;
    }

    this.renderCalendarSummary(container, calendar);
    this.renderWeek(container, calendar, timetables, tablesBySemester, standard);
    this.renderHoursAudit(container, calendar, standard, timetables);
    this.renderThemes(container, tablesBySemester);
    this.renderReconstruction(container, tablesBySemester);
    this.renderActions(container, currentTimetable, currentTables);
  }

  /** 재구성 기록 — 진도표 비고의 `재구성: 사유` 관례를 모아 보인다 (기록이 있을 때만). */
  private renderReconstruction(
    container: HTMLElement,
    tablesBySemester: Record<string, ProgressTable[]>
  ): void {
    const notes = reconstructionNotes(tablesBySemester);
    if (notes.length === 0) return;
    const section = container.createDiv({ cls: "class-management-ops-audit" });
    section.createEl("h3", { text: `재구성 기록 (${notes.length})` });
    section.createEl("p", {
      cls: "class-management-ops-hint",
      text: "차시를 수정·이동·통합한 의도의 기록입니다 — 진도표 비고에 `재구성: 사유`로 적으면 모입니다. 변경 전 원본은 백업 폴더의 자동 스냅숏에 있습니다."
    });
    const table = section.createEl("table", { cls: "class-management-ops-audit-table" });
    const head = table.createEl("thead").createEl("tr");
    for (const label of ["학기", "과목", "순", "단원·영역", "학습 내용", "재구성 사유"]) {
      head.createEl("th", { text: label });
    }
    const body = table.createEl("tbody");
    for (const note of notes) {
      const row = body.createEl("tr");
      row.createEl("td", { text: note.semester });
      row.createEl("td", { text: note.subject });
      row.createEl("td", { text: String(note.order) });
      row.createEl("td", { text: note.unit });
      row.createEl("td", { text: note.topic });
      row.createEl("td", { text: note.memo });
    }
  }

  /** 범교과 주제어 집계 — 진도표 비고의 #태그 기반, 법정 이수(안전 등) 확인용. */
  private renderThemes(
    container: HTMLElement,
    tablesBySemester: Record<string, ProgressTable[]>
  ): void {
    const themes = crossCurricularThemes(tablesBySemester);
    const section = container.createDiv({ cls: "class-management-ops-audit" });
    section.createEl("h3", { text: "범교과 주제어" });
    if (themes.length === 0) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: "진도표 비고 칸에 #안전 같은 태그를 적으면 주제어별 차시·시수가 집계됩니다 (예: #안전 #인성 #환경 — 한 칸에 여러 태그 가능)."
      });
      return;
    }
    section.createEl("p", {
      cls: "class-management-ops-hint",
      text: "진도표 비고의 #태그를 1·2학기 합산으로 집계합니다. 안전교육처럼 이수 시수 보고가 필요한 주제를 확인하세요."
    });
    const table = section.createEl("table", { cls: "class-management-ops-audit-table" });
    const head = table.createEl("thead").createEl("tr");
    for (const label of ["주제어", "차시", "시수", "1학기", "2학기", "과목별 시수"]) {
      head.createEl("th", { text: label });
    }
    const body = table.createEl("tbody");
    for (const theme of themes) {
      const row = body.createEl("tr");
      row.createEl("td", { text: `#${theme.tag}` });
      row.createEl("td", { text: String(theme.lessons) });
      row.createEl("td", { text: String(theme.hours) });
      row.createEl("td", { text: String(theme.hoursBySemester["1학기"] ?? 0) });
      row.createEl("td", { text: String(theme.hoursBySemester["2학기"] ?? 0) });
      row.createEl("td", {
        text: theme.subjects.map((entry) => `${entry.subject} ${entry.hours}`).join(" · ")
      });
    }
  }

  private renderSetup(
    container: HTMLElement,
    calendar: AcademicCalendar | null,
    standard: { file: TFile } | null,
    timetable: BaseTimetable | null,
    tables: ProgressTable[]
  ): void {
    const section = container.createDiv({ cls: "class-management-ops-setup" });
    const items: Array<{ label: string; file: TFile | null; open: () => void }> = [
      {
        label: "학사일정",
        file: calendar?.file ?? null,
        open: () => void this.plugin.openAcademicCalendarNote()
      },
      {
        label: "기준 시수",
        file: standard?.file ?? null,
        open: () => void this.plugin.openHoursStandardNote()
      },
      {
        label: `기초시간표 (${this.plugin.settings.semester})`,
        file: timetable?.file ?? null,
        open: () => void this.plugin.openBaseTimetableNote()
      }
    ];
    for (const item of items) {
      const row = section.createDiv({ cls: "class-management-ops-setup-item" });
      row.createEl("span", {
        text: `${item.file ? "✓" : "✗"} ${item.label}`,
        cls: item.file ? "is-ready" : "is-missing"
      });
      const button = row.createEl("button", { text: item.file ? "열기" : "만들기" });
      button.addEventListener("click", item.open);
    }
    const progressRow = section.createDiv({ cls: "class-management-ops-setup-item" });
    progressRow.createEl("span", {
      text: `${tables.length > 0 ? "✓" : "✗"} 진도표 ${tables.length}과목`,
      cls: tables.length > 0 ? "is-ready" : "is-missing"
    });
    const importButton = progressRow.createEl("button", { text: "차시 가져오기" });
    importButton.addEventListener("click", () => this.plugin.openProgressImportModal());
    for (const table of tables) {
      const button = progressRow.createEl("button", { text: table.subject });
      button.addEventListener("click", () => void this.plugin.openFile(table.file));
    }
  }

  private renderCalendarSummary(container: HTMLElement, calendar: AcademicCalendar): void {
    const section = container.createDiv({ cls: "class-management-ops-summary" });
    for (const semester of ["1학기", "2학기"]) {
      const range = semesterRange(calendar, semester);
      if (!range.from || !range.to) continue;
      const card = section.createDiv({ cls: "class-management-ops-card" });
      card.createEl("strong", { text: semester });
      card.createEl("span", { text: `${range.from} ~ ${range.to}` });
      card.createEl("span", {
        text: `수업일수 ${countClassDays(calendar, range.from, range.to)}일 · 수업가능시수 ${availableHours(calendar, range.from, range.to)}시간`
      });
    }
  }

  private renderWeek(
    container: HTMLElement,
    calendar: AcademicCalendar,
    timetables: Record<string, BaseTimetable | null>,
    tablesBySemester: Record<string, ProgressTable[]>,
    standard: HoursStandard | null
  ): void {
    const section = container.createDiv({ cls: "class-management-ops-week" });
    const header = section.createDiv({ cls: "class-management-ops-week-header" });
    header.createEl("h3", { text: "주간 시간표" });
    const navigation = header.createDiv({ cls: "class-management-ops-week-nav" });
    const previous = navigation.createEl("button", { text: "◀" });
    previous.addEventListener("click", () => {
      this.weekAnchor = addDays(this.weekAnchor, -7);
      this.render();
    });
    const today = navigation.createEl("button", { text: "이번 주" });
    today.addEventListener("click", () => {
      this.weekAnchor = mondayOf(localDate());
      this.render();
    });
    const next = navigation.createEl("button", { text: "▶" });
    next.addEventListener("click", () => {
      this.weekAnchor = addDays(this.weekAnchor, 7);
      this.render();
    });
    header.createEl("span", {
      text: `${this.weekAnchor} ~ ${addDays(this.weekAnchor, 4)}`
    });

    const dates = [0, 1, 2, 3, 4].map((offset) => addDays(this.weekAnchor, offset));
    const days = dates.map((date) => {
      const semester = semesterForDate(calendar, date);
      return resolveDay(calendar, semester ? timetables[semester] ?? null : null, date);
    });
    const dayEditable = dates.map((date) => {
      const semester = semesterForDate(calendar, date);
      return semester !== "" && (timetables[semester] ?? null) !== null;
    });
    const editable = dayEditable.some(Boolean);
    const contents = buildAssignedSlotContents(calendar, timetables, tablesBySemester);
    const subjects = this.collectSubjects(
      [...(tablesBySemester["1학기"] ?? []), ...(tablesBySemester["2학기"] ?? [])],
      standard,
      timetables[this.plugin.settings.semester] ?? null
    );
    if (editable) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: "칸을 클릭하면 그 날짜의 교시만 다른 과목으로 바꿀 수 있으며, 변경은 그 날짜가 속한 학기의 기초시간표 노트에 기록됩니다. 빈 칸(＋)은 6~8교시처럼 기준 교시 밖의 수업 추가, 행사 교시 클릭은 그 교시만 교과·창체로 재배정합니다."
      });
    }

    const maxResolvedPeriod = Math.max(
      1,
      ...days.flatMap((day) => day.periods.map((item) => item.period))
    );
    const maxPeriods = editable ? Math.min(8, maxResolvedPeriod + 1) : maxResolvedPeriod;
    const table = section.createEl("table", { cls: "class-management-ops-week-table" });
    const head = table.createEl("thead").createEl("tr");
    head.createEl("th", { text: "교시" });
    for (const day of days) {
      const cell = head.createEl("th", {
        text: `${day.date.slice(5)} (${weekdayLabel(day.date)})`
      });
      if (!day.isClassDay) {
        cell.addClass("is-closed");
        cell.createEl("div", { text: day.reason || "휴업", cls: "class-management-ops-day-status" });
      } else if (day.events.length > 0) {
        cell.createEl("div", {
          text: day.events.map((event) => event.name).join(", "),
          cls: "class-management-ops-day-status"
        });
      }
    }
    const body = table.createEl("tbody");
    for (let period = 1; period <= maxPeriods; period += 1) {
      const row = body.createEl("tr");
      row.createEl("td", { text: String(period) });
      days.forEach((day, dayIndex) => {
        const cell = row.createEl("td");
        if (!day.isClassDay) {
          cell.addClass("is-closed");
          return;
        }
        const daySemester = semesterForDate(calendar, day.date);
        const dayTimetable = daySemester ? timetables[daySemester] ?? null : null;
        const cellEditable = dayEditable[dayIndex] ?? false;
        const resolved = day.periods.find((item) => item.period === period);
        if (!resolved) {
          if (cellEditable) {
            const removal = dayTimetable?.overrides.find(
              (item) =>
                item.date === day.date &&
                item.period === period &&
                isRemovedSubject(item.subject)
            );
            if (removal) {
              cell.addClass("is-removed");
              cell.createEl("span", { text: "수업 없음", cls: "class-management-ops-removed" });
              this.attachCellEditor(cell, {
                date: day.date,
                period,
                currentSubject: "",
                hasOverride: true,
                isEvent: false,
                isRemoved: true,
                subjects,
                label: `${day.date} ${period}교시 삭제됨 — 우클릭: 복원 메뉴`
              });
            } else {
              cell.addClass("is-empty");
              cell.createEl("span", { text: "＋", cls: "class-management-ops-add" });
              this.attachCellEditor(cell, {
                date: day.date,
                period,
                currentSubject: "",
                hasOverride: false,
                isEvent: false,
                isRemoved: false,
                subjects,
                label: `${day.date} ${period}교시 — 우클릭: 수업 추가 메뉴`
              });
            }
          }
          return;
        }
        if (resolved.source === "event") cell.addClass("is-event");
        if (resolved.source === "override") cell.addClass("is-override");
        cell.createEl("strong", { text: resolved.subject });
        const content = contents.get(`${day.date}|${period}`);
        const pinnedHere = content !== undefined &&
          content.fixedDate === day.date &&
          (content.fixedPeriod === period || content.fixedPeriod === 0);
        if (content) {
          const topic = cell.createEl("div", {
            text: `${pinnedHere ? "📌 " : ""}${[content.unit, content.topic].filter(Boolean).join(" · ")}`,
            cls: "class-management-ops-topic"
          });
          if (pinnedHere) {
            topic.addClass("is-pinned");
            topic.setAttribute(
              "title",
              content.fixedPeriod > 0 ? "이 날짜·교시에 고정된 차시" : "이 날짜에 고정된 차시"
            );
          }
          appendSlotMarkers(cell, content);
        }
        if (cellEditable) {
          this.attachCellEditor(cell, {
            date: day.date,
            period,
            currentSubject: resolved.subject,
            hasOverride: resolved.source === "override",
            isEvent: resolved.source === "event",
            isRemoved: false,
            subjects,
            pinnedRowLabel: pinnedHere && content
              ? `${content.order}. ${content.topic}`
              : "",
            label: `${day.date} ${period}교시 ${resolved.subject || "빈 교시"}${
              content?.unitLink.trim() ? ` · 프로젝트 ${wikiLinkText(content.unitLink)}` : ""
            }${content?.assignmentLink.trim() ? " · 과제 있음" : ""} — 클릭: 차시 정보, 우클릭: 변경 메뉴`
          });
        }
      });
    }
  }

  private attachCellEditor(
    cell: HTMLElement,
    options: {
      date: string;
      period: number;
      currentSubject: string;
      hasOverride: boolean;
      isEvent: boolean;
      isRemoved: boolean;
      subjects: string[];
      pinnedRowLabel?: string;
      label: string;
    }
  ): void {
    cell.addClass("is-editable");
    cell.setAttribute("role", "button");
    cell.setAttribute("tabindex", "0");
    cell.setAttribute("aria-label", options.label);
    cell.setAttribute("title", options.label);
    const context: TimetableCellContext = {
      date: options.date,
      period: options.period,
      currentSubject: options.currentSubject,
      hasOverride: options.hasOverride,
      isEvent: options.isEvent,
      isRemoved: options.isRemoved,
      subjects: options.subjects,
      pinnedRowLabel: options.pinnedRowLabel ?? ""
    };
    const inspect = (): void => {
      void this.plugin.openLessonInspector(options.date, options.period);
    };
    cell.addEventListener("click", inspect);
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        inspect();
      }
    });
    cell.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      showTimetableCellMenu(this.plugin, event, context);
    });
    registerLongPress(cell, (x, y) => showTimetableCellMenu(this.plugin, { x, y }, context));
  }

  private collectSubjects(
    tables: ProgressTable[],
    standard: HoursStandard | null,
    timetable: BaseTimetable | null
  ): string[] {
    return collectSubjectOptions(this.plugin.settings.schoolSubjects, tables, standard, timetable);
  }

  private renderHoursAudit(
    container: HTMLElement,
    calendar: AcademicCalendar,
    standard: HoursStandard | null,
    timetables: Record<string, BaseTimetable | null>
  ): void {
    const section = container.createDiv({ cls: "class-management-ops-audit" });
    section.createEl("h3", { text: "시수 점검 (기준 · 편성 · 실행)" });
    if (!timetables["1학기"] && !timetables["2학기"]) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: "기초시간표를 만들면 편성 시수를 집계합니다."
      });
      return;
    }

    const semesterHours: Record<string, SemesterHours> = {
      "1학기": { planned: {}, taught: {} },
      "2학기": { planned: {}, taught: {} }
    };
    const today = localDate();
    const missingSemesters: string[] = [];
    for (const semester of ["1학기", "2학기"]) {
      const range = semesterRange(calendar, semester);
      if (!range.from || !range.to) continue;
      const semesterTimetable = timetables[semester] ?? null;
      if (!semesterTimetable) {
        missingSemesters.push(semester);
        continue;
      }
      const bucket = semesterHours[semester];
      if (!bucket) continue;
      bucket.planned = plannedHoursBySubject(calendar, semesterTimetable, range.from, range.to);
      if (today >= range.from) {
        const elapsedTo = today < range.to ? today : range.to;
        bucket.taught = plannedHoursBySubject(calendar, semesterTimetable, range.from, elapsedTo);
      }
    }

    section.createEl("p", {
      cls: "class-management-ops-hint",
      text: "실행은 오늘까지 시간표 기준으로 운영된 시수입니다. 학기별 기준은 기준 시수 노트의 1학기·2학기 열, 학년 기준·증감·상태는 학년 열(비면 1·2학기 합) 기준입니다."
    });
    const rows = buildHoursAudit(standard, semesterHours["1학기"], semesterHours["2학기"]);
    if (missingSemesters.length > 0) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: `${missingSemesters.join("·")} 기초시간표가 없어 해당 학기 편성·실행은 0으로 표시됩니다.`
      });
    }

    const table = section.createEl("table", { cls: "class-management-ops-audit-table" });
    const head = table.createEl("thead");
    const groupRow = head.createEl("tr");
    groupRow.createEl("th", { text: "" });
    for (const label of ["1학기", "2학기", "학년"]) {
      groupRow.createEl("th", { text: label, attr: { colspan: "3" }, cls: "is-group" });
    }
    groupRow.createEl("th", { text: "", attr: { colspan: "2" } });
    const headRow = head.createEl("tr");
    for (const label of ["교과·영역", "기준", "편성", "실행", "기준", "편성", "실행", "기준", "편성", "실행", "증감", "상태"]) {
      headRow.createEl("th", { text: label });
    }
    const dash = (value: number): string => (value > 0 ? String(value) : "—");
    const body = table.createEl("tbody");
    for (const row of rows) {
      const line = body.createEl("tr", { cls: `is-${row.status} is-${row.kind}` });
      line.createEl("td", { text: row.subject });
      line.createEl("td", { text: dash(row.standard1) });
      line.createEl("td", { text: String(row.planned1) });
      line.createEl("td", { text: String(row.taught1) });
      line.createEl("td", { text: dash(row.standard2) });
      line.createEl("td", { text: String(row.planned2) });
      line.createEl("td", { text: String(row.taught2) });
      line.createEl("td", { text: dash(row.standardHours) });
      line.createEl("td", { text: String(row.plannedHours) });
      line.createEl("td", { text: String(row.taughtHours) });
      line.createEl("td", {
        text: row.standardHours ? `${row.deltaPercent > 0 ? "+" : ""}${row.deltaPercent}%` : "—"
      });
      line.createEl("td", { text: AUDIT_STATUS_LABELS[row.status] });
    }
    if (rows.length === 0) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: "기준 시수 노트와 기초시간표를 입력하면 3단 대조가 표시됩니다."
      });
    }
    this.renderHoursSuggestions(section, calendar, timetables, rows);
  }

  /** 시수 조절 제안 — 초과·미달 짝의 미래 슬롯 후보를 제안만 한다(적용은 교사, 우클릭 변경). */
  private renderHoursSuggestions(
    section: HTMLElement,
    calendar: AcademicCalendar,
    timetables: Record<string, BaseTimetable | null>,
    rows: HoursAuditRow[]
  ): void {
    const semester = this.plugin.settings.semester;
    const timetable = timetables[semester] ?? null;
    if (!timetable) return;
    const range = semesterRange(calendar, semester);
    if (!range.from || !range.to) return;
    const today = localDate();
    const from = today > range.from ? today : range.from;
    if (from > range.to) return;

    const suggestions = hoursAdjustmentSuggestions(rows, (subject) =>
      subjectSlots(calendar, timetable, from, range.to, subject)
    );
    const unders = rows.filter((row) => row.kind === "subject" && row.status === "under");
    if (suggestions.length === 0 && unders.length === 0) return;

    const box = section.createDiv({ cls: "class-management-ops-suggestions" });
    box.createEl("h4", { text: "조절 제안" });
    if (suggestions.length === 0) {
      box.createEl("p", {
        cls: "class-management-ops-hint",
        text: "미달 과목이 있지만 초과 과목의 남은 수업이 없어 제안할 변경이 없습니다 — 기준 시수 노트 값 또는 기초시간표 편성을 확인하세요."
      });
      return;
    }
    box.createEl("p", {
      cls: "class-management-ops-hint",
      text: `${semester} 남은 수업에서 고를 수 있는 변경 후보입니다. 적용은 주간 시간표 칸 우클릭 → 과목 변경으로 하세요 — 저장 즉시 진도가 재배정됩니다.`
    });
    const list = box.createEl("ul");
    for (const suggestion of suggestions) {
      const slots = suggestion.slots
        .map((slot) => `${slot.date.slice(5)}(${slot.period})`)
        .join(" · ");
      list.createEl("li", {
        text: `${suggestion.from} → ${suggestion.to} ${suggestion.count}시간: ${slots}${suggestion.truncated ? " (남은 수업이 부족해 일부만 제안)" : ""}`
      });
    }
  }

  private renderActions(
    container: HTMLElement,
    timetable: BaseTimetable | null,
    tables: ProgressTable[]
  ): void {
    const section = container.createDiv({ cls: "class-management-ops-actions" });
    const assign = section.createEl("button", { text: "진도 자동 배정" });
    assign.disabled = !timetable || tables.length === 0;
    assign.addEventListener("click", () => void this.plugin.runProgressAssignment());
    const weekly = section.createEl("button", { text: "이 주 주간학습안내 생성", cls: "mod-cta" });
    weekly.disabled = !timetable;
    weekly.addEventListener("click", () => void this.plugin.generateWeeklyPlan(this.weekAnchor));
  }
}
