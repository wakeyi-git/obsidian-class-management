import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { nextRecurringDate, taskRecurrenceLabel } =
  await loadTypeScriptModule("../src/task.ts");

test("반복 주기별 다음 날짜를 계산한다", () => {
  assert.equal(nextRecurringDate("2026-07-21", "daily"), "2026-07-22");
  assert.equal(nextRecurringDate("2026-07-21", "weekly"), "2026-07-28");
});

test("말일이 없는 달은 마지막 날로 보정한다", () => {
  assert.equal(nextRecurringDate("2026-01-31", "monthly"), "2026-02-28");
});

test("반복 라벨을 표시한다", () => {
  assert.equal(taskRecurrenceLabel("monthly"), "매월 반복");
});
