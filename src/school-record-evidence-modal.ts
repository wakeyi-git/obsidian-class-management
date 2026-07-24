import { App, ButtonComponent, Modal, Notice, Setting, type TextAreaComponent } from "obsidian";
import { pickStandardInto } from "./standard-picker-modal";
import {
  ACTIVITY_PLAN_LABELS,
  emptySchoolRecordEvidence,
  EVIDENCE_TYPE_LABELS,
  normalizeSubjects,
  SCHOOL_RECORD_SUBAREAS,
  validateSchoolRecordEvidence
} from "@core/school-record-evidence";
import { SCHOOL_RECORD_AREAS } from "@core/school-record";
import type {
  AchievementStandardEntry,
  ClassManagementSettings,
  CurriculumLesson,
  CurriculumUnit,
  NewRecord,
  SchoolRecordArea,
  SchoolRecordEvidence,
  StudentEntry
} from "@core/types";
import { localDate } from "@core/utils";

export class SchoolRecordEvidenceModal extends Modal {
  private date: string;
  private evidence = emptySchoolRecordEvidence();
  private fieldsEl?: HTMLElement;
  private validationEl?: HTMLElement;
  private saveButton?: ButtonComponent;
  private warningsConfirmed = false;
  private saving = false;
  private standardInput?: TextAreaComponent;

  constructor(
    app: App,
    private readonly student: StudentEntry,
    private readonly settings: ClassManagementSettings,
    private readonly onSubmit: (record: NewRecord) => Promise<void>,
    initialDate = localDate(),
    initialArea: SchoolRecordArea = "creative-activities",
    initialEvidence?: SchoolRecordEvidence,
    private readonly curriculumUnits: CurriculumUnit[] = [],
    private readonly curriculumLessons: CurriculumLesson[] = [],
    initialUnit?: CurriculumUnit,
    initialLesson?: CurriculumLesson,
    private readonly standards: AchievementStandardEntry[] = []
  ) {
    super(app);
    this.date = initialDate;
    this.evidence = initialEvidence ? { ...initialEvidence } : emptySchoolRecordEvidence(initialArea);
    if (initialUnit) this.applyCurriculumUnit(initialUnit);
    if (initialLesson) this.applyCurriculumLesson(initialLesson);
  }

