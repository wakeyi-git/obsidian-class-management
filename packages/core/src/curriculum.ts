import type { TFile } from "obsidian";
import { booleanValue, yamlString } from "./utils";
import type {
  ClassManagementSettings,
  ConceptInquiryPhase,
  ConceptInquiryStrand,
  CurriculumDesignApproach,
  CurriculumKnowledgeStructure,
  CurriculumLesson,
  CurriculumLessonStatus,
  CurriculumUnit,
  CurriculumUnitStatus,
  NewCurriculumLesson,
  NewCurriculumUnit
} from "./types";

export const CURRICULUM_DESIGN_APPROACH_LABELS: Record<CurriculumDesignApproach, string> = {
  "within-subject": "교과 내 재구성",
  interdisciplinary: "교과 간·비교과 통합",
  "backward-design": "이해중심 백워드 설계"
};

export const CURRICULUM_UNIT_STATUS_LABELS: Record<CurriculumUnitStatus, string> = {
  draft: "설계 중",
  ready: "실행 준비",
  "in-progress": "운영 중",
  completed: "운영 완료"
};

export const CURRICULUM_LESSON_STATUS_LABELS: Record<CurriculumLessonStatus, string> = {
  planned: "계획",
  completed: "실행 완료"
};

export const CURRICULUM_KNOWLEDGE_STRUCTURE_LABELS: Record<CurriculumKnowledgeStructure, string> = {
  knowledge: "지식 구조 중심",
  process: "과정 구조 중심",
  "knowledge-process": "지식+과정 구조"
};

export const CONCEPT_INQUIRY_PHASE_LABELS: Record<ConceptInquiryPhase, string> = {
  engage: "참여·관계 맺기",
  focus: "집중하기",
  investigate: "조사하기",
  organize: "조직·정리하기",
  generalize: "일반화하기",
  transfer: "전이하기",
  reflect: "성찰하기"
};

export const DEFAULT_CONCEPT_INQUIRY_PHASES = Object.keys(
  CONCEPT_INQUIRY_PHASE_LABELS
) as ConceptInquiryPhase[];

export const EVALUATION_METHOD_OPTIONS = [
  "관찰평가",
  "자기평가",
  "동료평가",
  "구술·발표",
  "서술·논술",
  "프로젝트",
  "실험·실습",
  "포트폴리오"
] as const;

export interface CurriculumAlignmentIssue {
  stage: "curriculum" | "lesson" | "assessment" | "record";
  severity: "error" | "warning";
  message: string;
}

export interface CurriculumAlignmentAudit {
  score: number;
  linkedStages: number;
  totalStages: 4;
  issues: CurriculumAlignmentIssue[];
}

export interface ConceptInquiryAudit {
  score: number;
  completed: number;
  total: 10;
  issues: CurriculumAlignmentIssue[];
}

export function emptyCurriculumUnit(settings: ClassManagementSettings): NewCurriculumUnit {
  return {
    id: createCurriculumId("unit"),
    subject: settings.schoolSubjects[0] ?? "",
    grade: settings.grade,
    semester: settings.semester,
    unitName: "",
    theme: "",
    designApproach: "backward-design",
    status: "draft",
    startDate: "",
    endDate: "",
    plannedHours: 1,
    achievementStandards: "",
    studentNeeds: "",
    enduringUnderstanding: "",
    essentialQuestion: "",
    competencies: "",
    assessmentTask: "",
    evaluationCriteria: "",
    evaluationMethods: [],
    feedbackPlan: "",
    recordFocus: "",
    learningPlan: "",
    connectedSubjects: [],
    conceptInquiryEnabled: false,
    unitOverview: "",
    keyIdea: "",
    conceptualLens: "",
    macroConcepts: [],
    microConcepts: [],
    knowledgeStructure: "knowledge-process",
    conceptMap: "",
    conceptInquiryStrands: [],
    inquiryPhases: [...DEFAULT_CONCEPT_INQUIRY_PHASES],
    priorKnowledge: "",
    transferContext: "",
    studentAgency: "",
    analyticRubric: ""
  };
}

