import { App, Modal, Notice, Setting } from "obsidian";
import type { NewTask, StudentEntry, TaskStatus } from "@core/types";

export class TaskModal extends Modal {
  private title = "";
  private status: TaskStatus = "inbox";
  private project = "";
  private context = "";
  private startDate = "";
  private dueDate = "";
  private priority: NewTask["priority"] = "normal";
  private recurrence: NewTask["recurrence"] = "none";
  private studentNumber = "";
  private detail = "";
  private saving = false;

  constructor(
    app: App,
    private readonly students: StudentEntry[],
    private readonly onSave: (task: NewTask) => Promise<void>,
    initialDueDate = ""
  ) {
    super(app);
    this.dueDate = initialDueDate;
  }

  onOpen(): void {
    this.setTitle("할 일 빠른 수집");
    this.modalEl.addClass("class-management-task-modal");

    new Setting(this.contentEl).setName("제목").addText((text) => {
      text.setPlaceholder("예: 보호자 상담 일정 잡기").onChange((value) => {
        this.title = value;
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });

    new Setting(this.contentEl).setName("GTD 상태").addDropdown((dropdown) =>
      dropdown
        .addOptions({
          inbox: "수집함",
          next: "다음 행동",
          waiting: "대기",
          someday: "언젠가",
          done: "완료"
        })
        .setValue(this.status)
        .onChange((value) => (this.status = value as TaskStatus))
    );

    new Setting(this.contentEl).setName("프로젝트").addText((text) =>
      text.setPlaceholder("예: 학부모 상담주간").onChange((value) => {
        this.project = value;
      })
    );
    new Setting(this.contentEl).setName("컨텍스트").addText((text) =>
      text.setPlaceholder("예: @학교, @전화").onChange((value) => {
        this.context = value;
      })
    );

    new Setting(this.contentEl).setName("시작일").addText((text) => {
      text.inputEl.type = "date";
      text.setValue(this.startDate).onChange((value) => (this.startDate = value));
    });
    new Setting(this.contentEl).setName("마감일").addText((text) => {
      text.inputEl.type = "date";
      text.setValue(this.dueDate).onChange((value) => (this.dueDate = value));
    });

    new Setting(this.contentEl).setName("우선순위").addDropdown((dropdown) =>
      dropdown
        .addOptions({ "": "없음", low: "낮음", normal: "보통", high: "높음" })
        .setValue(this.priority)
        .onChange((value) => (this.priority = value as NewTask["priority"]))
    );

    new Setting(this.contentEl).setName("반복").addDropdown((dropdown) =>
      dropdown
        .addOptions({ none: "반복 없음", daily: "매일", weekly: "매주", monthly: "매월" })
        .setValue(this.recurrence)
        .onChange((value) => (this.recurrence = value as NewTask["recurrence"]))
    );

    new Setting(this.contentEl).setName("연결 학생").addDropdown((dropdown) => {
      dropdown.addOption("", "연결하지 않음");
      this.students.forEach((student) => {
        dropdown.addOption(student.number, `${student.number}번 ${student.name}`);
      });
      dropdown.onChange((value) => (this.studentNumber = value));
    });

    new Setting(this.contentEl).setName("메모").addTextArea((text) => {
      text.setPlaceholder("완료 조건이나 참고 내용을 적으세요.").onChange((value) => {
        this.detail = value;
      });
      text.inputEl.rows = 4;
    });

    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("할 일 저장").setCta().onClick(() => void this.submit())
    );
  }

  private async submit(): Promise<void> {
    if (this.saving) return;
    if (!this.title.trim()) {
      new Notice("할 일 제목을 입력해 주세요.");
      return;
    }
    this.saving = true;
    const student = this.students.find((entry) => entry.number === this.studentNumber);
    try {
      await this.onSave({
        title: this.title.trim(),
        status: this.status,
        project: this.project.trim(),
        context: this.context.trim(),
        startDate: this.startDate,
        dueDate: this.dueDate,
        priority: this.priority,
        recurrence: this.recurrence,
        studentNumber: student?.number ?? "",
        studentName: student?.name ?? "",
        detail: this.detail.trim()
      });
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "할 일을 저장하지 못했습니다.");
      this.saving = false;
    }
  }
}
