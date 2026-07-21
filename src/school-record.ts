import type {
  ActivityEntry,
  SchoolRecordArea,
  SchoolRecordClassification,
  SchoolRecordReference,
  SchoolRecordReferenceLevel
} from "./types";
import { SCHOOL_RECORD_SUBAREAS } from "./school-record-evidence";

export interface SchoolRecordAreaDefinition {
  area: SchoolRecordArea;
  label: string;
  shortLabel: string;
  folder: string;
  description: string;
  guidelinePages: string;
  basis: string[];
}

export const SCHOOL_RECORD_AREAS: SchoolRecordAreaDefinition[] = [
  {
    area: "creative-activities",
    label: "창의적 체험활동상황",
    shortLabel: "창의적 체험활동",
    folder: "창의적 체험활동상황",
    description: "자율·자치활동과 동아리활동, 진로활동의 참여 과정과 변화 자료를 분류합니다.",
    guidelinePages: "인쇄본 76, 78~83쪽",
    basis: [
      "초등학교의 자율·자치활동과 동아리활동 특기사항은 통합하여 기록하고, 진로활동은 별도로 기록합니다.",
      "참여도·협력도·열성·실제 역할과 활동 실적, 활동 과정에서의 태도 변화와 성장을 중심으로 확인합니다.",
      "진로 관련 흥미·적성, 검사·상담, 학생과 학교의 활동 자료를 참고하되 교사가 관찰한 구체적 사실로 검토합니다."
    ]
  },
  {
    area: "subject-development",
    label: "교과학습발달상황(학기말종합의견)",
    shortLabel: "교과학습발달상황",
    folder: "교과학습발달상황(학기말종합의견)",
    description: "교과별 성취 특성, 수업·평가 참여, 자기주도적 학습 과정과 성장 자료를 분류합니다.",
    guidelinePages: "인쇄본 90~100쪽(특히 99~100쪽)",
    basis: [
      "성취기준에 따른 성취수준의 특성, 수업 참여와 자기주도적 학습 과정에서 나타난 변화·성장을 교과별로 확인합니다.",
      "학교의 평가 계획·요소, 교사가 관찰한 수행 과정과 결과, 누가기록과 학기말 평가 결과를 함께 검토합니다.",
      "과제 제출 상태만으로 성취수준을 판단하지 않으며 대회·수상, 방과후 활동, MOOC·K-MOOC·KOCW 내용은 초안 근거에서 제외합니다."
    ]
  },
  {
    area: "behavior-summary",
    label: "행동특성 및 종합의견",
    shortLabel: "행동특성 및 종합의견",
    folder: "행동특성 및 종합의견",
    description: "학습·행동·인성의 누적 관찰 자료와 성장, 강점, 발전 가능성 자료를 분류합니다.",
    guidelinePages: "인쇄본 102~104쪽",
    basis: [
      "연중 지속적으로 관찰한 학습·행동·인성 자료를 종합하여 성장, 강점과 발전 가능성을 확인합니다.",
      "교사가 직접 관찰한 구체적 사실과 누가기록을 우선하고 교육적·지원적인 관점으로 작성합니다.",
      "출결 예외나 과제 상태는 맥락을 확인하는 보조 자료일 뿐, 그 자체로 행동 특성을 단정하는 근거가 아닙니다."
    ]
  }
];

const DISALLOWED_PATTERN = /(?:방과\s*후|수상|입상|대회|MOOC|K-?MOOC|KOCW)/i;
const CAREER_PATTERN = /(?:진로|직업|적성|흥미|꿈|장래|진학|진로\s*검사|직업\s*체험)/i;
const CLUB_PATTERN = /(?:동아리|창체\s*동아리|부서\s*활동)/i;
const VOLUNTEER_PATTERN = /(?:봉사|도우미|캠페인)/i;
const AUTONOMY_PATTERN = /(?:자율|자치|학급\s*회의|학생회|전교|임원|회장|부회장|학급\s*규칙|학교\s*행사|입학식|졸업식|안전\s*교육|생명\s*존중|학교폭력\s*예방)/i;
const LEARNING_PATTERN = /(?:교과|수업|학습|성취|평가|발표|토론|탐구|실험|프로젝트|문제\s*해결|풀이|연산|읽기|글쓰기|쓰기|조사|자료\s*해석|작품|연주|표현\s*활동)/i;