export function emptyCurriculumLesson(unit: CurriculumUnit | null): NewCurriculumLesson {
  return {
    id: createCurriculumId("lesson"),
    unitId: unit?.id ?? "",
    unitTitle: unit?.unitName ?? "",
    unitPath: unit ? unit.file.path.replace(/\.md$/i, "") : "",
    subject: unit?.subject ?? "",
    date: "",
    period: "",
    sequence: 1,
    hours: 1,
    objective: "",
    activities: "",
    studentParticipation: "",
    assessmentEvidence: "",
    feedback: "",
    reflection: "",
    conceptInquiryPhase: unit?.conceptInquiryEnabled ? "engage" : "",
    conceptInquiryStrandId: unit?.conceptInquiryStrands[0]?.id ?? "",
    conceptInquiryStrandTitle: unit?.conceptInquiryStrands[0]?.title ?? "",
    studentGeneralization: "",
    transferEvidence: "",
    status: "planned",
    recordStatus: ""
  };
}

export function createConceptInquiryStrand(index = 1): ConceptInquiryStrand {
  return {
    id: createCurriculumId("strand"),
    title: `스트랜드 ${index}`,
    generalization: "",
    factualQuestions: "",
    conceptualQuestions: "",
    debatableQuestions: "",
    contentKnowledge: "",
    coreSkills: "",
    evaluationMethods: ""
  };
}

export function auditCurriculumAlignment(unit: NewCurriculumUnit | CurriculumUnit): CurriculumAlignmentAudit {
  const issues: CurriculumAlignmentIssue[] = [];
  const curriculumLinked = Boolean(unit.achievementStandards.trim() && unit.enduringUnderstanding.trim());
  const lessonLinked = Boolean(unit.learningPlan.trim() && unit.essentialQuestion.trim());
  const assessmentLinked = Boolean(
    unit.assessmentTask.trim() && unit.evaluationCriteria.trim() && unit.evaluationMethods.length
  );
  const recordLinked = Boolean(unit.feedbackPlan.trim() && unit.recordFocus.trim());

  if (!unit.achievementStandards.trim()) {
    issues.push({ stage: "curriculum", severity: "error", message: "성취기준이 없어 교육과정과 수업의 연결을 확인할 수 없습니다." });
  }
  if (!unit.enduringUnderstanding.trim()) {
    issues.push({ stage: "curriculum", severity: "warning", message: "학생이 오래 간직할 핵심 이해를 적어 주세요." });
  }
  if (!unit.studentNeeds.trim()) {
    issues.push({ stage: "curriculum", severity: "warning", message: "학생의 삶·흥미·선행 경험에 관한 요구 분석이 비어 있습니다." });
  }
  if (!unit.essentialQuestion.trim()) {
    issues.push({ stage: "lesson", severity: "warning", message: "성취기준을 탐구할 핵심 질문이 없습니다." });
  }
  if (!unit.learningPlan.trim()) {
    issues.push({ stage: "lesson", severity: "error", message: "학생 중심 학습 경험과 차시 흐름을 설계해 주세요." });
  }
  if (!unit.assessmentTask.trim()) {
    issues.push({ stage: "assessment", severity: "error", message: "목표 도달을 확인할 수행·평가 증거가 없습니다." });
  }
  if (!unit.evaluationCriteria.trim()) {
    issues.push({ stage: "assessment", severity: "error", message: "성취기준에서 도출한 평가요소·준거가 없습니다." });
  }
  if (!unit.evaluationMethods.length) {
    issues.push({ stage: "assessment", severity: "warning", message: "수업 과정에서 사용할 평가방법을 선택해 주세요." });
  }
  if (!unit.feedbackPlan.trim()) {
    issues.push({ stage: "record", severity: "warning", message: "평가 결과를 수업 개선과 학생 성장에 되돌릴 피드백 계획이 없습니다." });
  }
  if (!unit.recordFocus.trim()) {
    issues.push({ stage: "record", severity: "warning", message: "학생별로 관찰·기록할 구체적인 초점이 없습니다." });
  }

  const linkedStages = [curriculumLinked, lessonLinked, assessmentLinked, recordLinked]
    .filter(Boolean).length;
  return {
    score: linkedStages * 25,
    linkedStages,
    totalStages: 4,
    issues
  };
}

