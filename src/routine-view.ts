import { ItemView, Modal, Notice, Setting, WorkspaceLeaf } from "obsidian";
import { scaffoldView } from "./dom";
import { frequencyLabel } from "@core/routine";
import { dayStatus } from "@core/academic-calendar";
import type ClassManagementPlugin from "./main";
import type { RoutineFrequency, RoutineInstance, RoutineTemplate } from "@core/types";
import { localDate } from "@core/utils";

export const ROUTINE_VIEW_TYPE = "class-management-routine-view";

export class RoutineView extends ItemView {
  private date = localDate();
  private isClassDay: boolean | null = null;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return ROUTINE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "루틴 체크리스트";
  }

  getIcon(): string {
    return "calendar-check";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    const templates = await this.plugin.repository.getRoutineTemplates();
    const calendar = await this.plugin.repository.getAcademicCalendar();
    this.isClassDay = calendar ? dayStatus(calendar, this.date).kind === "class" : null;
    const existing = this.plugin.repository.getRoutineInstanceSummaries()
      .find((summary) => summary.date === this.date);
    const instance = existing
      ? await this.plugin.repository.loadRoutineInstance(existing.file, existing.date)
      : templates.length > 0 && !this.plugin.activeClassProfile.archived
        ? await this.plugin.repository.ensureRoutineInstance(this.date)
        : null;
    this.render(templates, instance);
  }

  async setDate(date: string): Promise<void> {
    this.date = date;
    await this.refresh();
  }

  private render(templates: RoutineTemplate[], instance: RoutineInstance | null): void {
    this.contentEl.empty();
    const { actions, toolbar, body } = scaffoldView(this.contentEl, {
      cls: "class-management-routine-view",
      title: "루틴 체크리스트",
      description: "일간·주간·월간 반복 업무를 날짜별 체크리스트로 보존합니다."
    });
    const newButton = actions.createEl("button", { text: "루틴 만들기", cls: "mod-cta" });
    newButton.disabled = this.plugin.activeClassProfile.archived;
    newButton.addEventListener("click", () => new RoutineTemplateModal(this.plugin, () => void this.refresh()).open());

    const navigation = toolbar.createDiv({ cls: "class-management-routine-navigation" });
    const previous = navigation.createEl("button", { text: "‹", attr: { "aria-label": "이전 날짜" } });
    previous.addEventListener("click", () => void this.moveDate(-1));
    const dateInput = navigation.createEl("input");
    dateInput.type = "date";
    dateInput.value = this.date;
    dateInput.addEventListener("change", () => {
      if (dateInput.value) {
        this.date = dateInput.value;
        void this.refresh();
      }
    });
    const today = navigation.createEl("button", { text: "오늘" });
    today.addEventListener("click", () => {
      this.date = localDate();
      void this.refresh();
    });
    const next = navigation.createEl("button", { text: "›", attr: { "aria-label": "다음 날짜" } });
    next.addEventListener("click", () => void this.moveDate(1));

    const layout = body.createDiv({ cls: "class-management-routine-layout" });
    const checklist = layout.createDiv({ cls: "class-management-panel" });
    checklist.createEl("h3", { text: `${this.date} 체크리스트` });
    if (templates.length === 0) {
      checklist.createEl("p", { text: "등록된 루틴이 없습니다." });
      const defaults = checklist.createEl("button", { text: "기본 루틴 3개 만들기" });
      defaults.disabled = this.plugin.activeClassProfile.archived;
      defaults.addEventListener("click", () => void this.createDefaults());
    } else if (!instance || instance.items.length === 0) {
      checklist.createEl("p", {
        text: this.isClassDay === false
          ? "주말·휴업일·방학에는 루틴을 만들지 않습니다."
          : "이 날짜에 실행할 루틴이 없습니다.",
        cls: "setting-item-description"
      });
    } else {
      const completed = instance.items.filter((item) => item.completed).length;
      checklist.createEl("p", { text: `${completed}/${instance.items.length}개 완료` });
      const list = checklist.createDiv({ cls: "class-management-routine-checklist" });
      instance.items.forEach((item) => {
        const label = list.createEl("label");
        const checkbox = label.createEl("input");
        checkbox.type = "checkbox";
        checkbox.checked = item.completed;
        checkbox.disabled = this.plugin.activeClassProfile.archived;
        checkbox.addEventListener("change", () =>
          void this.toggle(instance, item.line, checkbox.checked)
        );
        label.createEl("span", { text: item.text });
        label.createEl("small", { text: item.templateTitle });
      });
      const open = checklist.createEl("button", { text: "체크리스트 노트 열기" });
      open.addEventListener("click", () => void this.plugin.openFile(instance.file));
    }

    const templatePanel = layout.createDiv({ cls: "class-management-panel" });
    templatePanel.createEl("h3", { text: `루틴 템플릿 ${templates.length}개` });
    templates.forEach((template) => {
      const row = templatePanel.createEl("button", { cls: "class-management-template-row" });
      row.createEl("strong", { text: template.title });
      row.createEl("span", {
        text: `${frequencyLabel(template.frequency)} · ${template.items.length}개 항목`
      });
      row.addEventListener("click", () => void this.plugin.openFile(template.file));
    });
  }

  private async moveDate(amount: number): Promise<void> {
    const value = new Date(`${this.date}T00:00:00`);
    value.setDate(value.getDate() + amount);
    this.date = formatDate(value);
    await this.refresh();
  }

  private async toggle(instance: RoutineInstance, line: number, completed: boolean): Promise<void> {
    await this.plugin.repository.toggleRoutineItem(instance.file, line, completed);
    this.plugin.activityIndex.invalidate();
    await this.refresh();
  }

  private async createDefaults(): Promise<void> {
    const created = await this.plugin.repository.createDefaultRoutines();
    new Notice(`기본 루틴 ${created}개를 만들었습니다.`);
    await this.refresh();
  }
}

