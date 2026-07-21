import { booleanValue } from "./utils";
import type {
  ClassManagementSettings,
  RecordEntry,
  SchoolRecordArea,
  SchoolRecordEvidence,
  SchoolRecordEvidenceType,
  StudentEntry
} from "./types";

export const EVIDENCE_TYPE_LABELS: Record<SchoolRecordEvidenceType, string> = {
  "teacher-observation": "교사 직접 관찰",
  assessment: "수업·평가 자료",
  "self-assessment": "학생 자기평가",
  "peer-assessment": "학생 상호평가",
  counseling: "학생 상담",
  "guardian-consultation": "보호자 상담",
  "external-document": "외부·위탁 자료"
};

export const SCHOOL_RECORD_SUBAREAS: Record<SchoolRecordArea, Record<string, string>> = {
  "creative-activities": {
    autonomy: "자율·자치활동",
    club: "동아리활동",
    career: "진로활동",
    volunteer: "봉사활동 실적"
  },
  "subject-development": {
    subject: "교과 성취수준 및 특기사항",
    "school-autonomy": "학교자율시간 활동"
  },
  "behavior-summary": {
    learning: "학습 태도",
    relationship: "관계·협력",
    responsibility: "책임·자기관리",
    character: "인성·배려",
    habit: "생활 습관",
    "arts-sports": "체육·예술활동",
    "observed-volunteer": "학교계획 봉사활동 관찰",
    growth: "성장·변화",
    general: "종합 관찰"
  }
};

export const ACTIVITY_PLAN_LABELS: Record<string, string> = {
  curriculum: "정규교육과정",
  "school-plan": "학교교육계획",
  "individual-approved": "학생 개인계획·학교장 승인",
  entrusted: "위탁·공동교육",
  other: "추가 확인"
};

export interface EvidenceValidationIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
}

export interface CoverageGap {
  studentNumber: string;
  studentName: string;
  requirement: string;
}

export interface AreaCoverage {
  area: SchoolRecordArea;
  label: string;
  covered: number;
  total: number;
  gaps: CoverageGap[];
}

export interface SchoolRecordCoverage {
  areas: AreaCoverage[];
  legacyUnclassified: number;
}

const FRONTMATTER_FIELDS: Array<[keyof SchoolRecordEvidence, string]> = [
  ["area", "schoolRecordArea"],
  ["subarea", "schoolRecordSubarea"],
  ["evidenceType", "evidenceType"],
  ["observer", "observer"],
  ["activityName", "activityName"],
  ["activityPlan", "activityPlan"],
  ["startDate", "activityStartDate"],
  ["endDate", "activityEndDate"],
  ["participationRole", "participationRole"],
  ["participation", "participation"],
  ["observedFact", "observedFact"],
  ["changeGrowth", "changeGrowth"],
  ["subject", "subject"],
  ["achievementStandard", "achievementStandard"],
  ["evaluationElement", "evaluationElement"],
  ["evaluationMethod", "evaluationMethod"],
  ["selfDirectedGrowth", "selfDirectedGrowth"],
  ["nonParticipationReason", "nonParticipationReason"],
  ["observationContext", "observationContext"],
  ["recurrence", "recurrence"],
  ["strengthPotential", "strengthPotential"],
  ["supportProvided", "supportProvided"],
  ["volunteerOrganizer", "volunteerOrganizer"],
  ["volunteerHours", "volunteerHours"],
  ["volunteerCumulativeHours", "volunteerCumulativeHours"],
  ["reviewStatus", "reviewStatus"],
  ["curriculumUnitId", "curriculumUnitId"],
  ["curriculumUnitTitle", "curriculumUnitTitle"],
  ["curriculumUnitPath", "curriculumUnitPath"],
  ["curriculumLessonId", "curriculumLessonId"],
  ["curriculumLessonPath", "curriculumLessonPath"],
  ["conceptualUnderstanding", "conceptualUnderstanding"],
  ["inquiryProcess", "inquiryProcess"],
  ["studentTransferEvidence", "studentTransferEvidence"]
];

const FORBIDDEN_PATTERN = /(?:대회|수상|입상|K-?MOOC|MOOC|KOCW|방과\s*후\s*학교)/i;
const STIGMA_PATTERN = /(?:문제아|게으른|불성실한\s*학생|성격이\s*(?:나쁘|이상)|ADHD|자폐|정신\s*질환|진단받)/i;
const NEGATIVE_BEHAVIOR_PATTERN = /(?:규칙을\s*어|방해|폭언|폭력|거짓말|지시를\s*따르지|갈등을\s*일으|산만)/i;

