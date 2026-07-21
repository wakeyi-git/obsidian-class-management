import { Modal, Notice, Setting } from "obsidian";
import type ClassManagementPlugin from "./main";
import { SchoolRecordEvidenceModal } from "./school-record-evidence-modal";
import { suggestLegacySchoolRecordEvidence } from "./school-record-evidence";
import type { ActivityEntry } from "./types";

export class LegacyRecordMigrationModal extends Modal {
  constructor(
    private readonly plugin: ClassManagementPlugin,
    private readonly records: ActivityEntry[],
    private readonly onMigrated: () => Promise<void>
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("기존 자유서술 기록 분류 추천");
    this.modalEl.addClass("class-management-legacy-record-modal");
    this.contentEl.createEl("p", {
      text: "키워드 추천은 확정 분류가 아닙니다. 원본을 확인하고 필요한 구조화 필드를 채운 기록만 누락 점검의 근거로 인정됩니다."
    });
    const list = this.contentEl.createDiv({ cls: "class-management-legacy-record-list" });
    this.records.slice(0, 100).forEach((activity) => {
      const suggestion = suggestLegacySchoolRecordEvidence(activity.status, activity.detail);
      const row = list.createDiv();
      const summary = row.createDiv();
      summary.createEl("strong", { text: `${activity.date} · ${activity.studentNumber}번 ${activity.studentName} · ${activity.status}` });
      summary.createEl("span", { text: activity.detail || "내용 없음" });
      summary.createEl("small", { text: `추천: ${areaLabel(suggestion.area)}` });
      const actions = row.createDiv();
      const original = actions.createEl("button", { text: "원본" });
      original.addEventListener("click", () => void this.plugin.openFile(activity.file));
      const classify = actions.createEl("button", { text: "검토·분류", cls: "mod-cta" });
      classify.disabled = this.plugin.activeClassProfile.archived;
      classify.addEventListener("click", () => this.openClassification(activity, suggestion));
    });
    if (this.records.length > 100) {
      list.createEl("p", { text: `최근 100건만 표시합니다. 나머지 ${this.records.length - 100}건은 기간 필터로 나누어 검토하세요.` });
    }
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("닫기").onClick(() => this.close())
    );
  }

  private openClassification(
    activity: ActivityEntry,
    suggestion: ReturnType<typeof suggestLegacySchoolRecordEvidence>
  ): void {
    const student = this.plugin.repository.getStudents(true).find(
      (entry) => entry.number === activity.studentNumber
    );
    if (!student) {
      new Notice("연결된 학생을 찾을 수 없습니다.");
      return;
    }
    new SchoolRecordEvidenceModal(
      this.app,
      student,
      this.plugin.settings,
      async (record) => {
        const evidence = record.schoolRecordEvidence;
        if (!evidence) throw new Error("학교생활기록부 근거 정보를 확인할 수 없습니다.");
        await this.plugin.repository.updateRecordSchoolRecordEvidence(activity.file, evidence);
        this.plugin.activityIndex.invalidate();
        new Notice("기존 기록에 구조화된 학생부 근거 정보를 추가했습니다.");
        this.close();
        await this.onMigrated();
      },
      activity.date,
      suggestion.area,
      suggestion
    ).open();
  }
}

function areaLabel(area: ReturnType<typeof suggestLegacySchoolRecordEvidence>["area"]): string {
  if (area === "creative-activities") return "창의적 체험활동상황";
  if (area === "subject-development") return "교과학습발달상황";
  return "행동특성 및 종합의견";
}
