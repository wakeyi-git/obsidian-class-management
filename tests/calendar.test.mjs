import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule, makeActivities, makeActivityFile } from "./helpers.mjs";

const { buildCalendarEvents, calendarDays, dateKey, moveCalendarAnchor } =
  await loadTypeScriptModule("../packages/core/src/calendar.ts");

test("월간 달력은 주 단위로 채워진다", () => {
  const julyDays = calendarDays(new Date(2026, 6, 21), "month");
  assert.equal(julyDays.length, 35);
  assert.equal(dateKey(julyDays[0]), "2026-06-29");
  assert.equal(dateKey(julyDays.at(-1)), "2026-08-02");
});

test("주간 달력은 월요일부터 시작한다", () => {
  const weekDays = calendarDays(new Date(2026, 6, 21), "week");
  assert.equal(dateKey(weekDays[0]), "2026-07-20");
  assert.equal(dateKey(weekDays[6]), "2026-07-26");
});

test("앵커 이동은 다음 달 1일로 간다", () => {
  assert.equal(
    dateKey(moveCalendarAnchor(new Date(2026, 6, 21), "month", 1)),
    "2026-08-01"
  );
});

test("같은 출결 노트는 하나의 캘린더 항목으로 묶는다", () => {
  const activityFile = makeActivityFile();
  const activities = makeActivities(activityFile);
  const extraAttendance = {
    ...activities[1],
    id: "4",
    studentNumber: "3",
    studentName: "박구름",
    status: "출석",
    title: "출석",
    file: { ...activityFile, path: "2026-07-20 출결.md" }
  };
  activities[1].file = extraAttendance.file;
  const calendarEvents = buildCalendarEvents([...activities, extraAttendance]);
  const attendanceEvent = calendarEvents.find((event) => event.kind === "attendance");
  assert.equal(attendanceEvent?.studentNumbers.length, 2);
  assert.match(attendanceEvent?.detail ?? "", /지각 1명/);
});