const SUBJECT_PATTERNS: Array<[string, RegExp]> = [
  ["학교자율시간", /학교\s*자율\s*시간/i],
  ["통합교과", /(?:바른\s*생활|슬기로운\s*생활|즐거운\s*생활|통합\s*교과)/i],
  ["국어", /(?:국어|읽기|글쓰기|문학|독서)/i],
  ["수학", /(?:수학|수와\s*연산|도형|측정|규칙성|자료와\s*가능성)/i],
  ["사회", /(?:사회|역사|지리|정치|경제)/i],
  ["과학", /(?:과학|실험|생물|물질|지구|에너지)/i],
  ["영어", /(?:영어|english)/i],
  ["도덕", /(?:도덕|윤리)/i],
  ["실과", /(?:실과|정보|소프트웨어|코딩)/i],
  ["체육", /(?:체육|운동|스포츠)/i],
  ["음악", /(?:음악|노래|악기|연주)/i],
  ["미술", /(?:미술|그림|조형|작품)/i]
];

const BEHAVIOR_CATEGORIES: Array<[string, RegExp]> = [
  ["학습 태도", /(?:수업|학습|과제|발표|질문|집중|탐구|자기주도)/i],
  ["관계·협력", /(?:친구|또래|모둠|협력|협동|갈등|중재|소통|의견)/i],
  ["책임·자기관리", /(?:책임|역할|약속|준비|정리|자기관리|꾸준|성실)/i],
  ["인성·배려", /(?:배려|존중|양보|도움|친절|공감|예절|정직)/i],
  ["생활 습관", /(?:생활|규칙|습관|안전|질서|시간)/i],
  ["성장·변화", /(?:성장|변화|개선|노력|도전|극복|발전)/i]
];

export function schoolRecordAreaDefinition(area: SchoolRecordArea): SchoolRecordAreaDefinition {
  const definition = SCHOOL_RECORD_AREAS.find((candidate) => candidate.area === area);
  if (!definition) throw new Error(`알 수 없는 학교생활기록부 영역입니다: ${area}`);
  return definition;
}

export function selectStudentActivities(
  activities: ActivityEntry[],
  studentNumber: string,
  dateFrom: string,
  dateTo: string
): ActivityEntry[] {
  return activities.filter((activity) =>
    activity.studentNumber === studentNumber &&
    (!dateFrom || activity.date >= dateFrom) &&
    (!dateTo || activity.date <= dateTo)
  );
}

export function classifySchoolRecordReferences(
  activities: ActivityEntry[],
  area: SchoolRecordArea
): SchoolRecordClassification {
  const references = activities.map((activity) => classifyActivity(activity, area));
  return {
    area,
    primary: references.filter((reference) => reference.level === "primary"),
    supporting: references.filter((reference) => reference.level === "supporting"),
    excluded: references.filter((reference) => reference.level === "excluded")
  };
}

export function schoolRecordReferenceCounts(classification: SchoolRecordClassification): string {
  return `직접 ${classification.primary.length}건 · 보조 ${classification.supporting.length}건 · 제외 ${classification.excluded.length}건`;
}

function classifyActivity(
  activity: ActivityEntry,
  area: SchoolRecordArea
): SchoolRecordReference {
  if (activity.schoolRecordEvidence) {
    return classifyStructuredEvidence(activity, area);
  }
  if (area === "creative-activities") return classifyCreative(activity);
  if (area === "subject-development") return classifySubject(activity);
  return classifyBehavior(activity);
}

