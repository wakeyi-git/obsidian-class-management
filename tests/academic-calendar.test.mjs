import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const {
  academicCalendarMarkdown,
  addDays,
  availableHours,
  countClassDays,
  dayStatus,
  mondayOf,
  parseAcademicCalendar,
  parsePeriodsCell,
  parseWeekdayPeriods,
  periodCountFor,
  semesterForDate,
  semesterRange
} = await loadTypeScriptModule("../packages/core/src/academic-calendar.ts");

const file = { path: "학급운영/교육과정/학사일정/2026 학사일정.md", basename: "2026 학사일정", stat: { ctime: 1 } };
const frontmatter = {
  "class-management": "academic-calendar",
  schoolYear: "2026",
  semester1Start: "2026-03-02",
  semester1End: "2026-07-17",
  semester2Start: "2026-08-17",
  semester2End: "2027-01-08",
  weekdayPeriods: [5, 6, 5, 6, 5]
};
const content = [
  "## 휴업일",
  "",
  "| 날짜 | 구분 | 명칭 |",
  "| --- | --- | --- |",
  "| 2026-05-05 | 공휴일 | 어린이날 |",
  "| 2026-05-04 | 재량휴업일 | 재량휴업 |",
  "",
  "## 행사",
  "",
  "| 날짜 | 유형 | 명칭 | 교시 | 과목 | 비고 |",
  "| --- | --- | --- | --- | --- | --- |",
  "| 2026-05-08 | 행사 | 운동회 | 1-4 | 창체(자율) |  |",
  "| 2026-05-07 | 단축 | 단기방학 전날 | 4 |  |  |",
  "| 2026-03-02 | 전일행사 | 입학식 |  |  |  |"
].join("\n");
const calendar = parseAcademicCalendar(file, frontmatter, content);

test("학사일정 노트를 파싱한다", () => {
  assert.equal(calendar.schoolYear, "2026");
  assert.equal(calendar.closedDays.length, 2);
  assert.equal(calendar.events.length, 3);
  assert.deepEqual(calendar.weekdayPeriods, [5, 6, 5, 6, 5]);
  assert.deepEqual(
    calendar.events.find((event) => event.name === "운동회")?.periods,
    [1, 2, 3, 4]
  );
});

test("날짜 상태를 판별한다", () => {
  assert.equal(dayStatus(calendar, "2026-05-06").kind, "class");
  assert.equal(dayStatus(calendar, "2026-05-05").kind, "closed");
  assert.equal(dayStatus(calendar, "2026-05-09").kind, "weekend");
  assert.equal(dayStatus(calendar, "2026-07-21").kind, "vacation");
  assert.equal(dayStatus(calendar, "2026-07-21").name, "여름방학");
  assert.equal(dayStatus(calendar, "2026-02-10").kind, "out-of-year");
});

test("요일별 기준 교시와 단축을 반영해 교시 수를 계산한다", () => {
  assert.equal(periodCountFor(calendar, "2026-05-06"), 5);
  assert.equal(periodCountFor(calendar, "2026-05-07"), 4);
  assert.equal(periodCountFor(calendar, "2026-05-05"), 0);
});

test("수업일수와 수업가능시수를 계산한다", () => {
  assert.equal(countClassDays(calendar, "2026-05-04", "2026-05-08"), 3);
  assert.equal(availableHours(calendar, "2026-05-04", "2026-05-08"), 14);
});

test("학기 범위를 반환한다", () => {
  assert.deepEqual(semesterRange(calendar, "1학기"), { from: "2026-03-02", to: "2026-07-17" });
  assert.deepEqual(semesterRange(calendar, "2학기"), { from: "2026-08-17", to: "2027-01-08" });
});

test("날짜가 속한 학기를 판별한다", () => {
  assert.equal(semesterForDate(calendar, "2026-05-11"), "1학기");
  assert.equal(semesterForDate(calendar, "2026-09-01"), "2학기");
  assert.equal(semesterForDate(calendar, "2026-08-01"), "");
  assert.equal(semesterForDate(calendar, "2027-02-10"), "");
});

