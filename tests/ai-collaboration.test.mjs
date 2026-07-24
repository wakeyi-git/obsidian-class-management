import assert from "node:assert/strict";
import { test } from "node:test";
import {
  AI_SETTINGS,
  loadTypeScriptModule,
  makeActivityFile,
  makeExpandedActivities,
  makeSchoolRecordActivities
} from "./helpers.mjs";

const { buildAiDraftMarkdown, buildAiExportMarkdown, guidelineSummaryMarkdown } = await loadTypeScriptModule("../packages/core/src/ai-collaboration.ts");

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

test("익명 내보내기 — 실명·파일 경로 없이 근거 번호와 구조화 필드를 담는다", () => {
  const activityFile = makeActivityFile();
  const markdown = buildAiExportMarkdown(
    { ...AI_SETTINGS, grade: "3", semester: "2학기" },
    [{ file: activityFile, number: "1", name: "김하늘", status: "active" }],
    makeSchoolRecordActivities(activityFile),
    { dateFrom: "2026-07-01", dateTo: "2026-07-31", today: "2026-07-24" }
  );
  assert.match(markdown, /학생-S01/);
  assert.doesNotMatch(markdown, /김하늘/);
  assert.doesNotMatch(markdown, /테스트\.md/);
  assert.doesNotMatch(markdown, /\[\[/); // 위키링크(경로) 금지
  assert.match(markdown, /\[근거 01\]/);
  assert.match(markdown, /근거 번호를 인용/);
});

test("익명 내보내기 — 기재요령 요약이 있으면 전문을 인라인한다", () => {
  const activityFile = makeActivityFile();
  const markdown = buildAiExportMarkdown(
    { ...AI_SETTINGS, grade: "3", semester: "2학기" },
    [{ file: activityFile, number: "2", name: "이바다", status: "active" }],
    [],
    {
      dateFrom: "2026-07-01",
      dateTo: "2026-07-31",
      today: "2026-07-24",
      guideline: { year: "2026", content: "## 공통 원칙\n- 서술형 문장은 명사형 종결" }
    }
  );
  assert.match(markdown, /학생부 기재요령 요약 \(2026\)/);
  assert.match(markdown, /명사형 종결/);
  assert.doesNotMatch(markdown, /요약 노트가 아직 없어/);
});

test("기재요령 요약 스캐폴드 — 판별자·연도·영역 절", () => {
  const markdown = guidelineSummaryMarkdown("2026");
  assert.match(markdown, /class-management: school-record-guideline/);
  assert.match(markdown, /guidelineYear: "2026"/);
  assert.match(markdown, /## 행동특성 및 종합의견/);
});
