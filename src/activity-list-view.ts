import { App, ItemView, Modal, Notice, Setting, WorkspaceLeaf } from "obsidian";
import { addOption, filterLabel } from "./dom";
import {
  ACTIVITY_KIND_LABELS,
  EMPTY_ACTIVITY_FILTERS,
  filterActivities,
  uniqueActivityStatuses
} from "@core/activity";
import type ClassManagementPlugin from "./main";
import type {
  ActivityColumn,
  ActivityEntry,
  ActivityKind,
  ActivityListFilters,
  ClassManagementSettings
} from "@core/types";

export const ACTIVITY_LIST_VIEW_TYPE = "class-management-activity-list";

export class ActivityListView extends ItemView {
  private activities: ActivityEntry[] = [];
  private filters: ActivityListFilters;
  private resultsEl?: HTMLElement;
  private statusSelect?: HTMLSelectElement;
  private persistTimer?: number;
  private displayLimit = 200;
  private sortBy: ClassManagementSettings["activitySortBy"];
  private sortDirection: ClassManagementSettings["activitySortDirection"];
  private visibleColumns: Set<ActivityColumn>;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
    this.filters = {
      ...EMPTY_ACTIVITY_FILTERS,
      ...plugin.settings.activityListFilters
    };
    this.sortBy = plugin.settings.activitySortBy;
    this.sortDirection = plugin.settings.activitySortDirection;
    this.visibleColumns = new Set(plugin.settings.activityVisibleColumns);
  }

  getViewType(): string {
    return ACTIVITY_LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "학급 통합 목록";
  }

  getIcon(): string {
    return "list-filter";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async onClose(): Promise<void> {
    if (this.persistTimer !== undefined) window.clearTimeout(this.persistTimer);
  }

  async refresh(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.addClass("class-management-activity-view");
    this.contentEl.createEl("p", { text: "데이터를 불러오고 있습니다…" });

    try {
      this.activities = await this.plugin.activityIndex.getEntries();
      this.renderLayout();
    } catch (error) {
      this.contentEl.empty();
      this.contentEl.createEl("p", {
        text: error instanceof Error ? error.message : "통합 목록을 불러오지 못했습니다.",
        cls: "class-management-csv-error"
      });
    }
  }

  private renderLayout(): void {
    this.displayLimit = 200;
    this.contentEl.empty();
    const header = this.contentEl.createDiv({ cls: "class-management-view-heading" });
    const headingText = header.createDiv();
    headingText.createEl("h2", { text: "학급 통합 목록" });
    headingText.createEl("p", {
      text: "학생 기록과 출결, 과제, 할 일, 회신, 루틴을 검색하고 조건별로 모아봅니다."
    });
    const actions = header.createDiv({ cls: "class-management-view-actions" });
    const savedViews = actions.createEl("select");
    addOption(savedViews, "", "저장된 보기");
    this.plugin.settings.savedActivityViews.forEach((view) =>
      addOption(savedViews, view.name, view.name)
    );
    savedViews.addEventListener("change", () => {
      const selected = this.plugin.settings.savedActivityViews.find(
        (view) => view.name === savedViews.value
      );
      if (!selected) return;
      this.filters = { ...selected.filters };
      this.renderLayout();
      this.schedulePersist();
    });
    const saveView = actions.createEl("button", { text: "보기 저장" });
    saveView.addEventListener("click", () => {
      new SaveActivityViewModal(this.app, async (name) => {
        await this.plugin.saveNamedActivityView(name, this.filters);
        new Notice(`‘${name}’ 보기를 저장했습니다.`);
        this.renderLayout();
      }).open();
    });
    const deleteView = actions.createEl("button", { text: "보기 삭제" });
    deleteView.addEventListener("click", () => {
      const name = savedViews.value;
      if (!name) {
        new Notice("삭제할 저장된 보기를 먼저 선택해 주세요.");
        return;
      }
      void this.plugin.deleteNamedActivityView(name).then(() => {
        new Notice(`‘${name}’ 보기를 삭제했습니다.`);
        this.renderLayout();
      });
    });
    const reset = actions.createEl("button", { text: "필터 초기화" });
    reset.addEventListener("click", () => {
      this.filters = { ...EMPTY_ACTIVITY_FILTERS };
      this.renderLayout();
      this.schedulePersist();
    });
    const sort = actions.createEl("select", { attr: { "aria-label": "정렬 기준" } });
    addOption(sort, "date", "날짜순");
    addOption(sort, "student", "학생순");
    addOption(sort, "status", "상태순");
    sort.value = this.sortBy;
    sort.addEventListener("change", () => {
      this.sortBy = sort.value as ClassManagementSettings["activitySortBy"];
      this.renderResults();
      void this.savePreferences();
    });
    const direction = actions.createEl("button", {
      text: this.sortDirection === "desc" ? "내림차순" : "오름차순"
    });
    direction.addEventListener("click", () => {
      this.sortDirection = this.sortDirection === "desc" ? "asc" : "desc";
      this.renderLayout();
      void this.savePreferences();
    });
    const columns = actions.createEl("button", { text: "표시 열" });
    columns.addEventListener("click", () =>
      new ActivityColumnsModal(this.app, this.visibleColumns, (selected) => {
        this.visibleColumns = new Set(selected);
        this.renderLayout();
        void this.savePreferences();
      }).open()
    );
    const missingAssignments = actions.createEl("button", { text: "미제출 과제" });
    missingAssignments.addEventListener("click", () => {
      this.filters = { ...EMPTY_ACTIVITY_FILTERS, kind: "assignment", status: "미제출" };
      this.renderLayout();
      this.schedulePersist();
    });
    const attendanceExceptions = actions.createEl("button", { text: "이번 달 출결 예외" });
    attendanceExceptions.addEventListener("click", () => {
      this.filters = {
        ...EMPTY_ACTIVITY_FILTERS,
        kind: "attendance",
        status: "__attendance-exception__",
        dateFrom: `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-01`
      };
      this.renderLayout();
      this.schedulePersist();
    });
    const staleStudents = actions.createEl("button", { text: "최근 기록 없음" });
    staleStudents.addEventListener("click", () =>
      new StaleStudentsModal(this.plugin, this.activities).open()
    );

    const controls = this.contentEl.createDiv({ cls: "class-management-filter-bar" });
    this.renderSearchControl(controls);
    this.renderStudentControl(controls);
    this.renderKindControl(controls);
    this.renderStatusControl(controls);
    this.renderDateControl(controls, "시작일", "dateFrom");
    this.renderDateControl(controls, "종료일", "dateTo");

    this.resultsEl = this.contentEl.createDiv({ cls: "class-management-activity-results" });
    this.renderResults();
  }

  private renderSearchControl(container: HTMLElement): void {
    const label = filterLabel(container, "검색");
    const input = label.createEl("input");
    input.type = "search";
    input.placeholder = "학생, 본문, 상태 검색";
    input.value = this.filters.query;
    input.addEventListener("input", () => {
      this.filters.query = input.value;
      this.renderResults();
      this.schedulePersist();
    });
  }

  private renderStudentControl(container: HTMLElement): void {
    const label = filterLabel(container, "학생");
    const select = label.createEl("select");
    addOption(select, "", "전체 학생");
    this.plugin.repository.getStudents().forEach((student) =>
      addOption(select, student.number, `${student.number}번 ${student.name}`)
    );
    select.value = this.filters.studentNumber;
    select.addEventListener("change", () => {
      this.filters.studentNumber = select.value;
      this.renderResults();
      this.schedulePersist();
    });
  }

  private renderKindControl(container: HTMLElement): void {
    const label = filterLabel(container, "유형");
    const select = label.createEl("select");
    addOption(select, "", "전체 유형");
    (Object.entries(ACTIVITY_KIND_LABELS) as Array<[ActivityKind, string]>).forEach(
      ([value, text]) => addOption(select, value, text)
    );
    select.value = this.filters.kind;
    select.addEventListener("change", () => {
      this.filters.kind = select.value as "" | ActivityKind;
      this.filters.status = "";
      this.updateStatusOptions();
      this.renderResults();
      this.schedulePersist();
    });
  }

  private renderStatusControl(container: HTMLElement): void {
    const label = filterLabel(container, "상태");
    this.statusSelect = label.createEl("select");
    this.updateStatusOptions();
    this.statusSelect.addEventListener("change", () => {
      this.filters.status = this.statusSelect?.value ?? "";
      this.renderResults();
      this.schedulePersist();
    });
  }

  private updateStatusOptions(): void {
    if (!this.statusSelect) return;
    this.statusSelect.empty();
    addOption(this.statusSelect, "", "전체 상태");
    uniqueActivityStatuses(this.activities, this.filters.kind).forEach((status) =>
      addOption(this.statusSelect!, status, status)
    );
    if (this.filters.status === "__attendance-exception__") {
      addOption(this.statusSelect, "__attendance-exception__", "출석 외 전체");
    }
    this.statusSelect.value = this.filters.status;
  }

  private renderDateControl(
    container: HTMLElement,
    labelText: string,
    key: "dateFrom" | "dateTo"
  ): void {
    const label = filterLabel(container, labelText);
    const input = label.createEl("input");
    input.type = "date";
    input.value = this.filters[key];
    input.addEventListener("change", () => {
      this.filters[key] = input.value;
      this.renderResults();
      this.schedulePersist();
    });
  }

  private renderResults(): void {
    if (!this.resultsEl) return;
    this.resultsEl.empty();
    const filtered = this.sortActivities(filterActivities(this.activities, this.filters));
    this.resultsEl.createEl("p", {
      text: `전체 ${this.activities.length}건 중 ${filtered.length}건`,
      cls: "class-management-result-count"
    });

    if (filtered.length === 0) {
      this.resultsEl.createEl("p", {
        text: "조건에 맞는 기록이 없습니다.",
        cls: "class-management-empty"
      });
      return;
    }

    const tableWrap = this.resultsEl.createDiv({ cls: "class-management-table-wrap" });
    const table = tableWrap.createEl("table", { cls: "class-management-activity-table" });
    const header = table.createEl("thead").createEl("tr");
    const columnLabels: Record<ActivityColumn, string> = {
      date: "날짜",
      student: "학생",
      kind: "유형",
      status: "상태",
      detail: "내용",
      source: "원본"
    };
    this.visibleColumns.forEach((column) => header.createEl("th", { text: columnLabels[column] }));
    const body = table.createEl("tbody");
    const studentsByNumber = new Map(
      this.plugin.repository.getStudents(true).map((student) => [student.number, student] as const)
    );

    filtered.slice(0, this.displayLimit).forEach((activity) => {
      const row = body.createEl("tr");
      this.visibleColumns.forEach((column) => {
        if (column === "date") row.createEl("td", { text: activity.date });
        else if (column === "student") row.createEl("td", {
          text: activity.studentNumber
            ? `${activity.studentNumber}번 ${activity.studentName}`
            : "학급 공통"
        });
        else if (column === "kind") row.createEl("td", { text: ACTIVITY_KIND_LABELS[activity.kind] });
        else if (column === "status") row.createEl("td", {
          text: activity.status,
          cls: `class-management-status-chip is-${activity.kind}`
        });
        else if (column === "detail") {
          const detail = row.createEl("td", { cls: "class-management-activity-detail" });
          appendHighlightedText(detail, activity.detail || activity.title, this.filters.query);
        } else {
          const source = row.createEl("td");
          const actions = source.createDiv({ cls: "class-management-actions" });
          const open = actions.createEl("button", { text: "열기" });
          open.addEventListener("click", () => void this.plugin.openFile(activity.file));
          if (activity.studentNumber) {
            const student = studentsByNumber.get(activity.studentNumber);
            if (student) {
              const timeline = actions.createEl("button", { text: "타임라인" });
              timeline.addEventListener("click", () => void this.plugin.openStudentTimeline(student));
            }
          }
        }
      });
    });

    if (filtered.length > this.displayLimit) {
      const more = this.resultsEl.createEl("button", {
        text: `다음 ${Math.min(200, filtered.length - this.displayLimit)}건 더 보기`
      });
      more.addEventListener("click", () => {
        this.displayLimit += 200;
        this.renderResults();
      });
    }
  }

  private schedulePersist(): void {
    if (this.persistTimer !== undefined) window.clearTimeout(this.persistTimer);
    this.persistTimer = window.setTimeout(() => {
      void this.plugin.saveActivityFilters(this.filters);
    }, 250);
  }

  private sortActivities(activities: ActivityEntry[]): ActivityEntry[] {
    const direction = this.sortDirection === "asc" ? 1 : -1;
    return [...activities].sort((a, b) => {
      const left = this.sortBy === "student"
        ? `${a.studentNumber.padStart(5, "0")} ${a.studentName}`
        : this.sortBy === "status"
          ? a.status
          : a.date;
      const right = this.sortBy === "student"
        ? `${b.studentNumber.padStart(5, "0")} ${b.studentName}`
        : this.sortBy === "status"
          ? b.status
          : b.date;
      return left.localeCompare(right, "ko") * direction || (b.createdAt - a.createdAt);
    });
  }

  private async savePreferences(): Promise<void> {
    await this.plugin.saveActivityPreferences(
      this.sortBy,
      this.sortDirection,
      Array.from(this.visibleColumns)
    );
  }
}

