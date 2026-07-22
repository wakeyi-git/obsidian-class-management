import { Modal, Notice, Setting } from "obsidian";
import type ClassManagementPlugin from "./main";
import { SCHOOL_RECORD_SUBAREAS } from "@core/school-record-evidence";
import type { ActivityEntry, SchoolRecordReviewStatus } from "@core/types";

const REVIEW_LABELS: Record<SchoolRecordReviewStatus, string> = {
  raw: "RAW",
  reviewed: "검토 완료",
  excluded: "초안 제외"
};

export class SchoolRecordReviewModal extends Modal {
  constructor(
    private readonly plugin: ClassManagementPlugin,
    private readonly activities: ActivityEntry[],
    private readonly onChanged: () => Promise<void>
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("학교생활기록부 근거 검토 상태");
    this.modalEl.addClass("class-management-school-review-modal");
    this.contentEl.createEl("p", {
      text: "원본 사실과 영역을 확인한 자료만 검토 완료로 바꾸세요. 초안에 사용하면 안 되는 자료는 초안 제외로 표시합니다."
    });
    const list = this.contentEl.createDiv({ cls: "class-management-school-review-list" });
    this.activities.forEach((activity) => this.renderRow(list, activity));
    if (!this.activities.length) list.createEl("p", { text: "구조화된 근거 기록이 없습니다." });
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("닫기").onClick(() => this.close())
    );
  }

  private renderRow(container: HTMLElement, activity: ActivityEntry): void {
    const evidence = activity.schoolRecordEvidence;
    if (!evidence) return;
    const row = container.createDiv();
    const summary = row.createDiv();
    const category = evidence.subject || SCHOOL_RECORD_SUBAREAS[evidence.area][evidence.subarea] || evidence.subarea;
    summary.createEl("strong", { text: `${activity.date} · ${activity.studentNumber}번 ${activity.studentName} · ${category}` });
    summary.createEl("span", { text: activity.detail || evidence.observedFact || "내용 없음" });
    const actions = row.createDiv();
    const select = actions.createEl("select", {
      attr: { "aria-label": `${activity.studentNumber}번 ${activity.studentName} 근거 검토 상태` }
    });
    (Object.keys(REVIEW_LABELS) as SchoolRecordReviewStatus[]).forEach((status) => {
      const option = select.createEl("option", { text: REVIEW_LABELS[status] });
      option.value = status;
    });
    select.value = evidence.reviewStatus;
    select.disabled = this.plugin.activeClassProfile.archived;
    select.addEventListener("change", () => void this.changeStatus(activity, select));
    const original = actions.createEl("button", { text: "원본" });
    original.addEventListener("click", () => void this.plugin.openFile(activity.file));
  }

  private async changeStatus(activity: ActivityEntry, select: HTMLSelectElement): Promise<void> {
    const previous = activity.schoolRecordEvidence?.reviewStatus ?? "raw";
    const next = select.value as SchoolRecordReviewStatus;
    select.disabled = true;
    try {
      await this.plugin.repository.updateSchoolRecordEvidenceReviewStatus(activity.file, next);
      if (activity.schoolRecordEvidence) activity.schoolRecordEvidence.reviewStatus = next;
      this.plugin.activityIndex.invalidate();
      await this.onChanged();
      new Notice(`근거 상태를 ${REVIEW_LABELS[next]}로 변경했습니다.`);
    } catch (error) {
      select.value = previous;
      new Notice(error instanceof Error ? error.message : "검토 상태를 변경하지 못했습니다.");
    } finally {
      select.disabled = false;
    }
  }
}
