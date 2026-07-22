import { ItemView, Modal, Setting, WorkspaceLeaf } from "obsidian";
import { addOption } from "@core/dom";
import { ACTIVITY_KIND_LABELS } from "@core/activity";
import {
  buildCalendarEvents,
  calendarDays,
  dateKey,
  moveCalendarAnchor,
  type CalendarEvent
} from "@core/calendar";
import { dayStatus, eventsOn } from "@core/academic-calendar";
import type ClassManagementPlugin from "./main";
import type { AcademicCalendar, ActivityKind,
  CurriculumUnit } from "@core/types";

export const CALENDAR_VIEW_TYPE = "class-management-calendar";
const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export class ClassCalendarView extends ItemView {
  private anchor = new Date();
  private mode: "month" | "week";
  private events: CalendarEvent[] = [];
  private academicCalendar: AcademicCalendar | null = null;
  private projects: CurriculumUnit[] = [];
  private kind: "" | ActivityKind = "";
  private studentNumber = "";

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
    this.mode = plugin.settings.calendarViewMode;
  }

  getViewType(): string {
    return CALENDAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "학급 캘린더";
  }

  getIcon(): string {
    return "calendar-days";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const activities = await this.plugin.activityIndex.getEntries();
    this.events = buildCalendarEvents(activities);
    this.academicCalendar = await this.plugin.repository.getAcademicCalendar();
    this.projects = this.plugin.repository
      .getCurriculumUnits()
      .filter((unit) => unit.conceptInquiryEnabled && unit.startDate && unit.endDate);
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.contentEl.addClass("class-management-calendar-view");
    this.renderHeader();
    this.renderFilters();
    this.renderGrid();
  }

  private renderHeader(): void {
    const header = this.contentEl.createDiv({ cls: "class-management-calendar-header" });
    const navigation = header.createDiv({ cls: "class-management-calendar-navigation" });
    const previous = navigation.createEl("button", {
      text: "‹",
      attr: { "aria-label": this.mode === "month" ? "이전 달" : "이전 주" }
    });
    previous.addEventListener("click", () => {
      this.anchor = moveCalendarAnchor(this.anchor, this.mode, -1);
      this.render();
    });
    const today = navigation.createEl("button", { text: "오늘" });
    today.addEventListener("click", () => {
      this.anchor = new Date();
      this.render();
    });
    const next = navigation.createEl("button", {
      text: "›",
      attr: { "aria-label": this.mode === "month" ? "다음 달" : "다음 주" }
    });
    next.addEventListener("click", () => {
      this.anchor = moveCalendarAnchor(this.anchor, this.mode, 1);
      this.render();
    });

    header.createEl("h2", { text: this.headerTitle() });
    const modes = header.createDiv({ cls: "class-management-calendar-modes" });
    const week = modes.createEl("button", {
      text: "주간",
      cls: this.mode === "week" ? "is-active" : ""
    });
    week.addEventListener("click", () => void this.setMode("week"));
    const month = modes.createEl("button", {
      text: "월간",
      cls: this.mode === "month" ? "is-active" : ""
    });
    month.addEventListener("click", () => void this.setMode("month"));
  }

  private renderFilters(): void {
    const filters = this.contentEl.createDiv({ cls: "class-management-calendar-filters" });
    const kindLabel = filters.createEl("label");
    kindLabel.createEl("span", { text: "유형" });
    const kind = kindLabel.createEl("select");
    addOption(kind, "", "전체 유형");
    (Object.entries(ACTIVITY_KIND_LABELS) as Array<[ActivityKind, string]>).forEach(
      ([value, text]) => addOption(kind, value, text)
    );
    kind.value = this.kind;
    kind.addEventListener("change", () => {
      this.kind = kind.value as "" | ActivityKind;
      this.render();
    });

    const studentLabel = filters.createEl("label");
    studentLabel.createEl("span", { text: "학생" });
    const student = studentLabel.createEl("select");
    addOption(student, "", "전체 학생");
    this.plugin.repository.getStudents().forEach((entry) =>
      addOption(student, entry.number, `${entry.number}번 ${entry.name}`)
    );
    student.value = this.studentNumber;
    student.addEventListener("change", () => {
      this.studentNumber = student.value;
      this.render();
    });

    filters.createEl("span", {
      text: "날짜의 + 버튼으로 기록·출결·과제·할 일·회신표를 빠르게 만들 수 있습니다.",
      cls: "setting-item-description"
    });
  }

  private renderGrid(): void {
    const days = calendarDays(this.anchor, this.mode);
    const filteredEvents = this.events.filter(
      (event) =>
        (!this.kind || event.kind === this.kind) &&
        (!this.studentNumber || event.studentNumbers.includes(this.studentNumber))
    );
    const eventsByDate = new Map<string, CalendarEvent[]>();
    filteredEvents.forEach((event) => {
      const group = eventsByDate.get(event.date) ?? [];
      group.push(event);
      eventsByDate.set(event.date, group);
    });

    const grid = this.contentEl.createDiv({
      cls: `class-management-calendar-grid is-${this.mode}`
    });
    WEEKDAY_LABELS.forEach((weekday) =>
      grid.createEl("div", {
        text: weekday,
        cls: "class-management-calendar-weekday"
      })
    );

    const today = dateKey(new Date());
    days.forEach((day) => {
      const key = dateKey(day);
      const cell = grid.createDiv({ cls: "class-management-calendar-day" });
      if (this.mode === "month" && day.getMonth() !== this.anchor.getMonth()) {
        cell.addClass("is-outside");
      }
      if (key === today) cell.addClass("is-today");

      const dayHeader = cell.createDiv({ cls: "class-management-calendar-day-header" });
      dayHeader.createEl("span", { text: String(day.getDate()) });
      if (this.academicCalendar) {
        const status = dayStatus(this.academicCalendar, key);
        if (status.kind === "closed" || status.kind === "vacation") {
          cell.addClass("is-school-closed");
          dayHeader.createEl("span", {
            text: status.name || "휴업",
            cls: "class-management-calendar-day-status"
          });
        }
        eventsOn(this.academicCalendar, key).forEach((event) => {
          cell.createEl("span", {
            text: `${event.type === "단축" || event.type === "연장" ? `${event.type} ` : ""}${event.name}`,
            cls: "class-management-calendar-school-event"
          });
        });
      }
      for (const unit of this.projects) {
        const boundary = unit.startDate === key ? "시작" : unit.endDate === key ? "마침" : "";
        if (!boundary) continue;
        const project = cell.createEl("button", {
          cls: "class-management-calendar-event is-project",
          attr: { "aria-label": `${unit.unitName} 프로젝트 ${boundary} — 단원 노트 열기` }
        });
        project.createEl("strong", { text: `✦ ${unit.unitName} ${boundary}` });
        project.addEventListener("click", () => void this.plugin.openFile(unit.file));
      }
      const add = dayHeader.createEl("button", {
        text: "+",
        attr: { "aria-label": `${key} 항목 추가` }
      });
      add.addEventListener("click", () => new CalendarDateActionModal(this.plugin, key).open());

      const dayEvents = eventsByDate.get(key) ?? [];
      const limit = this.mode === "month" ? 4 : 12;
      dayEvents.slice(0, limit).forEach((event) => {
        const button = cell.createEl("button", {
          cls: `class-management-calendar-event is-${event.kind}`
        });
        button.createEl("strong", { text: event.title });
        if (this.mode === "week" && event.detail) {
          button.createEl("span", { text: event.detail });
        }
        button.addEventListener("click", () => void this.plugin.openFile(event.file));
      });
      if (dayEvents.length > limit) {
        cell.createEl("span", {
          text: `+${dayEvents.length - limit}건`,
          cls: "class-management-calendar-more"
        });
      }
    });
  }

  private async setMode(mode: "month" | "week"): Promise<void> {
    this.mode = mode;
    this.plugin.settings.calendarViewMode = mode;
    await this.plugin.saveData(this.plugin.settings);
    this.render();
  }

  private headerTitle(): string {
    if (this.mode === "month") {
      return `${this.anchor.getFullYear()}년 ${this.anchor.getMonth() + 1}월`;
    }
    const days = calendarDays(this.anchor, "week");
    const first = days[0];
    const last = days[6];
    if (!first || !last) return "주간";
    return `${first.getFullYear()}.${first.getMonth() + 1}.${first.getDate()} – ${last.getFullYear()}.${last.getMonth() + 1}.${last.getDate()}`;
  }
}

