import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const {
  auditCurriculumAlignment,
  auditConceptInquiryDesign,
  curriculumLessonMarkdown,
  curriculumUnitMarkdown,
  createConceptInquiryStrand,
  emptyCurriculumLesson,
  emptyCurriculumUnit,
  parseCurriculumLesson,
  parseCurriculumUnit,
  taughtHoursForUnit
} = await loadTypeScriptModule("../packages/core/src/curriculum.ts");

const curriculumSettings = {
  className: "우리 반",
  schoolYear: "2026",
  semester: "1학기",
  grade: "3",
  curriculum: "2022 개정 교육과정",
  schoolSubjects: ["수학", "국어"]
};

const unitDraft = emptyCurriculumUnit(curriculumSettings);
unitDraft.id = "unit-1";
unitDraft.unitName = "분수의 의미";

const strand = createConceptInquiryStrand(1);
Object.assign(strand, {
  title: "분수의 관계",
  generalization: "분수 표현은 전체와 부분의 관계에 따라 달라진다.",
  factualQuestions: "분수의 분모와 분자는 무엇을 나타내는가?",
  conceptualQuestions: "전체가 달라지면 같은 분수의 양은 어떻게 달라지는가?\n분수 표현 사이에는 어떤 관계가 있는가?\n같은 양을 서로 다른 분수로 어떻게 나타낼 수 있는가?",
  debatableQuestions: "분수는 항상 공평한 나눔을 나타내는가?",
  contentKnowledge: "분모, 분자, 단위분수, 동치분수",
  coreSkills: "비교하기, 관계 설명하기, 표현 전이하기",
  evaluationMethods: "관찰평가, 구술·발표"
});

test("빈 단원의 일체화 점수는 0이고 완성하면 100이다", () => {
  assert.equal(auditCurriculumAlignment(unitDraft).score, 0);
  Object.assign(unitDraft, {
    achievementStandards: "[4수01-10] 분수의 의미를 이해한다.",
    studentNeeds: "생활 속에서 분수를 사용한 경험을 나눈다.",
    enduringUnderstanding: "분수는 전체와 부분의 관계를 나타낸다.",
    essentialQuestion: "같은 양을 서로 다른 분수로 어떻게 나타낼까?",
    assessmentTask: "생활 속 분수 상황을 만들고 설명한다.",
    evaluationCriteria: "전체와 부분의 관계를 분수로 정확히 표현하고 설명한다.",
    evaluationMethods: ["관찰평가", "구술·발표"],
    feedbackPlan: "표현을 비교하고 수정할 재도전 기회를 제공한다.",
    recordFocus: "분수 표현을 선택한 근거와 설명 과정",
    learningPlan: "상황 탐색 → 분수 표현 → 친구의 표현 비교 → 설명 수정"
  });
  assert.equal(auditCurriculumAlignment(unitDraft).score, 100);
});

test("단원 Markdown에 판별자와 연결도가 들어간다", () => {
  const unitMarkdown = curriculumUnitMarkdown(unitDraft, curriculumSettings);
  assert.match(unitMarkdown, /class-management: curriculum-unit/);
  assert.match(unitMarkdown, /alignmentScore: 100/);
});