export function auditConceptInquiryDesign(
  unit: NewCurriculumUnit | CurriculumUnit
): ConceptInquiryAudit {
  if (!unit.conceptInquiryEnabled) return { score: 0, completed: 0, total: 10, issues: [] };
  const issues: CurriculumAlignmentIssue[] = [];
  const strands = unit.conceptInquiryStrands;
  const hasLensAndConcepts = Boolean(
    unit.conceptualLens.trim() && (unit.macroConcepts.length || unit.microConcepts.length)
  );
  const hasGeneralizations = Boolean(strands.length && strands.every((strand) => strand.generalization.trim()));
  const hasQuestions = Boolean(strands.length && strands.every((strand) =>
    questionCount(strand.conceptualQuestions) > 0
  ));
  const hasContentAndSkills = Boolean(strands.length && strands.every((strand) =>
    strand.contentKnowledge.trim() && strand.coreSkills.trim()
  ));
  const hasInquiryCycle = ["generalize", "transfer", "reflect"].every((phase) =>
    unit.inquiryPhases.includes(phase as ConceptInquiryPhase)
  );
  const checks = [
    Boolean(unit.keyIdea.trim()),
    hasLensAndConcepts,
    Boolean(strands.length && strands.every((strand) => strand.title.trim())),
    hasGeneralizations,
    hasQuestions,
    hasContentAndSkills,
    hasInquiryCycle,
    Boolean(unit.priorKnowledge.trim() && unit.studentAgency.trim()),
    Boolean(unit.transferContext.trim()),
    Boolean(unit.analyticRubric.trim())
  ];

  if (!unit.keyIdea.trim()) issues.push(conceptError("2022 개정 교육과정의 핵심 아이디어를 입력해 주세요."));
  if (!unit.conceptualLens.trim()) issues.push(conceptError("단원의 학습 방향과 깊이를 정할 개념적 렌즈가 없습니다."));
  if (!unit.macroConcepts.length && !unit.microConcepts.length) {
    issues.push(conceptError("개념적 렌즈와 연결할 매크로 또는 마이크로 개념을 입력해 주세요."));
  }
  if (unit.conceptualLens.trim().length > 30) {
    issues.push(conceptWarning("개념적 렌즈는 활동 문장보다 전이 가능한 한두 단어의 개념으로 간결하게 표현하는 것이 좋습니다."));
  }
  if (!strands.length) issues.push(conceptError("개념 렌즈로 조직한 스트랜드를 한 개 이상 추가해 주세요."));
  strands.forEach((strand, index) => {
    const label = strand.title.trim() || `스트랜드 ${index + 1}`;
    if (!strand.generalization.trim()) issues.push(conceptError(`${label}: 개념 간 관계를 나타내는 일반화 진술이 없습니다.`));
    else if (/\?$/.test(strand.generalization.trim())) issues.push(conceptWarning(`${label}: 일반화는 질문이 아니라 개념 간 관계를 나타내는 완결된 진술문이어야 합니다.`));
    const conceptualCount = questionCount(strand.conceptualQuestions);
    const debatableCount = questionCount(strand.debatableQuestions);
    if (conceptualCount < 3 || conceptualCount > 5) {
      issues.push(conceptWarning(`${label}: 개념적 질문은 3~5개를 권장합니다. 현재 ${conceptualCount}개입니다.`));
    }
    if (debatableCount > 2) issues.push(conceptWarning(`${label}: 논쟁적 질문은 1~2개 이내를 권장합니다.`));
    if (!strand.contentKnowledge.trim()) issues.push(conceptWarning(`${label}: 일반화를 뒷받침할 내용 지식이 없습니다.`));
    if (!strand.coreSkills.trim()) issues.push(conceptWarning(`${label}: 탐구와 전이에 사용할 핵심 기능이 없습니다.`));
  });
  if (!hasInquiryCycle) issues.push(conceptError("탐구 단계에는 일반화·전이·성찰이 포함되어야 합니다."));
  if (!unit.priorKnowledge.trim()) issues.push(conceptWarning("학생의 사전학습과 기존 개념을 가시화할 계획이 없습니다."));
  if (!unit.studentAgency.trim()) issues.push(conceptWarning("학생의 질문·선택·의사결정 등 주도성을 보장할 계획이 없습니다."));
  if (!unit.transferContext.trim()) issues.push(conceptError("일반화를 새로운 상황에 적용할 전이 맥락을 입력해 주세요."));
  if (!unit.analyticRubric.trim()) issues.push(conceptError("지식·이해, 과정·기능, 가치·태도를 확인할 분석적 루브릭이 없습니다."));

  const completed = checks.filter(Boolean).length;
  return { score: completed * 10, completed, total: 10, issues };
}

