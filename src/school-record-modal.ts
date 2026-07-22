import { App, Modal, Notice, Setting } from "obsidian";
import {
  classifySchoolRecordReferences,
  SCHOOL_RECORD_AREAS,
  schoolRecordReferenceCounts,
  selectStudentActivities
} from "@core/school-record";
import type { ActivityEntry, SchoolRecordArea, StudentEntry } from "@core/types";

export class SchoolRecordDraftModal extends Modal {
  private creating = false;

  constructor(
    app: App,
    private readonly student: StudentEntry,
    private readonly activities: ActivityEntry[],
    private readonly dateFrom: string,
    private readonly dateTo: string,
    private readonly onCreate: (areas: SchoolRecordArea[]) => Promise<void>
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("학교생활기록부 영역별 초안");
    this.modalEl.addClass("class-management-school-record-modal");
    this.contentEl.createEl("p", {
      text: `${this.student.number}번 ${this.student.name} · ${this.dateFrom || "전체"} ~ ${this.dateTo || "전체"}`
    });
    const notice = this.contentEl.createEl("blockquote");
    notice.setText("2026 학교생활기록부 기재요령(초)을 기준으로 참고 자료를 자동 분류합니다. 분류와 초안은 교사가 원본·학교 기준과 대조해 최종 확인해야 합니다.");

    const selected = selectStudentActivities(
      this.activities,
      this.student.number,
      this.dateFrom,
      this.dateTo
    );
    const grid = this.contentEl.createDiv({ cls: "class-management-school-record-grid" });
    SCHOOL_RECORD_AREAS.forEach((definition) => {
      const classification = classifySchoolRecordReferences(selected, definition.area);
      const card = grid.createDiv({ cls: "class-management-school-record-card" });
      card.createEl("h3", { text: definition.label });
      card.createEl("p", { text: definition.description });
      card.createEl("strong", { text: schoolRecordReferenceCounts(classification) });
      const categories = categorySummary(classification.primary.map((reference) => reference.category));
      card.createEl("small", {
        text: categories ? `직접 참고 분류: ${categories}` : "직접 참고 자료 없음 · 관찰·평가 누가기록을 먼저 확인하세요."
      });
      const button = card.createEl("button", { text: "이 영역 초안 만들기" });
      button.addEventListener("click", () => void this.create([definition.area]));
    });

    new Setting(this.contentEl)
      .setDesc("세 파일은 영역별 하위 폴더에 각각 저장되며 기존 파일을 덮어쓰지 않습니다.")
      .addButton((button) => button.setButtonText("취소").onClick(() => this.close()))
      .addButton((button) =>
        button.setButtonText("3개 영역 모두 만들기").setCta().onClick(() =>
          void this.create(SCHOOL_RECORD_AREAS.map((definition) => definition.area))
        )
      );
  }

  private async create(areas: SchoolRecordArea[]): Promise<void> {
    if (this.creating) return;
    this.creating = true;
    this.modalEl.addClass("is-loading");
    try {
      await this.onCreate(areas);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "영역별 초안을 만들지 못했습니다.");
      this.creating = false;
      this.modalEl.removeClass("is-loading");
    }
  }
}

function categorySummary(categories: string[]): string {
  const counts = new Map<string, number>();
  categories.forEach((category) => counts.set(category, (counts.get(category) ?? 0) + 1));
  return [...counts.entries()].map(([category, count]) => `${category} ${count}건`).join(" · ");
}
