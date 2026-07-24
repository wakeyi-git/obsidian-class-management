import type { TFile } from "obsidian";

/**
 * frontmatter `class-management:` 판별자 23종 — 노트 종류의 단일 진실 (PRODUCT §7).
 * 직렬화기·파서의 리터럴이 이 목록을 벗어나면 tests/note-kinds.test.mjs 가드가 실패한다.
 */
export const NOTE_KINDS = [
  "student",
  "attendance",
  "record",
  "assignment",
  "task",
  "notice",
  "routine-template",
  "routine-instance",
  "academic-calendar",
  "hours-standard",
  "timetable",
  "subject-progress",
  "curriculum-unit",
  "curriculum-lesson",
  "school-event",
  "weekly-plan",
  "achievement-standard",
  "school-record-guideline",
  "home",
  "backup",
  "report",
  "diagnostics",
  "ai-draft"
] as const;

export type NoteKind = (typeof NOTE_KINDS)[number];

/** 성취기준 노트의 파싱 결과 (R2 — 플러그인 인식). */
export interface AchievementStandardEntry {
  file: TFile;
  code: string;
  subject: string;
  gradeBand: string;
  statement: string;
}

export interface ClassManagementSettings {
  className: string;
  schoolYear: string;
  semester: string;
  schoolLevel: "elementary";
  grade: string;
  curriculum: string;
  schoolRecordGuidelineYear: string;
  schoolSubjects: string[];
  baseFolder: string;
  studentsFolder: string;
  recordsFolder: string;
  attendanceFolder: string;
  assignmentsFolder: string;
  tasksFolder: string;
  noticesFolder: string;
  routinesFolder: string;
  curriculumFolder: string;
  reportsFolder: string;
  exportsFolder: string;
  retentionYears: number;
  backupsFolder: string;
  schemaVersion: number;
  aiOutputFolder: string;
  aiCollaborationEnabled: boolean;
  aiAnonymizeStudents: boolean;
  aiExcludedFolders: string[];
  activeClassId: string;
  classProfiles: ClassProfile[];
  activityListFilters: ActivityListFilters;
  savedActivityViews: SavedActivityView[];
  /** 학급 메뉴 '자주 쓰는 명령'의 동작 id 목록(순서 유지). */
  favoriteActionIds: string[];
  /** 로드 시 규칙 기반 할 일 자동 수집(task-scan) 실행 여부. */
  autoTaskScan: boolean;
  activitySortBy: "date" | "student" | "status";
  activitySortDirection: "asc" | "desc";
  activityVisibleColumns: ActivityColumn[];
  calendarViewMode: "month" | "week";
  /** 학급 캘린더의 진도 차시 레이어 표시 여부(기본 꺼짐 — 소음 방지). */
  calendarShowProgress: boolean;
}

export interface ClassProfile {
  id: string;
  name: string;
  schoolYear: string;
  semester: string;
  schoolLevel: "elementary";
  grade: string;
  curriculum: string;
  schoolRecordGuidelineYear: string;
  schoolSubjects: string[];
  baseFolder: string;
  archived: boolean;
}

export interface StudentEntry {
  file: TFile;
  name: string;
  number: string;
  status: StudentStatus;
}

export type StudentStatus = "active" | "transferred" | "graduated";

export interface RecordEntry {
  file: TFile;
  studentName: string;
  studentNumber: string;
  recordType: string;
  date: string;
  schoolRecordEvidence?: SchoolRecordEvidence;
}

export interface NewStudent {
  name: string;
  number: string;
}

export interface SkippedStudent {
  student: NewStudent;
  reason: string;
}

export interface FailedStudent {
  student: NewStudent;
  reason: string;
}

export interface RosterImportSummary {
  created: StudentEntry[];
  skipped: SkippedStudent[];
  failed: FailedStudent[];
}

export type AttendanceStatus = "출석" | "지각" | "결석" | "조퇴" | "결과";

export interface AttendanceMark {
  studentNumber: string;
  studentName: string;
  status: AttendanceStatus;
  reason?: string;
}

export type AssignmentStatus = "제출" | "미제출" | "보완";

/** 수행평가 루브릭 도달수준 — 기록일 뿐 점수 산출(비목표)이 아니다. */
export type AssignmentLevel = "◎" | "○" | "△";

