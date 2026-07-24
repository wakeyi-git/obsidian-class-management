import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { addOption, filterLabel } from "./dom";
import type ClassManagementPlugin from "./main";
import { taskRecurrenceLabel } from "@core/task";
import type { NoticeSheet, TaskEntry, TaskStatus,
  RoutineInstance } from "@core/types";
import { localDate } from "@core/utils";

export const TASK_VIEW_TYPE = "class-management-task-view";

const TASK_COLUMNS: Array<{ status: TaskStatus; label: string }> = [
  { status: "inbox", label: "수집함" },
  { status: "next", label: "다음 행동" },
  { status: "waiting", label: "대기" },
  { status: "someday", label: "언젠가" },
  { status: "done", label: "완료" }
];

export class TaskView extends ItemView {
  private query = "";
  private project = "";
  private context = "";
  private boardHost: HTMLElement | null = null;
  private data: { tasks: TaskEntry[]; notices: NoticeSheet[] } | null = null;
  private todayRoutine: RoutineInstance | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return TASK_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "GTD 할 일";
  }

  getIcon(): string {
    return "list-checks";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const notices = await Promise.all(
      this.plugin.repository.getNoticeSummaries().map((summary) =>
        this.plugin.repository.loadNotice(summary)
      )
    );
    const today = localDate();
    const summary = this.plugin.repository
      .getRoutineInstanceSummaries()
      .find((entry) => entry.date === today);
    this.todayRoutine = summary
      ? await this.plugin.repository.loadRoutineInstance(summary.file, today)
      : null;
    this.render(this.plugin.repository.getTasks(), notices);
  }

  private render(tasks: TaskEntry[], notices: NoticeSheet[]): void {
    this.contentEl.empty();
    this.contentEl.addClass("class-management-task-view");
    const header = this.contentEl.createDiv({ cls: "class-management-view-header" });
    const title = header.createDiv();
    title.createEl("h2", { text: "GTD 할 일" });
    title.createEl("p", { text: this.reviewSummary(tasks, notices) });
    const add = header.createEl("button", { text: "할 일 수집", cls: "mod-cta" });
    add.addEventListener("click", () => this.plugin.openTaskModal());

    if (this.todayRoutine && this.todayRoutine.items.length > 0) {
      const done = this.todayRoutine.items.filter((item) => item.completed).length;
      const routineLine = this.contentEl.createDiv({ cls: "class-management-today-item is-static class-management-task-routine" });
      routineLine.createSpan({ text: "루틴", cls: "class-management-today-badge" });
      routineLine.createSpan({ text: `오늘 ${done}/${this.todayRoutine.items.length} 완료` });
      const open = routineLine.createEl("button", { text: "루틴 열기" });
      open.addEventListener("click", () => void this.plugin.openRoutines());
    }
    this.renderFilters(tasks, notices);
    // 필터 변경 시 입력창(한글 조합·포커스)을 보존하려고 보드 영역만 다시 그린다.
    this.boardHost = this.contentEl.createDiv();
    this.data = { tasks, notices };
    this.renderBoard();
  }

  private renderBoard(): void {
    if (!this.boardHost || !this.data) return;
    this.boardHost.empty();
    const { tasks, notices } = this.data;
    const normalized = this.query.trim().toLocaleLowerCase("ko");
    const filtered = tasks.filter((task) =>
      (!normalized || `${task.title} ${task.project} ${task.context} ${task.studentName}`
        .toLocaleLowerCase("ko").includes(normalized)) &&
      (!this.project || task.project === this.project) &&
      (!this.context || task.context === this.context)
    );

    const pendingNotices = notices.filter((notice) =>
      notice.marks.some((mark) => mark.status !== "회신 완료")
    );
    if (filtered.length === 0 && pendingNotices.length === 0) {
      this.boardHost.createEl("p", {
        cls: "class-management-today-hint",
        text: tasks.length === 0
          ? "할 일이 없습니다. 오른쪽 위 `할 일 수집`으로 첫 항목을 추가하세요."
          : "필터에 맞는 할 일이 없습니다. 검색어나 필터를 지워 보세요."
      });
    }
    const board = this.boardHost.createDiv({ cls: "class-management-task-board" });
    TASK_COLUMNS.forEach((column) => {
      const columnEl = board.createDiv({ cls: `class-management-task-column is-${column.status}` });
      const matching = filtered.filter((task) => task.status === column.status);
      const linkedNotices = column.status === "waiting" ? pendingNotices : [];
      columnEl.createEl("h3", { text: `${column.label} ${matching.length + linkedNotices.length}` });
      linkedNotices.forEach((notice) => {
        const pending = notice.marks.filter((mark) => mark.status !== "회신 완료").length;
        const card = columnEl.createDiv({ cls: "class-management-task-card is-notice" });
        const open = card.createEl("button", { text: notice.title });
        open.addEventListener("click", () => void this.plugin.openFile(notice.file));
        card.createEl("small", {
          text: `가정통신문 · 미회신·확인 ${pending}명${notice.dueDate ? ` · 마감 ${notice.dueDate}` : ""}`
        });
      });
      if (matching.length === 0 && linkedNotices.length === 0) {
        columnEl.createEl("p", { text: "항목 없음", cls: "setting-item-description" });
      }
      matching.forEach((task) => this.renderTask(columnEl, task));
    });
  }

  private renderFilters(tasks: TaskEntry[], notices: NoticeSheet[]): void {
    const filters = this.contentEl.createDiv({ cls: "class-management-filter-bar" });
    const searchLabel = filterLabel(filters, "검색");
    const search = searchLabel.createEl("input", { attr: { placeholder: "예: 상담 준비" } });
    search.type = "search";
    search.value = this.query;
    search.addEventListener("input", () => {
      this.query = search.value;
      this.renderBoard();
    });
    const projectLabel = filterLabel(filters, "프로젝트");
    const project = projectLabel.createEl("select");
    addOption(project, "", "전체 프로젝트");
    unique(tasks.map((task) => task.project)).forEach((value) => addOption(project, value, value));
    project.value = this.project;
    project.addEventListener("change", () => {
      this.project = project.value;
      this.renderBoard();
    });
    const contextLabel = filterLabel(filters, "컨텍스트");
    const context = contextLabel.createEl("select");
    addOption(context, "", "전체 컨텍스트");
    unique(tasks.map((task) => task.context)).forEach((value) => addOption(context, value, value));
    context.value = this.context;
    context.addEventListener("change", () => {
      this.context = context.value;
      this.renderBoard();
    });
  }

  private renderTask(container: HTMLElement, task: TaskEntry): void {
    const card = container.createDiv({ cls: "class-management-task-card" });
    const top = card.createDiv({ cls: "class-management-task-card-title" });
    const checkbox = top.createEl("input", { attr: { "aria-label": `${task.title} 완료` } });
    checkbox.type = "checkbox";
    checkbox.checked = task.status === "done";
    checkbox.addEventListener("change", () =>
      void this.changeStatus(task, checkbox.checked ? "done" : "next")
    );
    const open = top.createEl("button", { text: task.title });
    open.addEventListener("click", () => void this.plugin.openFile(task.file));
    const meta = [task.dueDate && `마감 ${task.dueDate}`,
      task.recurrence !== "none" && taskRecurrenceLabel(task.recurrence), task.project, task.context,
      task.studentName && `${task.studentNumber}번 ${task.studentName}`].filter(Boolean);
    if (meta.length) card.createEl("small", { text: meta.join(" · ") });
    const status = card.createEl("select", { attr: { "aria-label": "GTD 상태 변경" } });
    TASK_COLUMNS.forEach((column) => addOption(status, column.status, column.label));
    status.value = task.status;
    status.addEventListener("change", () => void this.changeStatus(task, status.value as TaskStatus));
  }

  private async changeStatus(task: TaskEntry, status: TaskStatus): Promise<void> {
    try {
      await this.plugin.repository.updateTaskStatus(task.file, status);
      this.plugin.activityIndex.invalidate();
      await this.refresh();
    } catch {
      new Notice("할 일 상태를 변경하지 못했습니다.");
    }
  }

  private reviewSummary(tasks: TaskEntry[], notices: NoticeSheet[]): string {
    const today = localDate();
    const overdue = tasks.filter((task) => task.status !== "done" && task.dueDate && task.dueDate < today).length;
    const dueSoon = tasks.filter((task) => task.status !== "done" && task.dueDate >= today && task.dueDate <= addDays(today, 7)).length;
    const waitingNotices = notices.filter((notice) =>
      notice.marks.some((mark) => mark.status !== "회신 완료")
    ).length;
    return `일간·주간 검토 · 수집함 ${tasks.filter((task) => task.status === "inbox").length}건 · 7일 내 마감 ${dueSoon}건 · 지연 ${overdue}건 · 회신 대기 ${waitingNotices}건`;
  }
}

function unique(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => a.localeCompare(b, "ko"));
}


function addDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00`);
  value.setDate(value.getDate() + days);
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
