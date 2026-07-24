import { App, Modal, Setting } from "obsidian";
import { countNeisChars, DEFAULT_NEIS_CHAR_LIMIT } from "@core/neis-export";

/**
 * NEIS 글자수 검사 — 최종 문구를 붙여넣으면 자수(공백 포함·제외)와 한도 잔여를 실시간으로 보인다.
 * 한도는 학교 기재요령에 따라 다르므로 직접 조정한다(기본 500자).
 */
export class NeisCharCountModal extends Modal {
  private text = "";
  private limit = DEFAULT_NEIS_CHAR_LIMIT;
  private result!: HTMLElement;

  constructor(app: App) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("NEIS 글자수 검사");

    new Setting(this.contentEl)
      .setName("자수 한도")
      .setDesc("학교 기재요령의 영역별 허용 글자수를 입력하세요.")
      .addText((input) => {
        input.inputEl.type = "number";
        input.setValue(String(this.limit)).onChange((value) => {
          this.limit = Math.max(0, Number(value) || 0);
          this.update();
        });
      });

    new Setting(this.contentEl).setName("문구").addTextArea((input) => {
      input.setPlaceholder("NEIS에 입력할 최종 문구를 붙여넣으세요.").onChange((value) => {
        this.text = value;
        this.update();
      });
      input.inputEl.rows = 8;
      window.setTimeout(() => input.inputEl.focus(), 0);
    });

    this.result = this.contentEl.createEl("p", { cls: "class-management-neis-count" });
    this.update();
  }

  private update(): void {
    const count = countNeisChars(this.text);
    const remaining = this.limit - count.withSpaces;
    this.result.setText(
      `공백 포함 ${count.withSpaces}자 · 공백 제외 ${count.withoutSpaces}자` +
        (this.limit > 0
          ? remaining >= 0
            ? ` · 한도까지 ${remaining}자 남음`
            : ` · 한도 초과 ${-remaining}자 — 줄여 쓰세요`
          : "")
    );
    this.result.toggleClass("is-over", this.limit > 0 && remaining < 0);
  }
}
