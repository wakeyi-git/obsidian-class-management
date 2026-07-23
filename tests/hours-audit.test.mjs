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
  const standard = parseHoursStandard(file, { schoolYear: "2026", tolerancePercent: 10 }, content);
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
  const standard = parseHoursStandard(file, {}, content);
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
    { path: "n.md", basename: "n", stat: { ctime: 1 } }, {}, content
  );
  assert.deepEqual(standard.entries, [
    { subject: "국어", hours1: 96, hours2: 102, hours: 198, category: "교과" },
    { subject: "수학", hours1: 65, hours2: 68, hours: 133, category: "교과" }
  ]);
});
