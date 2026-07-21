import { App, ButtonComponent, Modal, Notice, Setting, SuggestModal } from "obsidian";
import { decodeCsv, parseRosterCsv, type RosterCsvResult } from "./csv";
import type {
  NewRecord,
  NewStudent,
  RosterImportSummary,
  StudentEntry
} from "./types";
import { localDate } from "./utils";

export class StudentModal extends Modal {
  private name = "";
  private number = "";
  private batchText = "";
  private batchResult?: RosterCsvResult;
  private batchInput?: HTMLTextAreaElement;
  private batchPreviewEl?: HTMLElement;
  private batchButton?: ButtonComponent;

  constructor(
    app: App,
    private readonly onSubmit: (student: NewStudent) => Promise<void>,
    private readonly onBatchSubmit: (
      students: NewStudent[]
    ) => Promise<RosterImportSummary>
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle("학생 추가");
    this.modalEl.addClass("class-management-student-modal-container");
    this.contentEl.addClass("class-management-student-modal");
    this.contentEl.createEl("h3", { text: "학생 한 명 추가" });

    new Setting(this.contentEl)
      .setName("번호")
      .setDesc("학급 명렬표의 번호를 입력하세요.")
      .addText((text) => {
        text.setPlaceholder("예: 1");
        text.inputEl.inputMode = "numeric";
        text.onChange((value) => (this.number = value));
        window.setTimeout(() => text.inputEl.focus(), 0);
      });

    new Setting(this.contentEl)
      .setName("이름")
      .addText((text) =>
        text.setPlaceholder("예: 김하늘").onChange((value) => (this.name = value))
      );

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("학생 노트 만들기")
        .setCta()
        .onClick(() => void this.submit())
    );

    this.contentEl.createEl("hr");
    this.contentEl.createEl("h3", { text: "학생 명렬표 일괄 입력" });
    this.contentEl.createEl("p", {
      text: "번호와 이름을 쉼표나 탭으로 구분해 한 줄에 한 명씩 입력하세요.",
      cls: "setting-item-description"
    });

    this.batchInput = this.contentEl.createEl("textarea", {
      cls: "class-management-batch-input",
      attr: {
        rows: "8",
        placeholder: "번호,이름\n1,김하늘\n2,이바다"
      }
    });
    this.batchInput.addEventListener("input", () => {
      this.batchText = this.batchInput?.value ?? "";
      this.renderBatchPreview();
    });

    this.batchPreviewEl = this.contentEl.createDiv({
      cls: "class-management-batch-preview"
    });
    this.renderBatchPreview();

    const fileInput = this.contentEl.createEl("input");
    fileInput.type = "file";
    fileInput.accept = ".csv,text/csv,text/tab-separated-values";
    fileInput.hidden = true;
    fileInput.addEventListener("change", () => {
      const file = fileInput.files?.[0];
      if (file) void this.loadCsvFile(file);
    });

