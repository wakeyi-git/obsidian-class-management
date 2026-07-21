import { ItemView, TFile, WorkspaceLeaf } from "obsidian";
import { TimetableCellModal } from "./timetable-cell-modal";
import {
  availableHours,
  countClassDays,
  mondayOf,
  semesterForDate,
  semesterRange,
  weekdayLabel
} from "./academic-calendar";
import { isRemovedSubject, plannedHoursBySubject, resolveDay } from "./timetable";
import { buildAssignedSlotContents } from "./progress";
import { collectSubjectOptions } from "./subject-options";
import { buildHoursAudit } from "./hours-audit";
import { addDays } from "./academic-calendar";
import { localDate } from "./utils";
import type ClassManagementPlugin from "./main";
import type {
  AcademicCalendar,
  BaseTimetable,
  HoursAuditRow,
  HoursStandard,
  ProgressRow,
  ProgressTable
} from "./types";

export const CURRICULUM_OPS_VIEW_TYPE = "class-management-curriculum-ops";

const AUDIT_STATUS_LABELS: Record<HoursAuditRow["status"], string> = {
  ok: "적정",
  over: "초과",
  under: "미달",
  missing: "기준 없음"
};

export class CurriculumOpsView extends ItemView {
  private weekAnchor = mondayOf(localDate());

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return CURRICULUM_OPS_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "교육과정 운영";
  }

  getIcon(): string {
    return "calendar-clock";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("class-management-ops-view");
    const settings = this.plugin.settings;
    const repository = this.plugin.repository;

    container.createEl("h2", {
      text: `교육과정 운영 · ${settings.schoolYear} ${settings.semester}`
    });

    const calendar = await repository.getAcademicCalendar();
    const standard = await repository.getHoursStandard();
    const timetables: Record<string, BaseTimetable | null> = {
      "1학기": await repository.getBaseTimetable("1학기"),
      "2학기": await repository.getBaseTimetable("2학기")
    };
    const tablesBySemester: Record<string, ProgressTable[]> = {
      "1학기": await repository.getProgressTables("1학기"),
      "2학기": await repository.getProgressTables("2학기")
    };
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
    this.renderActions(container, currentTimetable, currentTables);
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
      void this.refresh();
    });
    const today = navigation.createEl("button", { text: "이번 주" });
    today.addEventListener("click", () => {
      this.weekAnchor = mondayOf(localDate());
      void this.refresh();
    });
    const next = navigation.createEl("button", { text: "▶" });
    next.addEventListener("click", () => {
      this.weekAnchor = addDays(this.weekAnchor, 7);
      void this.refresh();
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
                label: `${day.date} ${period}교시 삭제됨 · 되돌리기`
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
                label: `${day.date} ${period}교시 수업 추가`
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
            label: `${day.date} ${period}교시 ${resolved.subject || "빈 교시"} 과목 변경`
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
    const openEditor = (): void => {
      this.plugin.updateLessonInspector(options.date, options.period);
      new TimetableCellModal(this.plugin, {
        date: options.date,
        period: options.period,
        currentSubject: options.currentSubject,
        hasOverride: options.hasOverride,
        isEvent: options.isEvent,
        isRemoved: options.isRemoved,
        subjects: options.subjects,
        pinnedRowLabel: options.pinnedRowLabel ?? ""
      }).open();
    };
    cell.addEventListener("click", openEditor);
    cell.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        openEditor();
      }
    });
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

    const planned: Record<string, number> = {};
    const elapsed: Record<string, number> = {};
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
      const hours = plannedHoursBySubject(calendar, semesterTimetable, range.from, range.to);
      for (const [subject, count] of Object.entries(hours)) {
        planned[subject] = (planned[subject] ?? 0) + count;
      }
      if (today >= range.from) {
        const elapsedTo = today < range.to ? today : range.to;
        const done = plannedHoursBySubject(calendar, semesterTimetable, range.from, elapsedTo);
        for (const [subject, count] of Object.entries(done)) {
          elapsed[subject] = (elapsed[subject] ?? 0) + count;
        }
      }
    }

    section.createEl("p", {
      cls: "class-management-ops-hint",
      text: "실행은 오늘까지 시간표 기준으로 운영된 시수입니다. 시간표 변경·행사·교시 삭제가 반영됩니다."
    });
    const rows = buildHoursAudit(standard, planned, elapsed);
    if (missingSemesters.length > 0) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: `${missingSemesters.join("·")} 기초시간표가 없어 해당 학기 편성분은 제외된 연간 집계입니다.`
      });
    }

    const table = section.createEl("table", { cls: "class-management-ops-audit-table" });
    const head = table.createEl("thead").createEl("tr");
    for (const label of ["교과·영역", "기준", "편성", "실행(오늘까지)", "증감", "상태"]) {
      head.createEl("th", { text: label });
    }
    const body = table.createEl("tbody");
    for (const row of rows) {
      const line = body.createEl("tr", { cls: `is-${row.status}` });
      line.createEl("td", { text: row.subject });
      line.createEl("td", { text: row.standardHours ? String(row.standardHours) : "—" });
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
