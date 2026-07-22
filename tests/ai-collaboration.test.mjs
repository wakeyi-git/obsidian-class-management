import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_SETTINGS,
  loadTypeScriptModule,
  makeActivityFile,
  makeExpandedActivities,
  makeSchoolRecordActivities
} from "./helpers.mjs";

const { buildAiDraftMarkdown } = await loadTypeScriptModule("../packages/core/src/ai-collaboration.ts");

test("익명화된 학생 피드백 초안을 만든다", () => {
  const activityFile = makeActivityFile();
  const aiDraft = buildAiDraftMarkdown(
    AI_SETTINGS,
    { file: activityFile, number: "1", name: "김하늘" },
    makeExpandedActivities(activityFile),
    "feedback",
    "2026-07-01",
    "2026-07-31"
  );
  assert.match(aiDraft, /학생-S01 학생 피드백 초안/);
  assert.match(aiDraft, /draft: true/);
  assert.doesNotMatch(aiDraft, /studentName: 김하늘/);
});

test("생활기록부 영역 초안에 분류와 경고가 들어간다", () => {
  const activityFile = makeActivityFile();
  const schoolRecordDraft = buildAiDraftMarkdown(
    AI_SETTINGS,
    { file: activityFile, number: "1", name: "김하늘" },
    makeSchoolRecordActivities(activityFile),
    "school-record",
    "2026-07-01",
    "2026-07-31",
    "subject-development"
  );
  assert.match(schoolRecordDraft, /schoolRecordArea: "subject-development"/);
  assert.match(schoolRecordDraft, /교과학습발달상황\(학기말종합의견\) 초안/);
  assert.match(schoolRecordDraft, /## 분류된 참고 자료/);
  assert.match(schoolRecordDraft, /### 자동 제외 자료/);
  assert.match(schoolRecordDraft, /과제 제출 상태만으로/);
});
