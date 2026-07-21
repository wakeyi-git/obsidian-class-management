import { Modal, Notice, Setting } from "obsidian";
import { aiSetupPaths, setupAiWorkspace } from "./ai-collaboration";
import type ClassManagementPlugin from "./main";

export class AiSetupModal extends Modal {
  private enabled: boolean;
  private anonymize: boolean;
  private excluded: string;

  constructor(private readonly plugin: ClassManagementPlugin) {
    super(plugin.app);
    this.enabled = plugin.settings.aiCollaborationEnabled;
    this.anonymize = plugin.settings.aiAnonymizeStudents;
    this.excluded = plugin.settings.aiExcludedFolders.join("\n");
  }

  onOpen(): void {
    this.setTitle("AI 협업 설정");
    this.modalEl.addClass("class-management-ai-setup-modal");
    this.contentEl.createEl("p", {
      text: "Codex·Claude가 읽을 지침과 별도 결과 폴더를 만듭니다. API를 호출하거나 계정 키를 저장하지 않습니다."
    });
    const warning = this.contentEl.createEl("blockquote");
    warning.setText("학생 자료를 외부 AI 서비스에 제공하기 전에 학교·기관의 개인정보 처리 및 생성형 AI 정책을 확인하세요.");

    new Setting(this.contentEl)
      .setName("AI 협업 활성화")
      .setDesc("활성화해야 학생별 검토용 초안 생성 버튼을 사용할 수 있습니다.")
      .addToggle((toggle) => toggle.setValue(this.enabled).onChange((value) => {
        this.enabled = value;
      }));
    new Setting(this.contentEl)
      .setName("학생 이름 익명화")
      .setDesc("새 초안의 표시 이름을 학생-S01 형식으로 만듭니다. 원본 위키링크 경로에는 이름이 남을 수 있습니다.")
      .addToggle((toggle) => toggle.setValue(this.anonymize).onChange((value) => {
        this.anonymize = value;
      }));
    new Setting(this.contentEl)
      .setName("제외 폴더")
      .setDesc("한 줄에 하나씩 입력합니다. 생성되는 지침 파일에 읽지 말아야 할 경로로 기록됩니다.")
      .addTextArea((text) => {
        text.setValue(this.excluded).onChange((value) => (this.excluded = value));
        text.inputEl.rows = 5;
      });

    this.contentEl.createEl("h3", { text: "Dry-run: 생성 대상" });
    const preview = this.contentEl.createEl("ul", { cls: "class-management-ai-paths" });
    aiSetupPaths(this.plugin.settings).forEach((path) => preview.createEl("li", { text: path }));
    this.contentEl.createEl("p", {
      text: "같은 이름의 파일이 이미 있으면 덮어쓰지 않고 건너뜁니다.",
      cls: "setting-item-description"
    });

    new Setting(this.contentEl)
      .addButton((button) => button.setButtonText("취소").onClick(() => this.close()))
      .addButton((button) =>
        button.setButtonText("설정 저장 및 파일 생성").setCta().onClick(() => void this.create())
      );
  }

  private async create(): Promise<void> {
    this.plugin.settings.aiCollaborationEnabled = this.enabled;
    this.plugin.settings.aiAnonymizeStudents = this.anonymize;
    this.plugin.settings.aiExcludedFolders = this.excluded
      .split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    await this.plugin.saveSettings();
    try {
      const result = await setupAiWorkspace(this.app, this.plugin.settings);
      new Notice(`AI 협업 준비 완료 · 생성 ${result.created.length}개 · 기존 유지 ${result.skipped.length}개`);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "AI 협업 파일을 만들지 못했습니다.");
    }
  }
}
