import { Modal, Notice, Setting, TFile } from "obsidian";
import type ClassManagementPlugin from "./main";

export class RetentionModal extends Modal {
  private readonly selected = new Set<string>();
  private confirmed = false;

  constructor(
    private readonly plugin: ClassManagementPlugin,
    private readonly files: TFile[],
    private readonly cutoff: Date,
    private readonly onComplete: () => void
  ) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("보관 기간 지난 기록 검토");
    this.modalEl.addClass("class-management-retention-modal");
    this.contentEl.createEl("p", {
      text: `${formatDate(this.cutoff)} 이전에 수정된 관리 파일 ${this.files.length}개입니다. 선택한 파일만 Obsidian 휴지통으로 이동합니다.`
    });
    this.contentEl.createEl("p", {
      text: "학교·기관의 기록 보존 정책과 백업 상태를 먼저 확인하세요. 학생 노트는 이 목록에 포함하지 않습니다.",
      cls: "setting-item-description"
    });
    const toolbar = this.contentEl.createDiv({ cls: "class-management-retention-toolbar" });
    const all = toolbar.createEl("button", { text: "전체 선택" });
    all.addEventListener("click", () => {
      this.files.forEach((file) => this.selected.add(file.path));
      this.renderFiles(list);
    });
    const clear = toolbar.createEl("button", { text: "선택 해제" });
    clear.addEventListener("click", () => {
      this.selected.clear();
      this.renderFiles(list);
    });
    const list = this.contentEl.createDiv({ cls: "class-management-retention-list" });
    this.renderFiles(list);
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("선택 파일 휴지통 이동").setWarning().onClick(() => {
        if (this.selected.size === 0) {
          new Notice("휴지통으로 이동할 파일을 선택해 주세요.");
          return;
        }
        if (!this.confirmed) {
          this.confirmed = true;
          button.setButtonText(`정말 ${this.selected.size}개 휴지통 이동`);
          new Notice("한 번 더 누르면 선택 파일을 휴지통으로 이동합니다.");
          return;
        }
        void this.trashSelected();
      })
    );
  }

  private renderFiles(container: HTMLElement): void {
    container.empty();
    this.files.forEach((file) => {
      const label = container.createEl("label");
      const checkbox = label.createEl("input");
      checkbox.type = "checkbox";
      checkbox.checked = this.selected.has(file.path);
      checkbox.addEventListener("change", () => {
        if (checkbox.checked) this.selected.add(file.path);
        else this.selected.delete(file.path);
        this.confirmed = false;
      });
      label.createEl("span", { text: file.path });
      label.createEl("small", { text: new Date(file.stat.mtime).toLocaleDateString("ko-KR") });
    });
  }

  private async trashSelected(): Promise<void> {
    const moved = await this.plugin.repository.trashFilesByPath(this.selected);
    new Notice(`${moved}개 파일을 Obsidian 휴지통으로 이동했습니다.`);
    this.close();
    this.onComplete();
  }
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