export function emptySchoolRecordEvidence(
  area: SchoolRecordArea = "creative-activities"
): SchoolRecordEvidence {
  return {
    area,
    subarea: area === "creative-activities" ? "autonomy" : area === "subject-development" ? "subject" : "general",
    evidenceType: "teacher-observation",
    directObservation: true,
    observer: "학급담임교사",
    activityName: "",
    activityPlan: area === "creative-activities" ? "curriculum" : "",
    startDate: "",
    endDate: "",
    participationRole: "",
    participation: "",
    observedFact: "",
    changeGrowth: "",
    subject: "",
    achievementStandard: "",
    evaluationElement: "",
    evaluationMethod: "",
    selfDirectedGrowth: "",
    nonParticipationReason: "",
    observationContext: "",
    recurrence: "",
    strengthPotential: "",
    supportProvided: "",
    volunteerOrganizer: "",
    volunteerHours: "",
    volunteerCumulativeHours: "",
    volunteerApproved: false,
    reviewStatus: "raw",
    curriculumUnitId: "",
    curriculumUnitTitle: "",
    curriculumUnitPath: "",
    curriculumLessonId: "",
    curriculumLessonPath: "",
    conceptualUnderstanding: "",
    inquiryProcess: "",
    studentTransferEvidence: ""
  };
}

export function parseSchoolRecordEvidence(
  frontmatter: Record<string, unknown> | undefined
): SchoolRecordEvidence | undefined {
  const area = String(frontmatter?.schoolRecordArea ?? "");
  if (!isSchoolRecordArea(area)) return undefined;
  const evidence = emptySchoolRecordEvidence(area);
  FRONTMATTER_FIELDS.forEach(([property, key]) => {
    const value = frontmatter?.[key];
    if (value !== undefined && typeof evidence[property] === "string") {
      (evidence[property] as string) = String(value);
    }
  });
  evidence.directObservation = booleanValue(frontmatter?.directObservation, evidence.directObservation);
  evidence.volunteerApproved = booleanValue(frontmatter?.volunteerApproved, false);
  if (!isEvidenceType(evidence.evidenceType)) evidence.evidenceType = "teacher-observation";
  if (!isReviewStatus(evidence.reviewStatus)) evidence.reviewStatus = "raw";
  return evidence;
}

export function schoolRecordEvidenceFrontmatter(evidence: SchoolRecordEvidence): string[] {
  const lines = ["recordPurpose: school-record-evidence"];
  FRONTMATTER_FIELDS.forEach(([property, key]) => {
    const value = evidence[property];
    if (typeof value === "string" && value.trim()) lines.push(`${key}: ${JSON.stringify(value.trim())}`);
  });
  lines.push(`directObservation: ${evidence.directObservation ? "true" : "false"}`);
  if (evidence.subarea === "volunteer") {
    lines.push(`volunteerApproved: ${evidence.volunteerApproved ? "true" : "false"}`);
  }
  return lines;
}

export function applySchoolRecordEvidenceToFrontmatter(
  frontmatter: Record<string, unknown>,
  evidence: SchoolRecordEvidence
): void {
  frontmatter.recordPurpose = "school-record-evidence";
  FRONTMATTER_FIELDS.forEach(([property, key]) => {
    const value = evidence[property];
    if (typeof value === "string" && value.trim()) frontmatter[key] = value.trim();
    else delete frontmatter[key];
  });
  frontmatter.directObservation = evidence.directObservation;
  if (evidence.subarea === "volunteer") frontmatter.volunteerApproved = evidence.volunteerApproved;
  else delete frontmatter.volunteerApproved;
}

