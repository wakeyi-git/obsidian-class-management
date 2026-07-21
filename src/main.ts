import { Notice, Plugin, TFile } from "obsidian";
import { EMPTY_ACTIVITY_FILTERS } from "./activity";
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
import { defaultSubjectsForGrade } from "./school-record-evidence";
import { ClassManagementSettingTab } from "./settings-tab";
import {
  StudentTimelineView,
  STUDENT_TIMELINE_VIEW_TYPE
} from "./student-timeline-view";
import { TaskModal } from "./task-modal";
import { TaskView, TASK_VIEW_TYPE } from "./task-view";
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
  StudentEntry
} from "./types";

const DEFAULT_CLASS_ID = "default-class";
const DEFAULT_SCHOOL_YEAR = String(new Date().getFullYear());
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
  recordsFolder: "기록",
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
  schemaVersion: 12,
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
      name: "학교생활기록부 근거 기록",
      callback: () => this.openSchoolRecordEvidenceFlow()
    });
    this.addCommand({
      id: "add-school-record-evidence-batch",
      name: "학교생활기록부 근거 학급 일괄 입력",
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
      name: "학급 통합 목록 열기",
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
      name: "교육과정-수업-평가-기록 열기",
      callback: () => void this.openCurriculum()
    });
    this.addCommand({
      id: "create-curriculum-unit",
      name: "새 통합 단원 설계",
      callback: () => this.openCurriculumUnitModal()
    });
    this.addCommand({
      id: "open-reports",
      name: "분석과 보고서 열기",
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
      callback: () => new ClassProfileModal(this).open()
    });
    this.addCommand({
      id: "open-data-management",
      name: "학급·데이터 관리 열기",
      callback: () => void this.openDataManagement()
    });
    this.addCommand({
      id: "open-maintenance",
      name: "백업·복구·마이그레이션 열기",
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
      savedActivityViews: loaded?.savedActivityViews ?? []
    };
    this.settings.schemaVersion = 12;
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
        new Notice(`학생부 RAW 근거 ${records.length}건을 일괄 저장했습니다.`);
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

  openCurriculumUnitModal(existing?: CurriculumUnit): void {
    if (!this.canWriteActiveClass()) return;
    new CurriculumUnitModal(this.app, this.settings, async (unit, current) => {
      if (current) await this.repository.updateCurriculumUnit(current.file, unit);
      else await this.repository.createCurriculumUnit(unit);
      this.activityIndex.invalidate();
      new Notice(`${unit.subject} ${unit.unitName} 통합 설계를 저장했습니다.`);
      await this.refreshViews();
    }, existing).open();
  }

  openCurriculumLessonModal(unit: CurriculumUnit, existing?: CurriculumLesson): void {
    if (!this.canWriteActiveClass()) return;
    new CurriculumLessonModal(this.app, unit, async (lesson, current) => {
      if (current) await this.repository.updateCurriculumLesson(current.file, lesson);
      else await this.repository.createCurriculumLesson(lesson);
      this.activityIndex.invalidate();
      new Notice(`${unit.unitName} ${lesson.sequence}차시 기록을 저장했습니다.`);
      await this.refreshViews();
    }, existing).open();
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
        new Notice(`${student.number}번 ${student.name} 학생부 RAW 근거를 저장했습니다.`);
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
      async (date, title, marks, existingFile) => {
        await this.repository.saveAssignment(date, title, marks, existingFile);
        new Notice(`${title} 과제 체크를 저장했습니다.`);
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
    await Promise.all([
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
