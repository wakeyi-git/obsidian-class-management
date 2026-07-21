import { FuzzySuggestModal, type App } from "obsidian";
import type { CurriculumUnit } from "./types";

export class UnitSuggestModal extends FuzzySuggestModal<CurriculumUnit> {
  constructor(
    app: App,
    private readonly units: CurriculumUnit[],
    private readonly onPick: (unit: CurriculumUnit) => void,
    placeholder = "연결할 통합 단원을 검색하세요"
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getItems(): CurriculumUnit[] {
    return this.units;
  }

  getItemText(unit: CurriculumUnit): string {
    return `${unit.subject} · ${unit.unitName}${unit.conceptInquiryEnabled ? " (개념기반)" : ""}`;
  }

  onChooseItem(unit: CurriculumUnit): void {
    this.onPick(unit);
  }
}
