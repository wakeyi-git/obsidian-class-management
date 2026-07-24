import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule, makeActivityFile } from "./helpers.mjs";

const { buildNeisExportMarkdown, countNeisChars } =
  await loadTypeScriptModule("../packages/core/src/neis-export.ts");

function makeEvidenceActivity(overrides = {}, evidenceOverrides = {}) {
  return {
    id: "e1",
    file: makeActivityFile(),
    date: "2026-10-05",
    studentNumber: "1",
    studentName: "김하늘",
    kind: "record",
    title: "학생부 근거",
    status: "근거",
    detail: "모둠 탐구에서 자료를 비교하며 결론을 이끌었다",
    searchText: "",
    createdAt: 1,
    schoolRecordEvidence: {
      area: "subject-development",
      subarea: "",
      subject: "과학",
      reviewStatus: "reviewed",
      achievementStandard: "[4과01-01]",
      evaluationElement: "탐구 과정",
      directObservation: true,
      changeGrowth: "",
      conceptualUnderstanding: "",
      ...evidenceOverrides
    },
    ...overrides
  };
}

test("자수는 코드포인트 기준으로 공백 포함·제외를 센다", () => {
  const count = countNeisChars("바다를 지키자.\n실천했다 ");
  assert.equal(count.withSpaces, 13, "trim 후 줄바꿈 1자 포함");
  assert.equal(count.withoutSpaces, 11);
  assert.equal(countNeisChars("  ").withSpaces, 0);
});

test("NEIS 자료는 검토 완료 근거만 영역별로 담는다", () => {
  const students = [
    { file: makeActivityFile(), number: "1", name: "김하늘" },
    { file: makeActivityFile(), number: "2", name: "이바다" }
  ];
  const doc = buildNeisExportMarkdown(
    [
      makeEvidenceActivity(),
      makeEvidenceActivity(
        { id: "e2", date: "2026-09-01", detail: "학급 회의를 진행했다" },
        { area: "creative-activities", subarea: "자율", subject: "" }
      ),
      makeEvidenceActivity(
        { id: "e3", detail: "raw 상태 근거" },
        { reviewStatus: "raw" }
      )
    ],
    students,
    { className: "우리 반", guidelineYear: "2026", dateFrom: "2026-09-01", dateTo: "2026-12-31" }
  );
  assert.match(doc, /## 1번 김하늘/);
  assert.match(doc, /### 창의적 체험활동/);
  assert.match(doc, /\*\*자율\*\*/);
  assert.match(doc, /### 교과 학습발달상황/);
  assert.match(doc, /\*\*과학\*\*/);
  assert.match(doc, /\[4과01-01\] · 탐구 과정 · 직접 관찰/);
  assert.ok(!doc.includes("raw 상태 근거"), "raw 근거는 제외");
  assert.match(doc, /재료 분량: 공백 포함 \d+자/);
  assert.match(doc, /## 2번 이바다/);
  assert.match(doc, /검토 완료된 학생부 근거가 없습니다/);
});

test("학생·기간 필터가 적용된다", () => {
  const students = [{ file: makeActivityFile(), number: "1", name: "김하늘" }];
  const doc = buildNeisExportMarkdown(
    [makeEvidenceActivity({ date: "2026-03-05" })],
    students,
    { className: "우리 반", guidelineYear: "2026", studentNumber: "1", dateFrom: "2026-09-01" }
  );
  assert.match(doc, /검토 완료된 학생부 근거가 없습니다/, "기간 밖 근거 제외");
});