export function suggestLegacySchoolRecordEvidence(
  recordType: string,
  content: string
): SchoolRecordEvidence {
  const text = `${recordType} ${content}`;
  let area: SchoolRecordArea = "behavior-summary";
  let subarea = "general";
  if (/(?:진로|직업|적성|흥미|꿈|진학|진로검사)/.test(text)) {
    area = "creative-activities";
    subarea = "career";
  } else if (/(?:동아리|부서\s*활동)/.test(text)) {
    area = "creative-activities";
    subarea = "club";
  } else if (/(?:학급\s*회의|학생회|자율|자치|임원|학교\s*행사)/.test(text)) {
    area = "creative-activities";
    subarea = "autonomy";
  } else if (/(?:국어|수학|사회|과학|영어|도덕|실과|체육|음악|미술|수업|성취기준|평가|탐구|실험|풀이)/.test(text)) {
    area = "subject-development";
    subarea = "subject";
  }
  const evidence = emptySchoolRecordEvidence(area);
  evidence.subarea = subarea;
  evidence.observedFact = content.trim();
  evidence.directObservation = !/(?:상담|보호자\s*연락)/.test(recordType);
  evidence.evidenceType = recordType === "상담"
    ? "counseling"
    : recordType === "보호자 연락"
      ? "guardian-consultation"
      : "teacher-observation";
  evidence.observer = evidence.directObservation ? "학급담임교사" : "추가 확인";
  evidence.subject = detectLegacySubject(text);
  return evidence;
}

export function schoolRecordEvidenceBody(evidence: SchoolRecordEvidence): string[] {
  const subarea = SCHOOL_RECORD_SUBAREAS[evidence.area][evidence.subarea] ?? evidence.subarea;
  const rows: Array<[string, string]> = [
    ["학교생활기록부 영역", areaLabel(evidence.area)],
    ["통합 단원", evidence.curriculumUnitPath
      ? `${evidence.curriculumUnitPath}${evidence.curriculumUnitTitle ? ` (${evidence.curriculumUnitTitle})` : ""}`
      : evidence.curriculumUnitTitle],
    ["수업 실행 기록", evidence.curriculumLessonPath],
    ["학생이 형성한 개념적 이해", evidence.conceptualUnderstanding],
    ["탐구 과정", evidence.inquiryProcess],
    ["전이 증거", evidence.studentTransferEvidence],
    ["세부 영역", subarea],
    ["근거 유형", EVIDENCE_TYPE_LABELS[evidence.evidenceType]],
    ["직접 관찰", evidence.directObservation ? "예" : "아니요"],
    ["관찰자", evidence.observer],
    ["활동·수업", evidence.activityName],
    ["교육계획 구분", ACTIVITY_PLAN_LABELS[evidence.activityPlan] ?? evidence.activityPlan],
    ["기간", dateRange(evidence.startDate, evidence.endDate)],
    ["교과", evidence.subject],
    ["성취기준", evidence.achievementStandard],
    ["평가요소", evidence.evaluationElement],
    ["평가방법", evidence.evaluationMethod],
    ["역할", evidence.participationRole],
    ["참여 과정", evidence.participation],
    ["관찰 맥락", evidence.observationContext],
    ["반복·지속", evidence.recurrence],
    ["변화와 성장", evidence.changeGrowth || evidence.selfDirectedGrowth],
    ["강점·발전 가능성", evidence.strengthPotential],
    ["지원 내용", evidence.supportProvided],
    ["미참여 사유", evidence.nonParticipationReason],
    ["봉사 장소·주관기관", evidence.volunteerOrganizer],
    ["봉사 시간", evidence.volunteerHours],
    ["봉사 누계시간", evidence.volunteerCumulativeHours],
    ["학교장 승인", evidence.subarea === "volunteer" ? (evidence.volunteerApproved ? "확인" : "미확인") : ""]
  ];
  return [
    "## 학교생활기록부 근거 정보",
    "",
    ...rows.filter(([, value]) => value.trim()).map(([label, value]) => `- ${label}: ${value}`),
    ""
  ];
}

