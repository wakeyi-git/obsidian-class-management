import { Modal, Notice, Setting } from "obsidian";
import { parseAssessmentPlanImport } from "@core/planning";
import type ClassManagementPlugin from "./main";

/**
 * 평가 계획 가져오기 (R0-2) — 학교 평가계획 표를 붙여넣으면 과제 노트를 일괄 생성하고
 * 단원 연계·진도표 과제 열 기입까지 한다. 진도표 차시 가져오기와 같은 붙여넣기 UX.
 */
export class AssessmentImportModal extends Modal {
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
    this.titleEl.setText("평가 계획 가져오기");
    this.contentEl.createEl("p", {
      text: "학교 평가계획 표를 복사해 붙여넣으세요. 열 순서: 시기 | 단원 | 평가 요소 | 평가 기준 | 평가 방법(선택)."
    });
    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "시기는 \"9월 3주\"·\"10/15\"·\"2026-11-07\" 형태를 인식합니다. 주차 시기는 그 주에 배정된 진도표 차시 날짜로 맞춥니다. 같은 날짜·이름의 과제가 있으면 건너뜁니다."
    });

    new Setting(this.contentEl).setName("과목").addDropdown((dropdown) => {
      for (const subject of this.plugin.settings.schoolSubjects) {
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
      attr: {
        rows: "10",
        placeholder: "9월 3주\t물체와 물질\t물질의 상태 분류하기\t고체·액체·기체를 분류하고 성질을 비교하여 설명할 수 있다\t서술형"
      }
    });
    textarea.addEventListener("input", () => (this.text = textarea.value));

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("가져오기")
        .setCta()
        .onClick(() => void this.importItems())
    );
  }

  private async importItems(): Promise<void> {
    if (this.importing) return;
    if (!this.text.trim()) {
      new Notice("붙여넣은 내용이 없습니다.");
      return;
    }
    this.importing = true;
    try {
      const parsed = parseAssessmentPlanImport(this.text);
      if (parsed.items.length === 0) {
        new Notice("가져올 평가 항목을 찾지 못했습니다. 열 구분(탭·쉼표)을 확인하세요.");
        return;
      }
      const result = await this.plugin.importAssessmentPlan(this.subject, this.semester, parsed.items);
      const parts = [`과제 노트 ${result.created}개를 만들었습니다.`];
      if (result.skipped > 0) parts.push(`기존 ${result.skipped}개 건너뜀.`);
      const issues = [...parsed.issues, ...result.issues];
      if (issues.length > 0) parts.push(`확인 필요 ${issues.length}건.`);
      new Notice(parts.join(" "));
      for (const issue of issues.slice(0, 3)) new Notice(issue);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "평가 계획 가져오기에 실패했습니다.");
    } finally {
      this.importing = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
