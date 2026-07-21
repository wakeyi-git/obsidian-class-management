import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule, makeSchoolRecordActivities } from "./helpers.mjs";

const { classifySchoolRecordReferences } =
  await loadTypeScriptModule("../src/school-record.ts");

const schoolRecordActivities = makeSchoolRecordActivities();

test("창체 영역은 자율·자치활동과 제외 자료를 분류한다", () => {
  const creativeReferences = classifySchoolRecordReferences(
    schoolRecordActivities,
    "creative-activities"
  );
  assert.ok(creativeReferences.primary.some((reference) => reference.category === "자율·자치활동"));
  assert.ok(creativeReferences.excluded.some((reference) => reference.category === "기재 제외 가능 자료"));
});

test("교과 영역은 교과 근거와 보조 자료를 나눈다", () => {
  const subjectReferences = classifySchoolRecordReferences(
    schoolRecordActivities,
    "subject-development"
  );
  assert.ok(subjectReferences.primary.some((reference) => reference.category === "수학"));
  assert.ok(subjectReferences.supporting.some((reference) => reference.activity.kind === "assignment"));
  assert.ok(subjectReferences.excluded.some((reference) => /방과후/.test(reference.reason)));
});

test("행동 영역은 관계·협력과 출결 맥락을 나눈다", () => {
  const behaviorReferences = classifySchoolRecordReferences(
    schoolRecordActivities,
    "behavior-summary"
  );
  assert.ok(behaviorReferences.primary.some((reference) => reference.category === "관계·협력"));
  assert.ok(behaviorReferences.supporting.some((reference) => reference.category === "출결 맥락 확인"));
});
