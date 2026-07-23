import { ItemView, WorkspaceLeaf, setIcon } from "obsidian";
import { DASHBOARD_VIEW_TYPE } from "./dashboard-view";
import { CURRICULUM_OPS_VIEW_TYPE } from "./curriculum-ops-view";
import { CURRICULUM_GANTT_VIEW_TYPE } from "./curriculum-gantt-view";
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

interface NavItem {
  label: string;
  icon: string;
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

  private viewEntries(): Array<{ type: string; label: string; icon: string; open: () => void }> {
    const plugin = this.plugin;
    return [
      { type: DASHBOARD_VIEW_TYPE, label: "학급 대시보드", icon: "school", open: () => void plugin.openDashboard() },
      { type: CURRICULUM_OPS_VIEW_TYPE, label: "교육과정 운영", icon: "calendar-clock", open: () => void plugin.openCurriculumOps() },
      { type: CALENDAR_VIEW_TYPE, label: "학급 캘린더", icon: "calendar-days", open: () => void plugin.openCalendar() },
      { type: ACTIVITY_LIST_VIEW_TYPE, label: "통합 목록", icon: "list", open: () => void plugin.openActivityList() },
      { type: STUDENT_TIMELINE_VIEW_TYPE, label: "학생별 타임라인", icon: "user", open: () => plugin.openStudentTimelineFlow() },
      { type: TASK_VIEW_TYPE, label: "GTD 할 일", icon: "list-todo", open: () => void plugin.openTasks() },
      { type: ROUTINE_VIEW_TYPE, label: "루틴 체크리스트", icon: "repeat", open: () => void plugin.openRoutines() },
      { type: CURRICULUM_VIEW_TYPE, label: "교육과정 일체화", icon: "book-open-check", open: () => void plugin.openCurriculum() },
      { type: CURRICULUM_GANTT_VIEW_TYPE, label: "일체화 로드맵", icon: "gantt-chart", open: () => void plugin.openCurriculumGantt() },
      { type: REPORT_VIEW_TYPE, label: "분석·보고서", icon: "bar-chart-2", open: () => void plugin.openReports() },
      { type: DATA_MANAGEMENT_VIEW_TYPE, label: "학급·데이터", icon: "database", open: () => void plugin.openDataManagement() },
      { type: MAINTENANCE_VIEW_TYPE, label: "백업·유지관리", icon: "archive", open: () => void plugin.openMaintenance() }
    ];
  }

  /** 뷰별 작업 목록 — 하루 작업 순서와 사용 빈도 순으로 배열한다. */
  private contextActions(): NavItem[] {
    const plugin = this.plugin;
    const map: Record<string, NavItem[]> = {
      [DASHBOARD_VIEW_TYPE]: [
        { label: "출결 체크", icon: "user-check", run: () => plugin.openAttendanceModal() },
        { label: "학생 빠른 기록", icon: "pencil", run: () => plugin.openRecordFlow() },
        { label: "과제 체크", icon: "clipboard-check", run: () => plugin.openAssignmentFlow() },
        { label: "할 일 빠른 수집", icon: "inbox", run: () => plugin.openTaskModal() },
        { label: "가정통신문 회신", icon: "mail", run: () => plugin.openNoticeFlow() },
        { label: "학생 개별 기록", icon: "file-text", run: () => plugin.openSchoolRecordEvidenceFlow() },
        { label: "학급 일괄 기록", icon: "files", run: () => plugin.openSchoolRecordBatch() },
        { label: "학생 추가·명렬표", icon: "user-plus", run: () => plugin.openStudentModal() },
        { label: "학생 인스펙터", icon: "user-search", run: () => plugin.openStudentInspectorFlow() }
      ],
      [CURRICULUM_OPS_VIEW_TYPE]: [
        { label: "주간학습안내 생성", icon: "newspaper", run: () => void plugin.generateWeeklyPlan() },
        { label: "진도 자동 배정", icon: "wand", run: () => void plugin.runProgressAssignment() },
        { label: "진도표 차시 가져오기", icon: "download", run: () => plugin.openProgressImportModal() },
        { label: "일반 단원 일괄 생성", icon: "layers", run: () => plugin.openUnitScaffoldModal() },
        { label: "평가 계획 가져오기", icon: "clipboard-list", run: () => plugin.openAssessmentImportModal() },
        { label: "성취기준 노트 생성", icon: "target", run: () => void plugin.scaffoldStandardNotes() },
        { label: "진도표 성취기준 링크화", icon: "link", run: () => void plugin.linkifyProgressStandardCodes() },
        { label: "학사일정 노트", icon: "calendar", run: () => void plugin.openAcademicCalendarNote() },
        { label: "기준 시수 노트", icon: "clock", run: () => void plugin.openHoursStandardNote() },
        { label: "기초시간표 노트", icon: "table", run: () => void plugin.openBaseTimetableNote() },
        { label: "차시 인스펙터", icon: "book-open", run: () => void plugin.openLessonInspector() }
      ],
      [CALENDAR_VIEW_TYPE]: [
        { label: "학생 빠른 기록", icon: "pencil", run: () => plugin.openRecordFlow() },
        { label: "출결 체크", icon: "user-check", run: () => plugin.openAttendanceModal() },
        { label: "과제 체크", icon: "clipboard-check", run: () => plugin.openAssignmentFlow() },
        { label: "할 일 빠른 수집", icon: "inbox", run: () => plugin.openTaskModal() },
        { label: "주간학습안내 생성", icon: "newspaper", run: () => void plugin.generateWeeklyPlan() }
      ],
      [ACTIVITY_LIST_VIEW_TYPE]: [
        { label: "학생 빠른 기록", icon: "pencil", run: () => plugin.openRecordFlow() },
        { label: "출결 체크", icon: "user-check", run: () => plugin.openAttendanceModal() },
        { label: "과제 체크", icon: "clipboard-check", run: () => plugin.openAssignmentFlow() },
        { label: "학생별 타임라인", icon: "user", run: () => plugin.openStudentTimelineFlow() }
      ],
      [STUDENT_TIMELINE_VIEW_TYPE]: [
        { label: "학생 빠른 기록", icon: "pencil", run: () => plugin.openRecordFlow() },
        { label: "학생 개별 기록", icon: "file-text", run: () => plugin.openSchoolRecordEvidenceFlow() }
      ],
      [TASK_VIEW_TYPE]: [
        { label: "할 일 빠른 수집", icon: "inbox", run: () => plugin.openTaskModal() }
      ],
      [CURRICULUM_VIEW_TYPE]: [
        { label: "새 통합 단원 설계", icon: "plus-circle", run: () => plugin.openCurriculumUnitModal() },
        { label: "학생 개별 기록", icon: "file-text", run: () => plugin.openSchoolRecordEvidenceFlow() },
        { label: "학급 일괄 기록", icon: "files", run: () => plugin.openSchoolRecordBatch() }
      ],
      [REPORT_VIEW_TYPE]: [
        { label: "AI 협업 설정", icon: "bot", run: () => plugin.openAiSetup() }
      ],
      [DATA_MANAGEMENT_VIEW_TYPE]: [
        { label: "학급·학기 추가 및 전환", icon: "arrow-left-right", run: () => plugin.openClassProfileModal() },
        { label: "학생 추가·명렬표", icon: "user-plus", run: () => plugin.openStudentModal() },
        { label: "학급 공간 초기화", icon: "folder-plus", run: () => void plugin.initializeWorkspace() }
      ]
    };
    return map[this.contextViewType] ?? [];
  }

