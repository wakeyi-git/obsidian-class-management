import { App, ButtonComponent, Modal, Notice, Setting, SuggestModal, TFile } from "obsidian";
import { addOption } from "./dom";
import { NOTICE_STATUSES } from "@core/notice";
import type {
  NoticeMark,
  NoticeSheet,
  NoticeStatus,
  NoticeSummary,
  StudentEntry
} from "@core/types";
import { localDate } from "@core/utils";

type NoticeChoice = { kind: "new" } | { kind: "existing"; summary: NoticeSummary };

export class NoticePickerModal extends SuggestModal<NoticeChoice> {
  constructor(
    app: App,
    private readonly notices: NoticeSummary[],
    private readonly onChooseNotice: (choice: NoticeChoice) => void
  ) {
    super(app);
    this.setPlaceholder("새 가정통신문을 만들거나 기존 회신표를 검색하세요");
  }

  getSuggestions(query: string): NoticeChoice[] {
    const normalized = query.trim().toLocaleLowerCase("ko");
    return [
      { kind: "new" },
      ...this.notices
        .filter((notice) => `${notice.sentDate} ${notice.dueDate} ${notice.title}`
          .toLocaleLowerCase("ko").includes(normalized))
        .map((summary): NoticeChoice => ({ kind: "existing", summary }))
    ];
  }

  renderSuggestion(choice: NoticeChoice, element: HTMLElement): void {
    if (choice.kind === "new") {
      element.createEl("strong", { text: "+ 새 가정통신문 회신표" });
      return;
    }
    element.createEl("div", { text: choice.summary.title });
    element.createEl("small", {
      text: `발송 ${choice.summary.sentDate} · 마감 ${choice.summary.dueDate || "없음"}`
    });
  }

  onChooseSuggestion(choice: NoticeChoice): void {
    this.onChooseNotice(choice);
  }
}

export class NoticeModal extends Modal {
  private title = "";
  private sentDate = localDate();
  private dueDate = "";
  private readonly statuses = new Map<string, NoticeStatus>();
  private readonly responseDates = new Map<string, string>();
  private readonly notes = new Map<string, string>();
  private rosterEl?: HTMLElement;
  private summaryEl?: HTMLElement;
  private saveButton?: ButtonComponent;
  private saving = false;
  private exceptionsOnly = false;

  constructor(
    app: App,
    private readonly students: StudentEntry[],
    private readonly existing: NoticeSheet | undefined,
    private readonly onSave: (
      sentDate: string,
      dueDate: string,
      title: string,
      marks: NoticeMark[],
      existingFile?: TFile
    ) => Promise<void>,
    initialDate = localDate()
  ) {
    super(app);
    this.sentDate = initialDate;
    if (existing) {
      this.title = existing.title;
      this.sentDate = existing.sentDate;
      this.dueDate = existing.dueDate;
      existing.marks.forEach((mark) => {
        this.statuses.set(mark.studentNumber, mark.status);
        if (mark.responseDate) this.responseDates.set(mark.studentNumber, mark.responseDate);
        if (mark.note) this.notes.set(mark.studentNumber, mark.note);
      });
    }
    students.forEach((student) => {
      if (!this.statuses.has(student.number)) this.statuses.set(student.number, "미회신");
    });
  }

  onOpen(): void {
    this.setTitle(this.existing ? "가정통신문 회신표 수정" : "새 가정통신문 회신표");
    this.modalEl.addClass("class-management-notice-modal");
    if (this.existing) {
      this.contentEl.createEl("h3", { text: this.title });
      this.contentEl.createEl("p", { text: `발송 ${this.sentDate} · 마감 ${this.dueDate || "없음"}` });
    } else {
      new Setting(this.contentEl).setName("제목").addText((text) => {
        text.setPlaceholder("예: 현장체험학습 참가 동의서").onChange((value) => {
          this.title = value;
        });
        window.setTimeout(() => text.inputEl.focus(), 0);
      });
      new Setting(this.contentEl).setName("발송일").addText((text) => {
        text.inputEl.type = "date";
        text.setValue(this.sentDate).onChange((value) => (this.sentDate = value));
      });
      new Setting(this.contentEl).setName("회신 마감일").addText((text) => {
        text.inputEl.type = "date";
        text.setValue(this.dueDate).onChange((value) => (this.dueDate = value));
      });
    }

    const toolbar = this.contentEl.createDiv({ cls: "class-management-notice-toolbar" });
    this.summaryEl = toolbar.createDiv();
    const all = toolbar.createEl("button", { text: "모두 회신 완료" });
    all.addEventListener("click", () => {
      const today = localDate();
      this.students.forEach((student) => {
        this.statuses.set(student.number, "회신 완료");
        this.responseDates.set(student.number, today);
      });
      this.renderRoster();
    });
    const exceptions = toolbar.createEl("button", { text: "미회신·확인 필요만" });
    exceptions.addEventListener("click", () => {
      this.exceptionsOnly = !this.exceptionsOnly;
      exceptions.setText(this.exceptionsOnly ? "전체 학생 보기" : "미회신·확인 필요만");
      this.renderRoster();
    });

    this.rosterEl = this.contentEl.createDiv({ cls: "class-management-notice-roster" });
    this.renderRoster();
    new Setting(this.contentEl).addButton((button) => {
      this.saveButton = button;
      button.setButtonText("회신표 저장").setCta().onClick(() => void this.save());
    });
  }

