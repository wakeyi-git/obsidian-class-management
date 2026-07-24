import { FuzzySuggestModal, Notice, type App } from "obsidian";
import type { AchievementStandardEntry } from "@core/types";

/** 성취기준 검색 선택 — 코드·전문·과목으로 퍼지 검색해 한 건을 고른다 (R2 인식·연결 UI). */
export class StandardPickerModal extends FuzzySuggestModal<AchievementStandardEntry> {
  constructor(
    app: App,
    private readonly standards: AchievementStandardEntry[],
    private readonly onPick: (standard: AchievementStandardEntry) => void
  ) {
    super(app);
    this.setPlaceholder("성취기준 코드·내용·과목으로 검색");
  }

  getItems(): AchievementStandardEntry[] {
    return this.standards;
  }

  getItemText(standard: AchievementStandardEntry): string {
    return `[${standard.code}] ${standard.statement || "(전문 미입력)"} · ${standard.subject}`;
  }

  onChooseItem(standard: AchievementStandardEntry): void {
    this.onPick(standard);
  }
}

/**
 * 텍스트 필드에 성취기준을 검색해 덧붙이는 공통 흐름 — 세 모달(단원·근거·일괄)이 같이 쓴다.
 * 이미 있는 코드는 안내하고 건너뛰며, 값은 pick 시점에 읽어 편집 중 입력을 잃지 않는다.
 */
export function pickStandardInto(
  app: App,
  standards: AchievementStandardEntry[],
  read: () => string,
  apply: (next: string) => void
): void {
  if (standards.length === 0) {
    new Notice("성취기준 노트가 없습니다. `성취기준 노트 생성` 명령으로 먼저 만들어 주세요.");
    return;
  }
  new StandardPickerModal(app, standards, (standard) => {
    const line = `[${standard.code}] ${standard.statement}`.trim();
    const current = read().trim();
    if (current.includes(`[${standard.code}]`)) {
      new Notice(`[${standard.code}]는 이미 입력되어 있습니다.`);
      return;
    }
    apply(current ? `${current}\n${line}` : line);
  }).open();
}
