import { App, ButtonComponent, Modal, Notice, Setting, type TextAreaComponent } from "obsidian";
import { pickStandardInto } from "./standard-picker-modal";
import {
  ACTIVITY_PLAN_LABELS,
  emptySchoolRecordEvidence,
  normalizeSubjects,
  SCHOOL_RECORD_SUBAREAS,
  validateSchoolRecordEvidence
} from "@core/school-record-evidence";
import { SCHOOL_RECORD_AREAS } from "@core/school-record";
import type {
  AchievementStandardEntry,
  ClassManagementSettings,
  CurriculumUnit,
  NewRecord,
  SchoolRecordArea,
  StudentEntry
} from "@core/types";
import { localDate } from "@core/utils";

export class SchoolRecordBatchModal extends Modal {
  private date = localDate();
  private standardInput?: TextAreaComponent;
  private area: SchoolRecordArea = "creative-activities";
  private subarea = "autonomy";
  private activityName = "";
  private activityPlan = "curriculum";
  private subject = "";
  private achievementStandard = "";
  private evaluationElement = "";
  private evaluationMethod = "";
  private observationContext = "";
  private curriculumUnitId = "";
  private conceptEvidenceFocus: "conceptualUnderstanding" | "inquiryProcess" | "studentTransferEvidence" = "inquiryProcess";
  private readonly facts = new Map<string, string>();
  private commonEl?: HTMLElement;
  private rosterEl?: HTMLElement;
  private validationEl?: HTMLElement;
  private saveButton?: ButtonComponent;
  private warningsConfirmed = false;
  private saving = false;

  constructor(
    app: App,
    private readonly students: StudentEntry[],
    private readonly settings: ClassManagementSettings,
    private readonly onSave: (records: Array<{ student: StudentEntry; record: NewRecord }>) => Promise<void>,
    initialArea: SchoolRecordArea = "creative-activities",
    private readonly curriculumUnits: CurriculumUnit[] = [],
    initialUnit?: CurriculumUnit,
    private readonly standards: AchievementStandardEntry[] = []
  ) {
    super(app);
    this.area = initialArea;
    this.subarea = initialArea === "creative-activities" ? "autonomy" : initialArea === "subject-development" ? "subject" : "general";
    if (initialUnit) this.applyCurriculumUnit(initialUnit);
  }

