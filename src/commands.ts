import type ClassManagementPlugin from "./main";

/** 명령 팔레트 45개 — 진입점의 백업 경로(UX-FLOWS §4). 본문은 플러그인·플로 메서드에 위임한다. */
export function registerCommands(plugin: ClassManagementPlugin): void {
  plugin.addCommand({
    id: "open-dashboard",
    name: "학급 대시보드 열기",
    callback: () => void plugin.openDashboard()
  });
  plugin.addCommand({
    id: "open-navigator",
    name: "학급 메뉴 열기 (왼쪽 패널)",
    callback: () => void plugin.openNavigator()
  });
  plugin.addCommand({
    id: "open-today",
    name: "오늘 패널 열기 (오른쪽 패널)",
    callback: () => void plugin.openToday()
  });
  plugin.addCommand({
    id: "open-student-inspector",
    name: "학생 인스펙터 열기 (오른쪽 패널)",
    callback: () => plugin.openStudentInspectorFlow()
  });
  plugin.addCommand({
    id: "open-lesson-inspector",
    name: "차시 인스펙터 열기 (오른쪽 패널)",
    callback: () => void plugin.openLessonInspector()
  });
  plugin.addCommand({
    id: "initialize-workspace",
    name: "학급 공간 초기화",
    callback: () => void plugin.initializeWorkspace()
  });
  plugin.addCommand({
    id: "add-student",
    name: "학생 추가",
    callback: () => plugin.openStudentModal()
  });
  plugin.addCommand({
    id: "add-record",
    name: "학생 빠른 기록",
    callback: () => plugin.openRecordFlow()
  });
  plugin.addCommand({
    id: "add-school-record-evidence",
    name: "학생 개별 기록 (학생부 근거)",
    callback: () => plugin.openSchoolRecordEvidenceFlow()
  });
  plugin.addCommand({
    id: "add-school-record-evidence-batch",
    name: "학급 일괄 기록 (학생부 근거)",
    callback: () => plugin.openSchoolRecordBatch()
  });
  plugin.addCommand({
    id: "import-roster-csv",
    name: "CSV 명렬표 가져오기",
    callback: () => plugin.openStudentModal()
  });
  plugin.addCommand({
    id: "check-attendance",
    name: "오늘의 출결 체크",
    callback: () => plugin.openAttendanceModal()
  });
  plugin.addCommand({
    id: "check-assignment",
    name: "과제 체크",
    callback: () => plugin.openAssignmentFlow()
  });
  plugin.addCommand({
    id: "open-activity-list",
    name: "통합 목록 열기",
    callback: () => void plugin.openActivityList()
  });
  plugin.addCommand({
    id: "open-student-timeline",
    name: "학생 타임라인 열기",
    callback: () => plugin.openStudentTimelineFlow()
  });
  plugin.addCommand({
    id: "open-calendar",
    name: "학급 캘린더 열기",
    callback: () => void plugin.openCalendar()
  });
  plugin.addCommand({
    id: "open-curriculum-ops",
    name: "시간표·시수 열기",
    callback: () => void plugin.openCurriculumOps()
  });
  plugin.addCommand({
    id: "open-academic-calendar",
    name: "학사일정 노트 열기",
    callback: () => void plugin.openAcademicCalendarNote()
  });
  plugin.addCommand({
    id: "open-hours-standard",
    name: "기준 시수 노트 열기",
    callback: () => void plugin.openHoursStandardNote()
  });
  plugin.addCommand({
    id: "open-base-timetable",
    name: "기초시간표 노트 열기",
    callback: () => void plugin.openBaseTimetableNote()
  });
  plugin.addCommand({
    id: "import-progress-rows",
    name: "진도표 차시 가져오기",
    callback: () => plugin.openProgressImportModal()
  });
  plugin.addCommand({
    id: "assign-progress",
    name: "진도 자동 배정",
    callback: () => void plugin.runProgressAssignment()
  });
  plugin.addCommand({
    id: "scaffold-regular-units",
    name: "일반 단원 일괄 생성",
    callback: () => plugin.openUnitScaffoldModal()
  });
  plugin.addCommand({
    id: "import-assessment-plan",
    name: "평가 계획 가져오기",
    callback: () => plugin.openAssessmentImportModal()
  });
  plugin.addCommand({
    id: "scaffold-standard-notes",
    name: "성취기준 노트 생성",
    callback: () => void plugin.flows.scaffoldStandardNotes()
  });
  plugin.addCommand({
    id: "linkify-progress-standards",
    name: "진도표 성취기준 링크화",
    callback: () => void plugin.flows.linkifyProgressStandardCodes()
  });
  plugin.addCommand({
    id: "backfill-lesson-progress-links",
    name: "수업일지 진도표 역링크 채우기",
    callback: () => void plugin.flows.backfillLessonProgressLinks()
  });
  plugin.addCommand({
    id: "open-curriculum-gantt",
    name: "교육과정 로드맵 열기",
    callback: () => void plugin.openCurriculumGantt()
  });
  plugin.addCommand({
    id: "create-bases-views",
    name: "일체화 Bases 보기 만들기",
    callback: () => void plugin.flows.createBasesViews()
  });
  plugin.addCommand({
    id: "create-event-notes",
    name: "행사 노트 일괄 만들기",
    callback: () => void plugin.flows.createAllEventNotes()
  });
  plugin.addCommand({
    id: "generate-weekly-plan",
    name: "주간학습안내 생성 (이번 주)",
    callback: () => void plugin.generateWeeklyPlan()
  });
  plugin.addCommand({
    id: "open-tasks",
    name: "GTD 할 일 열기",
    callback: () => void plugin.openTasks()
  });
  plugin.addCommand({
    id: "capture-task",
    name: "할 일 빠른 수집",
    callback: () => plugin.openTaskModal()
  });
  plugin.addCommand({
    id: "check-notice-replies",
    name: "가정통신문 회신 체크",
    callback: () => plugin.openNoticeFlow()
  });
  plugin.addCommand({
    id: "open-routines",
    name: "루틴 체크리스트 열기",
    callback: () => void plugin.openRoutines()
  });
  plugin.addCommand({
    id: "open-curriculum-integration",
    name: "단원 설계 및 운영 열기",
    callback: () => void plugin.openCurriculum()
  });
  plugin.addCommand({
    id: "create-curriculum-unit",
    name: "새 통합 단원 설계",
    callback: () => plugin.openCurriculumUnitModal()
  });
  plugin.addCommand({
    id: "open-reports",
    name: "분석·보고서 열기",
    callback: () => void plugin.openReports()
  });
  plugin.addCommand({
    id: "setup-ai-collaboration",
    name: "AI 협업 설정",
    callback: () => plugin.openAiSetup()
  });
  plugin.addCommand({
    id: "manage-classes",
    name: "학급·학기 추가 및 전환",
    callback: () => plugin.openClassProfileModal()
  });
  plugin.addCommand({
    id: "open-data-management",
    name: "학급·데이터 열기",
    callback: () => void plugin.openDataManagement()
  });
  plugin.addCommand({
    id: "open-maintenance",
    name: "백업·유지관리 열기",
    callback: () => void plugin.openMaintenance()
  });
  plugin.addCommand({
    id: "capture-feedback",
    name: "피드백 기록",
    callback: () => plugin.openFeedbackModal()
  });
  plugin.addCommand({
    id: "scan-tasks",
    name: "할 일 자동 수집",
    callback: () => void plugin.flows.scanOperationalTasks()
  });
  plugin.addCommand({
    id: "neis-char-check",
    name: "NEIS 글자수 검사",
    callback: () => plugin.openNeisCharCheck()
  });
}
