import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const {
  achievementStandardMarkdown,
  extractStandardCodes,
  linkifyStandardCell,
  parseAssessmentPlanImport,
  pdfPageLinks,
  resolveAssessmentDate,
  standardGradeBand,
  standardSubject,
  unitScaffoldsFromProgress,
  wikiLinkTarget,
  wikiLinkText
} = await loadTypeScriptModule("../packages/core/src/planning.ts");

function makeRow(order, unit, topic, hours, assigned = "", extra = {}) {
  return {
    order,
    unit,
    topic,
    hours,
    standard: "",
    unitLink: "",
    assignmentLink: "",
    materials: "",
    fixedDate: "",
    fixedPeriod: 0,
    assigned,
    note: "",
    ...extra
  };
}

test("unitScaffoldsFromProgress: 단원 묶음·시수·기간·전개를 만든다", () => {
  const rows = [
    makeRow(1, "1. 물체와 물질", "말판 놀이", 1, "2026-09-02(3)", {
      standard: "[[4과05-01]], [[4과05-02]]"
    }),
    makeRow(2, "1. 물체와 물질", "물질의 상태", 2, "2026-09-09(3)", {
      standard: "[[4과05-02]]",
      unitLink: "[[과학 지구를 부탁해\\|지구를 부탁해]]"
    }),
    makeRow(3, "2. 지구와 바다", "바닷가 지형", 1, ""),
    makeRow(4, "", "단원명 없는 행", 1, "")
  ];
  const scaffolds = unitScaffoldsFromProgress({ rows });
  assert.equal(scaffolds.length, 2);

  const first = scaffolds[0];
  assert.equal(first.unitName, "1. 물체와 물질");
  assert.equal(first.plannedHours, 3);
  assert.equal(first.integratedHours, 2);
  assert.deepEqual(first.integratedTargets, ["지구를 부탁해"]);
  assert.equal(first.startDate, "2026-09-02");
  assert.equal(first.endDate, "2026-09-09");
  assert.deepEqual(first.standards, ["[[4과05-01]]", "[[4과05-02]]"]);
  assert.match(first.learningPlan, /1\. 말판 놀이 \(9\/2, 1시수\)/);
  assert.match(first.learningPlan, /2\. 물질의 상태 \(9\/9, 2시수\) → 지구를 부탁해 통합 운영/);
  assert.match(first.summary, /2시수는 지구를 부탁해 통합 운영/);

  const second = scaffolds[1];
  assert.equal(second.startDate, "");
  assert.match(second.summary, /\(배정 전\)/);
  assert.match(second.learningPlan, /미배정/);
});

test("pdfPageLinks: 지도서 딥링크를 라벨과 함께 추출한다", () => {
  const text = "일반 단원 ([[과학3-2_지도서.pdf#page=5\\|지도서 pp.5–76]]) · 11차시\\n중복 ([[과학3-2_지도서.pdf#page=5\\|지도서 pp.5–76]])";
  assert.deepEqual(pdfPageLinks(text), [
    { target: "과학3-2_지도서.pdf#page=5", label: "지도서 pp.5–76" }
  ]);
  assert.deepEqual(pdfPageLinks("[[수학3-2_지도서.pdf#page=12]]"), [
    { target: "수학3-2_지도서.pdf#page=12", label: "지도서" }
  ]);
  assert.deepEqual(pdfPageLinks("링크 없음"), []);
});

test("wikiLinkTarget: 링크 대상 경로를 얻는다", () => {
  assert.equal(wikiLinkTarget("[[학급운영/과제/2026-10-16 국어 수행평가\\|수행평가]]"), "학급운영/과제/2026-10-16 국어 수행평가");
  assert.equal(wikiLinkTarget("[[국어 독도 홍보단|독도 홍보단]]"), "국어 독도 홍보단");
  assert.equal(wikiLinkTarget("[[이름만]]"), "이름만");
  assert.equal(wikiLinkTarget("텍스트"), "");
});

test("wikiLinkText: 별칭·이스케이프 파이프·일반 텍스트", () => {
  assert.equal(wikiLinkText("[[경로/노트\\|별칭]]"), "별칭");
  assert.equal(wikiLinkText("[[이름만]]"), "이름만");
  assert.equal(wikiLinkText("그냥 텍스트"), "그냥 텍스트");
});