export interface AssignmentMark {
  studentNumber: string;
  studentName: string;
  status: AssignmentStatus;
  /** 선택 기록 — 하나라도 있으면 확인표가 도달수준 열이 있는 형식으로 저장된다. */
  level?: AssignmentLevel;
  note?: string;
}

export interface AssignmentSummary {
  file: TFile;
  title: string;
  date: string;
  unitId?: string;
  unitTitle?: string;
  unitPath?: string;
}

export interface CurriculumUnitLink {
  id: string;
  title: string;
  path: string;
}

export interface AssignmentSheet extends AssignmentSummary {
  marks: AssignmentMark[];
}

export type ActivityKind =
  | "record"
  | "attendance"
  | "assignment"
  | "task"
  | "notice"
  | "routine"
  | "curriculum";

export interface ActivityEntry {
  id: string;
  file: TFile;
  date: string;
  studentNumber: string;
  studentName: string;
  kind: ActivityKind;
  title: string;
  status: string;
  detail: string;
  searchText: string;
  createdAt: number;
  schoolRecordEvidence?: SchoolRecordEvidence;
}

export interface ActivityListFilters {
  query: string;
  studentNumber: string;
  kind: "" | ActivityKind;
  status: string;
  dateFrom: string;
  dateTo: string;
}

export interface SavedActivityView {
  name: string;
  filters: ActivityListFilters;
}

export type ActivityColumn = "date" | "student" | "kind" | "status" | "detail" | "source";

export type TaskStatus = "inbox" | "next" | "waiting" | "someday" | "done";

export interface TaskEntry {
  file: TFile;
  title: string;
  status: TaskStatus;
  project: string;
  context: string;
  startDate: string;
  dueDate: string;
  priority: "" | "low" | "normal" | "high";
  recurrence: "none" | "daily" | "weekly" | "monthly";
  studentNumber: string;
  studentName: string;
  detail: string;
  createdAt: number;
}

export type NewTask = Omit<TaskEntry, "file" | "createdAt">;

export type NoticeStatus = "미회신" | "회신 완료" | "확인 필요";

export interface NoticeMark {
  studentNumber: string;
  studentName: string;
  status: NoticeStatus;
  responseDate?: string;
  note?: string;
}

export interface NoticeSummary {
  file: TFile;
  title: string;
  sentDate: string;
  dueDate: string;
}

export interface NoticeSheet extends NoticeSummary {
  marks: NoticeMark[];
}

export type RoutineFrequency = "daily" | "weekly" | "monthly";

export interface RoutineTemplate {
  file: TFile;
  title: string;
  frequency: RoutineFrequency;
  weekday: number;
  monthDay: number;
  items: string[];
}

export interface RoutineInstanceItem {
  line: number;
  templateTitle: string;
  text: string;
  completed: boolean;
}

export interface RoutineInstance {
  file: TFile;
  date: string;
  items: RoutineInstanceItem[];
}

export interface NewRecord {
  recordType: string;
  date: string;
  content: string;
  schoolRecordEvidence?: SchoolRecordEvidence;
}

export type CurriculumDesignApproach =
  | "within-subject"
  | "interdisciplinary"
  | "backward-design";

export type CurriculumUnitStatus = "draft" | "ready" | "in-progress" | "completed";

export type CurriculumKnowledgeStructure = "knowledge" | "process" | "knowledge-process";

export type ConceptInquiryPhase =
  | "engage"
  | "focus"
  | "investigate"
  | "organize"
  | "generalize"
  | "transfer"
  | "reflect";

export interface ConceptInquiryStrand {
  id: string;
  title: string;
  generalization: string;
  factualQuestions: string;
  conceptualQuestions: string;
  debatableQuestions: string;
  contentKnowledge: string;
  coreSkills: string;
  evaluationMethods: string;
}