export function validateSchoolRecordEvidence(
  evidence: SchoolRecordEvidence
): EvidenceValidationIssue[] {
  const issues: EvidenceValidationIssue[] = [];
  if (!evidence.observedFact.trim() && !evidence.nonParticipationReason.trim()) {
    issues.push(error("missing-fact", "교사가 확인한 구체적 사실 또는 미참여 사유를 입력해 주세요."));
  }
  if (!evidence.subarea) issues.push(error("missing-subarea", "세부 영역을 선택해 주세요."));
  if (!evidence.observer.trim()) issues.push(error("missing-observer", "관찰자 또는 자료 제공자를 입력해 주세요."));
  if (!evidence.directObservation && evidence.evidenceType === "teacher-observation") {
    issues.push(error("observation-conflict", "직접 관찰이 아니라면 근거 유형을 상담·평가·외부 자료 등으로 변경해 주세요."));
  }
  if (evidence.area === "creative-activities") validateCreative(evidence, issues);
  if (evidence.area === "subject-development") validateSubject(evidence, issues);
  if (evidence.area === "behavior-summary") validateBehavior(evidence, issues);

  const text = evidenceText(evidence);
  if (FORBIDDEN_PATTERN.test(text)) {
    issues.push(warning("prohibited-content", "대회·수상, 방과후학교 또는 공개강좌 관련 표현은 공식 기재 근거에서 제외해야 합니다."));
  }
  if (STIGMA_PATTERN.test(text)) {
    issues.push(warning("stigmatizing-language", "진단·낙인으로 읽힐 수 있는 표현이 있습니다. 관찰 가능한 행동 사실로 바꿔 주세요."));
  }
  if (
    evidence.area === "subject-development" &&
    evidence.curriculumUnitId &&
    !evidence.conceptualUnderstanding.trim() &&
    !evidence.inquiryProcess.trim() &&
    !evidence.studentTransferEvidence.trim()
  ) {
    issues.push(warning("missing-concept-inquiry-evidence", "통합 단원 근거라면 학생이 형성한 개념적 이해, 탐구 과정 또는 전이 증거 중 확인한 내용을 남기는 것이 좋습니다."));
  }
  return issues;
}

export function buildSchoolRecordCoverage(
  students: StudentEntry[],
  records: RecordEntry[],
  subjects: string[]
): SchoolRecordCoverage {
  const activeRecords = records.filter((record) =>
    record.schoolRecordEvidence && record.schoolRecordEvidence.reviewStatus !== "excluded"
  );
  const areas: AreaCoverage[] = [
    coverageForRequirements(
      "creative-activities",
      "창의적 체험활동상황",
      students,
      [
        ["자율·자치/동아리 통합", (evidence) => evidence.area === "creative-activities" && ["autonomy", "club"].includes(evidence.subarea)],
        ["진로활동", (evidence) => evidence.area === "creative-activities" && evidence.subarea === "career"]
      ],
      activeRecords
    ),
    coverageForRequirements(
      "subject-development",
      "교과학습발달상황",
      students,
      subjects.map((subject) => [subject, (evidence: SchoolRecordEvidence) =>
        evidence.area === "subject-development" && evidence.subject === subject] as const),
      activeRecords
    ),
    coverageForRequirements(
      "behavior-summary",
      "행동특성 및 종합의견",
      students,
      [["행동특성 누가기록", (evidence) => evidence.area === "behavior-summary"]],
      activeRecords
    )
  ];
  return {
    areas,
    legacyUnclassified: records.filter((record) => !record.schoolRecordEvidence).length
  };
}

export function defaultSubjectsForGrade(grade: string): string[] {
  if (["1", "2"].includes(grade)) {
    return ["국어", "수학", "바른 생활", "슬기로운 생활", "즐거운 생활", "학교자율시간"];
  }
  const common = ["국어", "사회", "도덕", "수학", "과학", "체육", "음악", "미술", "영어"];
  if (["5", "6"].includes(grade)) common.splice(6, 0, "실과");
  return [...common, "학교자율시간"];
}

export function normalizeSubjects(settings: Pick<ClassManagementSettings, "grade" | "schoolSubjects">): string[] {
  const configured = settings.schoolSubjects.map((subject) => subject.trim()).filter(Boolean);
  return configured.length ? [...new Set(configured)] : defaultSubjectsForGrade(settings.grade);
}

function validateCreative(
  evidence: SchoolRecordEvidence,
  issues: EvidenceValidationIssue[]
): void {
  if (!evidence.activityName.trim()) issues.push(error("missing-activity", "창의적 체험활동명 또는 동아리명을 입력해 주세요."));
  if (!evidence.activityPlan) issues.push(error("missing-plan", "정규교육과정·학교교육계획 등 활동 근거를 선택해 주세요."));
  if (evidence.subarea === "volunteer") {
    if (!evidence.volunteerOrganizer.trim()) issues.push(error("missing-organizer", "봉사활동 장소 또는 주관기관을 입력해 주세요."));
    if (!evidence.volunteerHours.trim()) issues.push(error("missing-hours", "실제 봉사활동 시간을 입력해 주세요."));
    if (evidence.activityPlan === "individual-approved" && !evidence.volunteerApproved) {
      issues.push(error("missing-approval", "학생 개인계획 봉사활동은 학교장 승인 여부를 확인해 주세요."));
    }
    if (evidence.participation.trim() || evidence.changeGrowth.trim()) {
      issues.push(warning("volunteer-qualitative", "봉사활동 실적의 활동 내용에는 정성 평가를 넣지 말고, 직접 관찰 특기사항은 행동특성 근거로 별도 저장하세요."));
    }
  }
}

