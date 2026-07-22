import { Modal, Notice, Setting } from "obsidian";
import type ClassManagementPlugin from "./main";
import type { StudentEntry, StudentStatus } from "@core/types";

export class StudentEditModal extends Modal {
  private name: string;
  private number: string;
  private status: StudentStatus;

  constructor(
    private readonly plugin: ClassManagementPlugin,
    private readonly student: StudentEntry,
    private readonly onSaved: () => void
  ) {
    super(plugin.app);
    this.name = student.name;
    this.number = student.number;
    this.status = student.status;
  }

  onOpen(): void {
    this.setTitle("학생 정보·재적 상태 변경");
    this.contentEl.createEl("p", {
      text: "번호나 이름을 바꾸면 학생 노트를 안전하게 이름 변경하며 Obsidian 링크 업데이트 설정을 따릅니다."
    });
    new Setting(this.contentEl).setName("번호").addText((text) =>
      text.setValue(this.number).onChange((value) => (this.number = value))
    );
    new Setting(this.contentEl).setName("이름").addText((text) =>
      text.setValue(this.name).onChange((value) => (this.name = value))
    );
    new Setting(this.contentEl).setName("상태").addDropdown((dropdown) =>
      dropdown
        .addOptions({ active: "재적", transferred: "전출", graduated: "졸업·진급" })
        .setValue(this.status)
        .onChange((value) => (this.status = value as StudentStatus))
    );
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("변경 저장").setCta().onClick(() => void this.save())
    );
  }

  private async save(): Promise<void> {
    try {
      await this.plugin.repository.updateStudent(this.student, {
        name: this.name,
        number: this.number,
        status: this.status
      });
      this.plugin.activityIndex.invalidate();
      await this.plugin.refreshAllViews();
      new Notice("학생 정보와 상태를 변경했습니다.");
      this.close();
      this.onSaved();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "학생 정보를 변경하지 못했습니다.");
    }
  }
}