export interface CurriculumUnit {
  file: TFile;
  id: string;
  subject: string;
  grade: string;
  semester: string;
  unitName: string;
  theme: string;
  designApproach: CurriculumDesignApproach;
  status: CurriculumUnitStatus;
  startDate: string;
  endDate: string;
  plannedHours: number;
  achievementStandards: string;
  studentNeeds: string;
  enduringUnderstanding: string;
  essentialQuestion: string;
  competencies: string;
  assessmentTask: string;
  evaluationCriteria: string;
  evaluationMethods: string[];
  feedbackPlan: string;
  recordFocus: string;
  learningPlan: string;
  connectedSubjects: string[];
  conceptInquiryEnabled: boolean;
  unitOverview: string;
  keyIdea: string;
  conceptualLens: string;
  macroConcepts: string[];
  microConcepts: string[];
  knowledgeStructure: CurriculumKnowledgeStructure;
  conceptMap: string;
  conceptInquiryStrands: ConceptInquiryStrand[];
  inquiryPhases: ConceptInquiryPhase[];
  priorKnowledge: string;
  transferContext: string;
  studentAgency: string;
  analyticRubric: string;
  createdAt: number;
}

export type NewCurriculumUnit = Omit<CurriculumUnit, "file" | "createdAt">;

export type CurriculumLessonStatus = "planned" | "completed";

export interface CurriculumLesson {
  file: TFile;
  id: string;
  unitId: string;
  unitTitle: string;
  unitPath: string;
  subject: string;
  date: string;
  period: string;
  sequence: number;
  hours: number;
  objective: string;
  activities: string;
  studentParticipation: string;
  assessmentEvidence: string;
  feedback: string;
  reflection: string;
  conceptInquiryPhase: "" | ConceptInquiryPhase;
  conceptInquiryStrandId: string;
  conceptInquiryStrandTitle: string;
  studentGeneralization: string;
  transferEvidence: string;
  status: CurriculumLessonStatus;
  /** 날짜가 지나면 플러그인이 "raw"를 스탬프하고 이후 건드리지 않는다. */
  recordStatus: string;
  createdAt: number;
}

export type NewCurriculumLesson = Omit<CurriculumLesson, "file" | "createdAt">;

export interface ReportOptions {
  title: string;
  dateFrom: string;
  dateTo: string;
  studentNumber: string;
}

export type AiDraftKind = "feedback" | "school-record";

export type SchoolRecordArea =
  | "creative-activities"
  | "subject-development"
  | "behavior-summary";

export type SchoolRecordReferenceLevel = "primary" | "supporting" | "excluded";

export interface SchoolRecordReference {
  activity: ActivityEntry;
  level: SchoolRecordReferenceLevel;
  category: string;
  reason: string;
  warning?: string;
}

export interface SchoolRecordClassification {
  area: SchoolRecordArea;
  primary: SchoolRecordReference[];
  supporting: SchoolRecordReference[];
  excluded: SchoolRecordReference[];
}

export type SchoolRecordEvidenceType =
  | "teacher-observation"
  | "assessment"
  | "self-assessment"
  | "peer-assessment"
  | "counseling"
  | "guardian-consultation"
  | "external-document";

export type SchoolRecordReviewStatus = "raw" | "reviewed" | "excluded";

export interface SchoolRecordEvidence {
  area: SchoolRecordArea;
  subarea: string;
  evidenceType: SchoolRecordEvidenceType;
  directObservation: boolean;
  observer: string;
  activityName: string;
  activityPlan: string;
  startDate: string;
  endDate: string;
  participationRole: string;
  participation: string;
  observedFact: string;
  changeGrowth: string;
  subject: string;
  achievementStandard: string;
  evaluationElement: string;
  evaluationMethod: string;
  selfDirectedGrowth: string;
  nonParticipationReason: string;
  observationContext: string;
  recurrence: string;
  strengthPotential: string;
  supportProvided: string;
  volunteerOrganizer: string;
  volunteerHours: string;
  volunteerCumulativeHours: string;
  volunteerApproved: boolean;
  reviewStatus: SchoolRecordReviewStatus;
  curriculumUnitId: string;
  curriculumUnitTitle: string;
  curriculumUnitPath: string;
  curriculumLessonId: string;
  curriculumLessonPath: string;
  conceptualUnderstanding: string;
  inquiryProcess: string;
  studentTransferEvidence: string;
}

export type ClosedDayCategory = "공휴일" | "재량휴업일" | "기타";

export interface ClosedDay {
  date: string;
  category: ClosedDayCategory;
  name: string;
}

export type SchoolEventType = "행사" | "전일행사" | "단축" | "연장";

