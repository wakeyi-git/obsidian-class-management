import test from "node:test";
import assert from "node:assert/strict";
import { loadTypeScriptModule } from "./helpers.mjs";

const { collectTaughtSlots, distinctDates, taughtThroughDate } =
  await loadTypeScriptModule("../src/taught-lesson.ts");
const { taughtLessonFileName, taughtLessonSubfolder } =
  await loadTypeScriptModule("../src/entity-notes.ts");

const calendar = {
  file: null,
  schoolYear: "2026",
  semester1Start: "2026-03-02",
  semester1End: "2026-07-21",
  semester2Start: "2026-08-19",
  semester2End: "2027-01-08",
  weekdayPeriods: { 1: 5, 2: 5, 3: 5, 4: 5, 5: 5 },
  closedDays: [],
  events: [
    { date: "2026-08-20", name: "현장체험학습", type: "행사", periods: [1, 2, 3], subject: "" }
  ]
};

// grid[교시-1][요일(월=0)] — 수요일(열 2): 국어·수학·사회·과학·도덕
const timetable = {
  file: null,
  schoolYear: "2026",
  semester: "2학기",
  periods: 5,
  grid: [
    ["사회", "수학", "국어", "과학", "체육"],
    ["국어", "국어", "수학", "수학", "영어"],
    ["수학", "음악", "사회", "체육", "국어"],
    ["과학", "미술", "과학", "음악", "수학"],
    ["체육", "영어", "도덕", "국어", "창체(자율)"]
  ],
  overrides: []
};

test("실시 차시 수집은 기준일까지 수업일의 과목 교시만 담는다", () => {
  // 2026-08-19(수)~08-20(목) — 8/20은 1~3교시가 과목 미지정 행사
  const contents = new Map([
    ["2026-08-19|1", { order: 3, unit: "1. 경험", topic: "경험 나누기", hours: 1, standard: "[4국01-02]", fixedDate: "", fixedPeriod: 0, assigned: "", materials: "", note: "" }]
  ]);
  const entries = collectTaughtSlots(calendar, timetable, "2학기", contents, "2026-08-20");
  const first = entries[0];
  assert.equal(first.date, "2026-08-19");
  assert.equal(first.subject, "국어");
  assert.equal(first.unit, "1. 경험");
  assert.equal(first.order, 3);
  assert.equal(first.standard, "[4국01-02]");
  // 8/19(수요일 grid 3) 5교시 + 8/20 행사 미지정 1~3교시 제외, 4~5교시만
  const day2 = entries.filter((entry) => entry.date === "2026-08-20");
  assert.deepEqual(day2.map((entry) => entry.period), [4, 5]);
  assert.ok(entries.every((entry) => entry.subject.trim().length > 0));
});

test("기준일이 학기 시작 전이면 빈 목록, 학기말은 종료일에서 멈춘다", () => {
  assert.deepEqual(collectTaughtSlots(calendar, timetable, "2학기", new Map(), "2026-08-01"), []);
  const all = collectTaughtSlots(calendar, timetable, "2학기", new Map(), "2027-12-31");
  assert.ok(all.every((entry) => entry.date <= "2027-01-08"));
});

test("파일 이름·월 폴더·기준일 계산이 안정적이다", () => {
  const entry = {
    date: "2026-09-02", period: 3, subject: "국어", semester: "2학기", source: "base",
    unit: "", topic: "", hours: 1, standard: "", order: 0, lessonLog: ""
  };
  assert.equal(taughtLessonSubfolder(entry), "2026-09");
  assert.equal(taughtLessonFileName(entry), "2026-09-02 3교시 국어.md");
  assert.equal(taughtThroughDate("2026-08-20"), "2026-08-19");
  assert.equal(distinctDates([entry, { ...entry, period: 4 }, { ...entry, date: "2026-09-03" }]), 2);
});