export function curriculumUnitMarkdown(
  unit: NewCurriculumUnit | CurriculumUnit,
  settings: ClassManagementSettings
): string {
  const audit = auditCurriculumAlignment(unit);
  return [
    "---",
    "class-management: curriculum-unit",
    `curriculumUnitId: ${yamlString(unit.id)}`,
    `class: ${yamlString(settings.className)}`,
    `schoolYear: ${yamlString(settings.schoolYear)}`,
    `semester: ${yamlString(unit.semester)}`,
    `grade: ${yamlString(unit.grade)}`,
    `subject: ${yamlString(unit.subject)}`,
    `unitName: ${yamlString(unit.unitName)}`,
    `theme: ${yamlString(unit.theme)}`,
    `designApproach: ${yamlString(unit.designApproach)}`,
    `curriculumStatus: ${yamlString(unit.status)}`,
    `startDate: ${yamlString(unit.startDate)}`,
    `endDate: ${yamlString(unit.endDate)}`,
    `plannedHours: ${Math.max(0, unit.plannedHours)}`,
    `achievementStandards: ${yamlString(unit.achievementStandards)}`,
    `studentNeeds: ${yamlString(unit.studentNeeds)}`,
    `enduringUnderstanding: ${yamlString(unit.enduringUnderstanding)}`,
    `essentialQuestion: ${yamlString(unit.essentialQuestion)}`,
    `competencies: ${yamlString(unit.competencies)}`,
    `assessmentTask: ${yamlString(unit.assessmentTask)}`,
    `evaluationCriteria: ${yamlString(unit.evaluationCriteria)}`,
    `evaluationMethods: ${JSON.stringify(unit.evaluationMethods)}`,
    `feedbackPlan: ${yamlString(unit.feedbackPlan)}`,
    `recordFocus: ${yamlString(unit.recordFocus)}`,
    `learningPlan: ${yamlString(unit.learningPlan)}`,
    `connectedSubjects: ${JSON.stringify(unit.connectedSubjects)}`,
    `conceptInquiryEnabled: ${unit.conceptInquiryEnabled ? "true" : "false"}`,
    `unitOverview: ${yamlString(unit.unitOverview)}`,
    `keyIdea: ${yamlString(unit.keyIdea)}`,
    `conceptualLens: ${yamlString(unit.conceptualLens)}`,
    `macroConcepts: ${JSON.stringify(unit.macroConcepts)}`,
    `microConcepts: ${JSON.stringify(unit.microConcepts)}`,
    `knowledgeStructure: ${yamlString(unit.knowledgeStructure)}`,
    `conceptMap: ${yamlString(unit.conceptMap)}`,
    // 객체 배열은 옵시디언 속성 편집기가 못 다루므로 JSON 문자열로 저장한다(파서는 양쪽 다 읽음).
    `conceptInquiryStrands: ${yamlString(JSON.stringify(unit.conceptInquiryStrands))}`,
    `inquiryPhases: ${JSON.stringify(unit.inquiryPhases)}`,
    `priorKnowledge: ${yamlString(unit.priorKnowledge)}`,
    `transferContext: ${yamlString(unit.transferContext)}`,
    `studentAgency: ${yamlString(unit.studentAgency)}`,
    `analyticRubric: ${yamlString(unit.analyticRubric)}`,
    `alignmentScore: ${audit.score}`,
    `conceptInquiryScore: ${unit.conceptInquiryEnabled ? auditConceptInquiryDesign(unit).score : 0}`,
    "tags:",
    "  - class-management/curriculum",
    "  - class-management/curriculum-unit",
    "---",
    "",
    `# ${unit.subject} · ${unit.unitName}`,
    "",
    `> ${settings.curriculum} · ${unit.grade}학년 ${unit.semester} · ${CURRICULUM_DESIGN_APPROACH_LABELS[unit.designApproach]}`,
    "",
    "## 1. 교육과정 재인식과 학생 요구",
    "",
    `- 성취기준: ${unit.achievementStandards || "미입력"}`,
    `- 학생 요구·삶의 맥락: ${unit.studentNeeds || "미입력"}`,
    `- 핵심역량: ${unit.competencies || "미입력"}`,
    "",
    ...conceptInquiryMarkdown(unit),
    "## 2. 바라는 결과",
    "",
    `- 핵심 이해: ${unit.enduringUnderstanding || "미입력"}`,
    `- 핵심 질문: ${unit.essentialQuestion || "미입력"}`,
    `- 주제·맥락: ${unit.theme || "미입력"}`,
    "",
    "## 3. 수용할 만한 증거와 평가",
    "",
    `- 수행과제: ${unit.assessmentTask || "미입력"}`,
    `- 평가요소·준거: ${unit.evaluationCriteria || "미입력"}`,
    `- 평가방법: ${unit.evaluationMethods.join(", ") || "미입력"}`,
    "",
    "## 4. 학습 경험과 수업 계획",
    "",
    unit.learningPlan || "미입력",
    "",
    "## 5. 피드백과 기록 계획",
    "",
    `- 피드백 계획: ${unit.feedbackPlan || "미입력"}`,
    `- 학생별 관찰·기록 초점: ${unit.recordFocus || "미입력"}`,
    "",
    "## 6. 연계 기록",
    "",
    "이 단원을 링크한 수업일지·과제·학생부 근거가 아래에 자동으로 모입니다.",
    "",
    "![[연계 기록.base]]",
    "",
    "## 일체화 점검",
    "",
    `- 연결도: ${audit.score}% (${audit.linkedStages}/${audit.totalStages}단계)`,
    ...audit.issues.map((issue) => `- [ ] ${issue.message}`),
    ""
  ].join("\n");
}