    new Setting(this.contentEl)
      .addButton((button) =>
        button.setButtonText("CSV 가져오기").onClick(() => {
          fileInput.value = "";
          fileInput.click();
        })
      )
      .addButton((button) => {
        this.batchButton = button;
        button
          .setButtonText("명렬표 일괄 추가")
          .setCta()
          .setDisabled(true)
          .onClick(() => void this.submitBatch());
      });
  }

  private async submit(): Promise<void> {
    if (!this.number.trim() || !this.name.trim()) {
      new Notice("번호와 이름을 모두 입력해 주세요.");
      return;
    }

    try {
      await this.onSubmit({ number: this.number.trim(), name: this.name.trim() });
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "학생을 추가하지 못했습니다.");
    }
  }

  private async loadCsvFile(file: File): Promise<void> {
    try {
      const text = decodeCsv(await file.arrayBuffer());
      this.batchText = text;
      if (this.batchInput) this.batchInput.value = text;
      this.renderBatchPreview();
      new Notice(`${file.name}을 명렬표 입력창에 불러왔습니다.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "CSV를 읽지 못했습니다.";
      this.renderBatchError(message);
    }
  }

  private renderBatchPreview(): void {
    if (!this.batchPreviewEl) return;
    this.batchPreviewEl.empty();
    this.batchResult = undefined;
    this.batchButton?.setDisabled(true);

    if (!this.batchText.trim()) {
      this.batchPreviewEl.createEl("p", {
        text: "직접 붙여넣거나 아래 CSV 가져오기를 이용할 수 있습니다.",
        cls: "setting-item-description"
      });
      return;
    }

    try {
      this.batchResult = parseRosterCsv(this.batchText);
      const students = this.batchResult.students;
      this.batchPreviewEl.createEl("strong", {
        text: `추가할 학생 ${students.length}명`
      });
      this.batchPreviewEl.createEl("p", {
        text: students
          .slice(0, 5)
          .map((student) => `${student.number}번 ${student.name}`)
          .join(" · ")
      });

      if (students.length > 5) {
        this.batchPreviewEl.createEl("p", {
          text: `그 외 ${students.length - 5}명`,
          cls: "setting-item-description"
        });
      }

      if (this.batchResult.issues.length > 0) {
        const issueList = this.batchPreviewEl.createEl("ul", {
          cls: "class-management-batch-issues"
        });
        this.batchResult.issues.slice(0, 4).forEach((issue) =>
          issueList.createEl("li", { text: `${issue.row}행: ${issue.message}` })
        );
      }

      this.batchButton?.setDisabled(false);
    } catch (error) {
      this.renderBatchError(
        error instanceof Error ? error.message : "명렬표 형식을 확인해 주세요."
      );
    }
  }

  private renderBatchError(message: string): void {
    if (!this.batchPreviewEl) return;
    this.batchResult = undefined;
    this.batchButton?.setDisabled(true);
    this.batchPreviewEl.empty();
    this.batchPreviewEl.createEl("p", {
      text: message,
      cls: "class-management-csv-error"
    });
  }

  private async submitBatch(): Promise<void> {
    if (!this.batchResult) return;
    this.batchButton?.setDisabled(true).setButtonText("추가하는 중…");

    try {
      const result = await this.onBatchSubmit(this.batchResult.students);
      const invalidCount = this.batchResult.issues.length;
      new Notice(
        `학생 ${result.created.length}명 추가 · 중복 ${result.skipped.length}명 · 실패 ${result.failed.length}명${invalidCount > 0 ? ` · 입력 오류 ${invalidCount}행` : ""}`
      );
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "명렬표를 추가하지 못했습니다.");
      this.batchButton?.setDisabled(false).setButtonText("명렬표 일괄 추가");
    }
  }
}

export class StudentSuggestModal extends SuggestModal<StudentEntry> {
  constructor(
    app: App,
    private readonly students: StudentEntry[],
    private readonly onChooseStudent: (student: StudentEntry) => void,
    placeholder = "기록할 학생을 검색하세요"
  ) {
    super(app);
    this.setPlaceholder(placeholder);
  }

  getSuggestions(query: string): StudentEntry[] {
    const normalized = query.trim().toLocaleLowerCase("ko");
    return this.students.filter((student) =>
      `${student.number} ${student.name}`.toLocaleLowerCase("ko").includes(normalized)
    );
  }

  renderSuggestion(student: StudentEntry, element: HTMLElement): void {
    element.createEl("div", {
      text: `${student.number}번 ${student.name}`,
      cls: "class-management-suggestion"
    });
  }

  onChooseSuggestion(student: StudentEntry): void {
    this.onChooseStudent(student);
  }
}

export class RecordModal extends Modal {
  private recordType = "관찰";
  private date = localDate();
  private content = "";

  constructor(
    app: App,
    private readonly student: StudentEntry,
    private readonly onSubmit: (record: NewRecord) => Promise<void>,
    initialDate = localDate()
  ) {
    super(app);
    this.date = initialDate;
  }

  onOpen(): void {
    this.setTitle(`${this.student.number}번 ${this.student.name} 기록`);

    new Setting(this.contentEl)
      .setName("분류")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({
            관찰: "관찰",
            상담: "상담",
            칭찬: "칭찬",
            생활지도: "생활지도",
            "보호자 연락": "보호자 연락",
            기타: "기타"
          })
          .setValue(this.recordType)
          .onChange((value) => (this.recordType = value))
      );

    new Setting(this.contentEl).setName("기록일").addText((text) => {
      text.inputEl.type = "date";
      text.setValue(this.date).onChange((value) => (this.date = value));
    });

    new Setting(this.contentEl)
      .setName("내용")
      .setDesc("확인한 사실을 중심으로 간결하게 작성하세요.")
      .addTextArea((area) => {
        area.setPlaceholder("예: 모둠 활동에서 친구의 의견을 정리해 발표를 도왔다.");
        area.inputEl.rows = 7;
        area.inputEl.addClass("class-management-record-input");
        area.onChange((value) => (this.content = value));
        window.setTimeout(() => area.inputEl.focus(), 0);
      });

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText("기록 저장")
        .setCta()
        .onClick(() => void this.submit())
    );
  }

  private async submit(): Promise<void> {
    if (!this.date || !this.content.trim()) {
      new Notice("기록일과 내용을 입력해 주세요.");
      return;
    }

    try {
      await this.onSubmit({
        recordType: this.recordType,
        date: this.date,
        content: this.content.trim()
      });
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "기록을 저장하지 못했습니다.");
    }
  }
}
