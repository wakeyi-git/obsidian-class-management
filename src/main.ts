import { Notice, Plugin, TFile, type WorkspaceLeaf } from "obsidian";
import { EMPTY_ACTIVITY_FILTERS } from "@core/activity";
import { ActivityIndex } from "./activity-index";
import { ActivityListView, ACTIVITY_LIST_VIEW_TYPE } from "./activity-list-view";
import { AiSetupModal } from "./ai-setup-modal";
import { AttendanceModal } from "./attendance-modal";
import { AssignmentModal, AssignmentPickerModal } from "./assignment-modal";
import { ClassCalendarView, CALENDAR_VIEW_TYPE } from "./calendar-view";
import { ClassProfileModal } from "./class-profile-modal";
import { ClassRepository } from "./class-repository";
import { CurriculumLessonModal } from "./curriculum-lesson-modal";
import { CurriculumUnitModal } from "./curriculum-unit-modal";
import { CurriculumView, CURRICULUM_VIEW_TYPE } from "./curriculum-view";
import { CurriculumOpsView, CURRICULUM_OPS_VIEW_TYPE } from "./curriculum-ops-view";
import { CurriculumGanttView, CURRICULUM_GANTT_VIEW_TYPE } from "./curriculum-gantt-view";
import { NavigatorView, NAVIGATOR_VIEW_TYPE } from "./navigator-view";
import { TodayView, TODAY_VIEW_TYPE } from "./today-view";
import { StudentInspectorView, STUDENT_INSPECTOR_VIEW_TYPE } from "./student-inspector-view";
import { LessonInspectorView, LESSON_INSPECTOR_VIEW_TYPE } from "./lesson-inspector-view";
import { ProgressImportModal } from "./progress-import-modal";
import { UnitScaffoldModal } from "./unit-scaffold-modal";
import { AssessmentImportModal } from "./assessment-import-modal";
import { ProgressPinModal } from "./progress-pin-modal";
import { addDays, dayStatus, mondayOf, semesterForDate, semesterRange } from "@core/academic-calendar";
import { isRemovedSubject, resolveDay, subjectSlots } from "@core/timetable";
import { assignProgress, buildAssignedSlotContents } from "@core/progress";
import { emptyCurriculumUnit, taughtHoursForUnit } from "@core/curriculum";
import {
  achievementStandardMarkdown,
  extractStandardCodes,
  linkifyStandardCell,
  resolveAssessmentDate,
  unitScaffoldsFromProgress
} from "@core/planning";
import { createTargetedSnapshot } from "./maintenance";
import { buildWeeklyPlanDays, buildWeeklyPlanMarkdown } from "@core/weekly-plan";
import { localDate } from "@core/utils";
import {
  DataManagementView,
  DATA_MANAGEMENT_VIEW_TYPE
} from "./data-management-view";
import { ClassDashboardView, DASHBOARD_VIEW_TYPE } from "./dashboard-view";
import { RecordModal, StudentModal, StudentSuggestModal } from "./modals";
import {
  MaintenanceView,
  MAINTENANCE_VIEW_TYPE
} from "./maintenance-view";
import { NoticeModal, NoticePickerModal } from "./notice-modal";
import { RoutineView, ROUTINE_VIEW_TYPE } from "./routine-view";
import { ReportView, REPORT_VIEW_TYPE } from "./report-view";
import { SchoolRecordEvidenceModal } from "./school-record-evidence-modal";
import { SchoolRecordBatchModal } from "./school-record-batch-modal";
import { defaultSubjectsForGrade } from "@core/school-record-evidence";
import { ClassManagementSettingTab } from "./settings-tab";
import {
  StudentTimelineView,
  STUDENT_TIMELINE_VIEW_TYPE
} from "./student-timeline-view";
import { TaskModal } from "./task-modal";
import { TaskView, TASK_VIEW_TYPE } from "./task-view";
import type { BaseTimetable, NewCurriculumLesson, ProgressTable, SchoolEvent } from "@core/types";
import type {
  ActivityListFilters,
  ActivityColumn,
  AssignmentSheet,
  ClassProfile,
  ClassManagementSettings,
  CurriculumLesson,
  CurriculumUnit,
  CurriculumUnitLink,
  NoticeSheet,
  ProgressRow,
  SchoolRecordArea,
  StudentEntry,
  TimetableOverride
} from "@core/types";

const DEFAULT_CLASS_ID = "default-class";
const DEFAULT_SCHOOL_YEAR = String(new Date().getFullYear());
// 저장된 설정의 스키마 표식. loadSettings의 정규화는 멱등이므로 버전과 무관하게
// 항상 실행하며, 저장 형식이 비호환으로 바뀔 때에만 이 값을 올리고 분기를 추가한다.
const SETTINGS_SCHEMA_VERSION = 13;
const DEFAULT_SETTINGS: ClassManagementSettings = {
  className: "우리 반",
  schoolYear: DEFAULT_SCHOOL_YEAR,
  semester: "1학기",
  schoolLevel: "elementary",
  grade: "3",
  curriculum: "2022 개정 교육과정",
  schoolRecordGuidelineYear: "2026",
  schoolSubjects: defaultSubjectsForGrade("3"),
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
  retentionYears: 5,
  backupsFolder: "백업",
  schemaVersion: SETTINGS_SCHEMA_VERSION,
  aiOutputFolder: "AI 결과",
  aiCollaborationEnabled: false,
  aiAnonymizeStudents: true,
  aiExcludedFolders: ["첨부파일", ".trash", ".obsidian"],
  activeClassId: DEFAULT_CLASS_ID,
  classProfiles: [{
    id: DEFAULT_CLASS_ID,
    name: "우리 반",
    schoolYear: DEFAULT_SCHOOL_YEAR,
    semester: "1학기",
    schoolLevel: "elementary",
    grade: "3",
    curriculum: "2022 개정 교육과정",
    schoolRecordGuidelineYear: "2026",
    schoolSubjects: defaultSubjectsForGrade("3"),
    baseFolder: "학급운영",
    archived: false
  }],
  activityListFilters: { ...EMPTY_ACTIVITY_FILTERS },
  savedActivityViews: [],
  favoriteActionIds: ["attendance", "record", "assignment", "task"],
  activitySortBy: "date",
  activitySortDirection: "desc",
  activityVisibleColumns: ["date", "student", "kind", "status", "detail", "source"],
  calendarViewMode: "month"
};

export default class ClassManagementPlugin extends Plugin {
  settings: ClassManagementSettings = DEFAULT_SETTINGS;
  repository = new ClassRepository(this.app, () => this.settings);
  activityIndex = new ActivityIndex(this.app, this.repository);