function validateSubject(
  evidence: SchoolRecordEvidence,
  issues: EvidenceValidationIssue[]
): void {
  if (!evidence.subject.trim()) issues.push(error("missing-subject", "교과 또는 학교자율시간 활동을 선택해 주세요."));
  if (!evidence.achievementStandard.trim() && !evidence.nonParticipationReason.trim()) {
    issues.push(error("missing-standard", "관련 성취기준을 입력해 주세요."));
  }
  if (!evidence.evaluationElement.trim() && !evidence.nonParticipationReason.trim()) {
    issues.push(error("missing-evaluation", "평가요소를 입력해 주세요."));
  }
  if (!["teacher-observation", "assessment", "external-document"].includes(evidence.evidenceType)) {
    issues.push(warning("support-only", "자기평가·상호평가·상담 자료는 교사의 수업·평가 관찰 근거와 함께 사용하세요."));
  }
}

function validateBehavior(
  evidence: SchoolRecordEvidence,
  issues: EvidenceValidationIssue[]
): void {
  if (!evidence.observationContext.trim()) issues.push(warning("missing-context", "행동이 관찰된 수업·모둠·생활 상황을 기록하면 근거가 더 명확해집니다."));
  if (NEGATIVE_BEHAVIOR_PATTERN.test(evidence.observedFact) && !evidence.recurrence.trim()) {
    issues.push(warning("negative-without-history", "부정적으로 읽힐 수 있는 행동은 단발성 일반화를 피하도록 반복·지속 여부와 누가기록을 확인하세요."));
  }
  if (/(?:영재교육|영재학급|영재교육원)/.test(evidenceText(evidence))) {
    issues.push(warning("gifted-wrong-area", "영재교육 이수 내용은 행동특성이 아니라 관련 교과의 성취수준 및 특기사항에서 검토해야 합니다."));
  }
}

function coverageForRequirements(
  area: SchoolRecordArea,
  label: string,
  students: StudentEntry[],
  requirements: ReadonlyArray<readonly [string, (evidence: SchoolRecordEvidence) => boolean]>,
  records: RecordEntry[]
): AreaCoverage {
  const gaps: CoverageGap[] = [];
  let covered = 0;
  students.forEach((student) => {
    const evidence = records
      .filter((record) => record.studentNumber === student.number)
      .map((record) => record.schoolRecordEvidence)
      .filter((entry): entry is SchoolRecordEvidence => Boolean(entry));
    requirements.forEach(([requirement, predicate]) => {
      if (evidence.some(predicate)) covered += 1;
      else gaps.push({ studentNumber: student.number, studentName: student.name, requirement });
    });
  });
  return { area, label, covered, total: students.length * requirements.length, gaps };
}

function evidenceText(evidence: SchoolRecordEvidence): string {
  return Object.values(evidence).filter((value): value is string => typeof value === "string").join(" ");
}

function areaLabel(area: SchoolRecordArea): string {
  if (area === "creative-activities") return "창의적 체험활동상황";
  if (area === "subject-development") return "교과학습발달상황(성취수준 및 특기사항)";
  return "행동특성 및 종합의견";
}

function dateRange(start: string, end: string): string {
  if (start && end && start !== end) return `${start} ~ ${end}`;
  return start || end;
}

function error(code: string, message: string): EvidenceValidationIssue {
  return { severity: "error", code, message };
}

function warning(code: string, message: string): EvidenceValidationIssue {
  return { severity: "warning", code, message };
}


function detectLegacySubject(text: string): string {
  return ["국어", "수학", "사회", "과학", "영어", "도덕", "실과", "체육", "음악", "미술"]
    .find((subject) => text.includes(subject)) ?? "";
}

function isSchoolRecordArea(value: string): value is SchoolRecordArea {
  return ["creative-activities", "subject-development", "behavior-summary"].includes(value);
}

function isEvidenceType(value: string): value is SchoolRecordEvidenceType {
  return Object.prototype.hasOwnProperty.call(EVIDENCE_TYPE_LABELS, value);
}

function isReviewStatus(value: string): value is SchoolRecordEvidence["reviewStatus"] {
  return ["raw", "reviewed", "excluded"].includes(value);
}
