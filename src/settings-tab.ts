import { App, PluginSettingTab, Setting } from "obsidian";
import type ClassManagementPlugin from "./main";
import { defaultSubjectsForGrade } from "@core/school-record-evidence";

type StringSettingKey =
  | "className" | "schoolYear" | "curriculum" | "schoolRecordGuidelineYear"
  | "baseFolder" | "studentsFolder" | "recordsFolder" | "attendanceFolder"
  | "assignmentsFolder" | "tasksFolder" | "noticesFolder" | "routinesFolder"
  | "curriculumFolder" | "reportsFolder" | "exportsFolder" | "backupsFolder"
  | "aiOutputFolder";

export class ClassManagementSettingTab extends PluginSettingTab {
  constructor(app: App, private readonly plugin: ClassManagementPlugin) {
    super(app, plugin);
  }

  /** 문자열 설정 한 줄 — 비우면 기본값으로 되돌린다. */
  private textSetting(
    containerEl: HTMLElement,
    name: string,
    desc: string,
    key: StringSettingKey,
    fallback: string
  ): void {
    const setting = new Setting(containerEl).setName(name);
    if (desc) setting.setDesc(desc);
    setting.addText((text) =>
      text
        .setPlaceholder(fallback)
        .setValue(this.plugin.settings[key])
        .onChange(async (value) => {
          this.plugin.settings[key] = value.trim() || fallback;
          await this.plugin.saveSettings();
        })
    );
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    // ── 학급 정보 ──
    new Setting(containerEl).setName("학급 정보").setHeading();
    containerEl.createEl("p", {
      text: "여러 학급·학년도를 관리하려면 ‘학급·학기 추가 및 전환’ 명령을 사용하세요. 아래 값은 현재 학급에 적용됩니다.",
      cls: "setting-item-description"
    });

    this.textSetting(containerEl, "학급 이름", "대시보드와 새 노트의 속성에 표시됩니다.", "className", "우리 반");
    this.textSetting(containerEl, "학년도", "노트 속성과 진도표·기준 시수 파일 이름에 쓰입니다.", "schoolYear", String(new Date().getFullYear()));

    new Setting(containerEl)
      .setName("학기")
      .setDesc("시수·진도·간트·주간 시간표의 기준 학기입니다. 방학 중에는 준비 중인 학기를 선택하세요 — 학기 경계를 지나면 전환을 알림으로 제안합니다.")
      .addDropdown((dropdown) =>
        dropdown
          .addOptions({ "1학기": "1학기", "2학기": "2학기" })
          .setValue(this.plugin.settings.semester)
          .onChange(async (value) => {
            this.plugin.settings.semester = value;
            await this.plugin.saveSettings();
          })
      );

    new Setting(containerEl)
      .setName("학년")
      .setDesc("기본 교과 구성과 학생부 근거 누락 점검에 사용합니다. 바꾸면 교과 목록이 학년 기본값으로 재설정됩니다.")
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

    this.textSetting(containerEl, "적용 교육과정", "단원 노트에 표기됩니다.", "curriculum", "2022 개정 교육과정");
    this.textSetting(
      containerEl,
      "학생부 기재요령 연도",
      "학생부 근거 커버리지 화면에 표시됩니다.",
      "schoolRecordGuidelineYear",
      this.plugin.settings.schoolYear
    );

    new Setting(containerEl)
      .setName("교과·학교자율시간")
      .setDesc("진도표·시간표·단원의 과목 목록과 근거 누락 점검에 씁니다. 쉼표 또는 줄바꿈으로 구분하고, 학교자율시간 과목(예: 디지털 놀이터)도 여기에 더합니다.")
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

    // ── 폴더 ──
    new Setting(containerEl).setName("폴더").setHeading();
    containerEl.createEl("p", {
      text: "폴더 이름을 바꾼 뒤 ‘학급 공간 초기화’ 명령을 실행하면 새 경로가 만들어집니다. 기존 노트는 옮겨지지 않으니 파일 탐색기에서 함께 이동하세요.",
      cls: "setting-item-description"
    });

    this.textSetting(containerEl, "기본 폴더", "모든 학급 관리 폴더가 이 안에 만들어집니다.", "baseFolder", "학급운영");
    this.textSetting(containerEl, "학생 폴더", "명렬표(학생 노트)를 담습니다.", "studentsFolder", "학생");
    this.textSetting(containerEl, "학생 기록 폴더", "관찰·상담·칭찬과 학생부 근거 기록을 담습니다.", "recordsFolder", "학생 기록");
    this.textSetting(containerEl, "출결 폴더", "날짜별 출결부를 담습니다.", "attendanceFolder", "출결");
    this.textSetting(containerEl, "과제 폴더", "과제 확인표와 평가 정보를 담습니다.", "assignmentsFolder", "과제");
    this.textSetting(containerEl, "할 일 폴더", "GTD 할 일 노트를 담습니다.", "tasksFolder", "할 일");
    this.textSetting(containerEl, "가정통신문 폴더", "회신 확인표를 담습니다.", "noticesFolder", "가정통신문");
    this.textSetting(containerEl, "루틴 폴더", "루틴 템플릿과 날짜별 체크리스트(수업일에만 생성)를 담습니다.", "routinesFolder", "루틴");
    this.textSetting(
      containerEl,
      "교육과정 폴더",
      "하위에 학사일정·시간표·진도표·주간학습안내·단원·수업일지·행사·성취기준·모아보기가 고정 이름으로 만들어집니다.",
      "curriculumFolder",
      "교육과정"
    );
    this.textSetting(containerEl, "보고서 폴더", "Markdown 보고서를 저장합니다.", "reportsFolder", "보고서");
    this.textSetting(containerEl, "내보내기 폴더", "CSV 내보내기를 저장합니다.", "exportsFolder", "내보내기");
    this.textSetting(containerEl, "백업 폴더", "수동 백업과 대량 변경 전 자동 스냅숏(‘… 자동’)을 저장합니다.", "backupsFolder", "백업");

    // ── 데이터 보관 ──
    new Setting(containerEl).setName("데이터 보관").setHeading();
    new Setting(containerEl)
      .setName("기록 보관 기간")
      .setDesc("설정한 연수보다 오래된 관리 파일을 백업·유지관리 화면의 보존 정리에서 검토합니다. 자동 삭제하지 않습니다.")
      .addText((text) => {
        text.inputEl.type = "number";
        text.inputEl.min = "1";
        text.setValue(String(this.plugin.settings.retentionYears)).onChange(async (value) => {
          this.plugin.settings.retentionYears = Math.max(1, Number(value) || 5);
          await this.plugin.saveSettings();
        });
      });

    // ── AI 협업과 개인정보 ──
    new Setting(containerEl).setName("AI 협업과 개인정보").setHeading();
    this.textSetting(
      containerEl,
      "AI 결과 폴더",
      "볼트 루트 기준 경로입니다. RAW 기록과 분리해 검토용 초안만 저장합니다.",
      "aiOutputFolder",
      "AI 결과"
    );
    new Setting(containerEl)
      .setName("AI 협업 활성화")
      .setDesc("기본값은 꺼짐입니다. 보고서 화면의 초안 생성 버튼이 활성화되며, AGENTS.md·CLAUDE.md 생성은 ‘AI 협업 설정’ 명령에서 미리보기 후 실행합니다.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiCollaborationEnabled).onChange(async (value) => {
          this.plugin.settings.aiCollaborationEnabled = value;
          await this.plugin.saveSettings();
        })
      );
    new Setting(containerEl)
      .setName("초안에서 학생 이름 익명화")
      .setDesc("내보내기·초안에서 이름을 번호 별칭으로 바꿉니다. 끄더라도 외부 전송 전 익명화를 권장합니다.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.aiAnonymizeStudents).onChange(async (value) => {
          this.plugin.settings.aiAnonymizeStudents = value;
          await this.plugin.saveSettings();
        })
      );
  }
}