export function curriculumLessonMarkdown(
  lesson: NewCurriculumLesson | CurriculumLesson,
  settings: ClassManagementSettings
): string {
  const section = (title: string, body: string): string[] =>
    body.trim() ? [`## ${title}`, "", body, ""] : [];
  const generalizationLines = [
    ...(lesson.studentGeneralization.trim()
      ? [`- 학생 일반화: ${lesson.studentGeneralization}`]
      : []),
    ...(lesson.transferEvidence.trim()
      ? [`- 새로운 맥락으로의 전이: ${lesson.transferEvidence}`]
      : [])
  ];
  const sections = [
    ...section("수업 목표", lesson.objective),
    ...section("학생 중심 학습 활동", lesson.activities),
    ...section("과정중심 평가 증거", lesson.assessmentEvidence),
    ...section("학생 참여와 배움", lesson.studentParticipation),
    ...section("피드백", lesson.feedback),
    ...(generalizationLines.length
      ? ["## 학생이 형성한 일반화와 전이 증거", "", ...generalizationLines, ""]
      : []),
    ...section("교사 성찰", lesson.reflection)
  ];
  return [
    "---",
    "class-management: curriculum-lesson",
    `curriculumLessonId: ${yamlString(lesson.id)}`,
    `curriculumUnitId: ${yamlString(lesson.unitId)}`,
    `curriculumUnitTitle: ${yamlString(lesson.unitTitle)}`,
    `curriculumUnitPath: ${yamlString(lesson.unitPath ? `[[${lesson.unitPath}]]` : "")}`,
    `class: ${yamlString(settings.className)}`,
    `schoolYear: ${yamlString(settings.schoolYear)}`,
    `semester: ${yamlString(settings.semester)}`,
    `subject: ${yamlString(lesson.subject)}`,
    `date: ${yamlString(lesson.date)}`,
    `period: ${yamlString(lesson.period)}`,
    `sequence: ${Math.max(1, lesson.sequence)}`,
    `lessonHours: ${Math.max(0.5, lesson.hours)}`,
    `lessonObjective: ${yamlString(lesson.objective)}`,
    `lessonActivities: ${yamlString(lesson.activities)}`,
    `studentParticipation: ${yamlString(lesson.studentParticipation)}`,
    `assessmentEvidence: ${yamlString(lesson.assessmentEvidence)}`,
    `feedback: ${yamlString(lesson.feedback)}`,
    `reflection: ${yamlString(lesson.reflection)}`,
    `conceptInquiryPhase: ${yamlString(lesson.conceptInquiryPhase)}`,
    `conceptInquiryStrandId: ${yamlString(lesson.conceptInquiryStrandId)}`,
    `conceptInquiryStrandTitle: ${yamlString(lesson.conceptInquiryStrandTitle)}`,
    `studentGeneralization: ${yamlString(lesson.studentGeneralization)}`,
    `transferEvidence: ${yamlString(lesson.transferEvidence)}`,
    `lessonStatus: ${yamlString(lesson.status)}`,
    `recordStatus: ${yamlString(lesson.recordStatus)}`,
    "tags:",
    "  - class-management/curriculum-lesson",
    "---",
    "",
    `# ${lesson.date || "날짜 미정"} · ${lesson.subject} ${lesson.sequence}차시`,
    "",
    ...(lesson.unitPath ? [`- 단원: [[${lesson.unitPath}|${lesson.unitTitle}]]`] : []),
    `- 교시: ${lesson.period || "미정"}`,
    `- 상태: ${CURRICULUM_LESSON_STATUS_LABELS[lesson.status]}`,
    ...(lesson.conceptInquiryPhase ? [`- 탐구 단계: ${CONCEPT_INQUIRY_PHASE_LABELS[lesson.conceptInquiryPhase]}`] : []),
    ...(lesson.conceptInquiryStrandTitle ? [`- 스트랜드: ${lesson.conceptInquiryStrandTitle}`] : []),
    "",
    ...(sections.length ? sections : ["## 기록", ""])
  ].join("\n");
}

