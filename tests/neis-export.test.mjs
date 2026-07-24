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

test("NEIS 진도표 CSV — 편제 매핑·시수 전개·차시 번호", async () => {
  const { buildNeisProgressCsv, neisSubjectName, pagesFromNote } =
    await loadTypeScriptModule("../packages/core/src/neis-export.ts");

  assert.equal(neisSubjectName("창체(자율)", "3"), "자율⋅자치활동", "U+22C5 점 유지");
  assert.equal(neisSubjectName("디지털 놀이터", "3"), "디지털 놀이터3");
  assert.equal(neisSubjectName("국어", "3"), "국어");
  assert.deepEqual(pagesFromNote("36~41쪽 (보조 6~7)"), { pages: "36~41", auxPages: "6~7" });
  assert.deepEqual(pagesFromNote("154~155쪽<br>#정보통신윤리교육"), { pages: "154~155", auxPages: "" });
  assert.deepEqual(pagesFromNote("#생활안전"), { pages: "", auxPages: "" });

  const file = { path: "진도표.md", basename: "진도표", stat: { ctime: 1 } };
  const row = (order, unit, topic, hours, note = "", materials = "") => ({
    order, unit, topic, hours, standard: "", materials, unitLink: "", assignmentLink: "",
    fixedDate: "", fixedPeriod: 0, assigned: "", note
  });
  const csv = buildNeisProgressCsv(
    [
      { file, schoolYear: "2026", semester: "1학기", subject: "창체(자율)", rows: [row(1, "학급 세우기", "약속 정하기", 1)] },
      {
        file, schoolYear: "2026", semester: "1학기", subject: "국어",
        rows: [
          row(1, "1. 단원", "배울 내용", 1, "32~35쪽"),
          row(2, "창의적교육활동", "문해력 평가", 1),
          row(3, "1. 단원", "이어서 -1-", 2, "36~41쪽 (보조 6~7)", "책")
        ]
      }
    ],
    { grade: "3", semester: "1학기", subjectOrder: ["국어", "수학"] }
  );
  const lines = csv.replace(/^﻿/, "").trim().split("\r\n").map((line) =>
    line.split(",").map((cell) => cell.replace(/^"|"$/g, "").replace(/""/g, '"'))
  );
  assert.equal(lines[0][3], "*편제");
  assert.equal(lines.length, 1 + 5, "시수 2 행은 2행으로 전개");
  assert.deepEqual(lines[1].slice(0, 6), ["1", "3", "1", "국어", "1. 단원", "배울 내용"], "subjectOrder 우선");
  assert.deepEqual(lines[2].slice(3, 6), ["국어", "창의적교육활동", "문해력 평가"]);
  assert.deepEqual(lines[3].slice(8, 11), ["2", "3", "책"], "해당차시는 단원별 누계(끼어든 창의적교육활동 무관), 전체차시 3");
  assert.deepEqual(lines[4].slice(0, 1), ["4"], "순번은 과목 안에서 이어짐");
  assert.deepEqual(lines[4].slice(6, 10), ["36~41", "6~7", "3", "3"]);
  assert.equal(lines[5][3], "자율⋅자치활동", "교과 목록 밖 창체는 뒤에");
});