  private globalActions(): NavItem[] {
    const plugin = this.plugin;
    return [
      { label: "출결 체크", icon: "user-check", run: () => plugin.openAttendanceModal() },
      { label: "학생 빠른 기록", icon: "pencil", run: () => plugin.openRecordFlow() },
      { label: "과제 체크", icon: "clipboard-check", run: () => plugin.openAssignmentFlow() },
      { label: "할 일 빠른 수집", icon: "inbox", run: () => plugin.openTaskModal() }
    ];
  }

  private renderItem(
    parent: HTMLElement,
    item: { label: string; icon: string; run: () => void },
    active = false
  ): void {
    const row = parent.createDiv({ cls: "class-management-nav-item" });
    if (active) {
      row.addClass("is-active");
      row.setAttribute("aria-current", "page");
    }
    row.setAttribute("role", "button");
    row.setAttribute("tabindex", "0");
    row.setAttribute("aria-label", item.label);
    const icon = row.createSpan({ cls: "class-management-nav-icon" });
    setIcon(icon, item.icon);
    row.createSpan({ text: item.label, cls: "class-management-nav-label" });
    row.addEventListener("click", item.run);
    row.addEventListener("keydown", (event) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        item.run();
      }
    });
  }

  private render(): void {
    const container = this.contentEl;
    container.empty();
    container.addClass("class-management-nav-view");

    const viewSection = container.createDiv({ cls: "class-management-nav-section" });
    viewSection.createDiv({ text: "뷰", cls: "class-management-nav-title" });
    for (const entry of this.viewEntries()) {
      this.renderItem(
        viewSection,
        {
          label: entry.label,
          icon: entry.icon,
          // 클릭 즉시 활성 강조 — 뷰 포커스 이벤트(active-leaf-change)가 늦게 오는 경우 대비.
          run: () => {
            entry.open();
            if (this.contextViewType !== entry.type) {
              this.contextViewType = entry.type;
              this.render();
            }
          }
        },
        entry.type === this.contextViewType
      );
    }

    const context = this.contextActions();
    const activeLabel = this.viewEntries().find(
      (entry) => entry.type === this.contextViewType
    )?.label;
    const contextSection = container.createDiv({ cls: "class-management-nav-section" });
    contextSection.createDiv({
      text: `${activeLabel ?? "현재 화면"} 작업`,
      cls: "class-management-nav-title"
    });
    if (context.length === 0) {
      contextSection.createEl("p", {
        cls: "class-management-nav-hint",
        text: "이 화면의 작업은 화면 안의 버튼을 사용합니다."
      });
    }
    for (const action of context) this.renderItem(contextSection, action);

    const globals = this.globalActions().filter(
      (action) => !context.some((item) => item.label === action.label)
    );
    if (globals.length > 0) {
      const globalSection = container.createDiv({ cls: "class-management-nav-section" });
      globalSection.createDiv({ text: "자주 쓰는 명령", cls: "class-management-nav-title" });
      for (const action of globals) this.renderItem(globalSection, action);
    }
  }
}
