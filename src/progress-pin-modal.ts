import { FuzzySuggestModal, type App, type FuzzyMatch } from "obsidian";
import type { ProgressRow } from "@core/types";

export class ProgressPinModal extends FuzzySuggestModal<ProgressRow> {
  constructor(
    app: App,
    private readonly rows: ProgressRow[],
    private readonly target: { date: string; period: number; subject: string },
    private readonly onPick: (row: ProgressRow) => void
  ) {
    super(app);
    this.setPlaceholder(
      `${target.date} ${target.period}교시(${target.subject})에 고정할 차시를 검색하세요`
    );
  }

  getItems(): ProgressRow[] {
    return this.rows;
  }

  getItemText(row: ProgressRow): string {
    const pinnedHere =
      row.fixedDate === this.target.date && row.fixedPeriod === this.target.period;
    const place = row.fixedDate
      ? `📌 ${row.fixedDate}${row.fixedPeriod > 0 ? `(${row.fixedPeriod})` : ""}`
      : row.assigned;
    const suffix = pinnedHere ? " (선택하면 해제)" : "";
    return [
      place,
      `${row.order}. ${[row.unit, row.topic].filter(Boolean).join(" · ")}`
    ]
      .filter(Boolean)
      .join(" — ")
      .concat(suffix);
  }

  renderSuggestion(match: FuzzyMatch<ProgressRow>, el: HTMLElement): void {
    super.renderSuggestion(match, el);
    const row = match.item;
    if (row.fixedDate === this.target.date && row.fixedPeriod === this.target.period) {
      el.addClass("class-management-pin-here");
    } else if (row.fixedDate) {
      el.addClass("class-management-pin-elsewhere");
    }
  }

  onChooseItem(row: ProgressRow): void {
    this.onPick(row);
  }
}