  onOpen(): void {
    this.setTitle(`${this.student.number}번 ${this.student.name} 학생부 근거 기록`);
    this.modalEl.addClass("class-management-school-evidence-modal");
    const description = this.contentEl.createEl("blockquote");
    description.setText(`${this.settings.schoolRecordGuidelineYear} 기재요령 · ${this.settings.grade}학년 · ${this.settings.curriculum}. 확인한 RAW 사실을 저장하며 공식 기록에는 자동 반영하지 않습니다.`);

    new Setting(this.contentEl).setName("관찰·평가일").addText((text) => {
      text.inputEl.type = "date";
      text.setValue(this.date).onChange((value) => {
        this.date = value;
        this.changed();
      });
    });
    new Setting(this.contentEl).setName("학교생활기록부 영역").addDropdown((dropdown) => {
      SCHOOL_RECORD_AREAS.forEach((definition) => {
        dropdown.addOption(definition.area, definition.label);
      });
      dropdown.setValue(this.evidence.area).onChange((value) => {
        const curriculumLink = pickCurriculumLink(this.evidence);
        this.evidence = { ...emptySchoolRecordEvidence(value as SchoolRecordArea), ...curriculumLink };
        const unit = this.curriculumUnits.find((entry) => entry.id === this.evidence.curriculumUnitId);
        if (unit && value === "subject-development") this.applyCurriculumUnit(unit);
        this.changed();
        this.renderFields();
      });
    });

    this.fieldsEl = this.contentEl.createDiv({ cls: "class-management-school-evidence-fields" });
    this.renderFields();
    this.validationEl = this.contentEl.createDiv({ cls: "class-management-school-evidence-validation" });
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("취소").onClick(() => this.close()))
      .addButton((button) => {
        this.saveButton = button;
        button.setButtonText("학생부 근거 저장 (RAW)").setCta().onClick(() => void this.save());
      });
  }

  private renderFields(): void {
    if (!this.fieldsEl) return;
    this.fieldsEl.empty();
    this.fieldsEl.createEl("h3", { text: "근거 출처" });
    this.renderCurriculumLinkFields();
    this.addDropdown("근거 유형", EVIDENCE_TYPE_LABELS, this.evidence.evidenceType, (value) => {
      this.evidence.evidenceType = value as SchoolRecordEvidence["evidenceType"];
    });
    this.addToggle("교사가 직접 관찰함", "상담·외부 자료처럼 직접 관찰이 아니면 끕니다.", this.evidence.directObservation, (value) => {
      this.evidence.directObservation = value;
    });
    this.addText("관찰자·자료 제공자", "예: 학급담임교사, 동아리 담당교사", this.evidence.observer, (value) => {
      this.evidence.observer = value;
    });

    this.fieldsEl.createEl("h3", { text: "영역별 누가기록" });
    if (this.evidence.area === "creative-activities") this.renderCreativeFields();
    else if (this.evidence.area === "subject-development") this.renderSubjectFields();
    else this.renderBehaviorFields();
  }

  private renderCurriculumLinkFields(): void {
    if (!this.fieldsEl || !this.curriculumUnits.length) return;
    const options = Object.fromEntries(this.curriculumUnits.map((unit) => [
      unit.id,
      `${unit.subject} · ${unit.unitName}`
    ]));
    this.addDropdown("단원 연결", options, this.evidence.curriculumUnitId, (value) => {
      const unit = this.curriculumUnits.find((entry) => entry.id === value);
      if (unit) this.applyCurriculumUnit(unit);
      else this.clearCurriculumLink();
      this.renderFields();
    }, "연결 안 함");
    if (!this.curriculumLessons.length) return;
    // 단원을 골랐으면 그 단원의 수업일지 + 단원 없는 수업일지(허브), 아니면 전체
    const lessons = this.curriculumLessons
      .filter((lesson) =>
        !this.evidence.curriculumUnitId ||
        lesson.unitId === this.evidence.curriculumUnitId ||
        !lesson.unitId
      )
      .sort((a, b) => b.date.localeCompare(a.date));
    if (!lessons.length) return;
    this.addDropdown(
      "수업일지 연결",
      Object.fromEntries(lessons.map((lesson) => [
        lesson.id,
        `${lesson.date || "날짜 미정"}${lesson.period ? ` ${lesson.period}` : ""} · ${lesson.subject}${
          lesson.objective ? ` · ${lesson.objective}` : lesson.unitTitle ? ` · ${lesson.unitTitle}` : ""
        }`
      ])),
      this.evidence.curriculumLessonId,
      (value) => {
        const lesson = lessons.find((entry) => entry.id === value);
        if (lesson) {
          this.applyCurriculumLesson(lesson);
          // 단원이 연결된 수업일지를 고르면 단원도 함께 따라온다
          if (lesson.unitId && lesson.unitId !== this.evidence.curriculumUnitId) {
            const unit = this.curriculumUnits.find((entry) => entry.id === lesson.unitId);
            if (unit) { this.applyCurriculumUnit(unit); this.renderFields(); }
          }
        } else {
          this.evidence.curriculumLessonId = "";
          this.evidence.curriculumLessonPath = "";
        }
      },
      "연결 안 함"
    );
  }

  private applyCurriculumUnit(unit: CurriculumUnit): void {
    this.evidence.curriculumUnitId = unit.id;
    this.evidence.curriculumUnitTitle = unit.unitName;
    this.evidence.curriculumUnitPath = `[[${unit.file.path.replace(/\.md$/i, "")}]]`;
    if (this.evidence.area === "subject-development") {
      this.evidence.subject = unit.subject;
      this.evidence.activityName = unit.unitName;
      this.evidence.achievementStandard = unit.achievementStandards;
      this.evidence.evaluationElement = unit.evaluationCriteria;
      this.evidence.evaluationMethod = unit.evaluationMethods.join(", ");
    }
  }

  private applyCurriculumLesson(lesson: CurriculumLesson): void {
    this.evidence.curriculumLessonId = lesson.id;
    this.evidence.curriculumLessonPath = `[[${lesson.file.path.replace(/\.md$/i, "")}]]`;
    if (this.evidence.area === "subject-development") {
      this.evidence.activityName = lesson.unitTitle || this.evidence.activityName;
      if (!this.evidence.evaluationElement) this.evidence.evaluationElement = lesson.assessmentEvidence;
    }
  }

  private clearCurriculumLink(): void {
    this.evidence.curriculumUnitId = "";
    this.evidence.curriculumUnitTitle = "";
    this.evidence.curriculumUnitPath = "";
    this.evidence.curriculumLessonId = "";
    this.evidence.curriculumLessonPath = "";
  }

  private renderCreativeFields(): void {
    this.addDropdown("세부 영역", SCHOOL_RECORD_SUBAREAS["creative-activities"], this.evidence.subarea, (value) => {
      this.evidence.subarea = value;
      this.changed();
      this.renderFields();
    });
    this.addText("활동명·동아리명", "예: 학급자치회, 과학탐구 동아리, 진로체험", this.evidence.activityName, (value) => {
      this.evidence.activityName = value;
    });
    this.addDropdown("활동 근거", ACTIVITY_PLAN_LABELS, this.evidence.activityPlan, (value) => {
      this.evidence.activityPlan = value;
    });
    this.addDatePair();

    if (this.evidence.subarea === "volunteer") {
      this.addText("장소·주관기관", "학교계획이면 (학교) 구분을 확인하세요.", this.evidence.volunteerOrganizer, (value) => {
        this.evidence.volunteerOrganizer = value;
      });
      this.addText("실제 봉사 시간", "예: 1", this.evidence.volunteerHours, (value, input) => {
        input.type = "number";
        input.min = "0";
        input.step = "0.5";
        this.evidence.volunteerHours = value;
      });
      this.addText("누계 시간", "선택 입력", this.evidence.volunteerCumulativeHours, (value, input) => {
        input.type = "number";
        input.min = "0";
        input.step = "0.5";
        this.evidence.volunteerCumulativeHours = value;
      });
      this.addToggle("학교장 승인 확인", "학생 개인계획 봉사활동은 승인 여부가 필요합니다.", this.evidence.volunteerApproved, (value) => {
        this.evidence.volunteerApproved = value;
      });
      this.addTextArea("객관적인 활동 내용", "정성 평가 없이 실제 봉사 내용 또는 제목만 기록합니다.", this.evidence.observedFact, (value) => {
        this.evidence.observedFact = value;
      });
      return;
    }

    this.addText("실제 역할", "임원은 전교·학년·학급 구분과 재임기간을 확인하세요.", this.evidence.participationRole, (value) => {
      this.evidence.participationRole = value;
    });
    this.addTextArea("참여·협력 과정", "참여도, 협력도, 열성도와 실제 활동을 사실 중심으로 기록합니다.", this.evidence.participation, (value) => {
      this.evidence.participation = value;
    });
    this.addTextArea("교사가 확인한 구체적 사실", "학생이 실제로 한 행동과 역할을 기록합니다.", this.evidence.observedFact, (value) => {
      this.evidence.observedFact = value;
    });
    this.addTextArea("태도 변화와 성장", "노력에 따른 진보와 행동 변화를 기록합니다.", this.evidence.changeGrowth, (value) => {
      this.evidence.changeGrowth = value;
    });
    this.addText("미참여 사유", "한 번도 참여하지 못한 경우에만 입력", this.evidence.nonParticipationReason, (value) => {
      this.evidence.nonParticipationReason = value;
    });
  }

  private renderSubjectFields(): void {
    this.addDropdown("세부 영역", SCHOOL_RECORD_SUBAREAS["subject-development"], this.evidence.subarea, (value) => {
      this.evidence.subarea = value;
    });
    const subjects = Object.fromEntries(normalizeSubjects(this.settings).map((subject) => [subject, subject]));
    this.addDropdown("교과·학교자율시간", subjects, this.evidence.subject, (value) => {
      this.evidence.subject = value;
    }, "선택");
    this.addText("단원·수업 주제", "예: 분수의 덧셈과 뺄셈", this.evidence.activityName, (value) => {
      this.evidence.activityName = value;
    });
    if (this.fieldsEl) {
      new Setting(this.fieldsEl)
        .setName("성취기준")
        .setDesc("성취기준 코드와 내용을 함께 기록할 수 있습니다.")
        .addTextArea((text) => {
          this.standardInput = text;
          text.setValue(this.evidence.achievementStandard).onChange((next) => {
            this.evidence.achievementStandard = next;
            this.changed();
          });
          text.inputEl.rows = 4;
        })
        .addExtraButton((button) =>
          button.setIcon("search").setTooltip("성취기준 노트에서 검색해 추가").onClick(() => {
            pickStandardInto(
              this.app,
              this.standards,
              () => this.evidence.achievementStandard,
              (next) => {
                this.evidence.achievementStandard = next;
                this.standardInput?.setValue(next);
                this.changed();
              }
            );
          })
        );
    }
    this.addText("평가요소", "예: 풀이 과정을 식과 말로 설명하기", this.evidence.evaluationElement, (value) => {
      this.evidence.evaluationElement = value;
    });
    this.addText("평가방법", "예: 수행평가, 관찰, 서술형 평가", this.evidence.evaluationMethod, (value) => {
      this.evidence.evaluationMethod = value;
    });
    this.addTextArea("관찰한 수행 과정·결과", "제출 여부가 아니라 학생이 보인 성취 특성을 기록합니다.", this.evidence.observedFact, (value) => {
      this.evidence.observedFact = value;
    });
    const linkedUnit = this.curriculumUnits.find((unit) => unit.id === this.evidence.curriculumUnitId);
    if (linkedUnit?.conceptInquiryEnabled) {
      this.addTextArea("학생이 형성한 개념적 이해", "교사가 제시한 문장을 복사하지 않고 학생이 사례와 개념의 관계를 설명한 말이나 글을 기록합니다.", this.evidence.conceptualUnderstanding, (value) => {
        this.evidence.conceptualUnderstanding = value;
      });
      this.addTextArea("탐구 과정", "질문 생성, 자료 조사, 공통점·차이점 조직, 근거를 활용한 일반화 과정에서 관찰한 사실", this.evidence.inquiryProcess, (value) => {
        this.evidence.inquiryProcess = value;
      });
      this.addTextArea("전이 증거", "형성한 일반화를 낯선 상황이나 삶의 맥락에 적용한 말·행동·산출물", this.evidence.studentTransferEvidence, (value) => {
        this.evidence.studentTransferEvidence = value;
      });
    }
    this.addTextArea("학습활동 참여", "수업 참여 과정에서 확인한 사실을 기록합니다.", this.evidence.participation, (value) => {
      this.evidence.participation = value;
    });
    this.addTextArea("자기주도적 학습과 성장", "이전 수행과 비교해 확인한 변화가 있을 때 기록합니다.", this.evidence.selfDirectedGrowth, (value) => {
      this.evidence.selfDirectedGrowth = value;
    });
    this.addText("수업 미참여 사유", "장기결석·위탁 등 교과수업에 참여하지 못한 경우", this.evidence.nonParticipationReason, (value) => {
      this.evidence.nonParticipationReason = value;
    });
  }

  private renderBehaviorFields(): void {
    this.addDropdown("행동 영역", SCHOOL_RECORD_SUBAREAS["behavior-summary"], this.evidence.subarea, (value) => {
      this.evidence.subarea = value;
    });
    this.addText("관찰 상황", "예: 국어 모둠 토의, 쉬는 시간, 학급자치회", this.evidence.observationContext, (value) => {
      this.evidence.observationContext = value;
    });
    this.addTextArea("교사가 확인한 구체적 행동", "평가나 성격 단정이 아닌 보거나 들은 행동을 기록합니다.", this.evidence.observedFact, (value) => {
      this.evidence.observedFact = value;
    });
    this.addText("반복·지속 여부", "예: 4월 이후 세 차례 관찰, 최근 한 달간 지속", this.evidence.recurrence, (value) => {
      this.evidence.recurrence = value;
    });
    this.addTextArea("변화와 성장", "이전과 비교하여 확인한 변화", this.evidence.changeGrowth, (value) => {
      this.evidence.changeGrowth = value;
    });
    this.addTextArea("강점·발전 가능성", "교육적 관점에서 확인한 강점과 가능성", this.evidence.strengthPotential, (value) => {
      this.evidence.strengthPotential = value;
    });
    this.addTextArea("지원 내용", "교사가 제공한 안내·지원과 이후 변화", this.evidence.supportProvided, (value) => {
      this.evidence.supportProvided = value;
    });
  }

  private addDatePair(): void {
    this.addText("활동 시작일", "선택 입력", this.evidence.startDate || this.date, (value, input) => {
      input.type = "date";
      this.evidence.startDate = value;
    });
    this.addText("활동 종료일", "선택 입력", this.evidence.endDate, (value, input) => {
      input.type = "date";
      this.evidence.endDate = value;
    });
  }

  private addText(
    name: string,
    description: string,
    value: string,
    onChange: (value: string, input: HTMLInputElement) => void
  ): void {
    if (!this.fieldsEl) return;
    new Setting(this.fieldsEl).setName(name).setDesc(description).addText((text) => {
      text.setValue(value).onChange((next) => {
        onChange(next, text.inputEl);
        this.changed();
      });
      onChange(value, text.inputEl);
    });
  }

  private addTextArea(
    name: string,
    description: string,
    value: string,
    onChange: (value: string) => void
  ): void {
    if (!this.fieldsEl) return;
    new Setting(this.fieldsEl).setName(name).setDesc(description).addTextArea((text) => {
      text.setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      });
      text.inputEl.rows = 4;
    });
  }

  private addDropdown(
    name: string,
    options: Record<string, string>,
    value: string,
    onChange: (value: string) => void,
    emptyLabel?: string
  ): void {
    if (!this.fieldsEl) return;
    new Setting(this.fieldsEl).setName(name).addDropdown((dropdown) => {
      if (emptyLabel) dropdown.addOption("", emptyLabel);
      dropdown.addOptions(options).setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      });
    });
  }

  private addToggle(
    name: string,
    description: string,
    value: boolean,
    onChange: (value: boolean) => void
  ): void {
    if (!this.fieldsEl) return;
    new Setting(this.fieldsEl).setName(name).setDesc(description).addToggle((toggle) =>
      toggle.setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      })
    );
  }

  private changed(): void {
    this.warningsConfirmed = false;
    this.validationEl?.empty();
    this.saveButton?.setButtonText("학생부 근거 저장 (RAW)");
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    const issues = validateSchoolRecordEvidence(this.evidence);
    this.renderValidation(issues);
    if (issues.some((issue) => issue.severity === "error")) return;
    const warnings = issues.filter((issue) => issue.severity === "warning");
    if (warnings.length && !this.warningsConfirmed) {
      this.warningsConfirmed = true;
      this.saveButton?.setButtonText("경고 확인 후 저장");
      return;
    }
    if (!this.date) {
      new Notice("관찰·평가일을 입력해 주세요.");
      return;
    }

    this.saving = true;
    this.saveButton?.setDisabled(true).setButtonText("저장하는 중…");
    try {
      await this.onSubmit({
        recordType: recordTypeLabel(this.evidence),
        date: this.date,
        content: this.evidence.observedFact.trim() || this.evidence.nonParticipationReason.trim(),
        schoolRecordEvidence: { ...this.evidence }
      });
      this.close();
    } catch (error) {
      this.saving = false;
      this.saveButton?.setDisabled(false).setButtonText("학생부 근거 저장 (RAW)");
      new Notice(error instanceof Error ? error.message : "학교생활기록부 근거를 저장하지 못했습니다.");
    }
  }

  private renderValidation(issues: ReturnType<typeof validateSchoolRecordEvidence>): void {
    if (!this.validationEl) return;
    this.validationEl.empty();
    if (!issues.length) return;
    this.validationEl.createEl("strong", { text: "저장 전 확인" });
    const list = this.validationEl.createEl("ul");
    issues.forEach((issue) => {
      const item = list.createEl("li", { text: issue.message });
      item.addClass(issue.severity === "error" ? "is-error" : "is-warning");
    });
  }
}

function recordTypeLabel(evidence: SchoolRecordEvidence): string {
  const subarea = SCHOOL_RECORD_SUBAREAS[evidence.area][evidence.subarea] ?? "학생부 근거";
  return `학생부 근거 · ${subarea}`;
}

function pickCurriculumLink(evidence: SchoolRecordEvidence): Pick<
  SchoolRecordEvidence,
  "curriculumUnitId" | "curriculumUnitTitle" | "curriculumUnitPath" | "curriculumLessonId" | "curriculumLessonPath"
> {
  return {
    curriculumUnitId: evidence.curriculumUnitId,
    curriculumUnitTitle: evidence.curriculumUnitTitle,
    curriculumUnitPath: evidence.curriculumUnitPath,
    curriculumLessonId: evidence.curriculumLessonId,
    curriculumLessonPath: evidence.curriculumLessonPath
  };
}