export function parseCurriculumUnit(
  file: TFile,
  frontmatter: Record<string, unknown> | undefined
): CurriculumUnit | null {
  if (frontmatter?.["class-management"] !== "curriculum-unit") return null;
  const approach = stringValue(frontmatter.designApproach) as CurriculumDesignApproach;
  const status = stringValue(frontmatter.curriculumStatus) as CurriculumUnitStatus;
  const knowledgeStructure = stringValue(frontmatter.knowledgeStructure) as CurriculumKnowledgeStructure;
  return {
    file,
    id: stringValue(frontmatter.curriculumUnitId, file.basename),
    subject: stringValue(frontmatter.subject),
    grade: stringValue(frontmatter.grade),
    semester: stringValue(frontmatter.semester),
    unitName: stringValue(frontmatter.unitName, file.basename),
    theme: stringValue(frontmatter.theme),
    designApproach: approach in CURRICULUM_DESIGN_APPROACH_LABELS ? approach : "backward-design",
    status: status in CURRICULUM_UNIT_STATUS_LABELS ? status : "draft",
    startDate: stringValue(frontmatter.startDate),
    endDate: stringValue(frontmatter.endDate),
    // 0시수 허용 — 전량 통합 이관된 일반 단원(원장 규칙: 일반=자체 운영분).
    plannedHours: nonNegativeNumber(frontmatter.plannedHours, 1),
    achievementStandards: stringValue(frontmatter.achievementStandards),
    studentNeeds: stringValue(frontmatter.studentNeeds),
    enduringUnderstanding: stringValue(frontmatter.enduringUnderstanding),
    essentialQuestion: stringValue(frontmatter.essentialQuestion),
    competencies: stringValue(frontmatter.competencies),
    assessmentTask: stringValue(frontmatter.assessmentTask),
    evaluationCriteria: stringValue(frontmatter.evaluationCriteria),
    evaluationMethods: stringArray(frontmatter.evaluationMethods),
    feedbackPlan: stringValue(frontmatter.feedbackPlan),
    recordFocus: stringValue(frontmatter.recordFocus),
    learningPlan: stringValue(frontmatter.learningPlan),
    connectedSubjects: stringArray(frontmatter.connectedSubjects),
    conceptInquiryEnabled: booleanValue(frontmatter.conceptInquiryEnabled, false),
    unitOverview: stringValue(frontmatter.unitOverview),
    keyIdea: stringValue(frontmatter.keyIdea),
    conceptualLens: stringValue(frontmatter.conceptualLens),
    macroConcepts: stringArray(frontmatter.macroConcepts),
    microConcepts: stringArray(frontmatter.microConcepts),
    knowledgeStructure: knowledgeStructure in CURRICULUM_KNOWLEDGE_STRUCTURE_LABELS
      ? knowledgeStructure
      : "knowledge-process",
    conceptMap: stringValue(frontmatter.conceptMap),
    conceptInquiryStrands: conceptStrands(frontmatter.conceptInquiryStrands),
    inquiryPhases: conceptPhases(frontmatter.inquiryPhases),
    priorKnowledge: stringValue(frontmatter.priorKnowledge),
    transferContext: stringValue(frontmatter.transferContext),
    studentAgency: stringValue(frontmatter.studentAgency),
    analyticRubric: stringValue(frontmatter.analyticRubric),
    createdAt: file.stat.ctime
  };
}

