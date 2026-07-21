import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const {
  buildHoursAudit,
  hoursStandardMarkdown,
  parseHoursStandard
} = await loadTypeScriptModule("../src/hours-audit.ts");

const file = { path: "기준 시수.md", basename: "기준 시수", stat: { ctime: 1 } };

test("기준 시수 노트를 파싱한다", () => {
  const content = [
    "## 기준 시수",
    "| 교과·영역 | 연간 기준 시수 |",
    "| --- | ---: |",
    "| 국어 | 204 |",
    "| 수학 | 136 |",
    "| 빈칸 |  |"
  ].join("\n");
  const standard = parseHoursStandard(file, { schoolYear: "2026", tolerancePercent: 10 }, content);
  assert.equal(standard.tolerancePercent, 10);
  assert.deepEqual(standard.entries, [
    { subject: "국어", hours: 204 },
    { subject: "수학", hours: 136 }
  ]);
});

test("스캐폴드에 교과와 창체 영역 행이 들어간다", () => {
  const markdown = hoursStandardMarkdown("2026", "우리 반", ["국어", "수학"]);
  assert.match(markdown, /class-management: hours-standard/);
  assert.match(markdown, /\| 국어 \|/);
  assert.match(markdown, /창체\(자율\)/);
});

test("기준·편성·실행 3단 대조와 허용 범위를 판정한다", () => {
  const standard = {
    file,
    schoolYear: "2026",
    tolerancePercent: 20,
    entries: [
      { subject: "국어", hours: 100 },
      { subject: "수학", hours: 100 },
      { subject: "체육", hours: 100 }
    ]
  };
  const rows = buildHoursAudit(standard, { 국어: 110, 수학: 130, 체육: 70, 미술: 20 }, { 국어: 50 });
  const byName = Object.fromEntries(rows.map((row) => [row.subject, row]));
  assert.equal(byName["국어"].status, "ok");
  assert.equal(byName["국어"].taughtHours, 50);
  assert.equal(byName["수학"].status, "over");
  assert.equal(byName["수학"].deltaPercent, 30);
  assert.equal(byName["체육"].status, "under");
  assert.equal(byName["미술"].status, "missing");
  assert.equal(rows[rows.length - 1].subject, "미술");
});
