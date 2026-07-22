import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import {
  auditCurriculumAlignment,
  auditConceptInquiryDesign,
  CONCEPT_INQUIRY_PHASE_LABELS,
  CURRICULUM_DESIGN_APPROACH_LABELS,
  CURRICULUM_KNOWLEDGE_STRUCTURE_LABELS,
  CURRICULUM_UNIT_STATUS_LABELS,
  createConceptInquiryStrand,
  emptyCurriculumUnit,
  EVALUATION_METHOD_OPTIONS
} from "@core/curriculum";
import type {
  ClassManagementSettings,
  ConceptInquiryPhase,
  ConceptInquiryStrand,
  CurriculumDesignApproach,
  CurriculumKnowledgeStructure,
  CurriculumUnit,
  CurriculumUnitStatus,
  NewCurriculumUnit
} from "@core/types";

export class CurriculumUnitModal extends Modal {
  private draft: NewCurriculumUnit;
  private validationEl?: HTMLElement;
  private conceptFieldsEl?: HTMLElement;
  private saveButton?: ButtonComponent;
  private saving = false;

  constructor(
    app: App,
    private readonly settings: ClassManagementSettings,
    private readonly onSave: (unit: NewCurriculumUnit, existing?: CurriculumUnit) => Promise<void>,
    private readonly existing?: CurriculumUnit
  ) {
    super(app);
    this.draft = existing ? unitDraft(existing) : emptyCurriculumUnit(settings);
  }

