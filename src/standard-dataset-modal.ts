import { Modal, Notice, Setting } from "obsidian";
import { achievementStandardMarkdown, parseStandardDataset } from "@core/planning";
import type ClassManagementPlugin from "./main";

/**
 * 성취기준 데이터셋 가져오기(3.6) — `코드,전문` 표를 붙여넣으면 성취기준 노트를 일괄 생성한다.
 * 지도서 PDF 추출(LLM 협업 경로) 없이도 타 사용자가 전문을 채울 수 있는 단독 경로.
 */
export class StandardDatasetModal extends Modal {
  private text = "";
  private summaryEl?: HTMLElement;
  private importing = false;

  constructor(private readonly plugin: ClassManagementPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("성취기준 데이터셋 가져오기");
    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "CSV·TSV 표를 붙여넣으세요 — 열 순서: 코드 | 전문 (예: 4수01-10,여러 가지 방법으로…). 대괄호가 있어도 되고, 머리글 행은 건너뜁니다. 이미 있는 노트는 덮어쓰지 않습니다."
    });

    new Setting(this.contentEl).setName("데이터셋").addTextArea((input) => {
      input.setPlaceholder("코드,전문\n4수01-10,…").onChange((value) => {
        this.text = value;
        this.updateSummary();
      });
      input.inputEl.rows = 10;
      window.setTimeout(() => input.inputEl.focus(), 0);
    });

    this.summaryEl = this.contentEl.createEl("p", { cls: "setting-item-description" });
    this.updateSummary();

    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("노트 생성").setCta().onClick(() => void this.run())
    );
  }

  private updateSummary(): void {
    if (!this.summaryEl) return;
    const parsed = parseStandardDataset(this.text);
    if (parsed.rows.length === 0 && parsed.issues.length === 0) {
      this.summaryEl.setText("붙여넣으면 미리보기가 표시됩니다.");
      return;
    }
    const existing = new Set(
      this.plugin.repository.getAchievementStandards().map((entry) => entry.code)
    );
    const skips = parsed.rows.filter((row) => existing.has(row.code)).length;
    this.summaryEl.setText(
      `코드 ${parsed.rows.length}건 (신규 ${parsed.rows.length - skips} · 기존 건너뜀 ${skips})` +
        (parsed.issues.length ? ` · 무시한 행 ${parsed.issues.length}` : "")
    );
  }

  private async run(): Promise<void> {
    if (this.importing) return;
    const parsed = parseStandardDataset(this.text);
    if (parsed.rows.length === 0) {
      new Notice("가져올 코드가 없습니다. 열 순서(코드 | 전문)를 확인해 주세요.");
      return;
    }
    this.importing = true;
    try {
      let created = 0;
      for (const row of parsed.rows) {
        const markdown = achievementStandardMarkdown({
          code: row.code,
          statement: row.statement,
          progressLinks: []
        });
        const result = await this.plugin.repository.ensureAchievementStandardNote(row.code, markdown);
        if (result.created) created += 1;
      }
      new Notice(
        `성취기준 노트 ${created}개를 만들었습니다. (기존 ${parsed.rows.length - created}개 건너뜀)` +
          (parsed.issues.length ? ` · 무시한 행 ${parsed.issues.length}` : "")
      );
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "데이터셋을 가져오지 못했습니다.");
      this.importing = false;
    }
  }
}
