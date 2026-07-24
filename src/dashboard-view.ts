import { ItemView, WorkspaceLeaf } from "obsidian";
import { scaffoldView } from "./dom";
import type ClassManagementPlugin from "./main";
import { addDays, dayStatus, semesterForDate, weekdayLabel } from "@core/academic-calendar";
import { resolveDay } from "@core/timetable";
import { buildAssignedSlotContents } from "@core/progress";
import { taughtHoursForUnit } from "@core/curriculum";
import type {
  AcademicCalendar,
  ActivityEntry,
  AttendanceMark,
  CurriculumUnit,
  RecordEntry,
  StudentEntry,
  TaskEntry
} from "@core/types";
import { localDate } from "@core/utils";

export const DASHBOARD_VIEW_TYPE = "class-management-dashboard";

export class ClassDashboardView extends ItemView {
  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return DASHBOARD_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "학급 대시보드";
  }

  getIcon(): string {
    return "school";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const container = this.contentEl;
    container.empty();
    const settings = this.plugin.settings;
    const { body } = scaffoldView(container, {
      cls: "class-management-dashboard",
      // 표준 골격의 예외: 대시보드 제목은 뷰 이름 대신 학급 이름이다 (DESIGN §6.5).
      title: settings.className,
      description: `${settings.schoolYear} ${settings.semester} · ${settings.grade}학년 · 학생 기록과 학급 운영 업무를 한눈에 확인합니다.${this.plugin.activeClassProfile.archived ? " · 읽기 전용 보관" : ""}`
    });

    const repository = this.plugin.repository;
    const students = repository.getStudents();
    const records = repository.getRecords();
    const today = localDate();
    const attendance = await repository.getAttendance(today);
    const calendar = await repository.getAcademicCalendar();
    const semester = calendar ? semesterForDate(calendar, today) : "";
    const timetable = semester ? await repository.getBaseTimetable(semester) : null;
    const tables = semester ? await repository.getProgressTables(semester) : [];
    const units = repository.getCurriculumUnits();
    const lessons = repository.getCurriculumLessons();
    const tasks = repository.getTasks();
    const activities = await this.plugin.activityIndex.getEntries();

    this.renderSummary(body, students, records, attendance, today);

    const grid = body.createDiv({ cls: "class-management-grid" });
    const main = grid.createDiv({ cls: "class-management-dashboard-column" });
    const side = grid.createDiv({ cls: "class-management-dashboard-column" });

    this.renderTodayTimetable(main, calendar, semester, timetable, tables, today);
    this.renderActiveUnits(main, units, lessons, semester, today);
    this.renderRecentRecords(main, records);

    this.renderChecks(side, records, activities, today);
    this.renderTasks(side, tasks, today);
    this.renderUpcoming(side, calendar, today);
    this.renderStudents(side, students);
  }

  /** 패널 공통 골격 — 제목 h3 + 해당 뷰로 가는 명시 버튼 (§7.2 카드 전체 클릭 금지). */
  private panel(
    container: HTMLElement,
    title: string,
    open?: { label: string; run: () => void }
  ): HTMLElement {
    const panel = container.createDiv({ cls: "class-management-panel" });
    const heading = panel.createDiv({ cls: "class-management-panel-heading" });
    heading.createEl("h3", { text: title });
    if (open) {
      const button = heading.createEl("button", {
        text: open.label,
        cls: "class-management-panel-open"
      });
      button.addEventListener("click", open.run);
    }
    return panel;
  }

  /** 오늘 수업은? — 교시·과목·배정 차시. 행 클릭은 차시 인스펙터(좌클릭=보기). */
  private renderTodayTimetable(
    container: HTMLElement,
    calendar: AcademicCalendar | null,
    semester: string,
    timetable: import("@core/types").BaseTimetable | null,
    tables: import("@core/types").ProgressTable[],
    today: string
  ): void {
    const panel = this.panel(container, "오늘 시간표", {
      label: "시간표·시수",
      run: () => void this.plugin.openCurriculumOps()
    });
    if (!calendar) {
      this.renderEmpty(panel, "학사일정 노트를 만들면 오늘 시간표가 표시됩니다.", "학사일정 노트 열기", () =>
        void this.plugin.openAcademicCalendarNote()
      );
      return;
    }
    const status = dayStatus(calendar, today);
    if (status.kind !== "class") {
      panel.createEl("p", {
        cls: "class-management-dashboard-hint",
        text: status.kind === "weekend" ? "주말입니다." : `${status.name || "휴업일"}입니다.`
      });
      return;
    }
    if (!timetable) {
      this.renderEmpty(panel, "이 학기 기초시간표가 아직 없습니다.", "기초시간표 노트 열기", () =>
        void this.plugin.openBaseTimetableNote()
      );
      return;
    }
    const contents = buildAssignedSlotContents(
      calendar,
      { [semester]: timetable },
      { [semester]: tables }
    );
    const day = resolveDay(calendar, timetable, today);
    if (day.periods.length === 0) {
      panel.createEl("p", { cls: "class-management-dashboard-hint", text: "오늘은 배정된 교시가 없습니다." });
      return;
    }
    const list = panel.createDiv({ cls: "class-management-dashboard-slots" });
    day.periods.forEach((period) => {
      const row = list.createEl("button", {
        cls: "class-management-dashboard-slot",
        attr: { "aria-label": `${period.period}교시 ${period.subject} — 클릭: 차시 인스펙터` }
      });
      row.createEl("span", { text: `${period.period}`, cls: "class-management-dashboard-slot-period" });
      row.createEl("span", { text: period.subject, cls: "class-management-dashboard-slot-subject" });
      const topic = contents.get(`${today}|${period.period}`)?.topic ?? "";
      row.createEl("span", {
        text: period.source === "event" ? "행사" : topic,
        cls: "class-management-dashboard-slot-topic"
      });
      row.addEventListener("click", () => void this.plugin.openLessonInspector(today, period.period));
    });
  }

  /** 지금 어느 단원인가? — 오늘이 기간에 든 단원의 진행률 (미니 로드맵). */
  private renderActiveUnits(
    container: HTMLElement,
    units: CurriculumUnit[],
    lessons: import("@core/types").CurriculumLesson[],
    semester: string,
    today: string
  ): void {
    const panel = this.panel(container, "진행 중 단원", {
      label: "교육과정 로드맵",
      run: () => void this.plugin.openCurriculumGantt()
    });
    const subjectOrder = this.plugin.settings.schoolSubjects;
    const active = units
      .filter((unit) =>
        (!semester || unit.semester === semester) &&
        unit.startDate && unit.endDate && unit.startDate <= today && today <= unit.endDate
      )
      .sort((a, b) => {
        const ai = subjectOrder.indexOf(a.subject);
        const bi = subjectOrder.indexOf(b.subject);
        return (ai < 0 ? 99 : ai) - (bi < 0 ? 99 : bi) || a.subject.localeCompare(b.subject, "ko");
      });
    if (active.length === 0) {
      panel.createEl("p", {
        cls: "class-management-dashboard-hint",
        text: "오늘 기간에 든 단원이 없습니다. 단원 설계에 시작일·종료일을 입력하면 나타납니다."
      });
      return;
    }
    const list = panel.createDiv({ cls: "class-management-dashboard-units" });
    active.slice(0, 6).forEach((unit) => {
      const row = list.createEl("button", {
        cls: "class-management-dashboard-unit",
        attr: { "aria-label": `${unit.subject} ${unit.unitName} 단원 노트 열기` }
      });
      const label = row.createDiv({ cls: "class-management-dashboard-unit-label" });
      if (unit.conceptInquiryEnabled) {
        label.createSpan({ text: "✦ ", cls: "class-management-dashboard-unit-integrated" });
      }
      label.createSpan({ text: `${unit.subject} · ${unit.unitName}` });
      const planned = Math.max(unit.plannedHours, 0);
      const taught = taughtHoursForUnit(unit.id, lessons);
      const percent = planned > 0 ? Math.min(100, Math.round((taught / planned) * 100)) : 0;
      const meter = row.createDiv({ cls: "class-management-dashboard-unit-meter" });
      const track = meter.createDiv({ cls: "class-management-progress-track" });
      track.createDiv({ cls: "class-management-progress-fill" }).style.width = `${percent}%`;
      meter.createSpan({
        text: planned > 0 ? `${taught}/${planned}시수 · ${percent}%` : "이관 운영",
        cls: "class-management-dashboard-unit-figure"
      });
      row.addEventListener("click", () => void this.plugin.openFile(unit.file));
    });
    if (active.length > 6) {
      panel.createEl("p", {
        cls: "class-management-dashboard-hint",
        text: `외 ${active.length - 6}개 단원은 교육과정 로드맵에서 확인하세요.`
      });
    }
  }

  /** 반드시 확인할 것 — 검토 대기 근거·미제출·미회신·이번 달 출결 예외. */
  private renderChecks(
    container: HTMLElement,
    records: RecordEntry[],
    activities: ActivityEntry[],
    today: string
  ): void {
    const panel = this.panel(container, "확인 필요", {
      label: "분석·보고서",
      run: () => void this.plugin.openReports()
    });
    const monthStart = `${today.slice(0, 7)}-01`;
    const rows: Array<[string, number]> = [
      [
        "검토 대기 학생부 근거",
        records.filter((record) => record.schoolRecordEvidence?.reviewStatus === "raw").length
      ],
      [
        "미제출 과제",
        activities.filter((entry) => entry.kind === "assignment" && entry.status === "미제출").length
      ],
      [
        "미회신 가정통신문",
        activities.filter((entry) => entry.kind === "notice" && entry.status !== "회신 완료").length
      ],
      [
        "이번 달 출결 예외",
        activities.filter(
          (entry) => entry.kind === "attendance" && entry.status !== "출석" && entry.date >= monthStart
        ).length
      ]
    ];
    const list = panel.createDiv({ cls: "class-management-dashboard-checks" });
    rows.forEach(([label, count]) => {
      const row = list.createDiv({ cls: "class-management-dashboard-check" });
      row.createSpan({ text: label });
      row.createSpan({
        text: count > 0 ? `${count}건` : "없음",
        cls: count > 0 ? "class-management-dashboard-check-count is-warning" : "class-management-dashboard-check-count"
      });
    });
  }

  /** 미결 할 일 — 상태별 건수와 마감 지난·오늘 항목. */
  private renderTasks(container: HTMLElement, tasks: TaskEntry[], today: string): void {
    const panel = this.panel(container, "GTD 할 일", {
      label: "GTD 보드",
      run: () => void this.plugin.openTasks()
    });
    const open = tasks.filter((task) => task.status !== "done");
    if (open.length === 0) {
      panel.createEl("p", { cls: "class-management-dashboard-hint", text: "미결 할 일이 없습니다." });
      return;
    }
    const counts = [
      ["수집함", open.filter((task) => task.status === "inbox").length],
      ["다음 행동", open.filter((task) => task.status === "next").length],
      ["대기", open.filter((task) => task.status === "waiting").length]
    ] as const;
    panel.createEl("p", {
      cls: "class-management-dashboard-hint",
      text: counts.map(([label, count]) => `${label} ${count}`).join(" · ")
    });
    const due = open
      .filter((task) => task.dueDate && task.dueDate <= today)
      .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
      .slice(0, 3);
    if (due.length > 0) {
      const list = panel.createDiv({ cls: "class-management-dashboard-checks" });
      due.forEach((task) => {
        const row = list.createEl("button", {
          cls: "class-management-dashboard-due",
          attr: { "aria-label": `${task.title} 노트 열기` }
        });
        row.createSpan({ text: task.title });
        row.createSpan({
          text: task.dueDate === today ? "오늘 마감" : `마감 ${task.dueDate}`,
          cls: "class-management-dashboard-check-count is-warning"
        });
        row.addEventListener("click", () => void this.plugin.openFile(task.file));
      });
    }
  }

  /** 다가오는 7일 — 행사·휴업일. */
  private renderUpcoming(
    container: HTMLElement,
    calendar: AcademicCalendar | null,
    today: string
  ): void {
    const panel = this.panel(container, "다가오는 일정", {
      label: "학급 캘린더",
      run: () => void this.plugin.openCalendar()
    });
    if (!calendar) {
      panel.createEl("p", {
        cls: "class-management-dashboard-hint",
        text: "학사일정 노트를 만들면 행사·휴업일이 표시됩니다."
      });
      return;
    }
    const items: Array<{ date: string; label: string; kind: "event" | "closed" }> = [];
    for (let offset = 0; offset <= 7; offset += 1) {
      const date = addDays(today, offset);
      calendar.events
        .filter((event) => event.date === date)
        .forEach((event) => {
          const periods = event.periods.length ? ` · ${event.periods.join(",")}교시` : "";
          items.push({ date, label: `${event.name}${periods}`, kind: "event" });
        });
      const status = dayStatus(calendar, date);
      if (status.kind === "closed") {
        items.push({ date, label: status.name || "휴업일", kind: "closed" });
      }
    }
    if (items.length === 0) {
      panel.createEl("p", { cls: "class-management-dashboard-hint", text: "7일 안에 행사·휴업일이 없습니다." });
      return;
    }
    const list = panel.createDiv({ cls: "class-management-dashboard-checks" });
    items.slice(0, 6).forEach((item) => {
      const row = list.createDiv({ cls: "class-management-dashboard-check" });
      row.createSpan({
        text: `${item.date.slice(5).replace("-", "/")}(${weekdayLabel(item.date)}) ${item.kind === "event" ? "● " : ""}${item.label}`,
        cls: item.kind === "event" ? "class-management-dashboard-event" : undefined
      });
    });
  }

  private renderSummary(
    container: HTMLElement,
    students: StudentEntry[],
    records: RecordEntry[],
    attendance: AttendanceMark[],
    today: string
  ): void {
    const summary = container.createDiv({ cls: "class-management-summary" });
    const values = [
      ["학생", `${students.length}명`],
      [
        "오늘 출결",
        attendance.length > 0
          ? `${attendance.filter((mark) => mark.status === "출석").length}/${attendance.length}명`
          : "미체크"
      ],
      ["오늘 기록", `${records.filter((record) => record.date === today).length}건`],
      ["전체 기록", `${records.length}건`]
    ];

    values.forEach(([label, value]) => {
      const card = summary.createDiv({ cls: "class-management-summary-card" });
      card.createEl("span", { text: label ?? "" });
      card.createEl("strong", { text: value ?? "" });
    });
  }

  private renderStudents(container: HTMLElement, students: StudentEntry[]): void {
    const section = container.createDiv({ cls: "class-management-panel" });
    section.createEl("h3", { text: "학생 명단" });

    if (students.length === 0) {
      this.renderEmpty(section, "아직 등록한 학생이 없습니다.", "첫 학생 추가", () =>
        this.plugin.openStudentModal()
      );
      return;
    }

    const list = section.createDiv({ cls: "class-management-student-list" });
    students.forEach((student) => {
      const row = list.createDiv({ cls: "class-management-student-row" });
      const note = row.createEl("button", {
        cls: "class-management-student-note",
        attr: { "aria-label": `${student.number}번 ${student.name} 학생 인스펙터 열기` }
      });
      note.createEl("span", {
        text: student.number,
        cls: "class-management-student-number"
      });
      note.createEl("span", { text: student.name });
      note.addEventListener("click", () => void this.plugin.inspectStudent(student.number));
      const timeline = row.createEl("button", {
        text: "타임라인",
        cls: "class-management-timeline-button",
        attr: { "aria-label": `${student.number}번 ${student.name} 타임라인 열기` }
      });
      timeline.addEventListener("click", () => void this.plugin.openStudentTimeline(student));
    });
  }

  private renderRecentRecords(container: HTMLElement, records: RecordEntry[]): void {
    const section = container.createDiv({ cls: "class-management-panel" });
    section.createEl("h3", { text: "최근 기록" });

    if (records.length === 0) {
      this.renderEmpty(section, "아직 작성한 기록이 없습니다.", "첫 기록 작성", () =>
        this.plugin.openRecordFlow()
      );
      return;
    }

    const list = section.createDiv({ cls: "class-management-record-list" });
    records.slice(0, 10).forEach((record) => {
      const row = list.createEl("button", {
        cls: "class-management-record-row",
        attr: { "aria-label": `${record.studentNumber}번 ${record.studentName} ${record.date} 기록 열기` }
      });
      const meta = row.createDiv({ cls: "class-management-record-meta" });
      meta.createEl("strong", {
        text: `${record.studentNumber}번 ${record.studentName}`
      });
      meta.createEl("span", { text: `${record.date} · ${record.recordType}` });
      row.addEventListener("click", () => void this.plugin.openFile(record.file));
    });
  }

  private renderEmpty(
    container: HTMLElement,
    message: string,
    buttonText: string,
    onClick: () => void
  ): void {
    const empty = container.createDiv({ cls: "class-management-empty" });
    empty.createEl("p", { text: message });
    const button = empty.createEl("button", { text: buttonText });
    button.addEventListener("click", onClick);
  }
}