test("교시 표기와 요일 교시 배열을 파싱한다", () => {
  assert.deepEqual(parsePeriodsCell("1-3"), [1, 2, 3]);
  assert.deepEqual(parsePeriodsCell("1, 3"), [1, 3]);
  assert.deepEqual(parsePeriodsCell("5"), [5]);
  assert.deepEqual(parsePeriodsCell(""), []);
  assert.deepEqual(parseWeekdayPeriods("5,6,5"), [5, 6, 5, 0, 0]);
  assert.deepEqual(parseWeekdayPeriods([4, 4, 4, 4, 4, 9]), [4, 4, 4, 4, 4]);
});

test("날짜 계산 헬퍼가 동작한다", () => {
  assert.equal(addDays("2026-07-31", 1), "2026-08-01");
  assert.equal(mondayOf("2026-07-23"), "2026-07-20");
  assert.equal(mondayOf("2026-07-20"), "2026-07-20");
});

test("스캐폴드 Markdown을 되읽을 수 있다", () => {
  const markdown = academicCalendarMarkdown("2026", "우리 반");
  assert.match(markdown, /class-management: academic-calendar/);
  const parsed = parseAcademicCalendar(file, frontmatter, markdown);
  assert.ok(parsed.closedDays.some((day) => day.name === "어린이날"));
  assert.ok(parsed.events.some((event) => event.type === "단축"));
});

test("weekdayPeriods: 쉼표 문자열과 숫자 배열 모두 파싱된다", () => {
  assert.deepEqual(parseWeekdayPeriods("5, 6, 5, 6, 5"), [5, 6, 5, 6, 5]);
  assert.deepEqual(parseWeekdayPeriods([5, 6, 5, 5, 5]), [5, 6, 5, 5, 5]);
});

test("방학 구간: 행정 학기 안이라도 방학 표 기간은 비수업일", () => {
  const content = [
    "## 방학",
    "| 시작 | 종료 | 이름 |",
    "| --- | --- | --- |",
    "| 2026-07-21 | 2026-08-18 | 여름방학 |",
    ""
  ].join("\n");
  const calendar = parseAcademicCalendar(
    { path: "c.md", basename: "c", stat: { ctime: 1 } },
    {
      "class-management": "academic-calendar",
      schoolYear: "2026",
      semester1Start: "2026-03-01",
      semester1End: "2026-08-18",
      semester2Start: "2026-08-19",
      semester2End: "2027-02-28",
      weekdayPeriods: "5, 6, 5, 5, 5"
    },
    content
  );
  assert.deepEqual(calendar.vacations, [
    { from: "2026-07-21", to: "2026-08-18", name: "여름방학" }
  ]);
  assert.equal(dayStatus(calendar, "2026-07-22").kind, "vacation"); // 학기 범위 안 방학
  assert.equal(dayStatus(calendar, "2026-07-20").kind, "class"); // 방학 전 수업일
  assert.equal(dayStatus(calendar, "2026-08-19").kind, "class"); // 개학일
});

test("방학 표가 없으면 기존 파생 방학(학기 사이)이 유지된다", () => {
  const calendar = parseAcademicCalendar(
    { path: "c.md", basename: "c", stat: { ctime: 1 } },
    {
      "class-management": "academic-calendar",
      semester1Start: "2026-03-02",
      semester1End: "2026-07-20",
      semester2Start: "2026-08-19",
      semester2End: "2027-01-08"
    },
    ""
  );
  assert.equal(calendar.vacations.length, 0);
  assert.equal(dayStatus(calendar, "2026-07-22").kind, "vacation");
});

test("판별자가 다른 노트는 학사일정으로 파싱하지 않는다", () => {
  assert.equal(
    parseAcademicCalendar(file, { schoolYear: "2026" }, content),
    null
  );
});