  onOpen(): void {
    this.setTitle(this.existing ? "단원 설계 수정" : "새 단원 설계");
    this.modalEl.addClass("class-management-curriculum-modal");
    this.contentEl.createEl("p", {
      text: "성취기준에서 목표를 정하고, 수용할 만한 평가 증거를 먼저 결정한 뒤 학생 중심 학습 경험과 기록 초점을 연결합니다."
    });

    this.heading("기본 정보");
    this.addDropdown("교과", Object.fromEntries(this.settings.schoolSubjects.map((subject) => [subject, subject])), this.draft.subject, (value) => {
      this.draft.subject = value;
    });
    this.addText("단원명", "예: 분수의 덧셈과 뺄셈", this.draft.unitName, (value) => {
      this.draft.unitName = value;
    });
    this.addText("통합 주제·실생활 맥락", "교과 간 통합이나 실제 삶의 맥락", this.draft.theme, (value) => {
      this.draft.theme = value;
    });
    this.addDropdown("설계 방법", CURRICULUM_DESIGN_APPROACH_LABELS, this.draft.designApproach, (value) => {
      this.draft.designApproach = value as CurriculumDesignApproach;
    });
    this.addDropdown("운영 상태", CURRICULUM_UNIT_STATUS_LABELS, this.draft.status, (value) => {
      this.draft.status = value as CurriculumUnitStatus;
    });
    this.addDate("시작일", this.draft.startDate, (value) => (this.draft.startDate = value));
    this.addDate("종료일", this.draft.endDate, (value) => (this.draft.endDate = value));
    this.addNumber("계획 시수", this.draft.plannedHours, 1, (value) => (this.draft.plannedHours = value));

    this.heading("1. 교육과정 재인식과 학생 요구");
    this.addTextArea("성취기준", "코드와 내용을 함께 입력합니다. 여러 기준은 줄바꿈으로 구분합니다.", this.draft.achievementStandards, (value) => {
      this.draft.achievementStandards = value;
    }, 5);
    this.addTextArea("학생 요구·삶의 맥락", "학생의 흥미, 선행 경험, 학습 필요, 학급 특성", this.draft.studentNeeds, (value) => {
      this.draft.studentNeeds = value;
    });
    this.addTextArea("핵심역량", "이 단원에서 기를 역량과 구체적인 모습", this.draft.competencies, (value) => {
      this.draft.competencies = value;
    });
    this.addText("연계 교과", "쉼표로 구분", this.draft.connectedSubjects.join(", "), (value) => {
      this.draft.connectedSubjects = splitList(value);
    });

    this.heading("개념기반 탐구학습");
    new Setting(this.contentEl)
      .setName("개념기반 탐구학습 적용")
      .setDesc("핵심 아이디어, 개념적 렌즈, 스트랜드별 일반화와 안내 질문, 전이·성찰을 단원에 구조화합니다.")
      .addToggle((toggle) => toggle.setValue(this.draft.conceptInquiryEnabled).onChange((value) => {
        this.draft.conceptInquiryEnabled = value;
        if (value && !this.draft.conceptInquiryStrands.length) {
          this.draft.conceptInquiryStrands = [createConceptInquiryStrand(1)];
        }
        this.renderConceptInquiryFields();
        this.changed();
      }));
    this.conceptFieldsEl = this.contentEl.createDiv({ cls: "class-management-concept-inquiry-fields" });
    this.renderConceptInquiryFields();

    this.heading("2. 바라는 결과");
    this.addTextArea("핵심 이해", "단원이 끝난 뒤에도 학생이 이해하고 활용해야 할 큰 생각", this.draft.enduringUnderstanding, (value) => {
      this.draft.enduringUnderstanding = value;
    });
    this.addTextArea("핵심 질문", "정답 하나로 끝나지 않고 탐구와 전이를 이끄는 질문", this.draft.essentialQuestion, (value) => {
      this.draft.essentialQuestion = value;
    });

    this.heading("3. 수용할 만한 증거와 평가 계획");
    this.addTextArea("수행·평가 과제", "학생이 무엇을 하거나 만들어 목표 도달을 증명하는지", this.draft.assessmentTask, (value) => {
      this.draft.assessmentTask = value;
    });
    this.addTextArea("평가요소·준거", "성취기준에서 도출한 관찰 가능한 평가요소와 성공 기준", this.draft.evaluationCriteria, (value) => {
      this.draft.evaluationCriteria = value;
    });
    const methods = this.contentEl.createDiv({ cls: "class-management-curriculum-methods" });
    methods.createEl("strong", { text: "평가방법" });
    EVALUATION_METHOD_OPTIONS.forEach((method) => {
      new Setting(methods).setName(method).addToggle((toggle) =>
        toggle.setValue(this.draft.evaluationMethods.includes(method)).onChange((checked) => {
          this.draft.evaluationMethods = checked
            ? [...new Set([...this.draft.evaluationMethods, method])]
            : this.draft.evaluationMethods.filter((entry) => entry !== method);
          this.changed();
        })
      );
    });

    this.heading("4. 학습 경험과 수업 계획");
    this.addTextArea("차시 흐름과 학생 중심 활동", "도입-탐구-표현-피드백 흐름, 협력·질문·선택 활동을 구체적으로 적습니다.", this.draft.learningPlan, (value) => {
      this.draft.learningPlan = value;
    }, 7);

    this.heading("5. 피드백과 기록 계획");
    this.addTextArea("피드백 계획", "수업 중 피드백, 재도전, 다음 수업 조정 방법", this.draft.feedbackPlan, (value) => {
      this.draft.feedbackPlan = value;
    });
    this.addTextArea("학생별 관찰·기록 초점", "말·행동·산출물에서 무엇을 구체적으로 남길지", this.draft.recordFocus, (value) => {
      this.draft.recordFocus = value;
    });

    this.validationEl = this.contentEl.createDiv({ cls: "class-management-curriculum-validation" });
    this.renderAudit();
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("취소").onClick(() => this.close()))
      .addButton((button) => {
        this.saveButton = button;
        button.setButtonText("통합 설계 저장").setCta().onClick(() => void this.save());
      });
  }

  private renderConceptInquiryFields(): void {
    const container = this.conceptFieldsEl;
    if (!container) return;
    container.empty();
    if (!this.draft.conceptInquiryEnabled) {
      container.createEl("p", {
        text: "활성화하면 2022 개정 교육과정의 핵심 아이디어와 개념기반 탐구학습 설계 항목을 입력할 수 있습니다.",
        cls: "setting-item-description"
      });
      return;
    }
    this.addTextArea("단원 개요", "단원의 성격, 삶의 맥락, 학생이 성취할 역량과 기능", this.draft.unitOverview, (value) => {
      this.draft.unitOverview = value;
    }, 4, container);
    this.addTextArea("핵심 아이디어", "2022 개정 교육과정 내용체계에서 영역을 아우르며 전이 가능한 이해", this.draft.keyIdea, (value) => {
      this.draft.keyIdea = value;
    }, 4, container);
    this.addText("개념적 렌즈", "학습의 방향과 깊이를 정하는 한두 단어의 전이 가능한 개념", this.draft.conceptualLens, (value) => {
      this.draft.conceptualLens = value;
    }, container);
    this.addText("매크로 개념", "교과를 가로지르는 개념을 쉼표로 구분: 예) 변화, 관계, 시스템", this.draft.macroConcepts.join(", "), (value) => {
      this.draft.macroConcepts = splitList(value);
    }, container);
    this.addText("마이크로 개념", "교과 고유 개념을 쉼표로 구분", this.draft.microConcepts.join(", "), (value) => {
      this.draft.microConcepts = splitList(value);
    }, container);
    this.addDropdown("지식·과정 구조", CURRICULUM_KNOWLEDGE_STRUCTURE_LABELS, this.draft.knowledgeStructure, (value) => {
      this.draft.knowledgeStructure = value as CurriculumKnowledgeStructure;
    }, container, false);
    this.addTextArea("개념망", "단원 제목-개념적 렌즈-스트랜드-주요 개념의 관계를 Markdown 또는 Mermaid로 표현", this.draft.conceptMap, (value) => {
      this.draft.conceptMap = value;
    }, 5, container);
    this.addTextArea("사전학습 가시화", "학생의 기존 경험과 개념을 확인할 질문·전략: 예) 학습일기, 네모퉁이 토론", this.draft.priorKnowledge, (value) => {
      this.draft.priorKnowledge = value;
    }, 3, container);
    this.addTextArea("학생 주도성", "학생이 질문하고 선택하며 조사·표현·평가에 참여할 지점", this.draft.studentAgency, (value) => {
      this.draft.studentAgency = value;
    }, 3, container);
    this.addTextArea("전이 맥락", "학생이 형성한 일반화를 낯선 실제 상황에 적용할 과제나 맥락", this.draft.transferContext, (value) => {
      this.draft.transferContext = value;
    }, 3, container);

    const phases = container.createDiv({ cls: "class-management-concept-phases" });
    phases.createEl("strong", { text: "단원 탐구 단계" });
    phases.createEl("p", {
      text: "한 차시에 모두 수행하는 것이 아니라 스트랜드 전체 차시에 필요한 단계를 배열합니다.",
      cls: "setting-item-description"
    });
    (Object.entries(CONCEPT_INQUIRY_PHASE_LABELS) as Array<[ConceptInquiryPhase, string]>).forEach(([phase, label]) => {
      new Setting(phases).setName(label).addToggle((toggle) =>
        toggle.setValue(this.draft.inquiryPhases.includes(phase)).onChange((checked) => {
          this.draft.inquiryPhases = checked
            ? [...new Set([...this.draft.inquiryPhases, phase])]
            : this.draft.inquiryPhases.filter((entry) => entry !== phase);
          this.changed();
        })
      );
    });

    this.heading("스트랜드별 지도 계획", container, "h4");
    this.draft.conceptInquiryStrands.forEach((strand, index) => {
      this.renderStrand(container, strand, index);
    });
    const addStrand = container.createEl("button", { text: "스트랜드 추가" });
    addStrand.addEventListener("click", () => {
      this.draft.conceptInquiryStrands.push(createConceptInquiryStrand(this.draft.conceptInquiryStrands.length + 1));
      this.renderConceptInquiryFields();
      this.changed();
    });
    this.addTextArea("분석적 루브릭", "지식·이해, 과정·기능, 가치·태도별 평가요소와 수준을 작성", this.draft.analyticRubric, (value) => {
      this.draft.analyticRubric = value;
    }, 7, container);
  }

  private renderStrand(container: HTMLElement, strand: ConceptInquiryStrand, index: number): void {
    const card = container.createDiv({ cls: "class-management-concept-strand" });
    const header = card.createDiv({ cls: "class-management-concept-strand-header" });
    header.createEl("strong", { text: `${index + 1}. ${strand.title || "새 스트랜드"}` });
    const remove = header.createEl("button", { text: "삭제" });
    remove.disabled = this.draft.conceptInquiryStrands.length <= 1;
    remove.addEventListener("click", () => {
      this.draft.conceptInquiryStrands = this.draft.conceptInquiryStrands.filter((entry) => entry.id !== strand.id);
      this.renderConceptInquiryFields();
      this.changed();
    });
    this.addText("스트랜드명", "개념 렌즈로 조직한 학습 범주", strand.title, (value) => {
      strand.title = value;
      header.querySelector("strong")?.setText(`${index + 1}. ${value || "새 스트랜드"}`);
    }, card);
    this.addTextArea("일반화 진술", "두 개 이상 개념의 관계를 나타내며 학생이 탐구 후 스스로 형성할 완결된 진술", strand.generalization, (value) => {
      strand.generalization = value;
    }, 3, card);
    this.addTextArea("사실적 질문", "사실·용어·사례를 확인하는 질문, 한 줄에 하나", strand.factualQuestions, (value) => {
      strand.factualQuestions = value;
    }, 3, card);
    this.addTextArea("개념적 질문", "개념 간 관계와 패턴을 찾는 질문 3~5개, 한 줄에 하나", strand.conceptualQuestions, (value) => {
      strand.conceptualQuestions = value;
    }, 4, card);
    this.addTextArea("논쟁적 질문", "여러 관점과 근거가 가능한 질문 1~2개, 한 줄에 하나", strand.debatableQuestions, (value) => {
      strand.debatableQuestions = value;
    }, 3, card);
    this.addTextArea("내용 지식", "일반화를 뒷받침할 중요한 사실·사례·용어", strand.contentKnowledge, (value) => {
      strand.contentKnowledge = value;
    }, 3, card);
    this.addTextArea("핵심 기능", "조사·분석·표현·문제해결 등 교과 기능과 역량", strand.coreSkills, (value) => {
      strand.coreSkills = value;
    }, 3, card);
    this.addText("평가방법", "예: 관찰평가, 구술평가, 수행평가", strand.evaluationMethods, (value) => {
      strand.evaluationMethods = value;
    }, card);
  }

  private heading(text: string, parent: HTMLElement = this.contentEl, tag: "h3" | "h4" = "h3"): void {
    parent.createEl(tag, { text });
  }

  private addText(name: string, description: string, value: string, onChange: (value: string) => void, parent: HTMLElement = this.contentEl): void {
    new Setting(parent).setName(name).setDesc(description).addText((text) =>
      text.setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      })
    );
  }

  private addTextArea(name: string, description: string, value: string, onChange: (value: string) => void, rows = 4, parent: HTMLElement = this.contentEl): void {
    new Setting(parent).setName(name).setDesc(description).addTextArea((text) => {
      text.setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      });
      text.inputEl.rows = rows;
    });
  }

  private addDropdown(name: string, options: Record<string, string>, value: string, onChange: (value: string) => void, parent: HTMLElement = this.contentEl, allowEmpty = true): void {
    new Setting(parent).setName(name).addDropdown((dropdown) => {
      if (allowEmpty) dropdown.addOption("", "선택");
      dropdown.addOptions(options).setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      });
    });
  }

  private addDate(name: string, value: string, onChange: (value: string) => void): void {
    new Setting(this.contentEl).setName(name).addText((text) => {
      text.inputEl.type = "date";
      text.setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      });
    });
  }

  private addNumber(name: string, value: number, min: number, onChange: (value: number) => void): void {
    new Setting(this.contentEl).setName(name).addText((text) => {
      text.inputEl.type = "number";
      text.inputEl.min = String(min);
      text.setValue(String(value)).onChange((next) => {
        onChange(Math.max(min, Number(next) || min));
        this.changed();
      });
    });
  }

  private changed(): void {
    this.renderAudit();
  }

  private renderAudit(): void {
    if (!this.validationEl) return;
    this.validationEl.empty();
    const audit = auditCurriculumAlignment(this.draft);
    this.validationEl.createEl("strong", { text: `교육과정-수업-평가-기록 연결도 ${audit.score}%` });
    const conceptAudit = auditConceptInquiryDesign(this.draft);
    if (this.draft.conceptInquiryEnabled) {
      this.validationEl.createEl("p", {
        text: `개념기반 탐구학습 설계 완성도 ${conceptAudit.score}% (${conceptAudit.completed}/${conceptAudit.total})`
      });
    }
    const issues = [...audit.issues, ...conceptAudit.issues];
    if (!issues.length) {
      this.validationEl.createEl("p", { text: "네 단계의 핵심 연결 항목이 모두 입력되었습니다." });
      return;
    }
    const list = this.validationEl.createEl("ul");
    issues.forEach((issue) => {
      const item = list.createEl("li", { text: issue.message });
      item.addClass(issue.severity === "error" ? "is-error" : "is-warning");
    });
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    if (!this.draft.subject.trim() || !this.draft.unitName.trim()) {
      new Notice("교과와 단원명을 입력해 주세요.");
      return;
    }
    const audit = auditCurriculumAlignment(this.draft);
    const conceptAudit = auditConceptInquiryDesign(this.draft);
    if (this.draft.status !== "draft" && [...audit.issues, ...conceptAudit.issues].some((issue) => issue.severity === "error")) {
      new Notice("실행 단계로 전환하려면 빨간색 일체화 항목을 먼저 보완해 주세요.");
      this.renderAudit();
      return;
    }
    this.saving = true;
    this.saveButton?.setDisabled(true).setButtonText("저장하는 중…");
    try {
      await this.onSave({ ...this.draft }, this.existing);
      this.close();
    } catch (error) {
      this.saving = false;
      this.saveButton?.setDisabled(false).setButtonText("통합 설계 저장");
      new Notice(error instanceof Error ? error.message : "단원 설계를 저장하지 못했습니다.");
    }
  }
}

function unitDraft(unit: CurriculumUnit): NewCurriculumUnit {
  const { file: _file, createdAt: _createdAt, ...draft } = unit;
  return {
    ...draft,
    evaluationMethods: [...unit.evaluationMethods],
    connectedSubjects: [...unit.connectedSubjects],
    macroConcepts: [...unit.macroConcepts],
    microConcepts: [...unit.microConcepts],
    inquiryPhases: [...unit.inquiryPhases],
    conceptInquiryStrands: unit.conceptInquiryStrands.map((strand) => ({ ...strand }))
  };
}

function splitList(value: string): string[] {
  return [...new Set(value.split(/[,\n]/).map((item) => item.trim()).filter(Boolean))];
}
