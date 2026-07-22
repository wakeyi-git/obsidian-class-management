import { Modal, Notice, Setting } from "obsidian";
import type ClassManagementPlugin from "./main";
import { defaultSubjectsForGrade } from "@core/school-record-evidence";

export class ClassProfileModal extends Modal {
  private name = "";
  private schoolYear = String(new Date().getFullYear());
  private semester = "1학기";
  private grade = "3";
  private curriculum = "2022 개정 교육과정";
  private guidelineYear = "2026";
  private subjects = defaultSubjectsForGrade("3").join(", ");
  private baseFolder = "";
  private copyRoster = true;

  constructor(private readonly plugin: ClassManagementPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("학급·학기 관리");
    this.modalEl.addClass("class-management-class-modal");
    this.contentEl.createEl("h3", { text: "학급 전환" });
    this.plugin.settings.classProfiles.forEach((profile) => {
      const setting = new Setting(this.contentEl)
        .setName(`${profile.schoolYear} ${profile.semester} · ${profile.grade}학년 · ${profile.name}`)
        .setDesc(`${profile.curriculum} · ${profile.baseFolder}${profile.archived ? " · 읽기 전용 보관" : ""}`);
      if (profile.id === this.plugin.settings.activeClassId) {
        setting.addButton((button) => button.setButtonText("현재 학급").setDisabled(true));
      } else {
        setting.addButton((button) => button.setButtonText("전환").onClick(() =>
          void this.switchTo(profile.id)
        ));
      }
    });

    this.contentEl.createEl("hr");
    this.contentEl.createEl("h3", { text: "새 학급 또는 다음 학기" });
    new Setting(this.contentEl).setName("학급 이름").addText((text) =>
      text.setPlaceholder("예: 3학년 2반").onChange((value) => {
        this.name = value;
        if (!this.baseFolder) this.updateSuggestedFolder();
      })
    );
    new Setting(this.contentEl).setName("학년도").addText((text) =>
      text.setValue(this.schoolYear).onChange((value) => {
        this.schoolYear = value.trim();
        this.updateSuggestedFolder();
      })
    );
    new Setting(this.contentEl).setName("학기").addDropdown((dropdown) =>
      dropdown
        .addOptions({ "1학기": "1학기", "2학기": "2학기", "여름방학": "여름방학", "겨울방학": "겨울방학" })
        .setValue(this.semester)
        .onChange((value) => {
          this.semester = value;
          this.updateSuggestedFolder();
        })
    );
    new Setting(this.contentEl).setName("학년").addDropdown((dropdown) =>
      dropdown
        .addOptions({ "1": "1학년", "2": "2학년", "3": "3학년", "4": "4학년", "5": "5학년", "6": "6학년" })
        .setValue(this.grade)
        .onChange((value) => {
          this.grade = value;
          this.subjects = defaultSubjectsForGrade(value).join(", ");
          this.renderSubjectHint();
          this.updateSuggestedFolder();
        })
    );
    new Setting(this.contentEl).setName("적용 교육과정").addText((text) =>
      text.setValue(this.curriculum).onChange((value) => (this.curriculum = value.trim()))
    );
    new Setting(this.contentEl).setName("학생부 기재요령 연도").addText((text) =>
      text.setValue(this.guidelineYear).onChange((value) => (this.guidelineYear = value.trim()))
    );
    const subjects = new Setting(this.contentEl)
      .setName("교과·학교자율시간")
      .setDesc("누락 점검에 사용할 항목을 쉼표로 구분합니다.")
      .addTextArea((text) => {
        text.setValue(this.subjects).onChange((value) => (this.subjects = value));
        text.inputEl.addClass("class-management-class-subjects");
      });
    subjects.settingEl.addClass("class-management-subject-setting");
    new Setting(this.contentEl)
      .setName("기본 폴더")
      .setDesc("다른 학급과 겹치지 않는 Vault 경로를 사용하세요.")
      .addText((text) => {
        text.setPlaceholder("예: 학급운영/2026-1학기-3학년2반").onChange((value) => {
          this.baseFolder = value.trim();
        });
        text.inputEl.addEventListener("focus", () => {
          if (!text.getValue()) {
            this.updateSuggestedFolder();
            text.setValue(this.baseFolder);
          }
        });
      });
    new Setting(this.contentEl)
      .setName("현재 활성 학생 명단 복사")
      .setDesc("진급·새 학기 시작 시 번호와 이름만 새 학급 폴더에 복사합니다.")
      .addToggle((toggle) => toggle.setValue(this.copyRoster).onChange((value) => {
        this.copyRoster = value;
      }));
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("새 학급 만들고 전환").setCta().onClick(() => void this.create())
    );
  }

  private updateSuggestedFolder(): void {
    if (!this.name.trim()) return;
    const segment = `${this.schoolYear}-${this.semester}-${this.grade}학년-${this.name}`
      .replace(/[\\/:*?"<>|#^[\]]/g, "-")
      .replace(/\s+/g, "");
    this.baseFolder = `학급운영/${segment}`;
  }

  private async switchTo(id: string): Promise<void> {
    try {
      await this.plugin.switchClassProfile(id);
      new Notice(`${this.plugin.settings.className}으로 전환했습니다.`);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "학급을 전환하지 못했습니다.");
    }
  }

  private async create(): Promise<void> {
    if (!this.name.trim() || !this.schoolYear || !this.baseFolder) {
      new Notice("학급 이름, 학년도, 기본 폴더를 모두 입력해 주세요.");
      return;
    }
    if (this.plugin.settings.classProfiles.some((profile) => profile.baseFolder === this.baseFolder)) {
      new Notice("이미 다른 학급이 사용하는 기본 폴더입니다.");
      return;
    }
    const students = this.copyRoster ? this.plugin.repository.getStudents() : [];
    try {
      await this.plugin.createClassProfile({
        name: this.name.trim(),
        schoolYear: this.schoolYear,
        semester: this.semester,
        schoolLevel: "elementary",
        grade: this.grade,
        curriculum: this.curriculum || "2022 개정 교육과정",
        schoolRecordGuidelineYear: this.guidelineYear || this.schoolYear,
        schoolSubjects: parseSubjects(this.subjects, this.grade),
        baseFolder: this.baseFolder
      }, students);
      new Notice(`${this.name.trim()} 학급을 만들었습니다.`);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "학급을 만들지 못했습니다.");
    }
  }

  private renderSubjectHint(): void {
    const input = this.contentEl.querySelector<HTMLTextAreaElement>(".class-management-class-subjects");
    if (input) input.value = this.subjects;
  }
}

function parseSubjects(value: string, grade: string): string[] {
  const parsed = value.split(/[,\n]/).map((subject) => subject.trim()).filter(Boolean);
  return parsed.length ? [...new Set(parsed)] : defaultSubjectsForGrade(grade);
}