test("parseAssessmentPlanImport: 머리글 건너뛰기·필수 열 검사", () => {
  const text = [
    "시기\t단원\t평가 요소\t평가 기준\t평가 방법",
    "9월 3주\t물체와 물질\t물질 분류하기\t분류하고 설명할 수 있다\t서술형",
    "10월\t지구와 바다\t\t기준만 있음",
    "한 열뿐"
  ].join("\n");
  const result = parseAssessmentPlanImport(text);
  assert.equal(result.items.length, 1);
  assert.deepEqual(result.items[0], {
    timing: "9월 3주",
    unit: "물체와 물질",
    element: "물질 분류하기",
    criteria: "분류하고 설명할 수 있다",
    method: "서술형"
  });
  assert.equal(result.issues.length, 2);
});

const context = {
  semesterFrom: "2026-09-01",
  semesterTo: "2027-01-16",
  rows: [
    makeRow(1, "1. 물체와 물질", "실험", 1, "2026-09-16(2)"),
    makeRow(2, "2. 지구와 바다", "관찰", 1, "2026-09-18(3)")
  ]
};

test("resolveAssessmentDate: 명시 날짜", () => {
  assert.deepEqual(resolveAssessmentDate("2026-11-07", "", context), {
    date: "2026-11-07",
    source: "명시"
  });
  assert.deepEqual(resolveAssessmentDate("10/15", "", context), {
    date: "2026-10-15",
    source: "명시"
  });
  // 2학기가 해를 넘기면 1월은 다음 해로 해석한다.
  assert.deepEqual(resolveAssessmentDate("1월 7일", "", context), {
    date: "2027-01-07",
    source: "명시"
  });
});

test("resolveAssessmentDate: 주차는 단원 일치 배정일 우선", () => {
  const hit = resolveAssessmentDate("9월 3주", "지구와 바다", context);
  assert.deepEqual(hit, { date: "2026-09-18", source: "진도표" });
  const fallbackRow = resolveAssessmentDate("9월 3주", "없는 단원", context);
  assert.deepEqual(fallbackRow, { date: "2026-09-16", source: "진도표" });
  const weekStart = resolveAssessmentDate("10월 2주", "물체와 물질", context);
  assert.deepEqual(weekStart, { date: "2026-10-08", source: "주초" });
});

test("resolveAssessmentDate: 해석 불가는 issue를 남긴다", () => {
  assert.equal(resolveAssessmentDate("수시", "", context).issue !== undefined, true);
  assert.equal(resolveAssessmentDate("", "", context).date, "");
});

test("성취기준 코드 추출·과목·학년군", () => {
  const codes = extractStandardCodes("[[4과05-01]] [4국01-03] 4과05-01 6수03-12");
  assert.deepEqual(codes, ["4과05-01", "4국01-03", "6수03-12"]);
  assert.equal(standardSubject("4과05-01"), "과학");
  assert.equal(standardSubject("2즐01-01"), "즐거운 생활");
  assert.equal(standardGradeBand("4과05-01"), "3~4학년군");
  assert.equal(standardGradeBand("6수03-12"), "5~6학년군");
});

test("linkifyStandardCell: 혼합 표기를 위키링크로, 재실행해도 동일", () => {
  const cell = "[[4과05-01]], [4과05-02], 4과05-03";
  const once = linkifyStandardCell(cell);
  assert.equal(once, "[[4과05-01]], [[4과05-02]], [[4과05-03]]");
  assert.equal(linkifyStandardCell(once), once);
});

test("achievementStandardMarkdown: 프론트매터·본문 형식", () => {
  const markdown = achievementStandardMarkdown({
    code: "4과05-01",
    statement: "물질의 성질을 비교할 수 있다.",
    progressLinks: ["2026 2학기 과학 진도표"]
  });
  assert.match(markdown, /class-management: achievement-standard/);
  assert.match(markdown, /standardCode: "4과05-01"/);
  assert.match(markdown, /subject: "과학"/);
  assert.match(markdown, /gradeBand: "3~4학년군"/);
  assert.match(markdown, /# \[4과05-01\]/);
  assert.match(markdown, /> 물질의 성질을 비교할 수 있다\./);
  assert.match(markdown, /- \[\[2026 2학기 과학 진도표\]\]/);

  const empty = achievementStandardMarkdown({ code: "4국01-01", statement: "", progressLinks: [] });
  assert.match(empty, /전문 미입력/);
  assert.doesNotMatch(empty, /## 진도표/);
});
