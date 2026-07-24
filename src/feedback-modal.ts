import { App, Modal, Notice, Setting } from "obsidian";

/**
 * 실사용 마찰을 그 자리에서 남기는 최소 입력 모달 — 날짜·버전·화면은 자동 스탬프.
 * 수집처는 볼트의 피드백 노트이며, 개발 반영(트리아지)은 저장소 docs/FEEDBACK.md에서 한다.
 */
export class FeedbackModal extends Modal {
  private text = "";
  private saving = false;

  constructor(
    app: App,
    private readonly context: { version: string; screen: string },
    private readonly onSave: (text: string) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("피드백 기록");

    new Setting(this.contentEl).setName("내용").addTextArea((text) => {
      text
        .setPlaceholder("불편했던 것, 바라는 것을 한 줄로 적으세요.")
        .onChange((value) => {
          this.text = value;
        });
      text.inputEl.rows = 3;
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    const screen = this.context.screen ? ` · ${this.context.screen}` : "";
    this.contentEl.createEl("p", {
      text: `자동 기록: v${this.context.version}${screen}`,
      cls: "setting-item-description"
    });

    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("기록").setCta().onClick(() => void this.submit())
    );
  }

  private async submit(): Promise<void> {
    if (this.saving) return;
    if (!this.text.trim()) {
      new Notice("피드백 내용을 입력해 주세요.");
      return;
    }
    this.saving = true;
    try {
      await this.onSave(this.text.trim());
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "피드백을 기록하지 못했습니다.");
      this.saving = false;
    }
  }
}