function classifyStructuredEvidence(
  activity: ActivityEntry,
  area: SchoolRecordArea
): SchoolRecordReference {
  const evidence = activity.schoolRecordEvidence;
  if (!evidence) return reference(activity, "excluded", "근거 정보 없음", "구조화된 근거 정보를 읽지 못했습니다.");
  if (evidence.reviewStatus === "excluded") {
    return reference(activity, "excluded", "교사 제외", "교사가 공식 초안 근거에서 제외한 RAW 기록입니다.");
  }
  const text = activityText(activity);
  if (DISALLOWED_PATTERN.test(text)) {
    return reference(activity, "excluded", "기재 제외 자료", "대회·수상, 방과후 활동 또는 공개강좌 관련 내용은 초안 근거로 사용하지 않습니다.");
  }
  if (evidence.area !== area) {
    return reference(activity, "excluded", "다른 학교생활기록부 영역", `${structuredCategory(evidence.area, evidence.subarea, evidence.subject)} 근거로 저장된 자료입니다.`);
  }
  if (area === "behavior-summary" && /(?:영재교육|영재학급|영재교육원)/.test(text)) {
    return reference(activity, "excluded", "교과 영역 자료", "영재교육 이수 내용은 관련 교과에서 검토해야 합니다.");
  }
  const category = structuredCategory(area, evidence.subarea, evidence.subject);
  const isDirect = evidence.directObservation && ["teacher-observation", "assessment"].includes(evidence.evidenceType);
  if (area === "creative-activities" && evidence.subarea === "volunteer") {
    return reference(activity, "supporting", category, "봉사활동 실적의 객관적 일자·기관·내용·시간을 확인하는 자료입니다.", "정성적 특기사항은 교사가 직접 관찰한 별도 근거와 연결하세요.");
  }
  const isPrimary = isDirect && evidence.reviewStatus === "reviewed";
  const warning = evidence.reviewStatus === "raw"
    ? "교사 검토 전 RAW 근거입니다. 원본의 사실과 영역을 확인하세요."
    : !isDirect
      ? "직접 관찰·평가가 아닌 보조 자료이므로 교사 관찰 근거와 대조하세요."
      : undefined;
  return reference(
    activity,
    isPrimary ? "primary" : "supporting",
    category,
    isPrimary
      ? "교사가 검토 완료한 구조화된 직접 관찰·평가 근거입니다."
      : evidence.reviewStatus === "raw"
        ? "구조화되었지만 아직 교사 검토가 완료되지 않은 RAW 근거입니다."
        : "상담·자기평가·상호평가·외부 자료 등 추가 확인이 필요한 보조 근거입니다.",
    warning
  );
}

function classifyCreative(activity: ActivityEntry): SchoolRecordReference {
  const text = activityText(activity);
  if (activity.kind !== "record") {
    return reference(activity, "excluded", "영역 외 운영 자료", "창의적 체험활동의 참여 과정에 대한 개별 관찰 기록이 아닙니다.");
  }
  if (DISALLOWED_PATTERN.test(text)) {
    return reference(activity, "excluded", "기재 제외 가능 자료", "대회·수상·방과후 활동 등 기재 제한 여부를 먼저 확인해야 합니다.");
  }
  if (CAREER_PATTERN.test(text)) {
    return reference(activity, "primary", "진로활동", "흥미·적성·진로 탐색 과정과 참여 태도를 확인할 수 있는 자료입니다.");
  }
  if (CLUB_PATTERN.test(text)) {
    return reference(activity, "primary", "동아리활동", "동아리에서의 실제 역할, 참여와 협력 과정을 확인할 수 있는 자료입니다.");
  }
  if (AUTONOMY_PATTERN.test(text)) {
    return reference(activity, "primary", "자율·자치활동", "자율·자치활동의 참여 과정과 실제 역할을 확인할 수 있는 자료입니다.");
  }
  if (VOLUNTEER_PATTERN.test(text)) {
    return reference(
      activity,
      "supporting",
      "봉사활동 참고",
      "학교 교육계획에 따른 활동인지 확인한 뒤 관련 영역의 보조 자료로 사용합니다.",
      "개인 봉사나 단순 선행으로 단정하지 말고 학교 계획과 실제 역할을 확인하세요."
    );
  }
  return reference(
    activity,
    "supporting",
    "활동 영역 추가 확인",
    "개별 기록이지만 자율·자치, 동아리, 진로 중 어느 활동인지 원문에서 추가 확인해야 합니다."
  );
}