class ActivityColumnsModal extends Modal {
  private readonly selected: Set<ActivityColumn>;

  constructor(
    app: App,
    selected: Set<ActivityColumn>,
    private readonly onSave: (selected: ActivityColumn[]) => void
  ) {
    super(app);
    this.selected = new Set(selected);
  }

  onOpen(): void {
    this.setTitle("통합 목록 표시 열");
    const labels: Record<ActivityColumn, string> = {
      date: "날짜", student: "학생", kind: "유형", status: "상태", detail: "내용", source: "원본"
    };
    (Object.entries(labels) as Array<[ActivityColumn, string]>).forEach(([column, label]) => {
      new Setting(this.contentEl).setName(label).addToggle((toggle) =>
        toggle.setValue(this.selected.has(column)).onChange((value) => {
          if (value) this.selected.add(column);
          else this.selected.delete(column);
        })
      );
    });
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("적용").setCta().onClick(() => {
        if (this.selected.size === 0) {
          new Notice("한 개 이상의 열을 선택해 주세요.");
          return;
        }
        this.onSave(Array.from(this.selected));
        this.close();
      })
    );
  }
}

class StaleStudentsModal extends Modal {
  constructor(
    private readonly plugin: ClassManagementPlugin,
    private readonly activities: ActivityEntry[]
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("최근 30일 학생 기록 없음");
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 30);
    const cutoffDate = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;
    const recorded = new Set(
      this.activities
        .filter((activity) => activity.kind === "record" && activity.date >= cutoffDate)
        .map((activity) => activity.studentNumber)
    );
    const students = this.plugin.repository.getStudents().filter(
      (student) => !recorded.has(student.number)
    );
    this.contentEl.createEl("p", {
      text: `${cutoffDate} 이후 학생 기록이 없는 재적 학생 ${students.length}명입니다.`
    });
    students.forEach((student) => {
      const row = this.contentEl.createDiv({ cls: "class-management-data-student-row" });
      row.createEl("span", { text: `${student.number}번 ${student.name}` });
      const timeline = row.createEl("button", { text: "타임라인" });
      timeline.addEventListener("click", () => {
        this.close();
        void this.plugin.openStudentTimeline(student);
      });
    });
  }
}