export function parseCurriculumLesson(
  file: TFile,
  frontmatter: Record<string, unknown> | undefined
): CurriculumLesson | null {
  if (frontmatter?.["class-management"] !== "curriculum-lesson") return null;
  const status = stringValue(frontmatter.lessonStatus) as CurriculumLessonStatus;
  return {
    file,
    id: stringValue(frontmatter.curriculumLessonId, file.basename),
    unitId: stringValue(frontmatter.curriculumUnitId),
    unitTitle: stringValue(frontmatter.curriculumUnitTitle),
    unitPath: stripWikiLink(stringValue(frontmatter.curriculumUnitPath)),
    subject: stringValue(frontmatter.subject),
    date: stringValue(frontmatter.date),
    period: stringValue(frontmatter.period),
    sequence: positiveNumber(frontmatter.sequence, 1),
    hours: positiveNumber(frontmatter.lessonHours, 1),
    objective: stringValue(frontmatter.lessonObjective),
    activities: stringValue(frontmatter.lessonActivities),
    studentParticipation: stringValue(frontmatter.studentParticipation),
    assessmentEvidence: stringValue(frontmatter.assessmentEvidence),
    feedback: stringValue(frontmatter.feedback),
    reflection: stringValue(frontmatter.reflection),
    conceptInquiryPhase: conceptPhase(frontmatter.conceptInquiryPhase),
    conceptInquiryStrandId: stringValue(frontmatter.conceptInquiryStrandId),
    conceptInquiryStrandTitle: stringValue(frontmatter.conceptInquiryStrandTitle),
    studentGeneralization: stringValue(frontmatter.studentGeneralization),
    transferEvidence: stringValue(frontmatter.transferEvidence),
    status: status in CURRICULUM_LESSON_STATUS_LABELS ? status : "planned",
    recordStatus: stringValue(frontmatter.recordStatus),
    createdAt: file.stat.ctime
  };
}

export function taughtHoursForUnit(unitId: string, lessons: CurriculumLesson[]): number {
  return lessons
    .filter((lesson) => lesson.unitId === unitId && lesson.status === "completed")
    .reduce((sum, lesson) => sum + lesson.hours, 0);
}

