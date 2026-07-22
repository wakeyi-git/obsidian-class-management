import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import {
  CONCEPT_INQUIRY_PHASE_LABELS,
  CURRICULUM_LESSON_STATUS_LABELS,
  emptyCurriculumLesson
} from "./curriculum";
import type {
  ConceptInquiryPhase,
  CurriculumLesson,
  CurriculumLessonStatus,
  CurriculumUnit,
  NewCurriculumLesson
} from "./types";
import { localDate } from "./utils";

/**
 * 수업 기록(수업일지) 모달 — 차시의 허브 노트.
 * 단원 연계는 선택이다: 맥락(날짜·교시·과목)만으로 가볍게 시작하고,
 * 프로젝트 차시는 단원을 연결해 탐구·성찰까지 채운다.
 */
export class CurriculumLessonModal extends Modal {
  private draft: NewCurriculumLesson;
  private unit: CurriculumUnit | null;
  private saveButton?: ButtonComponent;
  private saving = false;

  constructor(
    app: App,
    unit: CurriculumUnit | null,
    private readonly units: CurriculumUnit[],
    private readonly onSave: (lesson: NewCurriculumLesson, existing?: CurriculumLesson) => Promise<void>,
    private readonly existing?: CurriculumLesson,
    prefill?: Partial<NewCurriculumLesson>
  ) {
    super(app);
    this.draft = existing
      ? lessonDraft(existing)
      : { ...emptyCurriculumLesson(unit), ...prefill };
    this.unit = unit ?? this.units.find((item) => item.id === this.draft.unitId) ?? null;
    if (!this.draft.date) this.draft.date = localDate();
  }

  onOpen(): void {
    this.modalEl.addClass("class-management-curriculum-modal");
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.setTitle(
      this.unit ? `${this.unit.unitName} 수업일지` : "수업일지"
    );
    this.contentEl.createEl("blockquote", {
      text: this.unit
        ? `${this.unit.subject} · 성취기준과 평가계획에 연결된 차시입니다. 계획 단계에서는 목표와 활동을, 실행 후에는 평가 증거·피드백·성찰을 남깁니다.`
        : "이 차시의 기록 허브입니다. 메모만 남겨도 되고, 단원을 연결하면 탐구·성찰 기록으로 확장됩니다. 학생 관찰·과제가 이 노트를 링크합니다."
    });

    new Setting(this.contentEl)
      .setName("연계 단원")
      .setDesc("선택 사항 — 이 차시가 속한 단원을 연결하세요.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "연결 없음");
        for (const unit of this.units) {
          dropdown.addOption(unit.id, `${unit.subject} · ${unit.unitName}`);
        }
        dropdown.setValue(this.unit?.id ?? "").onChange((value) => {
          const selected = this.units.find((item) => item.id === value) ?? null;
          this.unit = selected;
          this.draft.unitId = selected?.id ?? "";
          this.draft.unitTitle = selected?.unitName ?? "";
          this.draft.unitPath = selected
            ? selected.file.path.replace(/\.md$/i, "")
            : "";
          if (selected) {
            this.draft.subject = selected.subject;
            if (!this.draft.conceptInquiryPhase && selected.conceptInquiryEnabled) {
              this.draft.conceptInquiryPhase = "engage";
            }
          }
          if (!selected) {
            this.draft.conceptInquiryStrandId = "";
            this.draft.conceptInquiryStrandTitle = "";
          }
          this.render();
        });
      });

