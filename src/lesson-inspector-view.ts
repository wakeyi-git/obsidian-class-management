import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { eventsOn, semesterForDate, weekdayLabel } from "./academic-calendar";
import { resolveDay } from "./timetable";
import { buildAssignedSlotContents } from "./progress";
import { collectSubjectOptions } from "./subject-options";
import { TimetableCellModal } from "./timetable-cell-modal";
import type ClassManagementPlugin from "./main";

export const LESSON_INSPECTOR_VIEW_TYPE = "class-management-lesson-inspector";

export class LessonInspectorView extends ItemView {
  private slot: { date: string; period: number } | null = null;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return LESSON_INSPECTOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "차시 인스펙터";
  }

  getIcon(): string {
    return "book-open";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async setSlot(date: string, period: number): Promise<void> {
    this.slot = { date, period };
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("class-management-today-view");

    if (!this.slot) {
      container.createEl("p", {
        cls: "class-management-today-hint class-management-inspector-empty",
        text: "주간 시간표나 오늘 패널에서 교시를 클릭하면 해당 차시 정보가 표시됩니다."
      });
      return;
    }

    const { date, period } = this.slot;
    const repository = this.plugin.repository;
    const calendar = await repository.getAcademicCalendar();
    if (!calendar) {
      container.createEl("p", {
        cls: "class-management-today-hint",
        text: "학사일정 노트가 필요합니다."
      });
      return;
    }
    const semester = semesterForDate(calendar, date);
    const timetable = semester ? await repository.getBaseTimetable(semester) : null;
    const day = resolveDay(calendar, timetable, date);
    const resolved = day.periods.find((item) => item.period === period);

    const header = container.createDiv({ cls: "class-management-today-header" });
    header.createEl("div", {
      text: `${date} (${weekdayLabel(date)}) ${period}교시`,
      cls: "class-management-today-date"
    });
    header.createEl("div", {
      text: resolved
        ? `${resolved.subject || "(빈 교시)"}${semester ? ` · ${semester}` : ""}${resolved.source === "override" ? " · 변경됨" : resolved.source === "event" ? " · 행사" : ""}`
        : day.isClassDay
          ? "이 교시는 오늘 운영하지 않습니다."
          : day.reason || "수업일이 아닙니다.",
      cls: "class-management-today-status"
    });

    const events = eventsOn(calendar, date);
    if (events.length > 0) {
      const section = this.section(container, "calendar", "이날 행사");
      for (const event of events) {
        const item = section.createDiv({ cls: "class-management-today-item" });
        item.createSpan({
          text: `${event.type} · ${event.name}${event.periods.length ? ` (${event.periods.join(",")}교시)` : ""}`,
          cls: "class-management-nav-label"
        });
        item.setAttribute("aria-label", "행사 노트 열기");
        item.addEventListener("click", () => void this.plugin.openEventNote(event));
      }
    }

    if (!resolved || !semester || !timetable) return;
    const subject = resolved.subject.trim();
    const tables = await repository.getProgressTables(semester);
    const contents = buildAssignedSlotContents(
      calendar,
      { [semester]: timetable },
      { [semester]: tables }
    );
    const row = contents.get(`${date}|${period}`);

    const progress = this.section(container, "book-open", "진도 차시");
    if (!row) {
      progress.createEl("p", {
        cls: "class-management-today-hint",
        text: subject
          ? `${subject}에 배정된 차시가 없습니다.`
          : "과목이 비어 있습니다."
      });
    } else {
      const pinned = row.fixedDate === date && (row.fixedPeriod === period || row.fixedPeriod === 0);
      progress.createEl("div", {
        text: `${pinned ? "📌 " : ""}${row.order}. ${[row.unit, row.topic].filter(Boolean).join(" · ")}`,
        cls: "class-management-today-subject"
      });
      const details: Array<[string, string]> = [
        ["시수", String(row.hours)],
        ["성취기준", row.standard],
        ["준비물", row.materials],
        ["배정", row.assigned],
        ["비고", row.note]
      ];
      for (const [label, value] of details) {
        if (!value) continue;
        const line = progress.createDiv({ cls: "class-management-today-item is-static" });
        line.createSpan({ text: label, cls: "class-management-today-badge" });
        line.createSpan({ text: value, cls: "class-management-inspector-value" });
      }
    }

    const units = repository
      .getCurriculumUnits()
      .filter((unit) => unit.subject === subject);
    if (units.length > 0) {
      const section = this.section(container, "book-open-check", "연결된 통합 단원");
      for (const unit of units) {
        const item = section.createDiv({ cls: "class-management-today-item" });
        item.createSpan({ text: unit.unitName, cls: "class-management-nav-label" });
        item.addEventListener("click", () => void this.plugin.openFile(unit.file));
      }
    }

    const actions = container.createDiv({ cls: "class-management-inspector-actions" });
    const edit = actions.createEl("button", { text: "이 교시 편집" });
    edit.addEventListener("click", () => {
      const standardPromise = repository.getHoursStandard();
      void standardPromise.then((standard) => {
        new TimetableCellModal(this.plugin, {
          date,
          period,
          currentSubject: resolved.subject,
          hasOverride: resolved.source === "override",
          isEvent: resolved.source === "event",
          isRemoved: false,
          subjects: collectSubjectOptions(
            this.plugin.settings.schoolSubjects,
            tables,
            standard,
            timetable
          ),
          pinnedRowLabel: ""
        }).open();
      });
    });
    if (subject) {
      const promote = actions.createEl("button", { text: "수업일지 만들기" });
      promote.addEventListener(
        "click",
        () => void this.plugin.promoteProgressLesson(date, period)
      );
    }
    const table = tables.find((item) => item.subject === subject);
    if (table) {
      const open = actions.createEl("button", { text: "진도표 열기" });
      open.addEventListener("click", () => void this.plugin.openFile(table.file));
    } else if (subject) {
      const create = actions.createEl("button", { text: "진도표 만들기" });
      create.addEventListener("click", () => {
        new Notice("진도표 차시 가져오기에서 과목을 선택해 만들 수 있습니다.");
        this.plugin.openProgressImportModal();
      });
    }
  }

  private section(container: HTMLElement, icon: string, title: string): HTMLElement {
    const section = container.createDiv({ cls: "class-management-today-section" });
    const heading = section.createDiv({ cls: "class-management-today-title" });
    const iconEl = heading.createSpan({ cls: "class-management-nav-icon" });
    setIcon(iconEl, icon);
    heading.createSpan({ text: title });
    return section;
  }
}
