import { Notice, Plugin, TFile, type ItemView, type TAbstractFile, type WorkspaceLeaf } from "obsidian";
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
import { CurriculumFlows } from "./curriculum-flows";
import { registerCommands } from "./commands";
import {
  ACTIVITY_INDEX_CATEGORIES,
  classifyVaultPath,
  type VaultChangeCategory
} from "@core/change-scope";
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
import type { NewCurriculumLesson, SchoolEvent } from "@core/types";
import type {
  ActivityListFilters,
  ActivityColumn,
  AssignmentSheet,
  ClassProfile,
  ClassManagementSettings,
  CurriculumLesson,
  CurriculumUnit,
  NoticeSheet,
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

/** 활동 색인을 쓰는 뷰의 공통 의존 — 색인 원천 7범주 + 학생 명단. */
const INDEX_VIEW_DEPS: ReadonlyArray<VaultChangeCategory> = ["student", ...ACTIVITY_INDEX_CATEGORIES];

/**
 * 뷰 등록과 볼트 변경 갱신의 단일 원본 — 갱신 대상 여부는 뷰의 refresh() 유무로 정해진다.
 * dependsOn이 있으면 그 범주의 변경에만 다시 그린다(§7 부분 갱신 2단계).
 * 없으면 항상 다시 그린다 — 오늘·대시보드·인스펙터처럼 교차 도메인 콕핏은 넓게 두는 것이 안전.
 */
const MANAGED_VIEWS: ReadonlyArray<{
  type: string;
  create: (leaf: WorkspaceLeaf, plugin: ClassManagementPlugin) => ItemView;
  dependsOn?: ReadonlyArray<VaultChangeCategory>;
}> = [
  { type: DASHBOARD_VIEW_TYPE, create: (leaf, plugin) => new ClassDashboardView(leaf, plugin) },
  {
    type: ACTIVITY_LIST_VIEW_TYPE,
    create: (leaf, plugin) => new ActivityListView(leaf, plugin),
    dependsOn: INDEX_VIEW_DEPS
  },
  {
    type: STUDENT_TIMELINE_VIEW_TYPE,
    create: (leaf, plugin) => new StudentTimelineView(leaf, plugin),
    dependsOn: INDEX_VIEW_DEPS
  },
  {
    type: CALENDAR_VIEW_TYPE,
    create: (leaf, plugin) => new ClassCalendarView(leaf, plugin),
    dependsOn: [...INDEX_VIEW_DEPS, "calendar-hours", "school-event"]
  },
  {
    type: TASK_VIEW_TYPE,
    create: (leaf, plugin) => new TaskView(leaf, plugin),
    dependsOn: ["task", "notice", "student"]
  },
  {
    type: ROUTINE_VIEW_TYPE,
    create: (leaf, plugin) => new RoutineView(leaf, plugin),
    dependsOn: ["routine", "calendar-hours"]
  },
  {
    type: CURRICULUM_VIEW_TYPE,
    create: (leaf, plugin) => new CurriculumView(leaf, plugin),
    dependsOn: ["curriculum-unit", "curriculum-lesson", "assignment", "record", "progress"]
  },
  {
    type: CURRICULUM_OPS_VIEW_TYPE,
    create: (leaf, plugin) => new CurriculumOpsView(leaf, plugin),
    dependsOn: ["calendar-hours", "timetable", "progress"]
  },
  {
    type: CURRICULUM_GANTT_VIEW_TYPE,
    create: (leaf, plugin) => new CurriculumGanttView(leaf, plugin),
    dependsOn: ["curriculum-unit", "assignment", "school-event", "calendar-hours", "progress"]
  },
  { type: NAVIGATOR_VIEW_TYPE, create: (leaf, plugin) => new NavigatorView(leaf, plugin) },
  { type: TODAY_VIEW_TYPE, create: (leaf, plugin) => new TodayView(leaf, plugin) },
  { type: STUDENT_INSPECTOR_VIEW_TYPE, create: (leaf, plugin) => new StudentInspectorView(leaf, plugin) },
  { type: LESSON_INSPECTOR_VIEW_TYPE, create: (leaf, plugin) => new LessonInspectorView(leaf, plugin) },
  { type: REPORT_VIEW_TYPE, create: (leaf, plugin) => new ReportView(leaf, plugin) },
  { type: DATA_MANAGEMENT_VIEW_TYPE, create: (leaf, plugin) => new DataManagementView(leaf, plugin) },
  { type: MAINTENANCE_VIEW_TYPE, create: (leaf, plugin) => new MaintenanceView(leaf, plugin) }
];

export default class ClassManagementPlugin extends Plugin {
  settings: ClassManagementSettings = DEFAULT_SETTINGS;
  repository = new ClassRepository(this.app, () => this.settings);
  activityIndex = new ActivityIndex(this.app, this.repository);
  flows = new CurriculumFlows(this);

  async onload(): Promise<void> {
    await this.loadSettings();

    for (const spec of MANAGED_VIEWS) {
      this.registerView(spec.type, (leaf) => spec.create(leaf, this));
    }
    this.app.workspace.onLayoutReady(() => {
      if (this.app.workspace.getLeavesOfType(NAVIGATOR_VIEW_TYPE).length === 0) {
        void this.openNavigator();
      }
      if (this.app.workspace.getLeavesOfType(TODAY_VIEW_TYPE).length === 0) {
        void this.openToday();
      }
      const startupTimers = [
        // 날짜가 지난 수업 기록에 raw를 스탬프한다(이후 플러그인은 건드리지 않음).
        window.setTimeout(() => void this.flows.stampRawLessonRecords(), 2000),
        // 학기 경계를 지나면 설정 전환을 제안한다(자동 변경은 하지 않음).
        window.setTimeout(() => void this.flows.suggestSemesterSwitch(), 2600),
        // 1.30.0 폴더 직관화 이후 구 이름 폴더가 남아 있으면 이행 안내(자동 이동은 하지 않음).
        window.setTimeout(() => this.flows.warnLegacyFolders(), 3200)
      ];
      this.register(() => startupTimers.forEach((id) => window.clearTimeout(id)));
    });

    this.addRibbonIcon("school", "학급 대시보드", () => void this.openDashboard());

    registerCommands(this);

    this.addSettingTab(new ClassManagementSettingTab(this.app, this));

    let refreshTimer: number | undefined;
    let pendingCategories = new Set<VaultChangeCategory>();
    // 변경 경로를 범주로 분류해 영향 뷰만 갱신한다 — 기본 폴더 밖 변경은 무시(§7 부분 갱신 2단계).
    const scheduleRefresh = (changed: TAbstractFile, oldPath?: string) => {
      const folders = this.repository.managedFolders();
      const categories = [changed.path, oldPath ?? ""]
        .filter(Boolean)
        .map((path) => classifyVaultPath(path, folders))
        .filter((category): category is VaultChangeCategory => category !== null);
      if (categories.length === 0) return;
      categories.forEach((category) => pendingCategories.add(category));
      if (categories.some((category) => ACTIVITY_INDEX_CATEGORIES.includes(category))) {
        this.activityIndex.invalidate();
      }
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        const flush = pendingCategories;
        pendingCategories = new Set();
        void this.refreshViews(flush);
      }, 120);
    };
    this.register(() => {
      if (refreshTimer !== undefined) window.clearTimeout(refreshTimer);
    });
    this.registerEvent(this.app.vault.on("create", (file) => scheduleRefresh(file)));
    this.registerEvent(this.app.vault.on("delete", (file) => scheduleRefresh(file)));
    this.registerEvent(this.app.vault.on("rename", (file, oldPath) => scheduleRefresh(file, oldPath)));
    this.registerEvent(this.app.metadataCache.on("changed", (file) => scheduleRefresh(file)));
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
      initialUnit,
      this.repository.getAchievementStandards()
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

  // ── 도메인 플로 위임 — 본문은 CurriculumFlows(./curriculum-flows.ts, §7 main 분해 2단계) ──

  scaffoldRegularUnits(
    semester: string,
    subjects: string[]
  ): Promise<{ created: string[]; skipped: string[] }> {
    return this.flows.scaffoldRegularUnits(semester, subjects);
  }

  importAssessmentPlan(
    subject: string,
    semester: string,
    items: Array<{ timing: string; unit: string; element: string; criteria: string; method: string }>
  ): Promise<{ created: number; skipped: number; issues: string[] }> {
    return this.flows.importAssessmentPlan(subject, semester, items);
  }

  pinProgressRowAt(date: string, period: number, subject: string): Promise<void> {
    return this.flows.pinProgressRowAt(date, period, subject);
  }

  saveTimetableOverride(override: TimetableOverride): Promise<void> {
    return this.flows.saveTimetableOverride(override);
  }

  removeTimetableOverrideAt(date: string, period: number): Promise<void> {
    return this.flows.removeTimetableOverrideAt(date, period);
  }

  runProgressAssignment(): Promise<void> {
    return this.flows.runProgressAssignment();
  }

  generateWeeklyPlan(weekStart?: string): Promise<void> {
    return this.flows.generateWeeklyPlan(weekStart);
  }

  recordEvidenceAt(date: string, period: number): Promise<void> {
    return this.flows.recordEvidenceAt(date, period);
  }

  findLessonAt(date: string, period: number): CurriculumLesson | undefined {
    return this.flows.findLessonAt(date, period);
  }

  recordLessonAt(date: string, period: number): Promise<void> {
    return this.flows.recordLessonAt(date, period);
  }

  openCurriculumUnitModal(existing?: CurriculumUnit): void {
    if (!this.canWriteActiveClass()) return;
    const standards = this.repository.getAchievementStandards();
    new CurriculumUnitModal(this.app, this.settings, async (unit, current) => {
      if (current) await this.repository.updateCurriculumUnit(current.file, unit);
      else await this.repository.createCurriculumUnit(unit);
      this.activityIndex.invalidate();
      new Notice(`${unit.subject} ${unit.unitName} 단원 설계를 저장했습니다.`);
      await this.refreshViews();
    }, existing, standards).open();
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
      await this.flows.refreshUnitProgress(lesson.unitId);
      if (current && current.unitId && current.unitId !== lesson.unitId) {
        await this.flows.refreshUnitProgress(current.unitId);
      }
      this.activityIndex.invalidate();
      new Notice(`${lesson.date} ${lesson.subject} 수업일지를 저장했습니다.`);
      await this.refreshViews();
    }, existing, options?.prefill).open();
  }

  async openEventNote(event: SchoolEvent): Promise<void> {
    try {
      const file = await this.repository.ensureEventNote(event);
      await this.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "행사 노트를 열지 못했습니다.");
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

  openSchoolRecordEvidenceModal(
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
      initialLesson,
      this.repository.getAchievementStandards()
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
        await this.flows.linkAssignmentToProgress(date, title, unitLink, file);
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

  /**
   * 레지스트리의 열린 뷰 중 refresh()를 가진 것만 다시 그린다(내비게이터는 자체 이벤트로 갱신).
   * categories가 있으면 dependsOn이 겹치는 뷰(또는 광역 뷰)만 — 없으면 전부(명령 플로의 명시 갱신).
   */
  private async refreshViews(categories?: ReadonlySet<VaultChangeCategory>): Promise<void> {
    const views = MANAGED_VIEWS.filter(
      (spec) =>
        !categories ||
        !spec.dependsOn ||
        spec.dependsOn.some((category) => categories.has(category))
    ).flatMap((spec) =>
      this.app.workspace.getLeavesOfType(spec.type).map((leaf) => leaf.view)
    ).filter(
      (view): view is ItemView & { refresh(): Promise<void> } =>
        typeof (view as { refresh?: unknown }).refresh === "function"
    );
    await Promise.all(views.map((view) => view.refresh()));
  }
}