test("개념기반 탐구 설계를 완성하면 탐구 점수가 100이다", () => {
  Object.assign(unitDraft, {
    conceptInquiryEnabled: true,
    unitOverview: "생활 속 나눔 상황에서 분수 관계를 탐구한다.",
    keyIdea: "분수는 전체와 부분의 관계를 나타내며 다양한 방식으로 표현할 수 있다.",
    conceptualLens: "관계",
    macroConcepts: ["관계", "표현"],
    microConcepts: ["단위분수", "동치분수"],
    conceptMap: "관계 → 분수 표현 → 전이",
    conceptInquiryStrands: [strand],
    priorKnowledge: "나눔 경험을 그림과 말로 표현한다.",
    transferContext: "다른 크기의 피자 나눔을 비교하여 공정성을 설명한다.",
    studentAgency: "학생이 비교할 사례와 표현 방법을 선택한다.",
    analyticRubric: "지식·이해: 분수 관계 / 과정·기능: 설명 / 가치·태도: 근거 존중"
  });
  assert.equal(auditConceptInquiryDesign(unitDraft).score, 100);
  const conceptMarkdown = curriculumUnitMarkdown(unitDraft, curriculumSettings);
  assert.match(conceptMarkdown, /## 개념기반 탐구학습 설계/);
  assert.match(conceptMarkdown, /개념적 렌즈: 관계/);
  assert.match(conceptMarkdown, /개념적 질문:/);
});

const unitFile = { path: "학급운영/교육과정/설계/수학 분수의 의미.md", basename: "수학 분수의 의미", stat: { ctime: 10 } };

test("단원 frontmatter를 되읽는다", () => {
  const parsedUnit = parseCurriculumUnit(unitFile, {
    "class-management": "curriculum-unit",
    curriculumUnitId: unitDraft.id,
    subject: unitDraft.subject,
    unitName: unitDraft.unitName,
    designApproach: unitDraft.designApproach,
    curriculumStatus: unitDraft.status,
    plannedHours: 8,
    achievementStandards: unitDraft.achievementStandards,
    enduringUnderstanding: unitDraft.enduringUnderstanding,
    essentialQuestion: unitDraft.essentialQuestion,
    assessmentTask: unitDraft.assessmentTask,
    evaluationCriteria: unitDraft.evaluationCriteria,
    evaluationMethods: unitDraft.evaluationMethods,
    feedbackPlan: unitDraft.feedbackPlan,
    recordFocus: unitDraft.recordFocus,
    learningPlan: unitDraft.learningPlan
  });
  assert.equal(parsedUnit?.plannedHours, 8);
  assert.deepEqual(parsedUnit?.evaluationMethods, ["관찰평가", "구술·발표"]);
});

test("개념기반 필드는 JSON 문자열도 되읽는다", () => {
  const parsedConceptUnit = parseCurriculumUnit(unitFile, {
    "class-management": "curriculum-unit",
    curriculumUnitId: "unit-1",
    subject: "수학",
    unitName: "분수의 의미",
    conceptInquiryEnabled: true,
    keyIdea: unitDraft.keyIdea,
    conceptualLens: "관계",
    macroConcepts: '["관계","표현"]',
    microConcepts: ["단위분수"],
    conceptInquiryStrands: JSON.stringify([strand]),
    inquiryPhases: '["engage","generalize","transfer","reflect"]',
    knowledgeStructure: "knowledge-process"
  });
  assert.equal(parsedConceptUnit?.conceptInquiryEnabled, true);
  assert.equal(parsedConceptUnit?.conceptInquiryStrands[0]?.generalization, strand.generalization);
  assert.deepEqual(parsedConceptUnit?.inquiryPhases, ["engage", "generalize", "transfer", "reflect"]);
});

test("차시 Markdown과 되읽기, 실행 시수 집계가 맞는다", () => {
  const parsedUnit = parseCurriculumUnit(unitFile, {
    "class-management": "curriculum-unit",
    curriculumUnitId: unitDraft.id,
    subject: unitDraft.subject,
    unitName: unitDraft.unitName
  });
  const lessonDraft = emptyCurriculumLesson(parsedUnit);
  Object.assign(lessonDraft, {
    id: "lesson-1",
    date: "2026-07-21",
    objective: "분수의 의미를 설명한다.",
    activities: "분수 상황을 만들고 비교한다.",
    assessmentEvidence: "분수 표현과 설명",
    status: "completed",
    hours: 2
  });
  assert.match(curriculumLessonMarkdown(lessonDraft, curriculumSettings), /curriculumUnitPath: "\[\[/);
  const parsedLesson = parseCurriculumLesson(
    { path: "학급운영/교육과정/수업일지/차시.md", basename: "차시", stat: { ctime: 11 } },
    {
      "class-management": "curriculum-lesson",
      curriculumLessonId: "lesson-1",
      curriculumUnitId: "unit-1",
      curriculumUnitTitle: "분수의 의미",
      curriculumUnitPath: "[[학급운영/교육과정/설계/수학 분수의 의미]]",
      subject: "수학",
      date: "2026-07-21",
      sequence: 1,
      lessonHours: 2,
      conceptInquiryPhase: "transfer",
      conceptInquiryStrandId: strand.id,
      conceptInquiryStrandTitle: strand.title,
      studentGeneralization: strand.generalization,
      transferEvidence: "다른 크기의 피자 나눔 상황에 적용함",
      lessonStatus: "completed"
    }
  );
  assert.equal(parsedLesson?.unitPath, "학급운영/교육과정/설계/수학 분수의 의미");
  assert.equal(parsedLesson?.conceptInquiryPhase, "transfer");
  assert.match(parsedLesson?.transferEvidence ?? "", /피자/);
  assert.equal(taughtHoursForUnit("unit-1", [parsedLesson]), 2);
});

test("단원 없는 수업 기록(허브)도 저장·되읽기·본문 축약이 된다", () => {
  const draft = emptyCurriculumLesson(null);
  Object.assign(draft, {
    id: "lesson-hub-1",
    date: "2026-09-02",
    period: "3교시",
    subject: "국어",
    activities: "발표 연습 관찰 메모"
  });
  const markdown = curriculumLessonMarkdown(draft, curriculumSettings);
  assert.match(markdown, /curriculumUnitPath: ""/);
  assert.match(markdown, /recordStatus: ""/);
  assert.doesNotMatch(markdown, /통합 단원: \[\[/);
  assert.doesNotMatch(markdown, /## 수업 목표/); // 빈 섹션은 렌더링하지 않는다
  assert.match(markdown, /## 학생 중심 학습 활동/);

  const parsed = parseCurriculumLesson(
    { path: "학급운영/교육과정/수업일지/허브.md", basename: "허브", stat: { ctime: 12 } },
    {
      "class-management": "curriculum-lesson",
      curriculumLessonId: "lesson-hub-1",
      subject: "국어",
      date: "2026-09-02",
      period: "3교시",
      recordStatus: "raw"
    }
  );
  assert.equal(parsed?.unitId, "");
  assert.equal(parsed?.recordStatus, "raw");
  // raw 상태는 다시 저장해도 frontmatter에 보존된다
  assert.match(curriculumLessonMarkdown(parsed, curriculumSettings), /recordStatus: "raw"/);
  // 완전히 빈 기록은 메모용 기록 섹션만 남는다
  const bare = emptyCurriculumLesson(null);
  Object.assign(bare, { id: "lesson-hub-2", date: "2026-09-03", subject: "수학" });
  assert.match(curriculumLessonMarkdown(bare, curriculumSettings), /## 기록/);
});

test("conceptInquiryStrands는 JSON 문자열로 저장되고 양쪽 형태 모두 파싱된다", () => {
  const unit = emptyCurriculumUnit(curriculumSettings);
  unit.unitName = "테스트";
  unit.conceptInquiryEnabled = true;
  unit.conceptInquiryStrands = [createConceptInquiryStrand(1)];
  unit.conceptInquiryStrands[0].title = "도구와 삶";
  const markdown = curriculumUnitMarkdown(unit, curriculumSettings);
  const line = markdown.split("\n").find((item) => item.startsWith("conceptInquiryStrands:"));
  assert.match(line, /^conceptInquiryStrands: "\[/); // 따옴표로 감싼 문자열(속성 편집기 호환)

  const asString = JSON.stringify(unit.conceptInquiryStrands);
  const parsedFromString = parseCurriculumUnit(
    { path: "u.md", basename: "u", stat: { ctime: 1 } },
    { "class-management": "curriculum-unit", curriculumUnitId: unit.id, unitName: "테스트",
      conceptInquiryStrands: asString },
    markdown
  );
  assert.equal(parsedFromString.conceptInquiryStrands[0].title, "도구와 삶");

  const parsedFromArray = parseCurriculumUnit(
    { path: "u.md", basename: "u", stat: { ctime: 1 } },
    { "class-management": "curriculum-unit", curriculumUnitId: unit.id, unitName: "테스트",
      conceptInquiryStrands: unit.conceptInquiryStrands },
    markdown
  );
  assert.equal(parsedFromArray.conceptInquiryStrands[0].title, "도구와 삶");
});