function classifySubject(activity: ActivityEntry): SchoolRecordReference {
  const text = activityText(activity);
  if (DISALLOWED_PATTERN.test(text)) {
    return reference(activity, "excluded", "기재 제외 자료", "대회·수상, 방과후 활동 또는 공개강좌 관련 내용은 초안 근거로 사용하지 않습니다.");
  }
  if (activity.kind === "assignment") {
    return reference(
      activity,
      "supporting",
      detectSubject(text),
      "과제 제목과 교사 메모는 관련 수업·평가 근거를 찾는 보조 자료입니다.",
      "제출·미제출·보완 상태만으로 성취수준이나 학습 태도를 판단하지 마세요."
    );
  }
  if (activity.kind !== "record") {
    return reference(activity, "excluded", "영역 외 운영 자료", "교과 성취기준에 따른 수업·평가의 관찰 자료가 아닙니다.");
  }
  const subject = detectSubject(text);
  const isDirectObservation = !/(?:상담|보호자\s*연락)/i.test(activity.status);
  if (subject !== "교과 미분류" || LEARNING_PATTERN.test(text)) {
    return reference(
      activity,
      isDirectObservation ? "primary" : "supporting",
      subject,
      isDirectObservation
        ? "수업·평가 과정에서 나타난 수행 특성이나 변화로 검토할 수 있는 관찰 자료입니다."
        : "상담·보호자 전달 자료이므로 교사의 직접 관찰·평가 기록과 대조해야 합니다.",
      subject === "교과 미분류" ? "공식 초안에 쓰기 전에 해당 교과와 성취기준을 연결하세요." : undefined
    );
  }
  return reference(activity, "excluded", "교과 근거 확인 불가", "교과, 성취기준 또는 수업·평가 맥락을 자동으로 확인할 수 없습니다.");
}

function classifyBehavior(activity: ActivityEntry): SchoolRecordReference {
  const text = activityText(activity);
  if (DISALLOWED_PATTERN.test(text)) {
    return reference(activity, "excluded", "기재 제외 자료", "대회·수상, 방과후 활동 또는 공개강좌 관련 내용은 행동특성 초안 근거로 사용하지 않습니다.");
  }
  if (/(?:영재교육|영재학급|영재교육원)/.test(text)) {
    return reference(activity, "excluded", "교과 영역 자료", "영재교육 이수 내용은 관련 교과에서 검토해야 합니다.");
  }
  if (activity.kind === "record") {
    const isDirectObservation = !/(?:상담|보호자\s*연락)/i.test(activity.status);
    return reference(
      activity,
      isDirectObservation ? "primary" : "supporting",
      detectBehaviorCategory(text),
      isDirectObservation
        ? "교사의 지속적인 관찰 기록으로 행동의 강점과 변화 여부를 확인할 수 있습니다."
        : "상담·보호자 전달 자료이므로 교사의 직접 관찰 누가기록과 대조해야 합니다."
    );
  }
  if (activity.kind === "attendance" && activity.status !== "출석") {
    return reference(
      activity,
      "supporting",
      "출결 맥락 확인",
      "지각·결석·조퇴·결과의 사유와 지원 맥락을 확인하는 자료입니다.",
      "출결 예외 자체를 성실성이나 인성에 대한 판단으로 사용하지 마세요."
    );
  }
  if (activity.kind === "assignment") {
    return reference(
      activity,
      "supporting",
      "학습 태도 추가 확인",
      "반복된 학습 과정의 맥락을 찾기 위한 보조 자료입니다.",
      "과제 상태만으로 행동 특성을 판단하지 말고 직접 관찰 기록을 확인하세요."
    );
  }
  return reference(activity, "excluded", "개별 행동 근거 아님", "학생의 학습·행동·인성을 직접 관찰한 개별 누가기록이 아닙니다.");
}

function detectSubject(text: string): string {
  return SUBJECT_PATTERNS.find(([, pattern]) => pattern.test(text))?.[0] ?? "교과 미분류";
}

function detectBehaviorCategory(text: string): string {
  return BEHAVIOR_CATEGORIES.find(([, pattern]) => pattern.test(text))?.[0] ?? "종합 관찰";
}

function activityText(activity: ActivityEntry): string {
  const evidence = activity.schoolRecordEvidence
    ? Object.values(activity.schoolRecordEvidence)
        .filter((value): value is string => typeof value === "string")
    : [];
  return [activity.title, activity.status, activity.detail, ...evidence].join(" ");
}

function structuredCategory(area: SchoolRecordArea, subarea: string, subject: string): string {
  if (area === "subject-development") return subject || SCHOOL_RECORD_SUBAREAS[area][subarea] || "교과 미분류";
  return SCHOOL_RECORD_SUBAREAS[area][subarea] || subarea || "세부 영역 미분류";
}

function reference(
  activity: ActivityEntry,
  level: SchoolRecordReferenceLevel,
  category: string,
  reason: string,
  warning?: string
): SchoolRecordReference {
  return { activity, level, category, reason, warning };
}