  private renderRoster(): void {
    if (!this.rosterEl) return;
    this.rosterEl.empty();
    const table = this.rosterEl.createEl("table");
    const header = table.createEl("thead").createEl("tr");
    ["번호", "이름", "상태", "회신일", "메모"].forEach((text) =>
      header.createEl("th", { text })
    );
    const body = table.createEl("tbody");
    this.students
      .filter((student) =>
        !this.exceptionsOnly || (this.statuses.get(student.number) ?? "미회신") !== "회신 완료"
      )
      .forEach((student) => {
      const row = body.createEl("tr");
      row.createEl("td", { text: student.number });
      row.createEl("td", { text: student.name });
      const select = row.createEl("td").createEl("select", {
        attr: { "aria-label": `${student.number}번 ${student.name} 회신 상태` }
      });
      NOTICE_STATUSES.forEach((status) => addOption(select, status, status));
      select.value = this.statuses.get(student.number) ?? "미회신";
      select.dataset.status = select.value;
      select.addEventListener("change", () => {
        const status = select.value as NoticeStatus;
        this.statuses.set(student.number, status);
        select.dataset.status = status;
        if (status === "회신 완료" && !this.responseDates.get(student.number)) {
          this.responseDates.set(student.number, localDate());
          this.renderRoster();
          return;
        }
        this.renderSummary();
      });
      const response = row.createEl("td").createEl("input");
      response.type = "date";
      response.setAttr("aria-label", `${student.number}번 ${student.name} 회신일`);
      response.value = this.responseDates.get(student.number) ?? "";
      response.addEventListener("change", () => this.responseDates.set(student.number, response.value));
      const note = row.createEl("td").createEl("input", {
        attr: {
          placeholder: "선택 메모",
          "aria-label": `${student.number}번 ${student.name} 회신 메모`
        }
      });
      note.value = this.notes.get(student.number) ?? "";
      note.addEventListener("input", () => this.notes.set(student.number, note.value));
      });
    this.renderSummary();
  }

  private renderSummary(): void {
    if (!this.summaryEl) return;
    const counts = new Map<NoticeStatus, number>(NOTICE_STATUSES.map((status) => [status, 0]));
    this.statuses.forEach((status) => counts.set(status, (counts.get(status) ?? 0) + 1));
    this.summaryEl.setText(
      `회신 ${counts.get("회신 완료") ?? 0}/${this.students.length}명 · 미회신 ${counts.get("미회신") ?? 0}명 · 확인 필요 ${counts.get("확인 필요") ?? 0}명`
    );
  }

  private async save(): Promise<void> {
    if (this.saving) return;
    if (!this.title.trim()) {
      new Notice("가정통신문 제목을 입력해 주세요.");
      return;
    }
    this.saving = true;
    this.saveButton?.setDisabled(true).setButtonText("저장하는 중…");
    const marks = this.students.map((student): NoticeMark => ({
      studentNumber: student.number,
      studentName: student.name,
      status: this.statuses.get(student.number) ?? "미회신",
      responseDate: this.responseDates.get(student.number) ?? "",
      note: this.notes.get(student.number)?.trim() ?? ""
    }));
    try {
      await this.onSave(this.sentDate, this.dueDate, this.title.trim(), marks, this.existing?.file);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "회신표를 저장하지 못했습니다.");
      this.saving = false;
      this.saveButton?.setDisabled(false).setButtonText("다시 저장");
    }
  }
}

