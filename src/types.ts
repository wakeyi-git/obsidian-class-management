import type { TFile } from "obsidian";

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
  activitySortBy: "date" | "student" | "status";
  activitySortDirection: "asc" | "desc";
  activityVisibleColumns: ActivityColumn[];
  calendarViewMode: "month" | "week";
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

export interface AssignmentMark {
  studentNumber: string;
  studentName: string;
  status: AssignmentStatus;
  note?: string;
}

export interface AssignmentSummary {
  file: TFile;
  title: string;
  date: string;
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

export interface NewTask extends Omit<TaskEntry, "file" | "createdAt"> {}

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
  events: SchoolEvent[];
}

export interface HoursStandardEntry {
  subject: string;
  hours: number;
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
  materials: string;
  fixedDate: string;
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
  subject: string;
  standardHours: number;
  plannedHours: number;
  taughtHours: number;
  deltaPercent: number;
  status: "ok" | "over" | "under" | "missing";
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
