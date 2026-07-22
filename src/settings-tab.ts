import { App, PluginSettingTab, Setting } from "obsidian";
import type ClassManagementPlugin from "./main";
import { defaultSubjectsForGrade } from "@core/school-record-evidence";

export class ClassManagementSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ClassManagementPlugin) {
    super(app, plugin);
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();
    new Setting(containerEl).setName("학급운영").setHeading();

    new Setting(containerEl)
      .setName("학급 이름")
      .setDesc("대시보드와 새 노트의 속성에 표시됩니다.")
      .addText((text) =>
        text
          .setPlaceholder("예: 3학년 2반")
          .setValue(this.plugin.settings.className)
          .onChange(async (value) => {
            this.plugin.settings.className = value.trim() || "우리 반";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("학년도")
      .addText((text) =>
        text.setValue(this.plugin.settings.schoolYear).onChange(async (value) => {
          this.plugin.settings.schoolYear = value.trim() || String(new Date().getFullYear());
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("학기")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ "1학기": "1학기", "2학기": "2학기", "여름방학": "여름방학", "겨울방학": "겨울방학" })
          .setValue(this.plugin.settings.semester)
          .onChange(async (value) => {
            this.plugin.settings.semester = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("학년")
      .setDesc("학교생활기록부 근거 누락 점검과 기본 교과 구성에 사용합니다.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ "1": "1학년", "2": "2학년", "3": "3학년", "4": "4학년", "5": "5학년", "6": "6학년" })
          .setValue(this.plugin.settings.grade)
          .onChange(async (value) => {
            this.plugin.settings.grade = value;
            this.plugin.settings.schoolSubjects = defaultSubjectsForGrade(value);
            await this.plugin.saveSettings();
            this.display();
          })
      );

    new Setting(containerEl)
      .setName("적용 교육과정")
      .addText((text) =>
        text.setValue(this.plugin.settings.curriculum).onChange(async (value) => {
          this.plugin.settings.curriculum = value.trim() || "2022 개정 교육과정";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("학교생활기록부 기재요령 연도")
      .addText((text) =>
        text.setValue(this.plugin.settings.schoolRecordGuidelineYear).onChange(async (value) => {
          this.plugin.settings.schoolRecordGuidelineYear = value.trim() || this.plugin.settings.schoolYear;
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("교과·학교자율시간")
      .setDesc("근거 누락 점검에 사용할 항목을 쉼표 또는 줄바꿈으로 구분합니다.")
      .addTextArea((text) => {
        text.setValue(this.plugin.settings.schoolSubjects.join(", ")).onChange(async (value) => {
          const subjects = value.split(/[,\n]/).map((subject) => subject.trim()).filter(Boolean);
          this.plugin.settings.schoolSubjects = subjects.length
            ? [...new Set(subjects)]
            : defaultSubjectsForGrade(this.plugin.settings.grade);
          await this.plugin.saveSettings();
        });
        text.inputEl.rows = 3;
      });

    new Setting(containerEl)
      .setName("기본 폴더")
      .setDesc("학생, 기록, 출결, 과제 폴더가 생성될 최상위 경로입니다.")
      .addText((text) =>
        text
          .setPlaceholder("학급운영")
          .setValue(this.plugin.settings.baseFolder)
          .onChange(async (value) => {
            this.plugin.settings.baseFolder = value.trim() || "학급운영";
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("학생 폴더")
      .addText((text) =>
        text.setValue(this.plugin.settings.studentsFolder).onChange(async (value) => {
          this.plugin.settings.studentsFolder = value.trim() || "학생";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("기록 폴더")
      .addText((text) =>
        text.setValue(this.plugin.settings.recordsFolder).onChange(async (value) => {
          this.plugin.settings.recordsFolder = value.trim() || "학생 기록";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("출결 폴더")
      .addText((text) =>
        text.setValue(this.plugin.settings.attendanceFolder).onChange(async (value) => {
          this.plugin.settings.attendanceFolder = value.trim() || "출결";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("과제 폴더")
      .addText((text) =>
        text.setValue(this.plugin.settings.assignmentsFolder).onChange(async (value) => {
          this.plugin.settings.assignmentsFolder = value.trim() || "과제";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("할 일 폴더")
      .addText((text) =>
        text.setValue(this.plugin.settings.tasksFolder).onChange(async (value) => {
          this.plugin.settings.tasksFolder = value.trim() || "할 일";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("가정통신문 폴더")
      .addText((text) =>
        text.setValue(this.plugin.settings.noticesFolder).onChange(async (value) => {
          this.plugin.settings.noticesFolder = value.trim() || "가정통신문";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("루틴 폴더")
      .addText((text) =>
        text.setValue(this.plugin.settings.routinesFolder).onChange(async (value) => {
          this.plugin.settings.routinesFolder = value.trim() || "루틴";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("교육과정 폴더")
      .setDesc("통합 단원 설계와 차시별 수업 실행 기록을 저장합니다.")
      .addText((text) =>
        text.setValue(this.plugin.settings.curriculumFolder).onChange(async (value) => {
          this.plugin.settings.curriculumFolder = value.trim() || "교육과정";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("보고서 폴더")
      .setDesc("기본 폴더 안에 Markdown 보고서와 CSV 내보내기를 저장합니다.")
      .addText((text) =>
        text.setValue(this.plugin.settings.reportsFolder).onChange(async (value) => {
          this.plugin.settings.reportsFolder = value.trim() || "보고서";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("내보내기 폴더")
      .addText((text) =>
        text.setValue(this.plugin.settings.exportsFolder).onChange(async (value) => {
          this.plugin.settings.exportsFolder = value.trim() || "내보내기";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl)
      .setName("기록 보관 기간")
      .setDesc("설정한 연수보다 오래된 관리 파일을 데이터 관리 화면에서 검토합니다. 자동 삭제하지 않습니다.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(String(this.plugin.settings.retentionYears)).onChange(async (value) => {
          this.plugin.settings.retentionYears = Math.max(1, Number(value) || 5);
          await this.plugin.saveSettings();
        });
      });

    new Setting(containerEl)
      .setName("백업 폴더")
      .setDesc("현재 학급 기본 폴더 안에 유지관리 백업을 저장합니다.")
      .addText((text) =>
        text.setValue(this.plugin.settings.backupsFolder).onChange(async (value) => {
          this.plugin.settings.backupsFolder = value.trim() || "백업";
          await this.plugin.saveSettings();
        })
      );

    new Setting(containerEl).setName("AI 협업과 개인정보").setHeading();
    new Setting(containerEl)
      .setName("AI 결과 폴더")
      .setDesc("Vault 루트 기준 경로입니다. RAW 기록과 분리해 검토용 초안을 저장합니다.")
      .addText((text) =>
        text.setValue(this.plugin.settings.aiOutputFolder).onChange(async (value) => {
          this.plugin.settings.aiOutputFolder = value.trim() || "AI 결과";
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName("AI 협업 활성화")
      .setDesc("기본값은 꺼짐입니다. AGENTS.md·CLAUDE.md 생성은 ‘AI 협업 설정’ 명령에서 미리보기 후 실행합니다.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiCollaborationEnabled).onChange(async (value) => {
          this.plugin.settings.aiCollaborationEnabled = value;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName("초안에서 학생 이름 익명화")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiAnonymizeStudents).onChange(async (value) => {
          this.plugin.settings.aiAnonymizeStudents = value;
          await this.plugin.saveSettings();
        })
      );

    containerEl.createEl("p", {
      text: "폴더 설정을 바꾼 뒤 ‘학급 공간 초기화’ 명령을 실행하면 새 경로가 만들어집니다.",
      cls: "setting-item-description"
    });
  }
}