class SaveActivityViewModal extends Modal {
  private name = "";

  constructor(
    app: App,
    private readonly onSave: (name: string) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("현재 필터 보기 저장");
    new Setting(this.contentEl).setName("보기 이름").addText((text) => {
      text.setPlaceholder("예: 이번 달 미제출").onChange((value) => {
        this.name = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("저장").setCta().onClick(() => void this.submit())
    );
  }

  private async submit(): Promise<void> {
    const name = this.name.trim();
    if (!name) {
      new Notice("보기 이름을 입력해 주세요.");
      return;
    }
    await this.onSave(name);
    this.close();
  }
}



function appendHighlightedText(
  container: HTMLElement,
  value: string,
  query: string
): void {
  const needle = query.trim();
  if (!needle) {
    container.setText(value);
    return;
  }

  const lowerValue = value.toLocaleLowerCase("ko");
  const lowerNeedle = needle.toLocaleLowerCase("ko");
  let cursor = 0;
  let index = lowerValue.indexOf(lowerNeedle);

  while (index >= 0) {
    container.appendText(value.slice(cursor, index));
    container.createEl("mark", { text: value.slice(index, index + needle.length) });
    cursor = index + needle.length;
    index = lowerValue.indexOf(lowerNeedle, cursor);
  }
  container.appendText(value.slice(cursor));
}
