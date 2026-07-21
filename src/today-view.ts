import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { dayStatus, semesterForDate, weekdayLabel } from "./academic-calendar";
import { resolveDay } from "./timetable";
import { buildAssignedSlotContents } from "./progress";
import { collectSubjectOptions } from "./subject-options";
import { TimetableCellModal } from "./timetable-cell-modal";
import { localDate } from "./utils";
import type ClassManagementPlugin from "./main";
import type { AcademicCalendar, ProgressRow } from "./types";

export const TODAY_VIEW_TYPE = "class-management-today";

export class TodayView extends ItemView {
  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return TODAY_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "오늘";
  }

  getIcon(): string {
    return "sun";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    container.addClass("class-management-today-view");
    const repository = this.plugin.repository;
    const today = localDate();

    const calendar = await repository.getAcademicCalendar();
    const status = calendar ? dayStatus(calendar, today) : null;
    const semester = calendar ? semesterForDate(calendar, today) : "";

    const header = container.createDiv({ cls: "class-management-today-header" });
    header.createEl("div", {
      text: `${today} (${weekdayLabel(today)})`,
      cls: "class-management-today-date"
    });
    header.createEl("div", {
      text: !calendar
        ? "학사일정 노트를 만들면 오늘 현황이 표시됩니다."
        : status?.kind === "class"
          ? `수업일 · ${semester}`
          : status?.kind === "weekend"
            ? "주말"
            : status?.name || "휴업일",
      cls: "class-management-today-status"
    });

    if (calendar) {
      await this.renderTimetable(container, calendar, semester, today);
      if (status?.kind === "class") await this.renderAttendance(container, today);
    }
    await this.renderDue(container, today);
    await this.renderRoutines(container, today);
    if (calendar) this.renderUpcoming(container, calendar, today);
  }

  private section(container: HTMLElement, icon: string, title: string): HTMLElement {
    const section = container.createDiv({ cls: "class-management-today-section" });
    const heading = section.createDiv({ cls: "class-management-today-title" });
    const iconEl = heading.createSpan({ cls: "class-management-nav-icon" });
    setIcon(iconEl, icon);
    heading.createSpan({ text: title });
    return section;
  }

  private async renderTimetable(
    container: HTMLElement,
    calendar: AcademicCalendar,
    semester: string,
    today: string
  ): Promise<void> {
    const section = this.section(container, "table", "오늘 시간표");
    const timetable = semester
      ? await this.plugin.repository.getBaseTimetable(semester)
      : null;
    const day = resolveDay(calendar, timetable, today);

    if (!day.isClassDay || day.periods.length === 0) {
      section.createEl("p", {
        cls: "class-management-today-hint",
        text: day.isClassDay ? "오늘 배정된 교시가 없습니다." : "오늘은 수업이 없습니다."
      });
      return;
    }

    let contents = new Map<string, ProgressRow>();
    let subjects: string[] = [];
    if (semester && timetable) {
      const tables = await this.plugin.repository.getProgressTables(semester);
      const standard = await this.plugin.repository.getHoursStandard();
      contents = buildAssignedSlotContents(
        calendar,
        { [semester]: timetable },
        { [semester]: tables }
      );
      subjects = collectSubjectOptions(
        this.plugin.settings.schoolSubjects,
        tables,
        standard,
        timetable
      );
    }

    for (const period of day.periods) {
      const row = section.createDiv({ cls: "class-management-today-period" });
      row.createSpan({ text: String(period.period), cls: "class-management-today-period-no" });
      const body = row.createDiv({ cls: "class-management-today-period-body" });
      const subjectLine = body.createDiv({ cls: "class-management-today-subject" });
      subjectLine.createSpan({ text: period.subject || "(빈 교시)" });
      if (period.source === "event") subjectLine.addClass("is-event");
      const content = contents.get(`${today}|${period.period}`);
      if (content) {
        const pinned = content.fixedDate === today &&
          (content.fixedPeriod === period.period || content.fixedPeriod === 0);
        body.createDiv({
          text: `${pinned ? "📌 " : ""}${[content.unit, content.topic].filter(Boolean).join(" · ")}`,
          cls: "class-management-today-topic"
        });
      }
      if (semester && timetable) {
        row.addClass("is-editable");
        row.setAttribute("role", "button");
        row.setAttribute("tabindex", "0");
        row.setAttribute("aria-label", `${today} ${period.period}교시 ${period.subject} 편집`);
        const open = (): void => {
          this.plugin.updateLessonInspector(today, period.period);
          new TimetableCellModal(this.plugin, {
            date: today,
            period: period.period,
            currentSubject: period.subject,
            hasOverride: period.source === "override",
            isEvent: period.source === "event",
            isRemoved: false,
            subjects,
            pinnedRowLabel: ""
          }).open();
        };
        row.addEventListener("click", open);
        row.addEventListener("keydown", (event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            open();
          }
        });
      }
    }
  }

  private async renderAttendance(container: HTMLElement, today: string): Promise<void> {
    const section = this.section(container, "user-check", "출결");
    const students = this.plugin.repository.getStudents();
    const marks = await this.plugin.repository.getAttendance(today);

    if (marks.length === 0) {
      section.createEl("p", {
        cls: "class-management-today-hint is-warning",
        text: `미체크 · 학생 ${students.length}명`
      });
    } else {
      const counts = new Map<string, number>();
      for (const mark of marks) counts.set(mark.status, (counts.get(mark.status) ?? 0) + 1);
      section.createEl("p", {
        cls: "class-management-today-hint",
        text: [...counts.entries()].map(([label, count]) => `${label} ${count}`).join(" · ")
      });
    }
    const button = section.createEl("button", {
      text: marks.length === 0 ? "출결 체크" : "출결 수정",
      cls: marks.length === 0 ? "mod-cta" : ""
    });
    button.addEventListener("click", () => this.plugin.openAttendanceModal(today));
  }

  private async renderDue(container: HTMLElement, today: string): Promise<void> {
    const section = this.section(container, "inbox", "오늘 마감·할 일");
    const tasks = this.plugin.repository
      .getTasks()
      .filter((task) => task.status !== "done" && task.dueDate && task.dueDate <= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 5);
    const notices = this.plugin.repository
      .getNoticeSummaries()
      .filter((notice) => notice.dueDate && notice.dueDate >= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);

    if (tasks.length === 0 && notices.length === 0) {
      section.createEl("p", {
        cls: "class-management-today-hint",
        text: "오늘 마감인 항목이 없습니다."
      });
      return;
    }
    for (const task of tasks) {
      const row = section.createDiv({ cls: "class-management-today-item" });
      row.createSpan({
        text: task.dueDate < today ? "지남" : "오늘",
        cls: `class-management-today-badge${task.dueDate < today ? " is-warning" : ""}`
      });
      row.createSpan({ text: task.title });
      row.addEventListener("click", () => void this.plugin.openFile(task.file));
    }
    for (const notice of notices) {
      const days = this.daysBetween(today, notice.dueDate);
      const row = section.createDiv({ cls: "class-management-today-item" });
      row.createSpan({
        text: days === 0 ? "오늘" : `D-${days}`,
        cls: `class-management-today-badge${days <= 1 ? " is-warning" : ""}`
      });
      row.createSpan({ text: `회신 마감 · ${notice.title}` });
      row.addEventListener("click", () => void this.plugin.openFile(notice.file));
    }
  }

  private async renderRoutines(container: HTMLElement, today: string): Promise<void> {
    const entries = await this.plugin.activityIndex.getEntries();
    const routines = entries.filter(
      (entry) => entry.kind === "routine" && entry.date === today
    );
    if (routines.length === 0) return;
    const done = routines.filter((entry) => entry.status === "완료").length;
    const section = this.section(container, "repeat", "루틴");
    section.createEl("p", {
      cls: `class-management-today-hint${done < routines.length ? " is-warning" : ""}`,
      text: `${done}/${routines.length} 완료`
    });
    const button = section.createEl("button", { text: "루틴 열기" });
    button.addEventListener("click", () => void this.plugin.openRoutines(today));
  }

  private renderUpcoming(
    container: HTMLElement,
    calendar: AcademicCalendar,
    today: string
  ): void {
    const upcoming = [
      ...calendar.events.map((event) => ({ date: event.date, name: event.name })),
      ...calendar.closedDays.map((day) => ({ date: day.date, name: day.name || day.category }))
    ]
      .filter((item) => item.date >= today && this.daysBetween(today, item.date) <= 14)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);
    if (upcoming.length === 0) return;

    const section = this.section(container, "calendar", "다가오는 일정");
    for (const item of upcoming) {
      const days = this.daysBetween(today, item.date);
      const row = section.createDiv({ cls: "class-management-today-item" });
      row.createSpan({
        text: days === 0 ? "오늘" : `D-${days}`,
        cls: "class-management-today-badge"
      });
      row.createSpan({ text: `${item.name} (${item.date.slice(5)})` });
    }
  }

  private daysBetween(from: string, to: string): number {
    const [fy, fm, fd] = from.split("-").map(Number);
    const [ty, tm, td] = to.split("-").map(Number);
    const start = new Date(fy ?? 1970, (fm ?? 1) - 1, fd ?? 1, 12);
    const end = new Date(ty ?? 1970, (tm ?? 1) - 1, td ?? 1, 12);
    return Math.round((end.getTime() - start.getTime()) / 86400000);
  }
}
