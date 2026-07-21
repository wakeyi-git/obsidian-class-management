import { ItemView, WorkspaceLeaf } from "obsidian";
import { DASHBOARD_VIEW_TYPE } from "./dashboard-view";
import { CURRICULUM_OPS_VIEW_TYPE } from "./curriculum-ops-view";
import { CALENDAR_VIEW_TYPE } from "./calendar-view";
import { ACTIVITY_LIST_VIEW_TYPE } from "./activity-list-view";
import { STUDENT_TIMELINE_VIEW_TYPE } from "./student-timeline-view";
import { TASK_VIEW_TYPE } from "./task-view";
import { ROUTINE_VIEW_TYPE } from "./routine-view";
import { CURRICULUM_VIEW_TYPE } from "./curriculum-view";
import { REPORT_VIEW_TYPE } from "./report-view";
import { DATA_MANAGEMENT_VIEW_TYPE } from "./data-management-view";
import { MAINTENANCE_VIEW_TYPE } from "./maintenance-view";
import type ClassManagementPlugin from "./main";

export const NAVIGATOR_VIEW_TYPE = "class-management-navigator";

interface NavAction {
  label: string;
  run: () => void;
}

export class NavigatorView extends ItemView {
  /** 마지막으로 활성화됐던 학급 뷰 — 내비게이터 클릭으로 포커스가 바뀌어도 유지한다. */
  private contextViewType = DASHBOARD_VIEW_TYPE;

  constructor(leaf: WorkspaceLeaf, private readonly plugin: ClassManagementPlugin) {
    super(leaf);
  }

  getViewType(): string {
    return NAVIGATOR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "학급 메뉴";
  }

  getIcon(): string {
    return "compass";
  }

  async onOpen(): Promise<void> {
    this.registerEvent(
      this.app.workspace.on("active-leaf-change", (leaf) => {
        const type = leaf?.view.getViewType() ?? "";
        if (this.viewEntries().some((entry) => entry.type === type)) {
          if (this.contextViewType !== type) {
            this.contextViewType = type;
            this.render();
          }
        }
      })
    );
    this.render();
  }

  private viewEntries(): Array<{ type: string; label: string; open: () => void }> {
    const plugin = this.plugin;
    return [
      { type: DASHBOARD_VIEW_TYPE, label: "학급 대시보드", open: () => void plugin.openDashboard() },
      { type: CURRICULUM_OPS_VIEW_TYPE, label: "교육과정 운영", open: () => void plugin.openCurriculumOps() },
      { type: CALENDAR_VIEW_TYPE, label: "학급 캘린더", open: () => void plugin.openCalendar() },
      { type: ACTIVITY_LIST_VIEW_TYPE, label: "통합 목록", open: () => void plugin.openActivityList() },
      { type: STUDENT_TIMELINE_VIEW_TYPE, label: "학생별 타임라인", open: () => plugin.openStudentTimelineFlow() },
      { type: TASK_VIEW_TYPE, label: "GTD 할 일", open: () => void plugin.openTasks() },
      { type: ROUTINE_VIEW_TYPE, label: "루틴 체크리스트", open: () => void plugin.openRoutines() },
      { type: CURRICULUM_VIEW_TYPE, label: "교육과정 일체화", open: () => void plugin.openCurriculum() },
      { type: REPORT_VIEW_TYPE, label: "분석·보고서", open: () => void plugin.openReports() },
      { type: DATA_MANAGEMENT_VIEW_TYPE, label: "학급·데이터", open: () => void plugin.openDataManagement() },
      { type: MAINTENANCE_VIEW_TYPE, label: "백업·유지관리", open: () => void plugin.openMaintenance() }
    ];
  }

