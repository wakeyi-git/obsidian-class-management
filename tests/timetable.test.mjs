import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { parseAcademicCalendar } = await loadTypeScriptModule("../src/academic-calendar.ts");
const {
  baseTimetableMarkdown,
  parseBaseTimetable,
  plannedHoursBySubject,
  resolveDay,
  resolveWeek,
  subjectSlots
} = await loadTypeScriptModule("../src/timetable.ts");

const calendarFile = { path: "학사일정.md", basename: "학사일정", stat: { ctime: 1 } };
const calendar = parseAcademicCalendar(calendarFile, {
  schoolYear: "2026",
  semester1Start: "2026-03-02",
  semester1End: "2026-07-17",
  semester2Start: "2026-08-17",
  semester2End: "2027-01-08",
  weekdayPeriods: [5, 6, 5, 6, 5]
}, [
  "## 휴업일",
  "| 날짜 | 구분 | 명칭 |",
  "| --- | --- | --- |",
  "| 2026-05-05 | 공휴일 | 어린이날 |",
  "## 행사",
  "| 날짜 | 유형 | 명칭 | 교시 | 과목 | 비고 |",
  "| --- | --- | --- | --- | --- | --- |",
  "| 2026-05-08 | 행사 | 운동회 | 1-2 | 창체(자율) |  |",
  "| 2026-05-07 | 단축 | 단축수업 | 3 |  |  |"
].join("\n"));

const timetableFile = { path: "기초시간표.md", basename: "기초시간표", stat: { ctime: 2 } };
const timetableContent = [
  "## 기초시간표",
  "",
  "| 교시 | 월 | 화 | 수 | 목 | 금 |",
  "| ---: | --- | --- | --- | --- | --- |",
  "| 1 | 국어 | 수학 | 국어 | 과학 | 국어 |",
  "| 2 | 수학 | 국어 | 사회 | 수학 | 수학 |",
  "| 3 | 사회 | 체육 | 수학 | 국어 | 체육 |",
  "| 4 | 과학 | 음악 | 미술 | 영어 | 창체(자율) |",
  "| 5 | 체육 | 영어 | 도덕 | 미술 | 창체(동아리) |",
  "| 6 | － | 창체(자율) | － | 실과 | － |",
  "",
  "## 시간표 변경",
  "",
  "| 날짜 | 교시 | 과목 | 사유 |",
  "| --- | ---: | --- | --- |",
  "| 2026-05-06 | 1 | 체육 | 학년 체육대회 연습 |",
  ""
].join("\n");
const timetable = parseBaseTimetable(timetableFile, {
  schoolYear: "2026",
  semester: "1학기"
}, timetableContent);

test("기초시간표 그리드와 변경 표를 파싱한다", () => {
  assert.equal(timetable.periods, 6);
  assert.equal(timetable.grid[0][0], "국어");
  assert.equal(timetable.grid[5][1], "창체(자율)");
  assert.equal(timetable.overrides.length, 1);
});

test("기본 요일은 기초시간표를 따른다", () => {
  const monday = resolveDay(calendar, timetable, "2026-05-04");
  assert.equal(monday.isClassDay, true);
  assert.equal(monday.periods.length, 5);
  assert.deepEqual(
    monday.periods.map((period) => period.subject),
    ["국어", "수학", "사회", "과학", "체육"]
  );
});

test("시간표 변경이 기초시간표를 덮는다", () => {
  const wednesday = resolveDay(calendar, timetable, "2026-05-06");
  assert.equal(wednesday.periods[0]?.subject, "체육");
  assert.equal(wednesday.periods[0]?.source, "override");
  assert.equal(wednesday.periods[1]?.subject, "사회");
});

test("행사·단축·휴업이 반영된다", () => {
  const friday = resolveDay(calendar, timetable, "2026-05-08");
  assert.equal(friday.periods[0]?.subject, "창체(자율)");
  assert.equal(friday.periods[0]?.source, "event");
  assert.equal(friday.periods[2]?.subject, "체육");

  const thursday = resolveDay(calendar, timetable, "2026-05-07");
  assert.equal(thursday.periods.length, 3);

  const holiday = resolveDay(calendar, timetable, "2026-05-05");
  assert.equal(holiday.isClassDay, false);
  assert.equal(holiday.periods.length, 0);

  const week = resolveWeek(calendar, timetable, "2026-05-04");
  assert.equal(week.length, 5);
});

test("과목 슬롯과 편성 시수를 계산한다", () => {
  const slots = subjectSlots(calendar, timetable, "2026-05-04", "2026-05-08", "수학");
  assert.deepEqual(slots, [
    { date: "2026-05-04", period: 2 },
    { date: "2026-05-06", period: 3 },
    { date: "2026-05-07", period: 2 }
  ]);
  const planned = plannedHoursBySubject(calendar, timetable, "2026-05-04", "2026-05-08");
  assert.equal(planned["국어"], 2);
  assert.equal(planned["창체(자율)"], 3);
});

test("스캐폴드 시간표를 되읽을 수 있다", () => {
  const markdown = baseTimetableMarkdown("2026", "2학기", "우리 반", [5, 6, 5, 6, 5]);
  const parsed = parseBaseTimetable(timetableFile, { schoolYear: "2026", semester: "2학기" }, markdown);
  assert.equal(parsed.periods, 6);
  assert.equal(parsed.grid[5][0], "－");
});