class RoutineTemplateModal extends Modal {
  private title = "";
  private frequency: RoutineFrequency = "daily";
  private weekday = 1;
  private monthDay = 1;
  private items = "";

  constructor(
    private readonly plugin: ClassManagementPlugin,
    private readonly onCreated: () => void
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("새 루틴 템플릿");
    new Setting(this.contentEl).setName("이름").addText((text) => {
      text.setPlaceholder("예: 금요일 주간 정리").onChange((value) => (this.title = value));
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).setName("반복").addDropdown((dropdown) =>
      dropdown
        .addOptions({ daily: "매일", weekly: "매주", monthly: "매월" })
        .onChange((value) => (this.frequency = value as RoutineFrequency))
    );
    new Setting(this.contentEl)
      .setName("요일")
      .setDesc("주간 루틴에만 적용합니다.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ "1": "월", "2": "화", "3": "수", "4": "목", "5": "금", "6": "토", "0": "일" })
          .onChange((value) => (this.weekday = Number(value)))
      );
    new Setting(this.contentEl)
      .setName("날짜")
      .setDesc("월간 루틴에만 적용합니다.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.inputEl.max = "31";
        text.setValue("1").onChange((value) => (this.monthDay = Number(value) || 1));
      });
    new Setting(this.contentEl).setName("체크 항목").setDesc("한 줄에 하나씩 입력하세요.").addTextArea((text) => {
      text.setPlaceholder("출석 확인\n알림장 확인").onChange((value) => (this.items = value));
      text.inputEl.rows = 7;
    });
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("루틴 저장").setCta().onClick(() => void this.save())
    );
  }

  private async save(): Promise<void> {
    const items = this.items.split(/\r?\n/).map((item) => item.trim()).filter(Boolean);
    try {
      await this.plugin.repository.createRoutineTemplate({
        title: this.title,
        frequency: this.frequency,
        weekday: this.weekday,
        monthDay: Math.min(31, Math.max(1, this.monthDay)),
        items
      });
      this.close();
      this.onCreated();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "루틴을 저장하지 못했습니다.");
    }
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
