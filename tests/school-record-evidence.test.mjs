import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadTypeScriptModule,
  makeActivityFile,
  makeSchoolRecordActivities,
  makeSubjectEvidence
} from "./helpers.mjs";

const {
  buildSchoolRecordCoverage,
  defaultSubjectsForGrade,
  emptySchoolRecordEvidence,
  parseSchoolRecordEvidence,
  schoolRecordEvidenceFrontmatter,
  suggestLegacySchoolRecordEvidence,
  validateSchoolRecordEvidence
} = await loadTypeScriptModule("../packages/core/src/school-record-evidence.ts");
const { classifySchoolRecordReferences } =
  await loadTypeScriptModule("../packages/core/src/school-record.ts");

const subjectEvidence = makeSubjectEvidence(emptySchoolRecordEvidence);

test("완전한 교과 근거는 오류가 없다", () => {
  assert.equal(
    validateSchoolRecordEvidence(subjectEvidence).filter((issue) => issue.severity === "error").length,
    0
  );
});

test("frontmatter에 영역과 단원 연결이 들어간다", () => {
  assert.ok(schoolRecordEvidenceFrontmatter(subjectEvidence).some((line) =>
    line === 'schoolRecordArea: "subject-development"'
  ));
  assert.ok(schoolRecordEvidenceFrontmatter(subjectEvidence).some((line) =>
    line === 'curriculumUnitId: "unit-1"'
  ));
});

test("frontmatter를 근거로 되읽는다", () => {
  const parsedEvidence = parseSchoolRecordEvidence({
    schoolRecordArea: "subject-development",
    schoolRecordSubarea: "subject",
    evidenceType: "assessment",
    directObservation: true,
    observer: "교과담당교사",
    subject: "과학",
    reviewStatus: "reviewed"
  });
  assert.equal(parsedEvidence?.subject, "과학");
  assert.equal(parsedEvidence?.reviewStatus, "reviewed");
});

test("수상 실적과 이력 없는 부정 서술을 경고한다", () => {
  assert.ok(validateSchoolRecordEvidence({
    ...subjectEvidence,
    observedFact: "교내 수학대회에서 수상함"
  }).some((issue) => issue.code === "prohibited-content"));
  const negativeBehavior = {
    ...emptySchoolRecordEvidence("behavior-summary"),
    observationContext: "모둠 활동",
    observedFact: "친구의 발표를 반복해서 방해함"
  };
  assert.ok(validateSchoolRecordEvidence(negativeBehavior).some((issue) =>
    issue.code === "negative-without-history"
  ));
});

test("학년별 기본 교과 목록을 제공한다", () => {
  assert.deepEqual(defaultSubjectsForGrade("1").slice(0, 2), ["국어", "수학"]);
  assert.ok(defaultSubjectsForGrade("5").includes("실과"));
});

test("학생×영역×교과 누락을 점검한다", () => {
  const activityFile = makeActivityFile();
  const behaviorEvidence = emptySchoolRecordEvidence("behavior-summary");
  behaviorEvidence.observedFact = "모둠 친구의 의견을 끝까지 듣고 정리함";
  const coverage = buildSchoolRecordCoverage(
    [{ file: activityFile, number: "1", name: "김하늘", status: "active" }],
    [
      {
        file: activityFile,
        number: "1",
        studentNumber: "1",
        studentName: "김하늘",
        recordType: "학생부 근거",
        date: "2026-07-21",
        schoolRecordEvidence: behaviorEvidence
      }
    ],
    ["수학"]
  );
  assert.equal(coverage.areas.find((area) => area.area === "behavior-summary")?.covered, 1);
  assert.equal(coverage.areas.find((area) => area.area === "subject-development")?.gaps.length, 1);
});

test("자유서술 기록의 영역을 추천한다", () => {
  const legacySuggestion = suggestLegacySchoolRecordEvidence(
    "관찰",
    "수학 수업에서 풀이 과정을 설명함"
  );
  assert.equal(legacySuggestion.area, "subject-development");
  assert.equal(legacySuggestion.subject, "수학");
});

test("구조화 근거는 검토 상태에 따라 분류가 달라진다", () => {
  const structuredActivity = {
    ...makeSchoolRecordActivities()[1],
    schoolRecordEvidence: subjectEvidence
  };
  const structuredSubject = classifySchoolRecordReferences(
    [structuredActivity],
    "subject-development"
  );
  assert.equal(structuredSubject.primary[0]?.category, "수학");
  assert.match(structuredSubject.primary[0]?.reason ?? "", /구조화된/);
  const rawStructured = classifySchoolRecordReferences(
    [{ ...structuredActivity, schoolRecordEvidence: { ...subjectEvidence, reviewStatus: "raw" } }],
    "subject-development"
  );
  assert.equal(rawStructured.supporting.length, 1);
  const excludedStructured = classifySchoolRecordReferences(
    [{ ...structuredActivity, schoolRecordEvidence: { ...subjectEvidence, reviewStatus: "excluded" } }],
    "subject-development"
  );
  assert.equal(excludedStructured.excluded[0]?.category, "교사 제외");
});
