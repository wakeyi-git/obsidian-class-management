import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule, makeActivityFile, makeExpandedActivities } from "./helpers.mjs";

const { analyzeActivities, buildActivitiesCsv, buildReportMarkdown } =
  await loadTypeScriptModule("../packages/core/src/report.ts");

test("미완료 할 일과 미회신을 집계한다", () => {
  const analytics = analyzeActivities(makeExpandedActivities());
  assert.equal(analytics.tasksOpen, 1);
  assert.equal(analytics.noticePending, 1);
});

test("보고서 Markdown에 제목과 근거 링크가 들어간다", () => {
  const activityFile = makeActivityFile();
  const report = buildReportMarkdown(
    makeExpandedActivities(activityFile),
    { title: "7월 보고서", dateFrom: "2026-07-01", dateTo: "2026-07-31", studentNumber: "" },
    "우리 반",
    [{ file: activityFile, number: "1", name: "김하늘" }]
  );
  assert.match(report, /# 7월 보고서/);
  assert.match(report, /\[\[테스트\|원본\]\]/);
  assert.match(report, /cssclasses:\n {2}- class-management-print/);
});

test("CSV는 BOM과 헤더로 시작한다", () => {
  assert.ok(buildActivitiesCsv(makeExpandedActivities()).startsWith("﻿\"date\""));
});
