import { ItemView, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { TimetableCellModal } from "./timetable-cell-modal";
import {
  availableHours,
  countClassDays,
  mondayOf,
  semesterRange,
  weekdayLabel
} from "./academic-calendar";
import { plannedHoursBySubject, resolveWeek, subjectSlots } from "./timetable";
import { assignProgress, slotContentMap } from "./progress";
import { buildHoursAudit, taughtHoursBySubject } from "./hours-audit";
import { addDays } from "./academic-calendar";
import { localDate } from "./utils";
import type ClassManagementPlugin from "./main";
import type {
  AcademicCalendar,
  BaseTimetable,
  HoursAuditRow,
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
    const timetable = await repository.getBaseTimetable(settings.semester);
    const tables = await repository.getProgressTables(settings.semester);

    this.renderSetup(container, calendar, standard, timetable, tables);
    if (!calendar) {
      container.createEl("p", {
        cls: "class-management-ops-hint",
        text: "학사일정 노트를 만들고 학기 시작·종료일, 휴업일, 행사를 입력하면 수업일수·시간표·진도 배정이 계산됩니다."
      });
      return;
    }

    this.renderCalendarSummary(container, calendar);
    await this.renderWeek(container, calendar, timetable, tables);
    await this.renderHoursAudit(container, calendar, standard, timetable);
    this.renderActions(container, timetable, tables);
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

  private async renderWeek(
    container: HTMLElement,
    calendar: AcademicCalendar,
    timetable: BaseTimetable | null,
    tables: ProgressTable[]
  ): Promise<void> {
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

    const days = resolveWeek(calendar, timetable, this.weekAnchor);
    const contents = timetable
      ? this.buildSlotContents(calendar, timetable, tables)
      : new Map<string, ProgressRow>();
    const editable = timetable !== null &&
      timetable.semester === this.plugin.settings.semester;
    const subjects = this.collectSubjects(tables);
    if (editable) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: "칸을 클릭하면 그 날짜의 교시만 다른 과목으로 바꿀 수 있습니다. 행사 교시는 학사일정 노트에서 수정하세요."
      });
    }

    const maxPeriods = Math.max(1, ...days.map((day) => day.periods.length));
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
      for (const day of days) {
        const cell = row.createEl("td");
        if (!day.isClassDay) {
          cell.addClass("is-closed");
          continue;
        }
        const resolved = day.periods.find((item) => item.period === period);
        if (!resolved) continue;
        if (resolved.source === "event") cell.addClass("is-event");
        if (resolved.source === "override") cell.addClass("is-override");
        cell.createEl("strong", { text: resolved.subject });
        const content = contents.get(`${day.date}|${period}`);
        if (content) {
          cell.createEl("div", {
            text: [content.unit, content.topic].filter(Boolean).join(" · "),
            cls: "class-management-ops-topic"
          });
        }
        if (editable) {
          cell.addClass("is-editable");
          cell.setAttribute("role", "button");
          cell.setAttribute("tabindex", "0");
          cell.setAttribute(
            "aria-label",
            `${day.date} ${period}교시 ${resolved.subject || "빈 교시"} 과목 변경`
          );
          const openEditor = (): void => {
            if (resolved.source === "event") {
              new Notice("행사가 배정된 교시입니다. 학사일정 노트의 행사 표에서 수정하세요.");
              return;
            }
            new TimetableCellModal(this.plugin, {
              date: day.date,
              period,
              currentSubject: resolved.subject,
              hasOverride: resolved.source === "override",
              subjects
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
      }
    }
  }

  private collectSubjects(tables: ProgressTable[]): string[] {
    const subjects: string[] = [];
    const push = (subject: string): void => {
      const trimmed = subject.trim();
      if (trimmed && !subjects.includes(trimmed)) subjects.push(trimmed);
    };
    for (const subject of this.plugin.settings.schoolSubjects) push(subject);
    for (const table of tables) push(table.subject);
    for (const area of ["창체(자율)", "창체(동아리)", "창체(진로)"]) push(area);
    return subjects;
  }

  private buildSlotContents(
    calendar: AcademicCalendar,
    timetable: BaseTimetable,
    tables: ProgressTable[]
  ): Map<string, ProgressRow> {
    const range = semesterRange(calendar, this.plugin.settings.semester);
    const merged = new Map<string, ProgressRow>();
    if (!range.from || !range.to) return merged;
    for (const table of tables) {
      const slots = subjectSlots(calendar, timetable, range.from, range.to, table.subject);
      const assignment = assignProgress(table.rows, slots);
      for (const [key, row] of slotContentMap(assignment)) merged.set(key, row);
    }
    return merged;
  }

  private async renderHoursAudit(
    container: HTMLElement,
    calendar: AcademicCalendar,
    standard: Parameters<typeof buildHoursAudit>[0],
    timetable: BaseTimetable | null
  ): Promise<void> {
    const section = container.createDiv({ cls: "class-management-ops-audit" });
    section.createEl("h3", { text: "시수 점검 (기준 · 편성 · 실행)" });
    if (!timetable) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: "기초시간표를 만들면 편성 시수를 집계합니다."
      });
      return;
    }

    const planned: Record<string, number> = {};
    const missingSemesters: string[] = [];
    for (const semester of ["1학기", "2학기"]) {
      const range = semesterRange(calendar, semester);
      if (!range.from || !range.to) continue;
      const semesterTimetable =
        semester === this.plugin.settings.semester
          ? timetable
          : await this.plugin.repository.getBaseTimetable(semester);
      if (!semesterTimetable) {
        missingSemesters.push(semester);
        continue;
      }
      const hours = plannedHoursBySubject(calendar, semesterTimetable, range.from, range.to);
      for (const [subject, count] of Object.entries(hours)) {
        planned[subject] = (planned[subject] ?? 0) + count;
      }
    }

    const taught = taughtHoursBySubject(this.plugin.repository.getCurriculumLessons());
    const rows = buildHoursAudit(standard, planned, taught);
    if (missingSemesters.length > 0) {
      section.createEl("p", {
        cls: "class-management-ops-hint",
        text: `${missingSemesters.join("·")} 기초시간표가 없어 해당 학기 편성분은 제외된 연간 집계입니다.`
      });
    }

    const table = section.createEl("table", { cls: "class-management-ops-audit-table" });
    const head = table.createEl("thead").createEl("tr");
    for (const label of ["교과·영역", "기준", "편성", "실행", "증감", "상태"]) {
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
