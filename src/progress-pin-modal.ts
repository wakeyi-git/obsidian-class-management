import { FuzzySuggestModal, type App } from "obsidian";
import type { ProgressRow } from "./types";

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
    const status = pinnedHere
      ? " — 이 교시에 고정됨 (선택하면 해제)"
      : row.fixedDate
        ? ` — 고정 ${row.fixedDate}${row.fixedPeriod > 0 ? `(${row.fixedPeriod})` : ""}`
        : row.assigned
          ? ` — 배정 ${row.assigned}`
          : "";
    return `${row.order}. ${[row.unit, row.topic].filter(Boolean).join(" · ")}${status}`;
  }

  onChooseItem(row: ProgressRow): void {
    this.onPick(row);
  }
}
