import { App, FuzzySuggestModal, PluginSettingTab } from "obsidian";
import type { SettingDefinitionItem } from "obsidian";
import type ClassManagementPlugin from "./main";
import { defaultSubjectsForGrade } from "@core/school-record-evidence";
import { NAVIGATOR_VIEW_TYPE, NavigatorView, QUICK_ACTIONS, type QuickAction } from "./navigator-view";

/** 폴더·파일 이름에 쓸 수 없는 문자 검증 (하위 폴더명 텍스트 입력용). */
function invalidFolderName(value: string): string | void {
  if (!value.trim()) return; // 비우면 저장 시 기본값으로 대체된다
  if (/[\\:*?"<>|]/.test(value)) return '폴더 이름에는 \\ : * ? " < > | 를 쓸 수 없습니다.';
  if (value !== value.trim()) return "폴더 이름의 앞뒤 공백을 지워 주세요.";
}

/**
 * 설정 탭 — Obsidian 1.13 선언형 정의(getSettingDefinitions)를 사용한다.
 * 값 저장은 setControlValue가 담당하며(자동 저장), 빈 문자열은 기본값으로 되돌린다.
 */
export class ClassManagementSettingTab extends PluginSettingTab {
  /** 문자열 설정의 기본값 — 빈 입력을 이 값으로 복원한다. */
  private readonly fallbacks: Record<string, string> = {
    className: "우리 반",
    schoolYear: String(new Date().getFullYear()),
    curriculum: "2022 개정 교육과정",
    schoolRecordGuidelineYear: "",
    baseFolder: "학급운영",
    studentsFolder: "학생",
    recordsFolder: "학생 기록",
    attendanceFolder: "출결",
    assignmentsFolder: "과제",
    tasksFolder: "할 일",
    noticesFolder: "가정통신문",
    routinesFolder: "루틴",
    curriculumFolder: "교육과정",
    reportsFolder: "보고서",
    exportsFolder: "내보내기",
    backupsFolder: "백업",
    aiOutputFolder: "AI 결과"
  };

  constructor(app: App, private readonly plugin: ClassManagementPlugin) {
    super(app, plugin);
  }

  getControlValue(key: string): unknown {
    if (key === "schoolSubjects") return this.plugin.settings.schoolSubjects.join(", ");
    return (this.plugin.settings as unknown as Record<string, unknown>)[key];
  }

  async setControlValue(key: string, value: unknown): Promise<void> {
    const settings = this.plugin.settings as unknown as Record<string, unknown>;
    if (key === "schoolSubjects") {
      const subjects = String(value ?? "")
        .split(/[,\n]/)
        .map((subject) => subject.trim())
        .filter(Boolean);
      this.plugin.settings.schoolSubjects = subjects.length
        ? [...new Set(subjects)]
        : defaultSubjectsForGrade(this.plugin.settings.grade);
    } else if (key === "grade") {
      this.plugin.settings.grade = String(value);
      // 학년이 바뀌면 교과 목록을 학년 기본값으로 재설정한다.
      this.plugin.settings.schoolSubjects = defaultSubjectsForGrade(this.plugin.settings.grade);
    } else if (key === "retentionYears") {
      this.plugin.settings.retentionYears = Math.max(1, Number(value) || 5);
    } else if (typeof value === "string" && key in this.fallbacks) {
      settings[key] = value.trim() || this.fallbacks[key] || this.plugin.settings.schoolYear;
    } else {
      settings[key] = value;
    }
    await this.plugin.saveSettings();
    if (key === "grade") this.update(); // 교과 목록 컨트롤에 재설정 값을 반영
  }

  private async saveFavorites(ids: string[]): Promise<void> {
    this.plugin.settings.favoriteActionIds = ids;
    await this.plugin.saveSettings();
    this.app.workspace
      .getLeavesOfType(NAVIGATOR_VIEW_TYPE)
      .forEach((leaf) => leaf.view instanceof NavigatorView && leaf.view.refreshFavorites());
    this.update();
  }

  getSettingDefinitions(): SettingDefinitionItem[] {
    return [
      // ── 일반(첫 구역은 제목 없이 — Obsidian 설정 지침) ──
      {
        name: "학급·학기 추가 및 전환",
        desc: "여러 학급·학년도를 관리합니다. 아래 값은 현재 학급에 적용됩니다.",
        action: () => this.plugin.openClassProfileModal()
      },
      {
        name: "학급 이름",
        desc: "대시보드와 새 노트의 속성에 표시됩니다.",
        control: { type: "text", key: "className", placeholder: "우리 반" }
      },
      {
        name: "학년도",
        desc: "노트 속성과 진도표·기준 시수 파일 이름에 쓰입니다.",
        control: {
          type: "text",
          key: "schoolYear",
          placeholder: String(new Date().getFullYear()),
          validate: (value: string) =>
            value.trim() && !/^\d{4}$/.test(value.trim()) ? "네 자리 연도로 입력해 주세요." : undefined
        }
      },
      {
        name: "학기",
        desc: "시수·진도·로드맵·주간 시간표의 기준 학기입니다. 방학 중에는 준비 중인 학기를 선택하세요.",
        control: { type: "dropdown", key: "semester", options: { "1학기": "1학기", "2학기": "2학기" } }
      },
      {
        name: "학년",
        desc: "기본 교과 구성과 학생부 근거 누락 점검에 사용합니다. 바꾸면 교과 목록이 학년 기본값으로 재설정됩니다.",
        control: {
          type: "dropdown",
          key: "grade",
          options: { "1": "1학년", "2": "2학년", "3": "3학년", "4": "4학년", "5": "5학년", "6": "6학년" }
        }
      },
      {
        name: "적용 교육과정",
        desc: "단원 노트에 표기됩니다.",
        control: { type: "text", key: "curriculum", placeholder: "2022 개정 교육과정" }
      },
      {
        name: "학생부 기재요령 연도",
        desc: "학생부 근거 커버리지 화면에 표시됩니다.",
        control: { type: "text", key: "schoolRecordGuidelineYear", placeholder: "학년도와 같게" }
      },
      {
        name: "교과·학교자율시간",
        desc: "진도표·시간표·단원의 과목 목록과 근거 누락 점검에 씁니다. 쉼표 또는 줄바꿈으로 구분합니다.",
        control: { type: "textarea", key: "schoolSubjects" }
      },

      // ── 폴더 ──
      {
        type: "group",
        heading: "폴더",
        items: [
          {
            name: "기본 폴더",
            desc: "모든 학급 관리 폴더의 최상위 경로입니다. 바꾼 뒤 ‘학급 공간 초기화’를 실행하면 새 경로가 만들어지며, 기존 노트는 직접 옮겨야 합니다.",
            control: { type: "folder", key: "baseFolder", placeholder: "학급운영" }
          },
          {
            name: "학생 폴더",
            desc: "명렬표(학생 노트)를 담습니다.",
            control: { type: "text", key: "studentsFolder", placeholder: "학생", validate: invalidFolderName }
          },
          {
            name: "학생 기록 폴더",
            desc: "관찰·상담·칭찬과 학생부 근거 기록을 담습니다.",
            control: { type: "text", key: "recordsFolder", placeholder: "학생 기록", validate: invalidFolderName }
          },
          {
            name: "출결 폴더",
            desc: "날짜별 출결부를 담습니다.",
            control: { type: "text", key: "attendanceFolder", placeholder: "출결", validate: invalidFolderName }
          },
          {
            name: "과제 폴더",
            desc: "과제 확인표와 평가 정보를 담습니다.",
            control: { type: "text", key: "assignmentsFolder", placeholder: "과제", validate: invalidFolderName }
          },
          {
            name: "할 일 폴더",
            desc: "GTD 할 일 노트를 담습니다.",
            control: { type: "text", key: "tasksFolder", placeholder: "할 일", validate: invalidFolderName }
          },
          {
            name: "가정통신문 폴더",
            desc: "회신 확인표를 담습니다.",
            control: { type: "text", key: "noticesFolder", placeholder: "가정통신문", validate: invalidFolderName }
          },
          {
            name: "루틴 폴더",
            desc: "루틴 템플릿과 날짜별 체크리스트(수업일에만 생성)를 담습니다.",
            control: { type: "text", key: "routinesFolder", placeholder: "루틴", validate: invalidFolderName }
          },
          {
            name: "교육과정 폴더",
            desc: "하위에 학사일정·시간표·진도표·주간학습안내·단원·수업일지·행사·성취기준·모아보기가 고정 이름으로 만들어집니다.",
            control: { type: "text", key: "curriculumFolder", placeholder: "교육과정", validate: invalidFolderName }
          },
          {
            name: "보고서 폴더",
            desc: "Markdown 보고서를 저장합니다.",
            control: { type: "text", key: "reportsFolder", placeholder: "보고서", validate: invalidFolderName }
          },
          {
            name: "내보내기 폴더",
            desc: "CSV 내보내기를 저장합니다.",
            control: { type: "text", key: "exportsFolder", placeholder: "내보내기", validate: invalidFolderName }
          },
          {
            name: "백업 폴더",
            desc: "수동 백업과 대량 변경 전 자동 스냅숏(‘… 자동’)을 저장합니다.",
            control: { type: "text", key: "backupsFolder", placeholder: "백업", validate: invalidFolderName }
          }
        ]
      },

      // ── 자주 쓰는 명령 (학급 메뉴 하단 목록 — 추가·삭제·드래그 정렬) ──
      {
        type: "list",
        heading: "자주 쓰는 명령",
        emptyState: "학급 메뉴에 표시할 명령이 없습니다. +로 추가하세요.",
        addItem: {
          name: "명령 추가",
          action: () => {
            const chosen = new Set(this.plugin.settings.favoriteActionIds);
            const candidates = QUICK_ACTIONS.filter((action) => !chosen.has(action.id));
            new QuickActionPickerModal(this.app, candidates, (action) => {
              void this.saveFavorites([...this.plugin.settings.favoriteActionIds, action.id]);
            }).open();
          }
        },
        onReorder: (oldIndex, newIndex) => {
          const ids = [...this.plugin.settings.favoriteActionIds];
          const [moved] = ids.splice(oldIndex, 1);
          if (moved === undefined) return;
          ids.splice(newIndex, 0, moved);
          void this.saveFavorites(ids);
        },
        onDelete: (index) => {
          const ids = [...this.plugin.settings.favoriteActionIds];
          ids.splice(index, 1);
          void this.saveFavorites(ids);
        },
        items: this.plugin.settings.favoriteActionIds
          .map((id) => QUICK_ACTIONS.find((action) => action.id === id))
          .filter((action): action is QuickAction => action !== undefined)
          .map((action) => ({ name: action.label, searchable: false }))
      },

      // ── 데이터 보관 ──
      {
        type: "group",
        heading: "데이터 보관",
        items: [
          {
            name: "할 일 자동 수집 (로드 시)",
            desc: "플러그인이 켜질 때 규칙 기반으로 마감 임박 과제·행사·미회신·시수 이상 등을 GTD 수집함에 담습니다. 같은 항목은 다시 만들지 않습니다. ‘할 일 자동 수집’ 명령으로 수동 실행할 수도 있습니다.",
            control: { type: "toggle", key: "autoTaskScan", defaultValue: false }
          },
          {
            name: "기록 보관 기간",
            desc: "설정한 연수보다 오래된 관리 파일을 보존 정리에서 검토합니다. 자동 삭제하지 않습니다.",
            control: {
              type: "number",
              key: "retentionYears",
              defaultValue: 5,
              validate: (value: number) => (value < 1 ? "1년 이상으로 입력해 주세요." : undefined)
            }
          }
        ]
      },

      // ── AI 협업과 개인정보 ──
      {
        type: "group",
        heading: "AI 협업과 개인정보",
        items: [
          {
            name: "AI 결과 폴더",
            desc: "볼트 루트 기준 경로입니다. RAW 기록과 분리해 검토용 초안만 저장합니다.",
            control: { type: "folder", key: "aiOutputFolder", placeholder: "AI 결과" }
          },
          {
            name: "AI 협업 활성화",
            desc: "보고서 화면의 초안 생성 버튼이 활성화됩니다. AGENTS.md 생성은 ‘AI 협업 설정’ 명령에서 미리보기 후 실행합니다.",
            control: { type: "toggle", key: "aiCollaborationEnabled", defaultValue: false }
          },
          {
            name: "초안에서 학생 이름 익명화",
            desc: "내보내기·초안에서 이름을 번호 별칭으로 바꿉니다. 외부 전송 전 익명화를 권장합니다.",
            control: { type: "toggle", key: "aiAnonymizeStudents", defaultValue: true }
          }
        ]
      }
    ];
  }
}


class QuickActionPickerModal extends FuzzySuggestModal<QuickAction> {
  constructor(
    app: App,
    private readonly candidates: QuickAction[],
    private readonly onPick: (action: QuickAction) => void
  ) {
    super(app);
    this.setPlaceholder("추가할 명령 검색");
  }

  getItems(): QuickAction[] {
    return this.candidates;
  }

  getItemText(action: QuickAction): string {
    return action.label;
  }

  onChooseItem(action: QuickAction): void {
    this.onPick(action);
  }
}
