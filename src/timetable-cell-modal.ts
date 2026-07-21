import { Modal, Notice, Setting } from "obsidian";
import type ClassManagementPlugin from "./main";

export interface TimetableCellContext {
  date: string;
  period: number;
  currentSubject: string;
  hasOverride: boolean;
  subjects: string[];
}

export class TimetableCellModal extends Modal {
  private subject: string;
  private customSubject = "";
  private reason = "";
  private saving = false;

  constructor(
    private readonly plugin: ClassManagementPlugin,
    private readonly context: TimetableCellContext
  ) {
    super(plugin.app);
    this.subject = context.currentSubject;
  }

  onOpen(): void {
    this.contentEl.empty();
    this.titleEl.setText(`${this.context.date} ${this.context.period}교시 과목 변경`);
    this.contentEl.createEl("p", {
      text: `이 날짜의 해당 교시만 바뀌며, 기초시간표 노트의 '시간표 변경' 표에 기록됩니다. 현재: ${this.context.currentSubject || "(비어 있음)"}`
    });
    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "기준 교시 밖(예: 5교시 요일의 6교시, 체험학습 7·8교시)에 저장하면 그날 교시가 추가되고, 변경을 제거하면 다시 사라집니다."
    });

    new Setting(this.contentEl).setName("과목").addDropdown((dropdown) => {
      const options = [...this.context.subjects];
      if (this.context.currentSubject && !options.includes(this.context.currentSubject)) {
        options.unshift(this.context.currentSubject);
      }
      for (const subject of options) dropdown.addOption(subject, subject);
      if (this.subject && options.includes(this.subject)) dropdown.setValue(this.subject);
      dropdown.onChange((value) => (this.subject = value));
    });

    new Setting(this.contentEl)
      .setName("직접 입력")
      .setDesc("목록에 없는 과목·활동명은 여기에 적으면 우선 적용됩니다.")
      .addText((text) => text.onChange((value) => (this.customSubject = value)));

    new Setting(this.contentEl)
      .setName("사유 (선택)")
      .addText((text) =>
        text.setPlaceholder("동아리 지정일, 보강 등").onChange((value) => (this.reason = value))
      );

    const buttons = new Setting(this.contentEl);
    if (this.context.hasOverride) {
      buttons.addButton((button) =>
        button.setButtonText("변경 제거").setWarning().onClick(() => void this.remove())
      );
    }
    buttons.addButton((button) =>
      button.setButtonText("저장").setCta().onClick(() => void this.save())
    );
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    const subject = (this.customSubject.trim() || this.subject).trim();
    if (!subject) {
      new Notice("과목을 선택하거나 입력하세요.");
      return;
    }
    this.saving = true;
    try {
      await this.plugin.saveTimetableOverride({
        date: this.context.date,
        period: this.context.period,
        subject,
        reason: this.reason.trim()
      });
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "시간표 변경 저장에 실패했습니다.");
    } finally {
      this.saving = false;
    }
  }

  private async remove(): Promise<void> {
    if (this.saving) return;
    this.saving = true;
    try {
      await this.plugin.removeTimetableOverrideAt(this.context.date, this.context.period);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "시간표 변경 제거에 실패했습니다.");
    } finally {
      this.saving = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