class CalendarDateActionModal extends Modal {
  constructor(
    private readonly plugin: ClassManagementPlugin,
    private readonly date: string
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle(`${this.date} 빠른 추가`);
    new Setting(this.contentEl)
      .setName("학생 기록")
      .setDesc("학생을 선택해 관찰·상담·칭찬 기록을 작성합니다.")
      .addButton((button) =>
        button.setButtonText("작성").onClick(() => {
          this.close();
          this.plugin.openRecordFlow(this.date);
        })
      );
    new Setting(this.contentEl)
      .setName("출결")
      .setDesc("선택한 날짜의 출결을 체크합니다.")
      .addButton((button) =>
        button.setButtonText("체크").onClick(() => {
          this.close();
          this.plugin.openAttendanceModal(this.date);
        })
      );
    new Setting(this.contentEl)
      .setName("과제")
      .setDesc("선택한 날짜의 새 과제를 만듭니다.")
      .addButton((button) =>
        button.setButtonText("만들기").onClick(() => {
          this.close();
          this.plugin.openNewAssignment(this.date);
        })
      );
    new Setting(this.contentEl)
      .setName("할 일")
      .setDesc("선택한 날짜를 마감일로 하는 할 일을 수집합니다.")
      .addButton((button) =>
        button.setButtonText("수집").onClick(() => {
          this.close();
          this.plugin.openTaskModal(this.date);
        })
      );
    new Setting(this.contentEl)
      .setName("가정통신문")
      .setDesc("선택한 날짜를 발송일로 하는 회신표를 만듭니다.")
      .addButton((button) =>
        button.setButtonText("만들기").onClick(() => {
          this.close();
          this.plugin.openNoticeFlow(this.date);
        })
      );
    new Setting(this.contentEl)
      .setName("루틴")
      .setDesc("선택한 날짜의 반복 체크리스트를 엽니다.")
      .addButton((button) =>
        button.setButtonText("열기").onClick(() => {
          this.close();
          void this.plugin.openRoutines(this.date);
        })
      );
  }
}

