import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const {
  buildHoursAudit,
  hoursStandardMarkdown,
  parseHoursStandard
} = await loadTypeScriptModule("../packages/core/src/hours-audit.ts");

const file = { path: "기준 시수.md", basename: "기준 시수", stat: { ctime: 1 } };

test("구형 2열 기준 시수 표를 파싱하고 구분을 이름으로 추정한다", () => {
  const content = [
    "## 기준 시수",
    "| 교과·영역 | 연간 기준 시수 |",
    "| --- | ---: |",
    "| 국어 | 204 |",
    "| 창체(자율) | 34 |",
    "| 빈칸 |  |"
  ].join("\n");
  const standard = parseHoursStandard(file, { "class-management": "hours-standard", schoolYear: "2026", tolerancePercent: 10 }, content);
  assert.equal(standard.tolerancePercent, 10);
  assert.deepEqual(standard.entries, [
    { subject: "국어", hours1: 0, hours2: 0, hours: 204, category: "교과" },
    { subject: "창체(자율)", hours1: 0, hours2: 0, hours: 34, category: "창체" }
  ]);
});

test("구분 열이 있는 3열 표를 파싱하고 빈 구분은 위 행을 승계한다", () => {
  const content = [
    "## 기준 시수",
    "| 구분 | 교과·영역 | 연간 기준 시수 |",
    "| --- | --- | ---: |",
    "| 교과 | 국어 | 198 |",
    "|  | 디지털 놀이터 | 29 |",
    "| 창체 | 창체(자율) | 73 |"
  ].join("\n");
  const standard = parseHoursStandard(file, { "class-management": "hours-standard" }, content);
  assert.deepEqual(standard.entries, [
    { subject: "국어", hours1: 0, hours2: 0, hours: 198, category: "교과" },
    { subject: "디지털 놀이터", hours1: 0, hours2: 0, hours: 29, category: "교과" },
    { subject: "창체(자율)", hours1: 0, hours2: 0, hours: 73, category: "창체" }
  ]);
});

test("스캐폴드는 구분 열과 학교자율시간 안내를 담는다", () => {
  const markdown = hoursStandardMarkdown("2026", "우리 반", ["국어", "수학"]);
  assert.match(markdown, /class-management: hours-standard/);
  assert.match(markdown, /\| 구분 \| 교과·영역 \| 1학기 \| 2학기 \| 학년 \|/);
  assert.match(markdown, /\| 교과 \| 국어 \|/);
  assert.match(markdown, /\| 창체 \| 창체\(자율\) \|/);
  assert.match(markdown, /학교자율시간/);
});

function makeStandard() {
  return {
    file,
    schoolYear: "2026",
    tolerancePercent: 20,
    entries: [
      { subject: "국어", hours1: 48, hours2: 52, hours: 100, category: "교과" },
      { subject: "수학", hours1: 50, hours2: 50, hours: 100, category: "교과" },
      { subject: "창체(자율)", hours1: 20, hours2: 20, hours: 40, category: "창체" },
      { subject: "창체(진로)", hours1: 5, hours2: 5, hours: 10, category: "창체" }
    ]
  };
}

test("행 순서는 노트 순서이며 구분 소계·총계가 뒤따른다", () => {
  const rows = buildHoursAudit(
    makeStandard(),
    { planned: { 국어: 48, 수학: 65, "창체(자율)": 20, "창체(진로)": 5 }, taught: { 국어: 48 } },
    { planned: { 국어: 52, 수학: 65, "창체(자율)": 20, "창체(진로)": 5 }, taught: {} }
  );
  assert.deepEqual(
    rows.map((row) => `${row.kind}:${row.subject}`),
    [
      "subject:국어", "subject:수학", "subtotal:교과 소계",
      "subject:창체(자율)", "subject:창체(진로)", "subtotal:창체 소계",
      "total:총계"
    ]
  );
  const subtotal = rows.find((row) => row.subject === "교과 소계");
  assert.equal(subtotal.standardHours, 200);
  assert.equal(subtotal.standard1, 98);
  assert.equal(subtotal.standard2, 102);
  assert.equal(subtotal.planned1, 113);
  assert.equal(subtotal.planned2, 117);
  assert.equal(subtotal.plannedHours, 230);
  assert.equal(subtotal.taught1, 48);
  const total = rows[rows.length - 1];
  assert.equal(total.standardHours, 250);
  assert.equal(total.plannedHours, 280);
});

test("학기별 편성·실행이 나뉘고 허용 범위를 판정한다", () => {
  const rows = buildHoursAudit(
    makeStandard(),
    { planned: { 국어: 55, 수학: 65, "창체(자율)": 20, "창체(진로)": 5 }, taught: { 국어: 30 } },
    { planned: { 국어: 55, 수학: 65, "창체(자율)": 20, "창체(진로)": 5 }, taught: {} }
  );
  const byName = Object.fromEntries(rows.map((row) => [row.subject, row]));
  assert.equal(byName["국어"].planned1, 55);
  assert.equal(byName["국어"].planned2, 55);
  assert.equal(byName["국어"].taught1, 30);
  assert.equal(byName["국어"].taught2, 0);
  assert.equal(byName["국어"].status, "ok");
  assert.equal(byName["수학"].status, "over");
  assert.equal(byName["수학"].deltaPercent, 30);
});