    this.addDate();
    this.addText("과목", "예: 국어", this.draft.subject, (value) => (this.draft.subject = value));
    this.addText("교시", "예: 3교시", this.draft.period, (value) => (this.draft.period = value));
    this.addNumber("차시", this.draft.sequence, 1, (value) => (this.draft.sequence = value));
    this.addNumber("운영 시수", this.draft.hours, 0.5, (value) => (this.draft.hours = value));
    new Setting(this.contentEl).setName("실행 상태").addDropdown((dropdown) =>
      dropdown.addOptions(CURRICULUM_LESSON_STATUS_LABELS).setValue(this.draft.status).onChange((value) => {
        this.draft.status = value as CurriculumLessonStatus;
      })
    );
    if (this.unit?.conceptInquiryEnabled) this.renderConceptInquiryLink(this.unit);
    this.addTextArea("수업 목표", "이번 차시 활동이 향하는 지점 (선택)", this.draft.objective, (value) => (this.draft.objective = value));
    this.addTextArea("학생 중심 학습 활동·메모", "활동, 관찰 메모, 있었던 일 — 가볍게 시작해도 됩니다", this.draft.activities, (value) => (this.draft.activities = value), 6);
    this.addTextArea("과정중심 평가 증거", "발언, 행동, 산출물 등 이번 차시에서 확인할/확인한 증거", this.draft.assessmentEvidence, (value) => (this.draft.assessmentEvidence = value));
    this.addTextArea("학생 참여와 배움", "실제로 나타난 참여 양상과 예상 밖의 배움", this.draft.studentParticipation, (value) => (this.draft.studentParticipation = value));
    this.addTextArea("피드백과 재도전", "제공한 피드백, 학생 반응, 다음 학습 기회", this.draft.feedback, (value) => (this.draft.feedback = value));
    if (this.unit?.conceptInquiryEnabled) {
      this.addTextArea("학생이 형성한 일반화", "교사가 미리 알려준 문장이 아니라 사례와 개념의 관계를 탐구한 뒤 학생이 표현한 이해", this.draft.studentGeneralization, (value) => (this.draft.studentGeneralization = value));
      this.addTextArea("전이 증거", "형성한 일반화를 낯선 상황이나 실제 맥락에 적용한 말·행동·산출물", this.draft.transferEvidence, (value) => (this.draft.transferEvidence = value));
    }
    this.addTextArea("교사 성찰과 다음 수업 조정", "수업·평가 결과를 다음 교육과정 운영에 환류", this.draft.reflection, (value) => (this.draft.reflection = value));

    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("취소").onClick(() => this.close()))
      .addButton((button) => {
        this.saveButton = button;
        button.setButtonText("수업일지 저장").setCta().onClick(() => void this.save());
      });
  }

  private renderConceptInquiryLink(unit: CurriculumUnit): void {
    new Setting(this.contentEl)
      .setName("개념기반 탐구 단계")
      .setDesc("한 차시의 주된 단계입니다. 단원 전체에서는 일반화·전이·성찰까지 이어져야 합니다.")
      .addDropdown((dropdown) => {
        dropdown.addOption("", "선택");
        dropdown.addOptions(CONCEPT_INQUIRY_PHASE_LABELS)
          .setValue(this.draft.conceptInquiryPhase)
          .onChange((value) => {
            this.draft.conceptInquiryPhase = value as "" | ConceptInquiryPhase;
          });
      });
    if (!unit.conceptInquiryStrands.length) return;
    new Setting(this.contentEl)
      .setName("연결 스트랜드")
      .addDropdown((dropdown) => {
        dropdown
          .addOption("", "선택")
          .addOptions(Object.fromEntries(unit.conceptInquiryStrands.map((strand) => [strand.id, strand.title])))
          .setValue(this.draft.conceptInquiryStrandId)
          .onChange((value) => {
            const strand = unit.conceptInquiryStrands.find((entry) => entry.id === value);
            this.draft.conceptInquiryStrandId = value;
            this.draft.conceptInquiryStrandTitle = strand?.title ?? "";
          });
      });
    const selected = unit.conceptInquiryStrands.find((strand) => strand.id === this.draft.conceptInquiryStrandId);
    if (selected?.generalization) {
      this.contentEl.createEl("blockquote", {
        text: `이 스트랜드에서 학생이 형성할 일반화: ${selected.generalization}`
      });
    }
  }

  private addDate(): void {
    new Setting(this.contentEl).setName("수업일").addText((text) => {
      text.inputEl.type = "date";
      text.setValue(this.draft.date).onChange((value) => (this.draft.date = value));
    });
  }

  private addText(name: string, description: string, value: string, onChange: (value: string) => void): void {
    new Setting(this.contentEl).setName(name).setDesc(description).addText((text) => text.setValue(value).onChange(onChange));
  }

  private addTextArea(name: string, description: string, value: string, onChange: (value: string) => void, rows = 4): void {
    new Setting(this.contentEl).setName(name).setDesc(description).addTextArea((text) => {
      text.setValue(value).onChange(onChange);
      text.inputEl.rows = rows;
    });
  }

  private addNumber(name: string, value: number, min: number, onChange: (value: number) => void): void {
    new Setting(this.contentEl).setName(name).addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = String(min);
      text.inputEl.step = String(min);
      text.setValue(String(value)).onChange((next) => onChange(Math.max(min, Number(next) || min)));
    });
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    if (!this.draft.date || !this.draft.subject.trim()) {
      new Notice("수업일과 과목을 입력해 주세요.");
      return;
    }
    if (this.draft.status === "completed" && !this.draft.assessmentEvidence.trim()) {
      new Notice("실행 완료 수업에는 과정중심 평가 증거를 입력해 주세요.");
      return;
    }
    if (
      this.draft.status === "completed" &&
      this.unit?.conceptInquiryEnabled &&
      !this.draft.conceptInquiryPhase
    ) {
      new Notice("개념기반 탐구학습 단원의 실행 완료 기록에는 주된 탐구 단계를 선택해 주세요.");
      return;
    }
    if (this.draft.status === "completed" && this.draft.conceptInquiryPhase === "generalize" && !this.draft.studentGeneralization.trim()) {
      new Notice("일반화 단계의 실행 완료 기록에는 학생이 형성한 일반화를 남겨 주세요.");
      return;
    }
    if (this.draft.status === "completed" && this.draft.conceptInquiryPhase === "transfer" && !this.draft.transferEvidence.trim()) {
      new Notice("전이 단계의 실행 완료 기록에는 새로운 맥락에 적용한 증거를 남겨 주세요.");
      return;
    }
    this.saving = true;
    this.saveButton?.setDisabled(true).setButtonText("저장하는 중…");
    try {
      await this.onSave({ ...this.draft }, this.existing);
      this.close();
    } catch (error) {
      this.saving = false;
      this.saveButton?.setDisabled(false).setButtonText("수업일지 저장");
      new Notice(error instanceof Error ? error.message : "수업일지를 저장하지 못했습니다.");
    }
  }
}

function lessonDraft(lesson: CurriculumLesson): NewCurriculumLesson {
  const { file: _file, createdAt: _createdAt, ...draft } = lesson;
  return { ...draft };
}
