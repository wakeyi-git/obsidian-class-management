import { Modal, Notice, Setting } from "obsidian";
import { unitScaffoldsFromProgress } from "@core/planning";
import type { ProgressTable } from "@core/types";
import type ClassManagementPlugin from "./main";

/**
 * 일반 단원 일괄 생성 (R0-1) — 진도표를 읽어 과목·단원별 단원 노트 초안을 만든다.
 * 이미 같은 이름의 단원이 있으면 건너뛴다(멱등). 지도서 전문은 수기 보완 전제.
 */
export class UnitScaffoldModal extends Modal {
  private semester: string;
  private tables: ProgressTable[] = [];
  private selected = new Set<string>();
  private listEl: HTMLElement | null = null;
  private running = false;

  constructor(private readonly plugin: ClassManagementPlugin) {
    super(plugin.app);
    this.semester = plugin.settings.semester;
  }

  onOpen(): void {
    this.contentEl.empty();
    this.titleEl.setText("일반 단원 일괄 생성");
    this.contentEl.createEl("p", {
      text: "진도표의 차시 흐름을 단원별로 묶어 단원 노트 초안(전개·기간·시수·성취기준)을 만듭니다. 이미 있는 단원은 건너뜁니다."
    });
    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "통합 단원으로 이관된 차시는 전개에 → 표시로 남습니다. 지도서 전문·학생 요구는 노트에서 이어서 채워 주세요."
    });

    new Setting(this.contentEl).setName("학기").addDropdown((dropdown) => {
      dropdown.addOption("1학기", "1학기");
      dropdown.addOption("2학기", "2학기");
      dropdown.setValue(this.semester);
      dropdown.onChange((value) => {
        this.semester = value;
        void this.loadTables();
      });
    });

    this.listEl = this.contentEl.createDiv();

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("단원 노트 생성")
        .setCta()
        .onClick(() => void this.run())
    );

    void this.loadTables();
  }

  private async loadTables(): Promise<void> {
    this.tables = await this.plugin.repository.getProgressTables(this.semester);
    this.selected = new Set(
      this.tables
        .filter((table) => unitScaffoldsFromProgress(table).length > 0)
        .map((table) => table.subject)
    );
    this.renderList();
  }

  private renderList(): void {
    if (!this.listEl) return;
    this.listEl.empty();
    if (this.tables.length === 0) {
      this.listEl.createEl("p", {
        cls: "setting-item-description",
        text: `${this.semester} 진도표가 없습니다. 먼저 진도표 차시 가져오기로 차시를 넣어 주세요.`
      });
      return;
    }
    const existing = this.plugin.repository.getCurriculumUnits();
    for (const table of this.tables) {
      const scaffolds = unitScaffoldsFromProgress(table);
      const duplicates = scaffolds.filter((scaffold) =>
        existing.some(
          (unit) =>
            unit.subject === table.subject &&
            unit.semester === this.semester &&
            unit.unitName === scaffold.unitName
        )
      ).length;
      const fresh = scaffolds.length - duplicates;
      const setting = new Setting(this.listEl)
        .setName(table.subject)
        .setDesc(
          scaffolds.length === 0
            ? "단원명이 있는 차시가 없어 만들 단원이 없습니다."
            : `단원 ${scaffolds.length}개 — 새로 ${fresh}개${duplicates > 0 ? ` · 기존 ${duplicates}개 건너뜀` : ""}`
        );
      setting.addToggle((toggle) => {
        toggle.setValue(this.selected.has(table.subject));
        toggle.setDisabled(scaffolds.length === 0);
        toggle.onChange((value) => {
          if (value) this.selected.add(table.subject);
          else this.selected.delete(table.subject);
        });
      });
    }
  }

  private async run(): Promise<void> {
    if (this.running) return;
    const subjects = [...this.selected];
    if (subjects.length === 0) {
      new Notice("생성할 과목을 선택해 주세요.");
      return;
    }
    this.running = true;
    try {
      const result = await this.plugin.scaffoldRegularUnits(this.semester, subjects);
      const skippedSuffix =
        result.skipped.length > 0 ? ` 기존 ${result.skipped.length}개는 건너뛰었습니다.` : "";
      new Notice(`단원 노트 ${result.created.length}개를 만들었습니다.${skippedSuffix}`);
      this.close();
      if (result.created.length > 0) await this.plugin.openCurriculum();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "단원 노트 생성에 실패했습니다.");
    } finally {
      this.running = false;
    }
  }

  onClose(): void {
    this.contentEl.empty();
  }
}
