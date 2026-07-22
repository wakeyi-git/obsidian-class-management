import { App, ButtonComponent, Modal, Notice, Setting, SuggestModal, TFile } from "obsidian";
import { ASSIGNMENT_STATUSES } from "@core/assignment";
import type {
  AssignmentMark,
  AssignmentSheet,
  AssignmentStatus,
  AssignmentSummary,
  CurriculumUnit,
  CurriculumUnitLink,
  StudentEntry
} from "@core/types";
import { localDate } from "@core/utils";

type AssignmentChoice =
  | { kind: "new" }
  | { kind: "existing"; summary: AssignmentSummary };

export class AssignmentPickerModal extends SuggestModal<AssignmentChoice> {
  constructor(
    app: App,
    private readonly assignments: AssignmentSummary[],
    private readonly onChooseAssignment: (choice: AssignmentChoice) => void
  ) {
    super(app);
    this.setPlaceholder("새 과제를 만들거나 기존 과제를 검색하세요");
  }

  getSuggestions(query: string): AssignmentChoice[] {
    const normalized = query.trim().toLocaleLowerCase("ko");
    const existing = this.assignments
      .filter((assignment) =>
        `${assignment.date} ${assignment.title}`
          .toLocaleLowerCase("ko")
          .includes(normalized)
      )
      .map((summary): AssignmentChoice => ({ kind: "existing", summary }));
    return [{ kind: "new" }, ...existing];
  }

  renderSuggestion(choice: AssignmentChoice, element: HTMLElement): void {
    if (choice.kind === "new") {
      element.createEl("strong", { text: "+ 새 과제 체크" });
      return;
    }

    element.createEl("div", { text: choice.summary.title });
    element.createEl("small", { text: choice.summary.date });
  }

  onChooseSuggestion(choice: AssignmentChoice): void {
    this.onChooseAssignment(choice);
  }
}

export class AssignmentModal extends Modal {
  private date = localDate();
  private assignmentTitle = "";
  private unitId = "";
  private readonly statuses = new Map<string, AssignmentStatus>();
  private readonly notes = new Map<string, string>();
  private rosterEl?: HTMLElement;
  private summaryEl?: HTMLElement;
  private saveButton?: ButtonComponent;
  private saving = false;

  constructor(
    app: App,
    private readonly students: StudentEntry[],
    private readonly existing: AssignmentSheet | undefined,
    private readonly units: CurriculumUnit[],
    private readonly onSave: (
      date: string,
      title: string,
      marks: AssignmentMark[],
      unitLink: CurriculumUnitLink | null,
      existingFile?: TFile
    ) => Promise<void>,
    initialDate = localDate()
  ) {
    super(app);

    this.date = initialDate;
    this.unitId = existing?.unitId ?? "";

    if (existing) {
      this.date = existing.date;
      this.assignmentTitle = existing.title;
      existing.marks.forEach((mark) => {
        this.statuses.set(mark.studentNumber, mark.status);
        if (mark.note) this.notes.set(mark.studentNumber, mark.note);
      });
    }
    students.forEach((student) => {
      if (!this.statuses.has(student.number)) this.statuses.set(student.number, "제출");
    });
  }