test("기준에 없는 과목은 구분을 추정해 그 구분 끝에 붙는다", () => {
  const rows = buildHoursAudit(
    makeStandard(),
    { planned: { 미술: 20, "창체(동아리)": 8 }, taught: {} },
    { planned: {}, taught: {} }
  );
  const labels = rows.map((row) => row.subject);
  assert.deepEqual(labels, [
    "국어", "수학", "미술", "교과 소계",
    "창체(자율)", "창체(진로)", "창체(동아리)", "창체 소계",
    "총계"
  ]);
  const art = rows.find((row) => row.subject === "미술");
  assert.equal(art.status, "missing");
  assert.equal(art.category, "교과");
});

test("학기형 기준 표: 1학기·2학기 열을 읽고 학년은 비면 합", () => {
  const content = [
    "## 기준 시수",
    "| 구분 | 교과·영역 | 1학기 | 2학기 | 학년 |",
    "| --- | --- | ---: | ---: | ---: |",
    "| 교과 | 국어 | 96 | 102 |  |",
    "| 교과 | 수학 | 65 | 68 | 133 |"
  ].join("\n");
  const standard = parseHoursStandard(
    { path: "n.md", basename: "n", stat: { ctime: 1 } }, { "class-management": "hours-standard" }, content
  );
  assert.deepEqual(standard.entries, [
    { subject: "국어", hours1: 96, hours2: 102, hours: 198, category: "교과" },
    { subject: "수학", hours1: 65, hours2: 68, hours: 133, category: "교과" }
  ]);
});

test("판별자가 다른 노트는 기준 시수로 파싱하지 않는다", () => {
  assert.equal(parseHoursStandard(file, {}, "| 교과 | 국어 | 198 |"), null);
});

test("시수 조절 제안: 초과→미달 짝을 미래 슬롯으로 제안한다", async () => {
  const { hoursAdjustmentSuggestions } = await loadTypeScriptModule("../packages/core/src/hours-audit.ts");
  const rows = [
    { kind: "subject", subject: "수학", status: "under", standardHours: 100, plannedHours: 70 },
    { kind: "subject", subject: "체육", status: "over", standardHours: 60, plannedHours: 100 },
    { kind: "subject", subject: "국어", status: "ok", standardHours: 100, plannedHours: 100 },
    { kind: "subtotal", subject: "교과 소계", status: "under", standardHours: 1, plannedHours: 0 }
  ];
  const slots = Array.from({ length: 40 }, (_, index) => ({ date: `2026-10-${String((index % 28) + 1).padStart(2, "0")}`, period: 1 }));
  const suggestions = hoursAdjustmentSuggestions(rows, (subject) => (subject === "체육" ? slots : []));
  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].from, "체육");
  assert.equal(suggestions[0].to, "수학");
  assert.equal(suggestions[0].count, 30, "필요량 30 = min(부족 30, 잉여 40)");
  assert.equal(suggestions[0].truncated, false);

  const few = hoursAdjustmentSuggestions(rows, (subject) => (subject === "체육" ? slots.slice(0, 5) : []));
  assert.equal(few[0].count, 5);
  assert.equal(few[0].truncated, true, "후보 슬롯 부족 표시");

  const none = hoursAdjustmentSuggestions(rows, () => []);
  assert.equal(none.length, 0, "미래 슬롯이 없으면 제안하지 않는다");
});

test("구분 '범교과' 행은 분리 보관되고 시수 점검에서 빠진다", () => {
  const file = { path: "기준.md", basename: "기준", stat: { ctime: 1 } };
  const content = [
    "## 기준 시수",
    "| 구분 | 교과·영역 | 1학기 | 2학기 | 학년 |",
    "| --- | --- | ---: | ---: | ---: |",
    "| 교과 | 수학 | 68 | 68 | 136 |",
    "| 범교과 | 안전교육 |  |  | 51 |",
    "|  | 통일교육 (의무) |  |  | 5 |",
    "|  | 인성교육 (의무) |  |  |  |"
  ].join("\n");
  const standard = parseHoursStandard(file, { "class-management": "hours-standard" }, content);
  assert.equal(standard.entries.length, 1, "교과 행만 시수 점검 입력");
  assert.equal(standard.crossCurricular.length, 3);
  assert.equal(standard.crossCurricular[0].hours, 51);
  assert.equal(standard.crossCurricular[1].subject, "통일교육 (의무)", "구분 승계");
  assert.equal(standard.crossCurricular[2].hours, 0, "의무·권장(시수 없음) 행도 유지");
  const audit = buildHoursAudit(standard);
  assert.ok(audit.every((row) => row.category !== "범교과"), "점검 표에 범교과 없음");
});
