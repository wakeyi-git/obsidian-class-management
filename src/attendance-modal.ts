import { App, ButtonComponent, Modal, Notice, Setting } from "obsidian";
import { ATTENDANCE_STATUSES } from "@core/attendance";
import type { AttendanceMark, AttendanceStatus, StudentEntry } from "@core/types";
import { localDate } from "@core/utils";

export class AttendanceModal extends Modal {
  private date = localDate();
  private readonly statuses = new Map<string, AttendanceStatus>();
  private readonly reasons = new Map<string, string>();
  private rosterEl?: HTMLElement;
  private summaryEl?: HTMLElement;
  private saveButton?: ButtonComponent;
  private loading = false;
  private loadRequest = 0;

  constructor(
    app: App,
    private readonly students: StudentEntry[],
    private readonly onLoad: (date: string) => Promise<AttendanceMark[]>,
    private readonly onSave: (date: string, marks: AttendanceMark[]) => Promise<void>,
    initialDate = localDate()
  ) {
    super(app);
    this.date = initialDate;
  }

  onOpen(): void {
    this.setTitle("출결 체크");

    new Setting(this.contentEl)
      .setName("날짜")
      .setDesc("저장된 날짜를 선택하면 기존 출결을 불러옵니다.")
      .addText((text) => {
        text.inputEl.type = "date";
        text.setValue(this.date).onChange((value) => {
          if (!value || value === this.date) return;
          this.date = value;
          void this.loadDate();
        });
      });

    const toolbar = this.contentEl.createDiv({ cls: "class-management-attendance-toolbar" });
    this.summaryEl = toolbar.createDiv();
    const allPresent = toolbar.createEl("button", { text: "모두 출석" });
    allPresent.addEventListener("click", () => {
      this.students.forEach((student) => this.statuses.set(student.number, "출석"));
      this.reasons.clear();
      this.renderRoster();
    });

    this.rosterEl = this.contentEl.createDiv({ cls: "class-management-attendance-roster" });

    new Setting(this.contentEl).addButton((button) => {
      this.saveButton = button;
      button
        .setButtonText("출결 저장")
        .setCta()
        .setDisabled(true)
        .onClick(() => void this.save());
    });

    void this.loadDate();
  }

  private async loadDate(): Promise<void> {
    const request = ++this.loadRequest;
    this.loading = true;
    this.saveButton?.setDisabled(true);
    this.rosterEl?.empty();
    this.rosterEl?.createEl("p", { text: "출결을 불러오고 있습니다…" });

    try {
      const saved = await this.onLoad(this.date);
      if (request !== this.loadRequest) return;
      const savedByNumber = new Map(saved.map((mark) => [mark.studentNumber, mark]));
      this.statuses.clear();
      this.reasons.clear();
      this.students.forEach((student) => {
        const mark = savedByNumber.get(student.number);
        this.statuses.set(student.number, mark?.status ?? "출석");
        if (mark?.status !== "출석" && mark?.reason) {
          this.reasons.set(student.number, mark.reason);
        }
      });
      this.renderRoster();
      this.saveButton?.setDisabled(false);
    } catch (error) {
      if (request !== this.loadRequest) return;
      const message = error instanceof Error ? error.message : "출결을 불러오지 못했습니다.";
      this.rosterEl?.empty();
      this.rosterEl?.createEl("p", {
        text: message,
        cls: "class-management-csv-error"
      });
    } finally {
      if (request === this.loadRequest) this.loading = false;
    }
  }

  private renderRoster(): void {
    if (!this.rosterEl) return;
    this.rosterEl.empty();

    const table = this.rosterEl.createEl("table");
    const header = table.createEl("thead").createEl("tr");
    header.createEl("th", { text: "번호" });
    header.createEl("th", { text: "이름" });
    header.createEl("th", { text: "상태" });
    header.createEl("th", { text: "사유" });
    const body = table.createEl("tbody");

    this.students.forEach((student) => {
      const row = body.createEl("tr");
      row.createEl("td", { text: student.number });
      row.createEl("td", { text: student.name });
      const control = row.createEl("td");
      const select = control.createEl("select", {
        attr: { "aria-label": `${student.number}번 ${student.name} 출결 상태` }
      });
      ATTENDANCE_STATUSES.forEach((status) => {
        const option = select.createEl("option", { text: status });
        option.value = status;
      });
      select.value = this.statuses.get(student.number) ?? "출석";
      this.styleStatusSelect(select);

      const reasonCell = row.createEl("td");
      const reasonInput = reasonCell.createEl("input", {
        cls: "class-management-attendance-reason",
        attr: {
          placeholder: "사유 입력",
          "aria-label": `${student.number}번 ${student.name} 출결 사유`
        }
      });
      reasonInput.type = "text";
      reasonInput.value = this.reasons.get(student.number) ?? "";
      reasonInput.disabled = select.value === "출석";
      reasonInput.addEventListener("input", () => {
        this.reasons.set(student.number, reasonInput.value);
      });

      select.addEventListener("change", () => {
        const status = select.value as AttendanceStatus;
        this.statuses.set(student.number, status);
        this.styleStatusSelect(select);
        reasonInput.disabled = status === "출석";
        if (status === "출석") {
          reasonInput.value = "";
          this.reasons.delete(student.number);
        } else {
          reasonInput.focus();
        }
        this.renderSummary();
      });
    });

    this.renderSummary();
  }

  private renderSummary(): void {
    if (!this.summaryEl) return;
    const counts = new Map<AttendanceStatus, number>(
      ATTENDANCE_STATUSES.map((status) => [status, 0])
    );
    this.statuses.forEach((status) => counts.set(status, (counts.get(status) ?? 0) + 1));
    const exceptions = ATTENDANCE_STATUSES.slice(1)
      .filter((status) => (counts.get(status) ?? 0) > 0)
      .map((status) => `${status} ${counts.get(status)}명`)
      .join(" · ");
    this.summaryEl.setText(
      `출석 ${counts.get("출석") ?? 0}/${this.students.length}명${exceptions ? ` · ${exceptions}` : ""}`
    );
  }

  private styleStatusSelect(select: HTMLSelectElement): void {
    select.dataset.status = select.value;
    select.addClass("class-management-attendance-status");
  }

  private async save(): Promise<void> {
    if (this.loading) return;
    this.loading = true;
    this.saveButton?.setDisabled(true).setButtonText("저장하는 중…");

    const marks: AttendanceMark[] = this.students.map((student) => {
      const status = this.statuses.get(student.number) ?? "출석";
      const reason = status === "출석"
        ? ""
        : (this.reasons.get(student.number) ?? "").trim();
      return reason
        ? {
            studentNumber: student.number,
            studentName: student.name,
            status,
            reason
          }
        : {
            studentNumber: student.number,
            studentName: student.name,
            status
          };
    });

    try {
      await this.onSave(this.date, marks);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "출결을 저장하지 못했습니다.");
      this.saveButton?.setDisabled(false).setButtonText("다시 저장");
      this.loading = false;
    }
  }
}