  /** 뷰별 작업 목록 — 하루 작업 순서와 사용 빈도 순으로 배열한다. */
  private contextActions(): NavAction[] {
    const plugin = this.plugin;
    const map: Record<string, NavAction[]> = {
      [DASHBOARD_VIEW_TYPE]: [
        { label: "출결 체크", run: () => plugin.openAttendanceModal() },
        { label: "학생 빠른 기록", run: () => plugin.openRecordFlow() },
        { label: "과제 체크", run: () => plugin.openAssignmentFlow() },
        { label: "할 일 빠른 수집", run: () => plugin.openTaskModal() },
        { label: "가정통신문 회신", run: () => plugin.openNoticeFlow() },
        { label: "학생부 근거 기록", run: () => plugin.openSchoolRecordEvidenceFlow() },
        { label: "학생부 학급 일괄", run: () => plugin.openSchoolRecordBatch() },
        { label: "학생 추가·명렬표", run: () => plugin.openStudentModal() }
      ],
      [CURRICULUM_OPS_VIEW_TYPE]: [
        { label: "주간학습안내 생성", run: () => void plugin.generateWeeklyPlan() },
        { label: "진도 자동 배정", run: () => void plugin.runProgressAssignment() },
        { label: "진도표 차시 가져오기", run: () => plugin.openProgressImportModal() },
        { label: "학사일정 노트", run: () => void plugin.openAcademicCalendarNote() },
        { label: "기준 시수 노트", run: () => void plugin.openHoursStandardNote() },
        { label: "기초시간표 노트", run: () => void plugin.openBaseTimetableNote() }
      ],
      [CALENDAR_VIEW_TYPE]: [
        { label: "학생 빠른 기록", run: () => plugin.openRecordFlow() },
        { label: "출결 체크", run: () => plugin.openAttendanceModal() },
        { label: "과제 체크", run: () => plugin.openAssignmentFlow() },
        { label: "할 일 빠른 수집", run: () => plugin.openTaskModal() },
        { label: "주간학습안내 생성", run: () => void plugin.generateWeeklyPlan() }
      ],
      [ACTIVITY_LIST_VIEW_TYPE]: [
        { label: "학생 빠른 기록", run: () => plugin.openRecordFlow() },
        { label: "출결 체크", run: () => plugin.openAttendanceModal() },
        { label: "과제 체크", run: () => plugin.openAssignmentFlow() },
        { label: "학생별 타임라인", run: () => plugin.openStudentTimelineFlow() }
      ],
      [STUDENT_TIMELINE_VIEW_TYPE]: [
        { label: "학생 빠른 기록", run: () => plugin.openRecordFlow() },
        { label: "학생부 근거 기록", run: () => plugin.openSchoolRecordEvidenceFlow() }
      ],
      [TASK_VIEW_TYPE]: [
        { label: "할 일 빠른 수집", run: () => plugin.openTaskModal() }
      ],
      [CURRICULUM_VIEW_TYPE]: [
        { label: "새 통합 단원 설계", run: () => plugin.openCurriculumUnitModal() },
        { label: "학생부 근거 기록", run: () => plugin.openSchoolRecordEvidenceFlow() },
        { label: "학생부 학급 일괄", run: () => plugin.openSchoolRecordBatch() }
      ],
      [REPORT_VIEW_TYPE]: [
        { label: "AI 협업 설정", run: () => plugin.openAiSetup() }
      ],
      [DATA_MANAGEMENT_VIEW_TYPE]: [
        { label: "학생 추가·명렬표", run: () => plugin.openStudentModal() },
        { label: "학급 공간 초기화", run: () => void plugin.initializeWorkspace() }
      ]
    };
    return map[this.contextViewType] ?? [];
  }

  private globalActions(): NavAction[] {
    const plugin = this.plugin;
    return [
      { label: "출결 체크", run: () => plugin.openAttendanceModal() },
      { label: "학생 빠른 기록", run: () => plugin.openRecordFlow() },
      { label: "과제 체크", run: () => plugin.openAssignmentFlow() },
      { label: "할 일 빠른 수집", run: () => plugin.openTaskModal() }
    ];
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("class-management-nav-view");

    const viewSection = container.createDiv({ cls: "class-management-nav-section" });
    viewSection.createEl("h4", { text: "뷰" });
    for (const entry of this.viewEntries()) {
      const item = viewSection.createEl("button", {
        text: entry.label,
        cls: "class-management-nav-item"
      });
      if (entry.type === this.contextViewType) item.addClass("is-active");
      item.addEventListener("click", entry.open);
    }

    const context = this.contextActions();
    const contextSection = container.createDiv({ cls: "class-management-nav-section" });
    const activeLabel = this.viewEntries().find(
      (entry) => entry.type === this.contextViewType
    )?.label;
    contextSection.createEl("h4", { text: `${activeLabel ?? "현재 화면"} 작업` });
    if (context.length === 0) {
      contextSection.createEl("p", {
        cls: "class-management-nav-hint",
        text: "이 화면의 작업은 화면 안의 버튼을 사용합니다."
      });
    }
    for (const action of context) {
      const item = contextSection.createEl("button", {
        text: action.label,
        cls: "class-management-nav-item is-action"
      });
      item.addEventListener("click", action.run);
    }

    const globals = this.globalActions().filter(
      (action) => !context.some((item) => item.label === action.label)
    );
    if (globals.length > 0) {
      const globalSection = container.createDiv({ cls: "class-management-nav-section" });
      globalSection.createEl("h4", { text: "자주 쓰는 명령" });
      for (const action of globals) {
        const item = globalSection.createEl("button", {
          text: action.label,
          cls: "class-management-nav-item is-action"
        });
        item.addEventListener("click", action.run);
      }
    }
  }
}
