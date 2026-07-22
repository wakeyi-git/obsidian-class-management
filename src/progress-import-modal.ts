import { Modal, Notice, Setting } from "obsidian";
import { parseProgressImport, parseProgressTable } from "@core/progress";
import type ClassManagementPlugin from "./main";

const CREATIVE_AREAS = ["창체(자율)", "창체(동아리)", "창체(봉사)", "창체(진로)"];

export class ProgressImportModal extends Modal {
  private subject: string;
  private semester: string;
  private text = "";
  private importing = false;

  constructor(private readonly plugin: ClassManagementPlugin) {
    super(plugin.app);
    this.subject = plugin.settings.schoolSubjects[0] ?? "국어";
    this.semester = plugin.settings.semester;
  }

  onOpen(): void {
    this.contentEl.empty();
    this.titleEl.setText("진도표 차시 가져오기");
    this.contentEl.createEl("p", {
      text: "Excel·한글 표를 복사해 붙여넣으세요. 열 순서: 단원(영역) | 학습 내용 | 시수 | 성취기준 | 준비물 | 비고. 시수를 비우면 1차시로 저장됩니다."
    });

    new Setting(this.contentEl).setName("과목").addDropdown((dropdown) => {
      for (const subject of [...this.plugin.settings.schoolSubjects, ...CREATIVE_AREAS]) {
        dropdown.addOption(subject, subject);
      }
      dropdown.setValue(this.subject);
      dropdown.onChange((value) => (this.subject = value));
    });

    new Setting(this.contentEl).setName("학기").addDropdown((dropdown) => {
      dropdown.addOption("1학기", "1학기");
      dropdown.addOption("2학기", "2학기");
      dropdown.setValue(this.semester);
      dropdown.onChange((value) => (this.semester = value));
    });

    const textarea = this.contentEl.createEl("textarea", {
      cls: "class-management-progress-import-input",
      attr: { rows: "12", placeholder: "1. 분수\t분수의 의미 알기\t2\n1. 분수\t분수 비교하기\t1" }
    });
    textarea.addEventListener("input", () => (this.text = textarea.value));

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("가져오기")
        .setCta()
        .onClick(() => void this.importRows())
    );
  }

  private async importRows(): Promise<void> {
    if (this.importing) return;
    if (!this.text.trim()) {
      new Notice("붙여넣은 내용이 없습니다.");
      return;
    }
    this.importing = true;
    try {
      const settings = this.plugin.settings;
      const file = await this.plugin.repository.ensureProgressTableNote(this.subject, this.semester);
      const content = await this.plugin.app.vault.read(file);
      const table = parseProgressTable(
        file,
        { schoolYear: settings.schoolYear, semester: this.semester, subject: this.subject },
        content
      );
      const startOrder = table.rows.reduce((max, row) => Math.max(max, row.order), 0) + 1;
      const imported = parseProgressImport(this.text, startOrder);
      if (imported.rows.length === 0) {
        new Notice("가져올 차시를 찾지 못했습니다. 열 구분(탭·쉼표)을 확인하세요.");
        return;
      }
      await this.plugin.repository.appendProgressRows(table, imported.rows);
      const issueSuffix = imported.issues.length > 0 ? ` (건너뜀 ${imported.issues.length}건)` : "";
      new Notice(`${this.subject} 진도표에 ${imported.rows.length}차시를 추가했습니다.${issueSuffix}`);
      this.close();
      await this.plugin.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "차시 가져오기에 실패했습니다.");
    } finally {
      this.importing = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