  onOpen(): void {
    this.setTitle("학생부 근거 학급 일괄 입력");
    this.modalEl.addClass("class-management-school-batch-modal");
    this.contentEl.createEl("p", {
      text: "같은 수업·활동 맥락을 먼저 입력한 뒤 학생별로 실제 관찰한 사실만 기록합니다. 빈 학생은 저장하지 않습니다."
    });
    this.commonEl = this.contentEl.createDiv({ cls: "class-management-school-batch-common" });
    this.rosterEl = this.contentEl.createDiv({ cls: "class-management-school-batch-roster" });
    this.validationEl = this.contentEl.createDiv({ cls: "class-management-school-evidence-validation" });
    this.renderCommon();
    this.renderRoster();
    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("취소").onClick(() => this.close()))
      .addButton((button) => {
        this.saveButton = button;
        button.setButtonText("입력한 학생 저장").setCta().onClick(() => void this.save());
      });
  }

  private renderCommon(): void {
    if (!this.commonEl) return;
    this.commonEl.empty();
    new Setting(this.commonEl).setName("날짜").addText((text) => {
      text.inputEl.type = "date";
      text.setValue(this.date).onChange((value) => {
        this.date = value;
        this.changed();
      });
    });
    new Setting(this.commonEl).setName("영역").addDropdown((dropdown) => {
      SCHOOL_RECORD_AREAS.forEach((definition) => {
        dropdown.addOption(definition.area, definition.shortLabel);
      });
      dropdown.setValue(this.area).onChange((value) => {
        this.area = value as SchoolRecordArea;
        this.subarea = this.area === "creative-activities" ? "autonomy" : this.area === "subject-development" ? "subject" : "general";
        this.changed();
        this.renderCommon();
      });
    });
    new Setting(this.commonEl).setName("세부 영역").addDropdown((dropdown) =>
      dropdown.addOptions(batchSubareas(this.area)).setValue(this.subarea).onChange((value) => {
        this.subarea = value;
        this.changed();
      })
    );
    if (this.curriculumUnits.length) {
      new Setting(this.commonEl).setName("단원 연결").addDropdown((dropdown) =>
        dropdown
          .addOption("", "연결 안 함")
          .addOptions(Object.fromEntries(this.curriculumUnits.map((unit) => [unit.id, `${unit.subject} · ${unit.unitName}`])))
          .setValue(this.curriculumUnitId)
          .onChange((value) => {
            const unit = this.curriculumUnits.find((entry) => entry.id === value);
            if (unit) this.applyCurriculumUnit(unit);
            else this.curriculumUnitId = "";
            this.changed();
            this.renderCommon();
          })
      );
    }
    if (this.area === "creative-activities") {
      this.addText("활동명·동아리명", this.activityName, (value) => (this.activityName = value));
      new Setting(this.commonEl).setName("활동 근거").addDropdown((dropdown) =>
        dropdown.addOptions(ACTIVITY_PLAN_LABELS).setValue(this.activityPlan).onChange((value) => {
          this.activityPlan = value;
          this.changed();
        })
      );
    } else if (this.area === "subject-development") {
      const linkedUnit = this.curriculumUnits.find((unit) => unit.id === this.curriculumUnitId);
      if (linkedUnit?.conceptInquiryEnabled) {
        new Setting(this.commonEl).setName("개념 탐구 근거 초점").addDropdown((dropdown) =>
          dropdown.addOptions({
            inquiryProcess: "탐구 과정",
            conceptualUnderstanding: "학생이 형성한 개념적 이해",
            studentTransferEvidence: "새로운 맥락으로의 전이"
          }).setValue(this.conceptEvidenceFocus).onChange((value) => {
            this.conceptEvidenceFocus = value as "conceptualUnderstanding" | "inquiryProcess" | "studentTransferEvidence";
            this.changed();
          })
        );
      }
      const subjects = Object.fromEntries(normalizeSubjects(this.settings).map((subject) => [subject, subject]));
      new Setting(this.commonEl).setName("교과·학교자율시간").addDropdown((dropdown) =>
        dropdown.addOption("", "선택").addOptions(subjects).setValue(this.subject).onChange((value) => {
          this.subject = value;
          this.changed();
        })
      );
      this.addText("단원·수업 주제", this.activityName, (value) => (this.activityName = value));
      if (this.commonEl) {
        new Setting(this.commonEl)
          .setName("성취기준")
          .addTextArea((text) => {
            this.standardInput = text;
            text.setValue(this.achievementStandard).onChange((next) => {
              this.achievementStandard = next;
              this.changed();
            });
            text.inputEl.rows = 3;
          })
          .addExtraButton((button) =>
            button.setIcon("search").setTooltip("성취기준 노트에서 검색해 추가").onClick(() => {
              pickStandardInto(
                this.app,
                this.standards,
                () => this.achievementStandard,
                (next) => {
                  this.achievementStandard = next;
                  this.standardInput?.setValue(next);
                  this.changed();
                }
              );
            })
          );
      }
      this.addText("평가요소", this.evaluationElement, (value) => (this.evaluationElement = value));
      this.addText("평가방법", this.evaluationMethod, (value) => (this.evaluationMethod = value));
    } else {
      this.addText("공통 관찰 상황", this.observationContext, (value) => (this.observationContext = value));
    }
  }

  private renderRoster(): void {
    if (!this.rosterEl) return;
    this.rosterEl.empty();
    const table = this.rosterEl.createEl("table");
    const header = table.createEl("thead").createEl("tr");
    ["번호", "학생", "교사가 확인한 구체적 사실"].forEach((label) => header.createEl("th", { text: label }));
    const body = table.createEl("tbody");
    this.students.forEach((student) => {
      const row = body.createEl("tr");
      row.createEl("td", { text: student.number });
      row.createEl("td", { text: student.name });
      const input = row.createEl("td").createEl("textarea", {
        attr: { "aria-label": `${student.number}번 ${student.name} 관찰 사실`, placeholder: "관찰한 학생만 입력" }
      });
      input.rows = 2;
      input.value = this.facts.get(student.number) ?? "";
      input.addEventListener("input", () => {
        this.facts.set(student.number, input.value);
        this.changed();
      });
    });
  }

  private addText(name: string, value: string, onChange: (value: string) => void): void {
    if (!this.commonEl) return;
    new Setting(this.commonEl).setName(name).addText((text) =>
      text.setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      })
    );
  }

  private addTextArea(name: string, value: string, onChange: (value: string) => void): void {
    if (!this.commonEl) return;
    new Setting(this.commonEl).setName(name).addTextArea((text) => {
      text.setValue(value).onChange((next) => {
        onChange(next);
        this.changed();
      });
      text.inputEl.rows = 3;
    });
  }

  private changed(): void {
    this.warningsConfirmed = false;
    this.validationEl?.empty();
    this.saveButton?.setButtonText("입력한 학생 저장");
  }

  private buildRecords(): Array<{ student: StudentEntry; record: NewRecord }> {
    return this.students.flatMap((student) => {
      const fact = (this.facts.get(student.number) ?? "").trim();
      if (!fact) return [];
      const evidence = emptySchoolRecordEvidence(this.area);
      Object.assign(evidence, {
        subarea: this.subarea,
        activityName: this.activityName.trim(),
        activityPlan: this.area === "creative-activities" ? this.activityPlan : "",
        subject: this.subject,
        achievementStandard: this.achievementStandard.trim(),
        evaluationElement: this.evaluationElement.trim(),
        evaluationMethod: this.evaluationMethod.trim(),
        observationContext: this.observationContext.trim(),
        observedFact: fact,
        startDate: this.date,
        endDate: this.date
      });
      const unit = this.curriculumUnits.find((entry) => entry.id === this.curriculumUnitId);
      if (unit) Object.assign(evidence, {
        curriculumUnitId: unit.id,
        curriculumUnitTitle: unit.unitName,
        curriculumUnitPath: `[[${unit.file.path.replace(/\.md$/i, "")}]]`
      });
      if (unit?.conceptInquiryEnabled) evidence[this.conceptEvidenceFocus] = fact;
      return [{
        student,
        record: {
          recordType: `학생부 근거 · ${SCHOOL_RECORD_SUBAREAS[this.area][this.subarea] ?? "일괄 관찰"}`,
          date: this.date,
          content: fact,
          schoolRecordEvidence: evidence
        }
      }];
    });
  }

  private applyCurriculumUnit(unit: CurriculumUnit): void {
    this.curriculumUnitId = unit.id;
    if (this.area !== "subject-development") return;
    this.subject = unit.subject;
    this.activityName = unit.unitName;
    this.achievementStandard = unit.achievementStandards;
    this.evaluationElement = unit.evaluationCriteria;
    this.evaluationMethod = unit.evaluationMethods.join(", ");
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    const records = this.buildRecords();
    if (!records.length) {
      new Notice("한 명 이상의 관찰 사실을 입력해 주세요.");
      return;
    }
    const issues = records.flatMap(({ record }) =>
      record.schoolRecordEvidence ? validateSchoolRecordEvidence(record.schoolRecordEvidence) : []
    );
    const unique = [...new Map(issues.map((issue) => [`${issue.severity}:${issue.code}`, issue])).values()];
    this.renderValidation(unique);
    if (unique.some((issue) => issue.severity === "error")) return;
    if (unique.some((issue) => issue.severity === "warning") && !this.warningsConfirmed) {
      this.warningsConfirmed = true;
      this.saveButton?.setButtonText("경고 확인 후 일괄 저장");
      return;
    }
    this.saving = true;
    this.saveButton?.setDisabled(true).setButtonText("저장하는 중…");
    try {
      await this.onSave(records);
      this.close();
    } catch (error) {
      this.saving = false;
      this.saveButton?.setDisabled(false).setButtonText("입력한 학생 저장");
      new Notice(error instanceof Error ? error.message : "일괄 근거를 저장하지 못했습니다.");
    }
  }

  private renderValidation(issues: ReturnType<typeof validateSchoolRecordEvidence>): void {
    if (!this.validationEl) return;
    this.validationEl.empty();
    if (!issues.length) return;
    const list = this.validationEl.createEl("ul");
    issues.forEach((issue) => list.createEl("li", {
      text: issue.message,
      cls: issue.severity === "error" ? "is-error" : "is-warning"
    }));
  }
}

function batchSubareas(area: SchoolRecordArea): Record<string, string> {
  if (area !== "creative-activities") return SCHOOL_RECORD_SUBAREAS[area];
  return Object.fromEntries(
    Object.entries(SCHOOL_RECORD_SUBAREAS[area]).filter(([key]) => key !== "volunteer")
  );
}