export interface SchoolEvent {
  date: string;
  type: SchoolEventType;
  name: string;
  periods: number[];
  subject: string;
}

export interface AcademicCalendar {
  file: TFile;
  schoolYear: string;
  semester1Start: string;
  semester1End: string;
  semester2Start: string;
  semester2End: string;
  weekdayPeriods: number[];
  closedDays: ClosedDay[];
  /** 방학 구간(행정 학기 안의 비수업 기간) — `## 방학` 표에서 읽는다. */
  vacations: VacationRange[];
  events: SchoolEvent[];
}

export interface VacationRange {
  from: string;
  to: string;
  name: string;
}

export interface HoursStandardEntry {
  subject: string;
  /** 1학기 기준 시수 — 구형 노트(연간만)면 0. */
  hours1: number;
  /** 2학기 기준 시수 — 구형 노트(연간만)면 0. */
  hours2: number;
  /** 학년(연간) 기준 시수 — 명시값이 없으면 1·2학기 합. */
  hours: number;
  /** 구분(교과·창체 등) — 구형 2열 표는 이름으로 추정한다. */
  category: string;
}

export interface HoursStandard {
  file: TFile;
  schoolYear: string;
  tolerancePercent: number;
  entries: HoursStandardEntry[];
}

export interface TimetableOverride {
  date: string;
  period: number;
  subject: string;
  reason: string;
}

export interface BaseTimetable {
  file: TFile;
  schoolYear: string;
  semester: string;
  periods: number;
  grid: string[][];
  overrides: TimetableOverride[];
}

export interface ResolvedPeriod {
  period: number;
  subject: string;
  source: "base" | "override" | "event";
  /** 과목이 지정되지 않은 행사 교시 — 표시용 행사명이며 교과 시수로 집계하지 않는다. */
  unmapped?: boolean;
}

export interface ResolvedDay {
  date: string;
  weekday: number;
  isClassDay: boolean;
  reason: string;
  periods: ResolvedPeriod[];
  events: SchoolEvent[];
}

export interface ProgressRow {
  order: number;
  unit: string;
  topic: string;
  hours: number;
  standard: string;
  /** 프로젝트 열(통합 단원 연계) 위키링크 — 구명 "통합 단원" 헤더도 읽는다 */
  unitLink: string;
  /** 과제(평가) 노트 위키링크 */
  assignmentLink: string;
  materials: string;
  fixedDate: string;
  /** 고정 교시 (0이면 날짜만 고정). 표기: `2026-10-15(3)` */
  fixedPeriod: number;
  assigned: string;
  note: string;
}

export interface ProgressTable {
  file: TFile;
  schoolYear: string;
  semester: string;
  subject: string;
  rows: ProgressRow[];
}

export interface SubjectSlot {
  date: string;
  period: number;
}

export interface AssignedProgressRow {
  row: ProgressRow;
  slots: SubjectSlot[];
  shortage: number;
}

export interface ProgressAssignment {
  rows: AssignedProgressRow[];
  unassignedSlots: SubjectSlot[];
  issues: string[];
}

export interface HoursAuditRow {
  /** subject=개별 행, subtotal=구분 소계, total=총계. */
  kind: "subject" | "subtotal" | "total";
  subject: string;
  /** 기준 시수 노트의 구분(교과·창체 등). */
  category: string;
  standardHours: number;
  standard1: number;
  standard2: number;
  planned1: number;
  taught1: number;
  planned2: number;
  taught2: number;
  plannedHours: number;
  taughtHours: number;
  deltaPercent: number;
  status: "ok" | "over" | "under" | "missing";
}

export interface SemesterHours {
  planned: Record<string, number>;
  taught: Record<string, number>;
}

export interface WeeklyPlanCell {
  period: number;
  subject: string;
  unit: string;
  topic: string;
  materials: string;
}

export interface WeeklyPlanDay {
  date: string;
  weekday: number;
  isClassDay: boolean;
  reason: string;
  cells: WeeklyPlanCell[];
}

export interface WeeklyPlanInput {
  className: string;
  schoolYear: string;
  semester: string;
  weekStart: string;
  weekEnd: string;
  days: WeeklyPlanDay[];
  notices: string[];
  morningActivities: string[];
}