  onOpen(): void {
    this.setTitle(this.existing ? "과제 체크 수정" : "새 과제 체크");
    this.modalEl.addClass("class-management-assignment-modal-container");

    if (this.existing) {
      const heading = this.contentEl.createDiv({ cls: "class-management-assignment-heading" });
      heading.createEl("strong", { text: this.assignmentTitle });
      heading.createEl("span", { text: this.date });
    } else {
      new Setting(this.contentEl).setName("날짜").addText((text) => {
        text.inputEl.type = "date";
        text.setValue(this.date).onChange((value) => {
          if (value) this.date = value;
        });
      });

      new Setting(this.contentEl).setName("과제명").addText((text) => {
        text.setPlaceholder("예: 수학 익힘 32~33쪽").onChange((value) => {
          this.assignmentTitle = value;
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });
    }

    if (this.units.length > 0) {
      new Setting(this.contentEl)
        .setName("연계 단원 (평가)")
        .setDesc("이 과제를 통합 단원의 평가 증거로 연결합니다.")
        .addDropdown((dropdown) => {
          dropdown.addOption("", "연결 없음");
          for (const unit of this.units) {
            dropdown.addOption(unit.id, `${unit.subject} · ${unit.unitName}`);
          }
          if (this.unitId && this.units.some((unit) => unit.id === this.unitId)) {
            dropdown.setValue(this.unitId);
          }
          dropdown.onChange((value) => (this.unitId = value));
        });
    }

    const toolbar = this.contentEl.createDiv({ cls: "class-management-assignment-toolbar" });
    this.summaryEl = toolbar.createDiv();
    const allSubmitted = toolbar.createEl("button", { text: "모두 제출" });
    allSubmitted.addEventListener("click", () => {
      this.students.forEach((student) => this.statuses.set(student.number, "제출"));
      this.notes.clear();
      this.renderRoster();
    });

    this.rosterEl = this.contentEl.createDiv({ cls: "class-management-assignment-roster" });
    this.renderRoster();

    new Setting(this.contentEl).addButton((button) => {
      this.saveButton = button;
      button
        .setButtonText("과제 체크 저장")
        .setCta()
        .onClick(() => void this.save());
    });
  }

  private renderRoster(): void {
    if (!this.rosterEl) return;
    this.rosterEl.empty();

    const table = this.rosterEl.createEl("table");
    const header = table.createEl("thead").createEl("tr");
    header.createEl("th", { text: "번호" });
    header.createEl("th", { text: "이름" });
    header.createEl("th", { text: "상태" });
    header.createEl("th", { text: "메모" });
    const body = table.createEl("tbody");

    this.students.forEach((student) => {
      const row = body.createEl("tr");
      row.createEl("td", { text: student.number });
      row.createEl("td", { text: student.name });

      const statusCell = row.createEl("td");
      const select = statusCell.createEl("select", {
        cls: "class-management-assignment-status",
        attr: { "aria-label": `${student.number}번 ${student.name} 과제 상태` }
      });
      ASSIGNMENT_STATUSES.forEach((status) => {
        const option = select.createEl("option", { text: status });
        option.value = status;
      });
      select.value = this.statuses.get(student.number) ?? "제출";
      this.styleStatusSelect(select);
      select.addEventListener("change", () => {
        this.statuses.set(student.number, select.value as AssignmentStatus);
        this.styleStatusSelect(select);
        this.renderSummary();
      });

      const noteCell = row.createEl("td");
      const noteInput = noteCell.createEl("input", {
        cls: "class-management-assignment-note",
        attr: {
          placeholder: "선택 메모",
          "aria-label": `${student.number}번 ${student.name} 과제 메모`
        }
      });
      noteInput.type = "text";
      noteInput.value = this.notes.get(student.number) ?? "";
      noteInput.addEventListener("input", () => {
        this.notes.set(student.number, noteInput.value);
      });
    });

    this.renderSummary();
  }

  private renderSummary(): void {
    if (!this.summaryEl) return;
    const counts = new Map<AssignmentStatus, number>(
      ASSIGNMENT_STATUSES.map((status) => [status, 0])
    );
    this.statuses.forEach((status) => counts.set(status, (counts.get(status) ?? 0) + 1));
    this.summaryEl.setText(
      `제출 ${counts.get("제출") ?? 0}/${this.students.length}명 · 미제출 ${counts.get("미제출") ?? 0}명 · 보완 ${counts.get("보완") ?? 0}명`
    );
  }

  private styleStatusSelect(select: HTMLSelectElement): void {
    select.dataset.status = select.value;
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    if (!this.assignmentTitle.trim()) {
      new Notice("과제명을 입력해 주세요.");
      return;
    }

    this.saving = true;
    this.saveButton?.setDisabled(true).setButtonText("저장하는 중…");
    const marks: AssignmentMark[] = this.students.map((student) => {
      const note = (this.notes.get(student.number) ?? "").trim();
      const mark: AssignmentMark = {
        studentNumber: student.number,
        studentName: student.name,
        status: this.statuses.get(student.number) ?? "제출"
      };
      if (note) mark.note = note;
      return mark;
    });

    try {
      const unit = this.units.find((item) => item.id === this.unitId);
      await this.onSave(
        this.date,
        this.assignmentTitle.trim(),
        marks,
        unit ? { id: unit.id, title: unit.unitName, path: unit.file.path } : null,
        this.existing?.file
      );
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "과제 체크를 저장하지 못했습니다.");
      this.saveButton?.setDisabled(false).setButtonText("다시 저장");
      this.saving = false;
    }
  }
}
