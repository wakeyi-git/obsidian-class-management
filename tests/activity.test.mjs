import assert from "node:assert/strict";
import { test } from "node:test";
import { EMPTY_FILTERS, loadTypeScriptModule, makeActivities } from "./helpers.mjs";

const { filterActivities } = await loadTypeScriptModule("../packages/core/src/activity.ts");

test("검색어로 활동을 거른다", () => {
  const activities = makeActivities();
  assert.deepEqual(
    filterActivities(activities, { ...EMPTY_FILTERS, query: "버스" }).map((item) => item.id),
    ["2"]
  );
});

test("학생과 유형 필터를 조합한다", () => {
  const activities = makeActivities();
  assert.deepEqual(
    filterActivities(activities, {
      ...EMPTY_FILTERS,
      studentNumber: "1",
      kind: "assignment"
    }).map((item) => item.id),
    ["3"]
  );
});

test("상태와 기간 필터를 조합한다", () => {
  const activities = makeActivities();
  assert.deepEqual(
    filterActivities(activities, {
      ...EMPTY_FILTERS,
      status: "칭찬",
      dateFrom: "2026-07-20"
    }).map((item) => item.id),
    ["1"]
  );
});

test("출결 예외 프리셋은 출석을 제외한다", () => {
  const activities = makeActivities();
  assert.deepEqual(
    filterActivities([
      ...activities,
      { ...activities[1], id: "attendance-present", status: "출석", title: "출석" }
    ], { ...EMPTY_FILTERS, kind: "attendance", status: "__attendance-exception__" })
      .map((item) => item.id),
    ["2"]
  );
});