function conceptInquiryMarkdown(unit: NewCurriculumUnit | CurriculumUnit): string[] {
  if (!unit.conceptInquiryEnabled) return [];
  const audit = auditConceptInquiryDesign(unit);
  return [
    "## 개념기반 탐구학습 설계",
    "",
    `- 설계 완성도: ${audit.score}% (${audit.completed}/${audit.total})`,
    `- 단원 개요: ${unit.unitOverview || "미입력"}`,
    `- 핵심 아이디어: ${unit.keyIdea || "미입력"}`,
    `- 개념적 렌즈: ${unit.conceptualLens || "미입력"}`,
    `- 매크로 개념: ${unit.macroConcepts.join(", ") || "미입력"}`,
    `- 마이크로 개념: ${unit.microConcepts.join(", ") || "미입력"}`,
    `- 지식·과정 구조: ${CURRICULUM_KNOWLEDGE_STRUCTURE_LABELS[unit.knowledgeStructure]}`,
    `- 사전학습 가시화: ${unit.priorKnowledge || "미입력"}`,
    `- 학생 주도성: ${unit.studentAgency || "미입력"}`,
    `- 전이 맥락: ${unit.transferContext || "미입력"}`,
    `- 탐구 단계: ${unit.inquiryPhases.map((phase) => CONCEPT_INQUIRY_PHASE_LABELS[phase]).join(" → ")}`,
    "",
    "### 개념망",
    "",
    unit.conceptMap || "미입력",
    "",
    "### 스트랜드별 지도 계획",
    "",
    ...unit.conceptInquiryStrands.flatMap((strand, index) => [
      `#### ${index + 1}. ${strand.title || `스트랜드 ${index + 1}`}`,
      "",
      `- 일반화: ${strand.generalization || "미입력"}`,
      `- 사실적 질문: ${inlineList(strand.factualQuestions)}`,
      `- 개념적 질문: ${inlineList(strand.conceptualQuestions)}`,
      `- 논쟁적 질문: ${inlineList(strand.debatableQuestions)}`,
      `- 내용 지식: ${strand.contentKnowledge || "미입력"}`,
      `- 핵심 기능: ${strand.coreSkills || "미입력"}`,
      `- 평가방법: ${strand.evaluationMethods || "미입력"}`,
      ""
    ]),
    "### 분석적 루브릭",
    "",
    unit.analyticRubric || "미입력",
    "",
    "### 개념기반 설계 점검",
    "",
    ...(audit.issues.length
      ? audit.issues.map((issue) => `- [ ] ${issue.message}`)
      : ["- [x] 개념기반 탐구학습의 핵심 설계 요소를 모두 확인했습니다."]),
    ""
  ];
}

function createCurriculumId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function stringValue(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value);
}

function stringArray(value: unknown): string[] {
  if (Array.isArray(value)) return value.map(String).map((item) => item.trim()).filter(Boolean);
  if (!value) return [];
  if (typeof value === "string" && value.trim().startsWith("[")) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) return parsed.map(String).map((item) => item.trim()).filter(Boolean);
    } catch {
      // 쉼표·줄바꿈 목록으로 계속 파싱합니다.
    }
  }
  return String(value).split(/[,\n]/).map((item) => item.trim()).filter(Boolean);
}

function conceptStrands(value: unknown): ConceptInquiryStrand[] {
  let entries: unknown[] = [];
  if (Array.isArray(value)) entries = value;
  else if (typeof value === "string" && value.trim()) {
    try {
      const parsed = JSON.parse(value) as unknown;
      if (Array.isArray(parsed)) entries = parsed;
    } catch {
      return [];
    }
  }
  return entries.flatMap((entry, index) => {
    if (!entry || typeof entry !== "object") return [];
    const raw = entry as Record<string, unknown>;
    return [{
      id: stringValue(raw.id, createCurriculumId("strand")),
      title: stringValue(raw.title, `스트랜드 ${index + 1}`),
      generalization: stringValue(raw.generalization),
      factualQuestions: stringValue(raw.factualQuestions),
      conceptualQuestions: stringValue(raw.conceptualQuestions),
      debatableQuestions: stringValue(raw.debatableQuestions),
      contentKnowledge: stringValue(raw.contentKnowledge),
      coreSkills: stringValue(raw.coreSkills),
      evaluationMethods: stringValue(raw.evaluationMethods)
    }];
  });
}

function conceptPhases(value: unknown): ConceptInquiryPhase[] {
  const phases = stringArray(value).filter((phase): phase is ConceptInquiryPhase =>
    phase in CONCEPT_INQUIRY_PHASE_LABELS
  );
  return phases.length ? phases : [...DEFAULT_CONCEPT_INQUIRY_PHASES];
}

function conceptPhase(value: unknown): "" | ConceptInquiryPhase {
  const phase = stringValue(value);
  return phase in CONCEPT_INQUIRY_PHASE_LABELS ? phase as ConceptInquiryPhase : "";
}


function questionCount(value: string): number {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).length;
}

function conceptError(message: string): CurriculumAlignmentIssue {
  return { stage: "curriculum", severity: "error", message };
}

function conceptWarning(message: string): CurriculumAlignmentIssue {
  return { stage: "curriculum", severity: "warning", message };
}

function inlineList(value: string): string {
  return value.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).join(" / ") || "미입력";
}

function positiveNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function nonNegativeNumber(value: unknown, fallback: number): number {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}

function stripWikiLink(value: string): string {
  return value.replace(/^\[\[/, "").replace(/\]\]$/, "").split("|")[0] ?? value;
}