  async onload(): Promise<void> {
    await this.loadSettings();

    this.registerView(
      DASHBOARD_VIEW_TYPE,
      (leaf) => new ClassDashboardView(leaf, this)
    );
    this.registerView(
      ACTIVITY_LIST_VIEW_TYPE,
      (leaf) => new ActivityListView(leaf, this)
    );
    this.registerView(
      STUDENT_TIMELINE_VIEW_TYPE,
      (leaf) => new StudentTimelineView(leaf, this)
    );
    this.registerView(
      CALENDAR_VIEW_TYPE,
      (leaf) => new ClassCalendarView(leaf, this)
    );
    this.registerView(TASK_VIEW_TYPE, (leaf) => new TaskView(leaf, this));
    this.registerView(ROUTINE_VIEW_TYPE, (leaf) => new RoutineView(leaf, this));
    this.registerView(CURRICULUM_VIEW_TYPE, (leaf) => new CurriculumView(leaf, this));
    this.registerView(
      CURRICULUM_OPS_VIEW_TYPE,
      (leaf) => new CurriculumOpsView(leaf, this)
    );
    this.registerView(
      CURRICULUM_GANTT_VIEW_TYPE,
      (leaf) => new CurriculumGanttView(leaf, this)
    );
    this.registerView(NAVIGATOR_VIEW_TYPE, (leaf) => new NavigatorView(leaf, this));
    this.registerView(TODAY_VIEW_TYPE, (leaf) => new TodayView(leaf, this));
    this.registerView(
      STUDENT_INSPECTOR_VIEW_TYPE,
      (leaf) => new StudentInspectorView(leaf, this)
    );
    this.registerView(
      LESSON_INSPECTOR_VIEW_TYPE,
      (leaf) => new LessonInspectorView(leaf, this)
    );
    this.app.workspace.onLayoutReady(() => {
      if (this.app.workspace.getLeavesOfType(NAVIGATOR_VIEW_TYPE).length === 0) {
        void this.openNavigator();
      }
      if (this.app.workspace.getLeavesOfType(TODAY_VIEW_TYPE).length === 0) {
        void this.openToday();
      }
      // 날짜가 지난 수업 기록에 raw를 스탬프한다(이후 플러그인은 건드리지 않음).
      window.setTimeout(() => void this.stampRawLessonRecords(), 2000);
      // 학기 경계를 지나면 설정 전환을 제안한다(자동 변경은 하지 않음).
      window.setTimeout(() => void this.suggestSemesterSwitch(), 2600);
      // 1.30.0 폴더 직관화 이후 구 이름 폴더가 남아 있으면 이행 안내(자동 이동은 하지 않음).
      window.setTimeout(() => this.warnLegacyFolders(), 3200);
    });
    this.registerView(REPORT_VIEW_TYPE, (leaf) => new ReportView(leaf, this));
    this.registerView(
      DATA_MANAGEMENT_VIEW_TYPE,
      (leaf) => new DataManagementView(leaf, this)
    );
    this.registerView(
      MAINTENANCE_VIEW_TYPE,
      (leaf) => new MaintenanceView(leaf, this)
    );

    this.addRibbonIcon("school", "학급 대시보드", () => void this.openDashboard());

    this.addCommand({
      id: "open-dashboard",
      name: "학급 대시보드 열기",
      callback: () => void this.openDashboard()
    });
    this.addCommand({
      id: "open-navigator",
      name: "학급 메뉴 열기 (왼쪽 패널)",
      callback: () => void this.openNavigator()
    });
    this.addCommand({
      id: "open-today",
      name: "오늘 패널 열기 (오른쪽 패널)",
      callback: () => void this.openToday()
    });
    this.addCommand({
      id: "open-student-inspector",
      name: "학생 인스펙터 열기 (오른쪽 패널)",
      callback: () => this.openStudentInspectorFlow()
    });
    this.addCommand({
      id: "open-lesson-inspector",
      name: "차시 인스펙터 열기 (오른쪽 패널)",
      callback: () => void this.openLessonInspector()
    });
    this.addCommand({
      id: "initialize-workspace",
      name: "학급 공간 초기화",
      callback: () => void this.initializeWorkspace()
    });
    this.addCommand({
      id: "add-student",
      name: "학생 추가",
      callback: () => this.openStudentModal()
    });
    this.addCommand({
      id: "add-record",
      name: "학생 빠른 기록",
      callback: () => this.openRecordFlow()
    });
    this.addCommand({
      id: "add-school-record-evidence",
      name: "학생 개별 기록 (학생부 근거)",
      callback: () => this.openSchoolRecordEvidenceFlow()
    });
    this.addCommand({
      id: "add-school-record-evidence-batch",
      name: "학급 일괄 기록 (학생부 근거)",
      callback: () => this.openSchoolRecordBatch()
    });
    this.addCommand({
      id: "import-roster-csv",
      name: "CSV 명렬표 가져오기",
      callback: () => this.openStudentModal()
    });
    this.addCommand({
      id: "check-attendance",
      name: "오늘의 출결 체크",
      callback: () => this.openAttendanceModal()
    });
    this.addCommand({
      id: "check-assignment",
      name: "과제 체크",
      callback: () => this.openAssignmentFlow()
    });
    this.addCommand({
      id: "open-activity-list",
      name: "통합 목록 열기",
      callback: () => void this.openActivityList()
    });
    this.addCommand({
      id: "open-student-timeline",
      name: "학생별 타임라인 열기",
      callback: () => this.openStudentTimelineFlow()
    });
    this.addCommand({
      id: "open-calendar",
      name: "학급 캘린더 열기",
      callback: () => void this.openCalendar()
    });
    this.addCommand({
      id: "open-curriculum-ops",
      name: "시간표·시수 열기",
      callback: () => void this.openCurriculumOps()
    });
    this.addCommand({
      id: "open-academic-calendar",
      name: "학사일정 노트 열기",
      callback: () => void this.openAcademicCalendarNote()
    });
    this.addCommand({
      id: "open-hours-standard",
      name: "기준 시수 노트 열기",
      callback: () => void this.openHoursStandardNote()
    });
    this.addCommand({
      id: "open-base-timetable",
      name: "기초시간표 노트 열기",
      callback: () => void this.openBaseTimetableNote()
    });
    this.addCommand({
      id: "import-progress-rows",
      name: "진도표 차시 가져오기",
      callback: () => this.openProgressImportModal()
    });
    this.addCommand({
      id: "assign-progress",
      name: "진도 자동 배정",
      callback: () => void this.runProgressAssignment()
    });
    this.addCommand({
      id: "scaffold-regular-units",
      name: "일반 단원 일괄 생성",
      callback: () => this.openUnitScaffoldModal()
    });
    this.addCommand({
      id: "import-assessment-plan",
      name: "평가 계획 가져오기",
      callback: () => this.openAssessmentImportModal()
    });
    this.addCommand({
      id: "scaffold-standard-notes",
      name: "성취기준 노트 생성",
      callback: () => void this.scaffoldStandardNotes()
    });
    this.addCommand({
      id: "linkify-progress-standards",
      name: "진도표 성취기준 링크화",
      callback: () => void this.linkifyProgressStandardCodes()
    });
    this.addCommand({
      id: "backfill-lesson-progress-links",
      name: "수업일지 진도표 역링크 채우기",
      callback: () => void this.backfillLessonProgressLinks()
    });
    this.addCommand({
      id: "open-curriculum-gantt",
      name: "교육과정 로드맵 열기",
      callback: () => void this.openCurriculumGantt()
    });
    this.addCommand({
      id: "create-bases-views",
      name: "일체화 Bases 보기 만들기",
      callback: () => void this.createBasesViews()
    });
    this.addCommand({
      id: "create-event-notes",
      name: "행사 노트 일괄 만들기",
      callback: () => void this.createAllEventNotes()
    });
    this.addCommand({
      id: "generate-weekly-plan",
      name: "주간학습안내 생성 (이번 주)",
      callback: () => void this.generateWeeklyPlan()
    });
    this.addCommand({
      id: "open-tasks",
      name: "GTD 할 일 열기",
      callback: () => void this.openTasks()
    });
    this.addCommand({
      id: "capture-task",
      name: "할 일 빠른 수집",
      callback: () => this.openTaskModal()
    });
    this.addCommand({
      id: "check-notice-replies",
      name: "가정통신문 회신 체크",
      callback: () => this.openNoticeFlow()
    });
    this.addCommand({
      id: "open-routines",
      name: "루틴 체크리스트 열기",
      callback: () => void this.openRoutines()
    });
    this.addCommand({
      id: "open-curriculum-integration",
      name: "단원 설계 및 운영 열기",
      callback: () => void this.openCurriculum()
    });
    this.addCommand({
      id: "create-curriculum-unit",
      name: "새 통합 단원 설계",
      callback: () => this.openCurriculumUnitModal()
    });
    this.addCommand({
      id: "open-reports",
      name: "분석·보고서 열기",
      callback: () => void this.openReports()
    });
    this.addCommand({
      id: "setup-ai-collaboration",
      name: "AI 협업 설정",
      callback: () => this.openAiSetup()
    });
    this.addCommand({
      id: "manage-classes",
      name: "학급·학기 추가 및 전환",
      callback: () => this.openClassProfileModal()
    });
    this.addCommand({
      id: "open-data-management",
      name: "학급·데이터 열기",
      callback: () => void this.openDataManagement()
    });
    this.addCommand({
      id: "open-maintenance",
      name: "백업·유지관리 열기",
      callback: () => void this.openMaintenance()
    });

    this.addSettingTab(new ClassManagementSettingTab(this.app, this));

    let refreshTimer: number | undefined;
    const scheduleRefresh = () => {
      this.activityIndex.invalidate();
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void this.refreshViews(), 120);
    };
    this.register(() => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    });
    this.registerEvent(this.app.vault.on("create", scheduleRefresh));
    this.registerEvent(this.app.vault.on("delete", scheduleRefresh));
    this.registerEvent(this.app.metadataCache.on("changed", scheduleRefresh));
  }

  onunload(): void {
    this.app.workspace.detachLeavesOfType(DASHBOARD_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(ACTIVITY_LIST_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(STUDENT_TIMELINE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(CALENDAR_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(TASK_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(ROUTINE_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(CURRICULUM_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(REPORT_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(DATA_MANAGEMENT_VIEW_TYPE);
    this.app.workspace.detachLeavesOfType(MAINTENANCE_VIEW_TYPE);
  }

  async loadSettings(): Promise<void> {
    const loaded = (await this.loadData()) as Partial<ClassManagementSettings> | null;
    this.settings = {
      ...DEFAULT_SETTINGS,
      ...(loaded ?? {}),
      activityListFilters: {
        ...EMPTY_ACTIVITY_FILTERS,
        ...(loaded?.activityListFilters ?? {})
      },
      savedActivityViews: loaded?.savedActivityViews ?? [],
      favoriteActionIds: loaded?.favoriteActionIds ?? DEFAULT_SETTINGS.favoriteActionIds
    };
    // v13: 폴더 직관화 — 기본 이름을 쓰던 설정만 새 이름으로 옮긴다(사용자 지정 이름은 유지).
    if ((loaded?.schemaVersion ?? 0) < 13 && loaded?.recordsFolder === "기록") {
      this.settings.recordsFolder = "학생 기록";
    }
    this.settings.schemaVersion = SETTINGS_SCHEMA_VERSION;
    if (!loaded?.classProfiles?.length) {
      this.settings.classProfiles = [{
        id: DEFAULT_CLASS_ID,
        name: this.settings.className,
        schoolYear: this.settings.schoolYear,
        semester: this.settings.semester,
        schoolLevel: "elementary",
        grade: this.settings.grade,
        curriculum: this.settings.curriculum,
        schoolRecordGuidelineYear: this.settings.schoolRecordGuidelineYear,
        schoolSubjects: [...this.settings.schoolSubjects],
        baseFolder: this.settings.baseFolder,
        archived: false
      }];
      this.settings.activeClassId = DEFAULT_CLASS_ID;
    }
    this.settings.classProfiles = this.settings.classProfiles.map((profile) => ({
      ...profile,
      schoolLevel: "elementary",
      grade: profile.grade || this.settings.grade || "3",
      curriculum: profile.curriculum || this.settings.curriculum || "2022 개정 교육과정",
      schoolRecordGuidelineYear: profile.schoolRecordGuidelineYear || this.settings.schoolRecordGuidelineYear || "2026",
      schoolSubjects: profile.schoolSubjects?.length
        ? [...profile.schoolSubjects]
        : defaultSubjectsForGrade(profile.grade || this.settings.grade || "3")
    }));
    const active = this.settings.classProfiles.find(
      (profile) => profile.id === this.settings.activeClassId
    ) ?? this.settings.classProfiles[0];
    if (active) this.applyClassProfile(active);
  }

  async saveSettings(): Promise<void> {
    const active = this.settings.classProfiles.find(
      (profile) => profile.id === this.settings.activeClassId
    );
    if (active) {
      active.name = this.settings.className;
      active.schoolYear = this.settings.schoolYear;
      active.semester = this.settings.semester;
      active.schoolLevel = this.settings.schoolLevel;
      active.grade = this.settings.grade;
      active.curriculum = this.settings.curriculum;
      active.schoolRecordGuidelineYear = this.settings.schoolRecordGuidelineYear;
      active.schoolSubjects = [...this.settings.schoolSubjects];
      active.baseFolder = this.settings.baseFolder;
    }
    await this.saveData(this.settings);
    await this.refreshDashboard();
  }

  get activeClassProfile(): ClassProfile {
    return this.settings.classProfiles.find(
      (profile) => profile.id === this.settings.activeClassId
    ) ?? this.settings.classProfiles[0] ?? {
      id: DEFAULT_CLASS_ID,
      name: this.settings.className,
      schoolYear: this.settings.schoolYear,
      semester: this.settings.semester,
      schoolLevel: "elementary",
      grade: this.settings.grade,
      curriculum: this.settings.curriculum,
      schoolRecordGuidelineYear: this.settings.schoolRecordGuidelineYear,
      schoolSubjects: [...this.settings.schoolSubjects],
      baseFolder: this.settings.baseFolder,
      archived: false
    };
  }

  async switchClassProfile(id: string): Promise<void> {
    const profile = this.settings.classProfiles.find((entry) => entry.id === id);
    if (!profile) throw new Error("학급 프로필을 찾을 수 없습니다.");
    this.settings.activeClassId = id;
    this.applyClassProfile(profile);
    await this.saveData(this.settings);
    this.activityIndex.invalidate();
    await this.repository.ensureWorkspace();
    await this.refreshViews();
  }

  async createClassProfile(
    profile: Omit<ClassProfile, "id" | "archived">,
    copyStudents: StudentEntry[] = []
  ): Promise<ClassProfile> {
    const created: ClassProfile = {
      ...profile,
      id: `class-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      archived: false
    };
    this.settings.classProfiles.push(created);
    await this.switchClassProfile(created.id);
    if (copyStudents.length > 0) {
      await this.repository.importStudents(
        copyStudents.map((student) => ({ number: student.number, name: student.name }))
      );
    }
    await this.refreshViews();
    return created;
  }

  async setClassArchived(id: string, archived: boolean): Promise<void> {
    const profile = this.settings.classProfiles.find((entry) => entry.id === id);
    if (!profile) return;
    profile.archived = archived;
    await this.saveData(this.settings);
    await this.refreshDashboard();
  }

  canWriteActiveClass(): boolean {
    if (!this.activeClassProfile.archived) return true;
    new Notice("보관된 학급은 플러그인에서 읽기 전용으로 열립니다.");
    return false;
  }

  private applyClassProfile(profile: ClassProfile): void {
    this.settings.className = profile.name;
    this.settings.schoolYear = profile.schoolYear;
    this.settings.semester = profile.semester;
    this.settings.schoolLevel = profile.schoolLevel;
    this.settings.grade = profile.grade;
    this.settings.curriculum = profile.curriculum;
    this.settings.schoolRecordGuidelineYear = profile.schoolRecordGuidelineYear;
    this.settings.schoolSubjects = [...profile.schoolSubjects];
    this.settings.baseFolder = profile.baseFolder;
  }

  async saveActivityFilters(filters: ActivityListFilters): Promise<void> {
    this.settings.activityListFilters = { ...filters };
    await this.saveData(this.settings);
  }

  async saveActivityPreferences(
    sortBy: ClassManagementSettings["activitySortBy"],
    sortDirection: ClassManagementSettings["activitySortDirection"],
    visibleColumns: ActivityColumn[]
  ): Promise<void> {
    this.settings.activitySortBy = sortBy;
    this.settings.activitySortDirection = sortDirection;
    this.settings.activityVisibleColumns = [...visibleColumns];
    await this.saveData(this.settings);
  }

  async saveNamedActivityView(
    name: string,
    filters: ActivityListFilters
  ): Promise<void> {
    const normalized = name.trim();
    if (!normalized) return;
    const existing = this.settings.savedActivityViews.findIndex(
      (view) => view.name === normalized
    );
    const saved = { name: normalized, filters: { ...filters } };
    if (existing >= 0) this.settings.savedActivityViews[existing] = saved;
    else this.settings.savedActivityViews.push(saved);
    await this.saveData(this.settings);
  }

  async deleteNamedActivityView(name: string): Promise<void> {
    this.settings.savedActivityViews = this.settings.savedActivityViews.filter(
      (view) => view.name !== name
    );
    await this.saveData(this.settings);
  }

  async openToday(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TODAY_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getRightLeaf(false);
    if (!leaf) return;
    if (!existing) await leaf.setViewState({ type: TODAY_VIEW_TYPE, active: false });
    await this.app.workspace.revealLeaf(leaf);
  }

  private async ensureRightView(viewType: string): Promise<WorkspaceLeaf | null> {
    const existing = this.app.workspace.getLeavesOfType(viewType)[0];
    if (existing) return existing;
    const leaf = this.app.workspace.getRightLeaf(false);
    if (!leaf) return null;
    await leaf.setViewState({ type: viewType, active: false });
    return leaf;
  }

  async inspectStudent(studentNumber: string): Promise<void> {
    const leaf = await this.ensureRightView(STUDENT_INSPECTOR_VIEW_TYPE);
    if (!leaf) return;
    if (leaf.view instanceof StudentInspectorView) await leaf.view.setStudent(studentNumber);
    await this.app.workspace.revealLeaf(leaf);
  }

  openStudentInspectorFlow(): void {
    const students = this.repository.getStudents();
    if (students.length === 0) {
      new Notice("먼저 학생을 추가해 주세요.");
      return;
    }
    new StudentSuggestModal(
      this.app,
      students,
      (student) => void this.inspectStudent(student.number),
      "인스펙터로 볼 학생을 검색하세요"
    ).open();
  }

  async openLessonInspector(date?: string, period?: number): Promise<void> {
    const leaf = await this.ensureRightView(LESSON_INSPECTOR_VIEW_TYPE);
    if (!leaf) return;
    await this.app.workspace.revealLeaf(leaf);
    if (date && period !== undefined && leaf.view instanceof LessonInspectorView) {
      await leaf.view.setSlot(date, period);
    }
  }

  async openNavigator(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(NAVIGATOR_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeftLeaf(false);
    if (!leaf) return;
    if (!existing) await leaf.setViewState({ type: NAVIGATOR_VIEW_TYPE, active: false });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openDashboard(): Promise<void> {
    await this.repository.ensureWorkspace();

    const existing = this.app.workspace.getLeavesOfType(DASHBOARD_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) {
      await leaf.setViewState({ type: DASHBOARD_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async initializeWorkspace(): Promise<void> {
    await this.repository.ensureWorkspace();
    new Notice("학급운영 폴더와 홈 노트를 준비했습니다.");
    await this.openDashboard();
  }

  openStudentModal(): void {
    if (!this.canWriteActiveClass()) return;
    new StudentModal(
      this.app,
      async (student) => {
        const created = await this.repository.createStudent(student);
        new Notice(`${created.number}번 ${created.name} 학생을 추가했습니다.`);
        await this.refreshDashboard();
      },
      async (students) => {
        const summary = await this.repository.importStudents(students);
        await this.refreshDashboard();
        return summary;
      }
    ).open();
  }

  openRecordFlow(initialDate?: string): void {
    if (!this.canWriteActiveClass()) return;
    const students = this.repository.getStudents();
    if (students.length === 0) {
      new Notice("먼저 학생을 추가해 주세요.");
      this.openStudentModal();
      return;
    }

    new StudentSuggestModal(this.app, students, (student) =>
      this.openRecordModal(student, initialDate)
    ).open();
  }

  openSchoolRecordEvidenceFlow(
    initialDate?: string,
    initialArea: SchoolRecordArea = "creative-activities",
    selectedStudent?: StudentEntry
  ): void {
    if (!this.canWriteActiveClass()) return;
    const students = this.repository.getStudents();
    if (students.length === 0) {
      new Notice("먼저 학생을 추가해 주세요.");
      this.openStudentModal();
      return;
    }
    if (selectedStudent) {
      this.openSchoolRecordEvidenceModal(selectedStudent, initialDate, initialArea);
      return;
    }
    new StudentSuggestModal(
      this.app,
      students,
      (student) => this.openSchoolRecordEvidenceModal(student, initialDate, initialArea),
      "학교생활기록부 근거를 기록할 학생을 검색하세요"
    ).open();
  }

  openSchoolRecordBatch(
    initialArea: SchoolRecordArea = "creative-activities",
    initialUnit?: CurriculumUnit
  ): void {
    if (!this.canWriteActiveClass()) return;
    const students = this.repository.getStudents();
    if (!students.length) {
      new Notice("먼저 학생을 추가해 주세요.");
      return;
    }
    new SchoolRecordBatchModal(
      this.app,
      students,
      this.settings,
      async (records) => {
        for (const { student, record } of records) {
          await this.repository.createRecord(student, record);
        }
        this.activityIndex.invalidate();
        new Notice(`학생부 근거 ${records.length}건을 일괄 저장했습니다 (RAW).`);
        await this.refreshViews();
      },
      initialArea,
      this.repository.getCurriculumUnits(),
      initialUnit
    ).open();
  }

  openAttendanceModal(initialDate?: string): void {
    if (!this.canWriteActiveClass()) return;
    const students = this.repository.getStudents();
    if (students.length === 0) {
      new Notice("먼저 학생을 추가해 주세요.");
      this.openStudentModal();
      return;
    }

    new AttendanceModal(
      this.app,
      students,
      (date) => this.repository.getAttendance(date),
      async (date, marks) => {
        await this.repository.saveAttendance(date, marks);
        new Notice(`${date} 출결을 저장했습니다.`);
        await this.refreshDashboard();
      },
      initialDate
    ).open();
  }

  openAssignmentFlow(): void {
    if (!this.canWriteActiveClass()) return;
    const students = this.repository.getStudents();
    if (students.length === 0) {
      new Notice("먼저 학생을 추가해 주세요.");
      this.openStudentModal();
      return;
    }

    const assignments = this.repository.getAssignmentSummaries();
    if (assignments.length === 0) {
      this.openAssignmentModal(students);
      return;
    }

    new AssignmentPickerModal(this.app, assignments, (choice) => {
      if (choice.kind === "new") {
        this.openAssignmentModal(students);
        return;
      }

      void this.repository
        .loadAssignment(choice.summary)
        .then((assignment) => this.openAssignmentModal(students, assignment))
        .catch((error: unknown) => {
          new Notice(error instanceof Error ? error.message : "과제를 불러오지 못했습니다.");
        });
    }).open();
  }

  openNewAssignment(date: string): void {
    if (!this.canWriteActiveClass()) return;
    const students = this.repository.getStudents();
    if (students.length === 0) {
      new Notice("먼저 학생을 추가해 주세요.");
      return;
    }
    this.openAssignmentModal(students, undefined, date);
  }

  async openActivityList(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(ACTIVITY_LIST_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) {
      await leaf.setViewState({ type: ACTIVITY_LIST_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async openCalendar(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(CALENDAR_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) {
      await leaf.setViewState({ type: CALENDAR_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async openCurriculum(): Promise<void> {
    await this.repository.ensureWorkspace();
    const existing = this.app.workspace.getLeavesOfType(CURRICULUM_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: CURRICULUM_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openCurriculumGantt(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(CURRICULUM_GANTT_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: CURRICULUM_GANTT_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openCurriculumOps(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(CURRICULUM_OPS_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: CURRICULUM_OPS_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  async openAcademicCalendarNote(): Promise<void> {
    try {
      const file = await this.repository.ensureAcademicCalendarNote();
      await this.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "학사일정 노트를 열지 못했습니다.");
    }
  }

  async openHoursStandardNote(): Promise<void> {
    try {
      const file = await this.repository.ensureHoursStandardNote();
      await this.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "기준 시수 노트를 열지 못했습니다.");
    }
  }

  async openBaseTimetableNote(): Promise<void> {
    try {
      const file = await this.repository.ensureBaseTimetableNote(this.settings.semester);
      await this.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "기초시간표 노트를 열지 못했습니다.");
    }
  }

  openClassProfileModal(): void {
    new ClassProfileModal(this).open();
  }

  openProgressImportModal(): void {
    if (!this.canWriteActiveClass()) return;
    new ProgressImportModal(this).open();
  }

  openUnitScaffoldModal(): void {
    if (!this.canWriteActiveClass()) return;
    new UnitScaffoldModal(this).open();
  }

  openAssessmentImportModal(): void {
    if (!this.canWriteActiveClass()) return;
    new AssessmentImportModal(this).open();
  }

  /** R0-1 일반 단원 스캐폴드 — 진도표 단원 묶음으로 단원 노트 초안을 만든다(기존 이름은 건너뜀). */
  async scaffoldRegularUnits(
    semester: string,
    subjects: string[]
  ): Promise<{ created: string[]; skipped: string[] }> {
    const existing = this.repository.getCurriculumUnits();
    const tables = await this.repository.getProgressTables(semester);
    const created: string[] = [];
    const skipped: string[] = [];
    for (const subject of subjects) {
      const table = tables.find((item) => item.subject === subject);
      if (!table) continue;
      for (const scaffold of unitScaffoldsFromProgress(table)) {
        const duplicate = existing.some(
          (unit) =>
            unit.subject === subject &&
            unit.semester === semester &&
            unit.unitName === scaffold.unitName
        );
        if (duplicate) {
          skipped.push(`${subject} ${scaffold.unitName}`);
          continue;
        }
        await this.repository.createCurriculumUnit({
          ...emptyCurriculumUnit(this.settings),
          subject,
          semester,
          unitName: scaffold.unitName,
          theme: scaffold.summary,
          designApproach: "within-subject",
          startDate: scaffold.startDate,
          endDate: scaffold.endDate,
          // 원장 규칙: 일반 단원 시수는 자체 운영분 — 통합 이관 시수는 프로젝트 단원이 계상해
          // 일반 합 + 프로젝트 합 = 시간표 편성이 되게 한다.
          plannedHours: scaffold.plannedHours - scaffold.integratedHours,
          achievementStandards: scaffold.standards.join("\n"),
          learningPlan: scaffold.learningPlan,
          unitOverview: scaffold.summary
        });
        created.push(`${subject} ${scaffold.unitName}`);
      }
    }
    return { created, skipped };
  }

  /** R0-2 평가 계획 가져오기 — 항목별로 날짜를 정하고 과제 노트 생성·단원 연계·진도표 기입까지. */
  async importAssessmentPlan(
    subject: string,
    semester: string,
    items: Array<{ timing: string; unit: string; element: string; criteria: string; method: string }>
  ): Promise<{ created: number; skipped: number; issues: string[] }> {
    const calendar = await this.repository.getAcademicCalendar();
    const range = calendar ? semesterRange(calendar, semester) : { from: "", to: "" };
    const tables = await this.repository.getProgressTables(semester);
    const table = tables.find((item) => item.subject === subject) ?? null;
    const units = this.repository
      .getCurriculumUnits()
      .filter((unit) => unit.subject === subject && unit.semester === semester);
    const students = this.repository.getStudents();
    const normalize = (value: string): string => value.replace(/[\d.\s()·\-~]/g, "");

    let created = 0;
    let skipped = 0;
    const issues: string[] = [];
    for (const item of items) {
      const resolved = resolveAssessmentDate(item.timing, item.unit, {
        semesterFrom: range.from ?? "",
        semesterTo: range.to ?? "",
        rows: table?.rows ?? []
      });
      if (!resolved.date) {
        issues.push(`"${item.element}": ${resolved.issue ?? "시기를 해석하지 못했습니다."}`);
        continue;
      }
      const unit =
        units.find(
          (candidate) =>
            item.unit &&
            normalize(candidate.unitName) &&
            (normalize(candidate.unitName).includes(normalize(item.unit)) ||
              normalize(item.unit).includes(normalize(candidate.unitName)))
        ) ??
        units.find(
          (candidate) =>
            candidate.startDate &&
            candidate.endDate &&
            resolved.date >= candidate.startDate &&
            resolved.date <= candidate.endDate
        ) ?? null;
      const unitLink = unit
        ? { id: unit.id, title: unit.unitName, path: unit.file.path }
        : null;
      const title = `${subject} 수행평가 - ${item.element}`;
      const marks = students.map((student) => ({
        studentNumber: student.number,
        studentName: student.name,
        status: "미제출" as const,
        note: ""
      }));
      const tailSections = [
        "",
        "## 평가 정보",
        "",
        `- 시기: ${item.timing || "미입력"} → ${resolved.date} (${resolved.source})`,
        `- 단원: ${item.unit || "미입력"}`,
        `- 평가 방법: ${item.method || "미입력"}`,
        "",
        "## 평가 기준",
        "",
        `> ${item.criteria || "미입력"}`
      ];
      try {
        const file = await this.repository.saveAssignment(
          resolved.date,
          title,
          marks,
          unitLink,
          undefined,
          tailSections
        );
        await this.linkAssignmentToProgress(resolved.date, title, unitLink, file);
        created += 1;
      } catch (error) {
        if (error instanceof Error && error.message.includes("이미 있습니다")) skipped += 1;
        else issues.push(`"${item.element}": ${error instanceof Error ? error.message : "저장 실패"}`);
      }
    }
    await this.refreshViews();
    return { created, skipped, issues };
  }

  /** R0-3 성취기준 노트 생성 — 진도표·단원 노트의 코드를 모아 없는 노트만 만든다. */
  async scaffoldStandardNotes(): Promise<void> {
    if (!this.canWriteActiveClass()) return;
    try {
      const sources = new Map<string, Set<string>>();
      for (const semester of ["1학기", "2학기"]) {
        for (const table of await this.repository.getProgressTables(semester)) {
          for (const row of table.rows) {
            for (const code of extractStandardCodes(row.standard)) {
              const set = sources.get(code) ?? new Set<string>();
              set.add(table.file.basename);
              sources.set(code, set);
            }
          }
        }
      }
      for (const unit of this.repository.getCurriculumUnits()) {
        for (const code of extractStandardCodes(unit.achievementStandards)) {
          if (!sources.has(code)) sources.set(code, new Set<string>());
        }
      }
      if (sources.size === 0) {
        new Notice("진도표·단원 노트에서 성취기준 코드를 찾지 못했습니다.");
        return;
      }
      let created = 0;
      let existing = 0;
      for (const [code, links] of [...sources.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        const result = await this.repository.ensureAchievementStandardNote(
          code,
          achievementStandardMarkdown({ code, statement: "", progressLinks: [...links].sort() })
        );
        if (result.created) created += 1;
        else existing += 1;
      }
      new Notice(
        `성취기준 노트 ${created}개를 만들었습니다. 기존 ${existing}개는 그대로 두었습니다. 전문은 노트에서 채워 주세요.`
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "성취기준 노트 생성에 실패했습니다.");
    }
  }

  /** R0-3 진도표 성취기준 링크화 — 두 학기 진도표의 코드 표기를 [[코드]]로 바꾼다(멱등). */
  async linkifyProgressStandardCodes(): Promise<void> {
    if (!this.canWriteActiveClass()) return;
    try {
      const targets: ProgressTable[] = [];
      for (const semester of ["1학기", "2학기"]) {
        for (const table of await this.repository.getProgressTables(semester)) {
          if (table.rows.some((row) => linkifyStandardCell(row.standard) !== row.standard)) {
            targets.push(table);
          }
        }
      }
      if (targets.length === 0) {
        new Notice("바꿀 성취기준 표기가 없습니다. 이미 모두 위키링크입니다.");
        return;
      }
      // 표 전체를 다시 쓰므로 변경 전 원본을 자동 스냅숏으로 남긴다 (UIUX §5).
      await createTargetedSnapshot(
        this.app,
        this.repository,
        this.settings,
        targets.map((table) => table.file),
        "진도표 성취기준 링크화"
      );
      let changedRows = 0;
      for (const table of targets) {
        changedRows += await this.repository.linkifyProgressStandards(table);
      }
      new Notice(
        `진도표 ${targets.length}개에서 ${changedRows}행의 성취기준을 위키링크로 바꿨습니다 · 변경 전 스냅숏 저장.`
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "성취기준 링크화에 실패했습니다.");
    }
  }

  /** 학기 경계를 지나면 설정 학기 전환을 제안한다 (§3 안내 문형 — 자동 변경하지 않음). */
  async suggestSemesterSwitch(): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) return;
      // 방학·휴업일에는 제안하지 않는다 — 행정 학기에서는 방학도 학기 범위 안이라 오탐이 된다.
      if (dayStatus(calendar, localDate()).kind !== "class") return;
      const current = semesterForDate(calendar, localDate());
      if (!current || current === this.settings.semester) return;
      new Notice(
        `오늘은 ${current} 기간입니다. 설정에서 학기를 ${current}(으)로 바꾸면 시간표·진도가 맞게 표시됩니다.`,
        10000
      );
    } catch {
      // 제안 실패는 조용히 넘어간다 — 다음 로드에서 다시 시도된다.
    }
  }

  /** 1.30.0 폴더 이름 변경(기록→학생 기록, 설계→단원, 뷰→모아보기) 전 구조를 감지해 안내한다. */
  warnLegacyFolders(): void {
    const pairs: Array<[string, string]> = [
      [`${this.repository.baseFolderPath}/기록`, this.repository.recordsFolderPath],
      [`${this.repository.curriculumFolderPath}/설계`, this.repository.curriculumUnitsFolderPath],
      [`${this.repository.curriculumFolderPath}/뷰`, this.repository.basesFolderPath]
    ];
    const legacy = pairs.filter(
      ([oldPath, newPath]) =>
        oldPath !== newPath &&
        this.app.vault.getAbstractFileByPath(oldPath) &&
        !this.app.vault.getAbstractFileByPath(newPath)
    );
    if (legacy.length === 0) return;
    new Notice(
      `구버전 폴더 이름이 남아 있습니다: ${legacy.map(([oldPath]) => oldPath).join(", ")}. ` +
        "폴더 이름을 새 구조(학생 기록·단원·모아보기)로 바꿔 주세요 — CHANGELOG 1.30.0 이행 안내 참고.",
      12000
    );
  }

  /** 수동 작성 수업일지를 진도표 비고에 역링크한다(플러그인 생성분과 같은 형식, 멱등). */
  async backfillLessonProgressLinks(): Promise<void> {
    if (!this.canWriteActiveClass()) return;
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다. `학사일정 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const lessons = this.repository
        .getCurriculumLessons()
        .filter((lesson) => lesson.date && lesson.subject);
      if (lessons.length === 0) {
        new Notice("날짜·과목이 있는 수업일지가 없습니다.");
        return;
      }
      const tablesBySemester = new Map<string, ProgressTable[]>();
      let added = 0;
      let already = 0;
      let unmatched = 0;
      for (const lesson of lessons) {
        const semester = semesterForDate(calendar, lesson.date);
        if (!semester) {
          unmatched += 1;
          continue;
        }
        if (!tablesBySemester.has(semester)) {
          tablesBySemester.set(semester, await this.repository.getProgressTables(semester));
        }
        const table = (tablesBySemester.get(semester) ?? []).find(
          (item) => item.subject === lesson.subject
        );
        const candidates = table
          ? table.rows.filter((row) => row.assigned.includes(lesson.date))
          : [];
        const periodDigits = lesson.period.replace(/[^0-9]/g, "");
        const row =
          candidates.find(
            (item) => periodDigits && item.assigned.includes(`${lesson.date}(${periodDigits})`)
          ) ?? candidates[0];
        if (!table || !row) {
          unmatched += 1;
          continue;
        }
        const link = `[[${lesson.file.path.replace(/\.md$/i, "")}|수업일지]]`;
        if (row.note.includes(link)) {
          already += 1;
          continue;
        }
        await this.repository.appendProgressRowLink(table, row.order, "note", link);
        added += 1;
      }
      const parts = [`수업일지 ${lessons.length}건 중 ${added}건을 진도표 비고에 역링크했습니다.`];
      if (already > 0) parts.push(`이미 연결 ${already}건.`);
      if (unmatched > 0) parts.push(`배정 차시를 못 찾은 ${unmatched}건은 진도표 배정을 확인하세요.`);
      new Notice(parts.join(" "));
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "역링크 채우기에 실패했습니다.");
    }
  }

  private async resolveSlotSubject(
    semester: string,
    date: string,
    period: number
  ): Promise<string> {
    const calendar = await this.repository.getAcademicCalendar();
    if (!calendar) return "";
    const timetable = await this.repository.getBaseTimetable(semester);
    const day = resolveDay(calendar, timetable, date);
    const slot = day.periods.find((item) => item.period === period);
    return slot && !slot.unmapped ? slot.subject.trim() : "";
  }

  /** 주간 시간표 수정에 영향받은 과목들의 진도 배정을 다시 계산해 진도표에 기록한다. */
  private async reassignProgressSubjects(semester: string, subjects: string[]): Promise<number> {
    const unique = [...new Set(subjects.map((s) => s.trim()).filter(Boolean))].filter(
      (subject) => !isRemovedSubject(subject)
    );
    if (unique.length === 0) return 0;
    const calendar = await this.repository.getAcademicCalendar();
    if (!calendar) return 0;
    const range = semesterRange(calendar, semester);
    if (!range.from || !range.to) return 0;
    const timetable = await this.repository.getBaseTimetable(semester);
    if (!timetable) return 0;
    const tables = await this.repository.getProgressTables(semester);
    let issues = 0;
    for (const subject of unique) {
      const table = tables.find((item) => item.subject === subject);
      if (!table) continue;
      const slots = subjectSlots(calendar, timetable, range.from, range.to, subject);
      const assignment = assignProgress(table.rows, slots);
      await this.repository.writeProgressAssignments(table, assignment);
      issues += assignment.issues.length;
    }
    return issues;
  }

  private async timetableSemesterForDate(date: string): Promise<string | null> {
    const calendar = await this.repository.getAcademicCalendar();
    if (!calendar) return this.settings.semester;
    const semester = semesterForDate(calendar, date);
    if (!semester) {
      new Notice(`${date}는 학기 기간 밖 날짜입니다. 학사일정 노트의 학기 범위를 확인하세요.`);
      return null;
    }
    return semester;
  }

  async pinProgressRowAt(date: string, period: number, subject: string): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다.");
        return;
      }
      const semester = semesterForDate(calendar, date);
      if (!semester) {
        new Notice(`${date}는 학기 기간 밖 날짜입니다.`);
        return;
      }
      const tables = await this.repository.getProgressTables(semester);
      const table = tables.find((item) => item.subject === subject);
      if (!table) {
        new Notice(`${subject} 진도표가 없습니다. 먼저 '진도표 차시 가져오기'로 만들어 주세요.`);
        return;
      }
      new ProgressPinModal(this.app, table.rows, { date, period, subject }, (row) => {
        void (async () => {
          try {
            const unpin = row.fixedDate === date && row.fixedPeriod === period;
            await this.repository.updateProgressRowFixed(
              table,
              row.order,
              unpin ? "" : date,
              unpin ? 0 : period
            );
            const range = semesterRange(calendar, semester);
            if (range.from && range.to) {
              const timetable = await this.repository.getBaseTimetable(semester);
              if (timetable) {
                const refreshed = (await this.repository.getProgressTables(semester)).find(
                  (item) => item.subject === subject
                );
                if (refreshed) {
                  const slots = subjectSlots(calendar, timetable, range.from, range.to, subject);
                  await this.repository.writeProgressAssignments(
                    refreshed,
                    assignProgress(refreshed.rows, slots)
                  );
                }
              }
            }
            new Notice(
              unpin
                ? `${row.order}. ${row.topic} 고정을 해제했습니다.`
                : `${row.order}. ${row.topic} → ${date} ${period}교시에 고정하고 재배정했습니다.`
            );
            await this.refreshViews();
          } catch (error) {
            new Notice(error instanceof Error ? error.message : "차시 고정에 실패했습니다.");
          }
        })();
      }).open();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "차시 고정에 실패했습니다.");
    }
  }

  async saveTimetableOverride(override: TimetableOverride): Promise<void> {
    const semester = await this.timetableSemesterForDate(override.date);
    if (!semester) return;
    const before = await this.resolveSlotSubject(semester, override.date, override.period);
    const file = await this.repository.ensureBaseTimetableNote(semester);
    await this.repository.upsertTimetableOverride(file, override);
    const after = await this.resolveSlotSubject(semester, override.date, override.period);
    const issues = await this.reassignProgressSubjects(semester, [before, after]);
    const reassignNote = issues > 0 ? ` · 진도 재배정(확인 ${issues}건)` : " · 진도 재배정";
    new Notice(
      isRemovedSubject(override.subject)
        ? `${override.date} ${override.period}교시를 삭제했습니다. (${semester})${reassignNote}`
        : `${override.date} ${override.period}교시 → ${override.subject} (${semester})${reassignNote}`
    );
    await this.refreshViews();
  }

  async removeTimetableOverrideAt(date: string, period: number): Promise<void> {
    const semester = await this.timetableSemesterForDate(date);
    if (!semester) return;
    const before = await this.resolveSlotSubject(semester, date, period);
    const file = await this.repository.ensureBaseTimetableNote(semester);
    await this.repository.removeTimetableOverride(file, date, period);
    const after = await this.resolveSlotSubject(semester, date, period);
    const issues = await this.reassignProgressSubjects(semester, [before, after]);
    const reassignNote = issues > 0 ? ` · 진도 재배정(확인 ${issues}건)` : " · 진도 재배정";
    new Notice(`${date} ${period}교시 변경을 제거했습니다. (${semester})${reassignNote}`);
    await this.refreshViews();
  }

  async runProgressAssignment(): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다. `학사일정 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const timetable = await this.repository.getBaseTimetable(this.settings.semester);
      if (!timetable) {
        new Notice("기초시간표 노트가 필요합니다. `기초시간표 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const tables = await this.repository.getProgressTables(this.settings.semester);
      if (tables.length === 0) {
        new Notice("진도표가 없습니다. `진도표 차시 가져오기`로 차시를 입력하세요.");
        return;
      }
      const range = semesterRange(calendar, this.settings.semester);
      if (!range.from || !range.to) {
        new Notice("학사일정 노트의 학기 시작·종료일을 확인하세요.");
        return;
      }
      // 수백 행을 다시 쓰므로 변경 전 원본을 자동 스냅숏으로 남긴다 (UIUX §5).
      await createTargetedSnapshot(
        this.app,
        this.repository,
        this.settings,
        tables.map((table) => table.file),
        "진도 자동 배정"
      );
      const issues: string[] = [];
      for (const table of tables) {
        const slots = subjectSlots(calendar, timetable, range.from, range.to, table.subject);
        const assignment = assignProgress(table.rows, slots);
        await this.repository.writeProgressAssignments(table, assignment);
        issues.push(...assignment.issues.map((issue) => `${table.subject}: ${issue}`));
      }
      new Notice(
        issues.length > 0
          ? `${this.settings.semester} 진도 배정 완료 · 변경 전 스냅숏 저장. 확인할 항목 ${issues.length}건은 각 진도표의 배정 열을 확인하세요.`
          : `${this.settings.semester} 진도표 ${tables.length}개의 배정을 완료했습니다 · 변경 전 스냅숏 저장.`
      );
      await this.refreshViews();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "진도 배정에 실패했습니다.");
    }
  }

  async generateWeeklyPlan(weekStart?: string): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다. `학사일정 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const timetables: Record<string, BaseTimetable | null> = {
        "1학기": await this.repository.getBaseTimetable("1학기"),
        "2학기": await this.repository.getBaseTimetable("2학기")
      };
      if (!timetables["1학기"] && !timetables["2학기"]) {
        new Notice("기초시간표 노트가 필요합니다. `기초시간표 노트 열기`를 먼저 실행하세요.");
        return;
      }
      const monday = weekStart ?? mondayOf(localDate());
      const days = [0, 1, 2, 3, 4].map((offset) => {
        const date = addDays(monday, offset);
        const semester = semesterForDate(calendar, date);
        return resolveDay(calendar, semester ? timetables[semester] ?? null : null, date);
      });
      const tablesBySemester: Record<string, ProgressTable[]> = {
        "1학기": await this.repository.getProgressTables("1학기"),
        "2학기": await this.repository.getProgressTables("2학기")
      };
      const contents = buildAssignedSlotContents(calendar, timetables, tablesBySemester);
      const weekSemester =
        days.map((day) => semesterForDate(calendar, day.date)).find(Boolean) ??
        this.settings.semester;
      const weekEnd = days[days.length - 1]?.date ?? monday;
      const notices = this.repository
        .getNoticeSummaries()
        .filter((notice) => notice.dueDate && notice.dueDate >= monday && notice.dueDate <= weekEnd)
        .map((notice) => `${notice.title} — 회신 마감 ${notice.dueDate}`);
      const morningActivities = (await this.repository.getRoutineTemplates())
        .filter((template) => template.frequency === "daily")
        .map((template) => template.title);
      const markdown = buildWeeklyPlanMarkdown({
        className: this.settings.className,
        schoolYear: this.settings.schoolYear,
        semester: weekSemester,
        weekStart: monday,
        weekEnd,
        days: buildWeeklyPlanDays(days, (date, period) => contents.get(`${date}|${period}`)),
        notices,
        morningActivities
      });
      const file = await this.repository.createWeeklyPlanNote(monday, markdown);
      new Notice(`${monday} 주간학습안내를 생성했습니다.`);
      await this.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "주간학습안내 생성에 실패했습니다.");
    }
  }

  openCurriculumUnitModal(existing?: CurriculumUnit): void {
    if (!this.canWriteActiveClass()) return;
    new CurriculumUnitModal(this.app, this.settings, async (unit, current) => {
      if (current) await this.repository.updateCurriculumUnit(current.file, unit);
      else await this.repository.createCurriculumUnit(unit);
      this.activityIndex.invalidate();
      new Notice(`${unit.subject} ${unit.unitName} 단원 설계를 저장했습니다.`);
      await this.refreshViews();
    }, existing).open();
  }

  openCurriculumLessonModal(
    unit: CurriculumUnit | null,
    existing?: CurriculumLesson,
    options?: {
      prefill?: Partial<NewCurriculumLesson>;
      afterCreate?: (created: CurriculumLesson) => Promise<void>;
    }
  ): void {
    if (!this.canWriteActiveClass()) return;
    const units = this.repository.getCurriculumUnits();
    new CurriculumLessonModal(this.app, unit, units, async (lesson, current) => {
      if (current) {
        await this.repository.updateCurriculumLesson(current.file, lesson);
      } else {
        const created = await this.repository.createCurriculumLesson(lesson);
        if (options?.afterCreate) await options.afterCreate(created);
      }
      // 연결된 단원(변경 전·후 모두)의 실시 시수를 갱신한다.
      await this.refreshUnitProgress(lesson.unitId);
      if (current && current.unitId && current.unitId !== lesson.unitId) {
        await this.refreshUnitProgress(current.unitId);
      }
      this.activityIndex.invalidate();
      new Notice(`${lesson.date} ${lesson.subject} 수업일지를 저장했습니다.`);
      await this.refreshViews();
    }, existing, options?.prefill).open();
  }

  /** 단원 연계 과제를 그 날짜에 배정된 해당 과목 진도표 행의 과제(평가) 칸에 링크한다. */
  private async linkAssignmentToProgress(
    date: string,
    title: string,
    unitLink: CurriculumUnitLink | null,
    file: TFile
  ): Promise<void> {
    if (!unitLink || !date) return;
    try {
      const unit = this.repository.getCurriculumUnits().find((item) => item.id === unitLink.id);
      if (!unit) return;
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) return;
      const semester = semesterForDate(calendar, date);
      if (!semester) return;
      const tables = await this.repository.getProgressTables(semester);
      const table = tables.find((item) => item.subject === unit.subject);
      if (!table) return;
      const link = `[[${file.path.replace(/\.md$/i, "")}|${title}]]`;
      for (const row of table.rows) {
        if (!row.assigned.includes(date)) continue;
        await this.repository.appendProgressRowLink(table, row.order, "assignmentLink", link);
      }
    } catch {
      // 진도표 기입 실패는 과제 저장을 막지 않는다.
    }
  }

  /** 이 교시의 학생부 근거 기록 흐름 — 학생 선택 후 날짜·단원·수업일지가 채워진 모달을 연다. */
  async recordEvidenceAt(date: string, period: number): Promise<void> {
    try {
      const students = this.repository.getStudents();
      if (!students.length) {
        new Notice("먼저 학생을 추가해 주세요.");
        return;
      }
      const lesson = this.findLessonAt(date, period);
      const calendar = await this.repository.getAcademicCalendar();
      const semester = calendar ? semesterForDate(calendar, date) : "";
      const timetable = semester ? await this.repository.getBaseTimetable(semester) : null;
      const resolved = calendar && timetable
        ? resolveDay(calendar, timetable, date).periods.find((item) => item.period === period)
        : undefined;
      const subject = resolved?.subject.trim() ?? lesson?.subject ?? "";
      const units = this.repository.getCurriculumUnits();
      const unit =
        units.find((item) => item.id === lesson?.unitId) ??
        (() => {
          const candidates = units.filter((item) =>
            item.subject === subject &&
            item.startDate && item.endDate && item.startDate <= date && date <= item.endDate
          );
          return candidates.length === 1 ? candidates[0] : undefined;
        })();
      new StudentSuggestModal(
        this.app,
        students,
        (student) => this.openSchoolRecordEvidenceModal(
          student,
          date,
          "subject-development",
          unit,
          lesson
        ),
        `${date} ${period}교시${subject ? `(${subject})` : ""} 근거를 기록할 학생을 검색하세요`
      ).open();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "근거 기록을 열지 못했습니다.");
    }
  }

  /** 수업일지를 날짜·교시로 찾는다 (교시 문자열은 "3교시" 형태에서 숫자만 비교). */
  findLessonAt(date: string, period: number): CurriculumLesson | undefined {
    return this.repository.getCurriculumLessons().find(
      (lesson) =>
        lesson.date === date && Number.parseInt(lesson.period, 10) === period
    );
  }

  /**
   * 이 교시의 수업 기록(허브 노트)을 연다 — 있으면 노트를 열고,
   * 없으면 진도 맥락을 미리 채운 수업 기록 모달을 연다. 단원 연계는 선택.
   */
  async recordLessonAt(date: string, period: number): Promise<void> {
    try {
      const existing = this.findLessonAt(date, period);
      if (existing) {
        await this.openFile(existing.file);
        return;
      }
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다.");
        return;
      }
      const semester = semesterForDate(calendar, date);
      const timetable = semester ? await this.repository.getBaseTimetable(semester) : null;
      if (!semester || !timetable) {
        new Notice("해당 날짜 학기의 기초시간표가 필요합니다.");
        return;
      }
      const day = resolveDay(calendar, timetable, date);
      const resolved = day.periods.find((item) => item.period === period);
      const subject = resolved?.subject.trim() ?? "";
      if (!subject) {
        new Notice("이 교시에는 과목이 없습니다.");
        return;
      }
      const tables = await this.repository.getProgressTables(semester);
      const table = tables.find((item) => item.subject === subject);
      const contents = buildAssignedSlotContents(
        calendar,
        { [semester]: timetable },
        { [semester]: tables }
      );
      const row = contents.get(`${date}|${period}`);

      // 과목·기간이 맞는 단원이 하나로 좁혀지면 미리 연결해 준다(모달에서 바꿀 수 있음).
      const candidates = this.repository
        .getCurriculumUnits()
        .filter((unit) => unit.subject === subject);
      const dated = candidates.filter(
        (unit) => unit.startDate && unit.endDate && unit.startDate <= date && date <= unit.endDate
      );
      const preselect = dated.length === 1
        ? dated[0]
        : candidates.length === 1
          ? candidates[0]
          : null;

      this.openCurriculumLessonModal(preselect ?? null, undefined, {
        prefill: {
          date,
          period: `${period}교시`,
          subject,
          hours: row?.hours ?? 1,
          objective: row?.topic ?? "",
          activities: row ? [row.unit, row.topic].filter(Boolean).join(" · ") : ""
        },
        afterCreate: async (created) => {
          if (table && row) {
            await this.repository.appendProgressRowLink(
              table,
              row.order,
              "note",
              `[[${created.file.path.replace(/\.md$/i, "")}|수업일지]]`
            );
          }
        }
      });
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "수업일지를 열지 못했습니다.");
    }
  }

  async openEventNote(event: SchoolEvent): Promise<void> {
    try {
      const file = await this.repository.ensureEventNote(event);
      await this.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "행사 노트를 열지 못했습니다.");
    }
  }

  async createBasesViews(): Promise<void> {
    try {
      const created = await this.repository.ensureBasesViews();
      new Notice(
        created.length > 0
          ? `Bases 보기 ${created.length}개를 만들었습니다: ${created.join(", ")}`
          : "Bases 보기가 이미 모두 있습니다."
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "Bases 보기 생성에 실패했습니다.");
    }
  }

  async createAllEventNotes(): Promise<void> {
    try {
      const calendar = await this.repository.getAcademicCalendar();
      if (!calendar) {
        new Notice("학사일정 노트가 필요합니다.");
        return;
      }
      const created = await this.repository.ensureAllEventNotes(calendar.events);
      new Notice(
        created.length > 0
          ? `행사 노트 ${created.length}개를 만들었습니다. (전체 ${calendar.events.length}개)`
          : `행사 노트가 이미 모두 있습니다. (${calendar.events.length}개)`
      );
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "행사 노트 생성에 실패했습니다.");
    }
  }

  /** 실행 완료 수업일지 합계로 단원의 실시 시수(taughtHours)를 갱신한다 — 단원 노트 1개만 쓴다. */
  async refreshUnitProgress(unitId: string): Promise<void> {
    if (!unitId) return;
    try {
      const unit = this.repository.getCurriculumUnits().find((item) => item.id === unitId);
      if (!unit) return;
      const total = taughtHoursForUnit(unitId, this.repository.getCurriculumLessons());
      await this.app.fileManager.processFrontMatter(unit.file, (frontmatter) => {
        frontmatter.taughtHours = total;
      });
    } catch {
      // 진행률 갱신 실패는 수업일지 저장을 막지 않는다.
    }
  }

  /** 어제 이전의 수업 기록에 recordStatus: raw를 스탬프한다. 한 번 raw가 되면 다시 쓰지 않는다. */
  async stampRawLessonRecords(): Promise<void> {
    try {
      const today = localDate();
      const targets = this.repository
        .getCurriculumLessons()
        .filter((lesson) => lesson.date && lesson.date < today && !lesson.recordStatus);
      for (const lesson of targets) {
        await this.app.fileManager.processFrontMatter(lesson.file, (frontmatter) => {
          if (!frontmatter.recordStatus) frontmatter.recordStatus = "raw";
        });
      }
      if (targets.length > 0) {
        new Notice(`지난 수업일지 ${targets.length}건을 RAW로 확정했습니다.`);
      }
    } catch {
      // 스탬프 실패는 다음 로드에서 재시도된다.
    }
  }

  openCurriculumEvidenceFlow(unit: CurriculumUnit, lesson?: CurriculumLesson): void {
    if (!this.canWriteActiveClass()) return;
    const students = this.repository.getStudents();
    if (!students.length) {
      new Notice("먼저 학생을 추가해 주세요.");
      return;
    }
    new StudentSuggestModal(
      this.app,
      students,
      (student) => this.openSchoolRecordEvidenceModal(
        student,
        lesson?.date,
        "subject-development",
        unit,
        lesson
      ),
      `${unit.unitName}의 평가·관찰 근거를 기록할 학생을 검색하세요`
    ).open();
  }

  async openTasks(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(TASK_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: TASK_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  openTaskModal(initialDueDate = ""): void {
    if (!this.canWriteActiveClass()) return;
    new TaskModal(this.app, this.repository.getStudents(), async (task) => {
      await this.repository.createTask(task);
      this.activityIndex.invalidate();
      new Notice(`${task.title} 할 일을 수집했습니다.`);
      await this.refreshViews();
    }, initialDueDate).open();
  }

  openNoticeFlow(initialDate?: string): void {
    if (!this.canWriteActiveClass()) return;
    const students = this.repository.getStudents();
    if (students.length === 0) {
      new Notice("먼저 학생을 추가해 주세요.");
      return;
    }
    const notices = this.repository.getNoticeSummaries();
    if (notices.length === 0) {
      this.openNoticeModal(students, undefined, initialDate);
      return;
    }
    new NoticePickerModal(this.app, notices, (choice) => {
      if (choice.kind === "new") {
        this.openNoticeModal(students, undefined, initialDate);
        return;
      }
      void this.repository.loadNotice(choice.summary)
        .then((sheet) => this.openNoticeModal(students, sheet))
        .catch((error: unknown) =>
          new Notice(error instanceof Error ? error.message : "회신표를 불러오지 못했습니다.")
        );
    }).open();
  }

  async openRoutines(date?: string): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(ROUTINE_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: ROUTINE_VIEW_TYPE, active: true });
    if (date && leaf.view instanceof RoutineView) await leaf.view.setDate(date);
    await this.app.workspace.revealLeaf(leaf);
  }

  async openReports(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(REPORT_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) await leaf.setViewState({ type: REPORT_VIEW_TYPE, active: true });
    await this.app.workspace.revealLeaf(leaf);
  }

  openAiSetup(): void {
    new AiSetupModal(this).open();
  }

  async openDataManagement(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(DATA_MANAGEMENT_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) {
      await leaf.setViewState({ type: DATA_MANAGEMENT_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async openMaintenance(): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(MAINTENANCE_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) {
      await leaf.setViewState({ type: MAINTENANCE_VIEW_TYPE, active: true });
    }
    await this.app.workspace.revealLeaf(leaf);
  }

  async refreshAllViews(): Promise<void> {
    await this.refreshViews();
  }

  openStudentTimelineFlow(): void {
    const students = this.repository.getStudents();
    if (students.length === 0) {
      new Notice("먼저 학생을 추가해 주세요.");
      return;
    }

    new StudentSuggestModal(
      this.app,
      students,
      (student) => void this.openStudentTimeline(student),
      "타임라인을 열 학생을 검색하세요"
    ).open();
  }

  async openStudentTimeline(student: StudentEntry): Promise<void> {
    const existing = this.app.workspace.getLeavesOfType(STUDENT_TIMELINE_VIEW_TYPE)[0];
    const leaf = existing ?? this.app.workspace.getLeaf(true);
    if (!existing) {
      await leaf.setViewState({ type: STUDENT_TIMELINE_VIEW_TYPE, active: true });
    }
    const view = leaf.view;
    if (view instanceof StudentTimelineView) await view.setStudent(student);
    await this.app.workspace.revealLeaf(leaf);
  }

  async openFile(file: TFile): Promise<void> {
    await this.app.workspace.getLeaf(false).openFile(file);
  }

  private openRecordModal(student: StudentEntry, initialDate?: string): void {
    new RecordModal(this.app, student, async (record) => {
      await this.repository.createRecord(student, record);
      new Notice(`${student.number}번 ${student.name} 학생 기록을 저장했습니다.`);
      await this.refreshDashboard();
    }, initialDate).open();
  }

  private openSchoolRecordEvidenceModal(
    student: StudentEntry,
    initialDate?: string,
    initialArea: SchoolRecordArea = "creative-activities",
    initialUnit?: CurriculumUnit,
    initialLesson?: CurriculumLesson
  ): void {
    new SchoolRecordEvidenceModal(
      this.app,
      student,
      this.settings,
      async (record) => {
        await this.repository.createRecord(student, record);
        this.activityIndex.invalidate();
        new Notice(`${student.number}번 ${student.name} 학생부 근거를 저장했습니다 (RAW).`);
        await this.refreshViews();
      },
      initialDate,
      initialArea,
      undefined,
      this.repository.getCurriculumUnits(),
      this.repository.getCurriculumLessons(),
      initialUnit,
      initialLesson
    ).open();
  }

  private openAssignmentModal(
    students: StudentEntry[],
    existing?: AssignmentSheet,
    initialDate?: string
  ): void {
    new AssignmentModal(
      this.app,
      students,
      existing,
      this.repository.getCurriculumUnits(),
      async (date, title, marks, unitLink, existingFile) => {
        const file = await this.repository.saveAssignment(date, title, marks, unitLink, existingFile);
        await this.linkAssignmentToProgress(date, title, unitLink, file);
        new Notice(
          `${title} 과제 체크를 저장했습니다.${unitLink ? ` (단원 연계: ${unitLink.title})` : ""}`
        );
        await this.refreshDashboard();
      },
      initialDate
    ).open();
  }

  private openNoticeModal(
    students: StudentEntry[],
    existing?: NoticeSheet,
    initialDate?: string
  ): void {
    new NoticeModal(
      this.app,
      students,
      existing,
      async (sentDate, dueDate, title, marks, existingFile) => {
        await this.repository.saveNotice(sentDate, dueDate, title, marks, existingFile);
        this.activityIndex.invalidate();
        new Notice(`${title} 회신표를 저장했습니다.`);
        await this.refreshViews();
      },
      initialDate
    ).open();
  }

  private async refreshDashboard(): Promise<void> {
    const views = this.app.workspace
      .getLeavesOfType(DASHBOARD_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is ClassDashboardView => view instanceof ClassDashboardView);

    await Promise.all(views.map((view) => view.refresh()));
  }

  private async refreshViews(): Promise<void> {
    await this.refreshDashboard();
    const activityViews = this.app.workspace
      .getLeavesOfType(ACTIVITY_LIST_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is ActivityListView => view instanceof ActivityListView);
    const timelineViews = this.app.workspace
      .getLeavesOfType(STUDENT_TIMELINE_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is StudentTimelineView => view instanceof StudentTimelineView);
    const calendarViews = this.app.workspace
      .getLeavesOfType(CALENDAR_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is ClassCalendarView => view instanceof ClassCalendarView);
    const ganttViews = this.app.workspace
      .getLeavesOfType(CURRICULUM_GANTT_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is CurriculumGanttView => view instanceof CurriculumGanttView);
    for (const view of ganttViews) await view.refresh();
    const taskViews = this.app.workspace
      .getLeavesOfType(TASK_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is TaskView => view instanceof TaskView);
    const routineViews = this.app.workspace
      .getLeavesOfType(ROUTINE_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is RoutineView => view instanceof RoutineView);
    const curriculumViews = this.app.workspace
      .getLeavesOfType(CURRICULUM_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is CurriculumView => view instanceof CurriculumView);
    const reportViews = this.app.workspace
      .getLeavesOfType(REPORT_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is ReportView => view instanceof ReportView);
    const dataViews = this.app.workspace
      .getLeavesOfType(DATA_MANAGEMENT_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is DataManagementView => view instanceof DataManagementView);
    const maintenanceViews = this.app.workspace
      .getLeavesOfType(MAINTENANCE_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is MaintenanceView => view instanceof MaintenanceView);
    const opsViews = this.app.workspace
      .getLeavesOfType(CURRICULUM_OPS_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is CurriculumOpsView => view instanceof CurriculumOpsView);
    const todayViews = this.app.workspace
      .getLeavesOfType(TODAY_VIEW_TYPE)
      .map((leaf) => leaf.view)
      .filter((view): view is TodayView => view instanceof TodayView);
    const inspectorViews = [
      ...this.app.workspace.getLeavesOfType(STUDENT_INSPECTOR_VIEW_TYPE),
      ...this.app.workspace.getLeavesOfType(LESSON_INSPECTOR_VIEW_TYPE)
    ]
      .map((leaf) => leaf.view)
      .filter(
        (view): view is StudentInspectorView | LessonInspectorView =>
          view instanceof StudentInspectorView || view instanceof LessonInspectorView
      );
    await Promise.all([
      ...todayViews.map((view) => view.refresh()),
      ...inspectorViews.map((view) => view.refresh()),
      ...opsViews.map((view) => view.refresh()),
      ...activityViews.map((view) => view.refresh()),
      ...timelineViews.map((view) => view.refresh()),
      ...calendarViews.map((view) => view.refresh()),
      ...taskViews.map((view) => view.refresh()),
      ...routineViews.map((view) => view.refresh()),
      ...curriculumViews.map((view) => view.refresh()),
      ...reportViews.map((view) => view.refresh()),
      ...dataViews.map((view) => view.refresh()),
      ...maintenanceViews.map((view) => view.refresh())
    ]);
  }
}
