import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { parseAcademicCalendar } = await loadTypeScriptModule("../packages/core/src/academic-calendar.ts");
const { parseBaseTimetable, resolveWeek } = await loadTypeScriptModule("../packages/core/src/timetable.ts");
const { assignProgress, assignedLessonsByDate, slotContentMap } =
  await loadTypeScriptModule("../packages/core/src/progress.ts");
const { buildWeeklyPlanDays, buildWeeklyPlanMarkdown } =
  await loadTypeScriptModule("../packages/core/src/weekly-plan.ts");

const calendar = parseAcademicCalendar(
  { path: "학사일정.md", basename: "학사일정", stat: { ctime: 1 } },
  {
    "class-management": "academic-calendar",
    schoolYear: "2026",
    semester1Start: "2026-03-02",
    semester1End: "2026-07-17",
    semester2Start: "2026-08-17",
    semester2End: "2027-01-08",
    weekdayPeriods: [2, 2, 2, 2, 2]
  },
  [
    "## 휴업일",
    "| 날짜 | 구분 | 명칭 |",
    "| --- | --- | --- |",
    "| 2026-08-19 | 재량휴업일 | 재량휴업 |"
  ].join("\n")
);

const timetable = parseBaseTimetable(
  { path: "기초시간표.md", basename: "기초시간표", stat: { ctime: 2 } },
  { "class-management": "timetable", schoolYear: "2026", semester: "2학기" },
  [
    "## 기초시간표",
    "| 교시 | 월 | 화 | 수 | 목 | 금 |",
    "| ---: | --- | --- | --- | --- | --- |",
    "| 1 | 수학 | 국어 | 수학 | 국어 | 수학 |",
    "| 2 | 국어 | 수학 | 국어 | 수학 | 국어 |"
  ].join("\n")
);

test("주간학습안내를 생성한다", () => {
  const days = resolveWeek(calendar, timetable, "2026-08-17");
  const mathSlots = [];
  for (const day of days) {
    for (const period of day.periods) {
      if (period.subject === "수학") mathSlots.push({ date: day.date, period: period.period });
    }
  }
  const assignment = assignProgress(
    [
      {
        order: 1,
        unit: "1. 분수",
        topic: "분수의 의미",
        hours: 2,
        standard: "",
        materials: "분수 막대",
        fixedDate: "",
        fixedPeriod: 0,
        assigned: "",
        note: ""
      }
    ],
    mathSlots
  );
  const contents = slotContentMap(assignment);
  const planDays = buildWeeklyPlanDays(days, (date, period) => contents.get(`${date}|${period}`));
  const markdown = buildWeeklyPlanMarkdown({
    className: "우리 반",
    schoolYear: "2026",
    semester: "2학기",
    weekStart: "2026-08-17",
    weekEnd: "2026-08-21",
    days: planDays,
    notices: ["수요일은 재량휴업일입니다."],
    morningActivities: ["독서"]
  });

  assert.match(markdown, /class-management: weekly-plan/);
  assert.match(markdown, /cssclasses:\n {2}- class-management-print/);
  assert.match(markdown, /08-17 \(월\)/);
  assert.match(markdown, /수학<br>1\. 분수<br>분수의 의미/);
  assert.match(markdown, /재량휴업/);
  assert.match(markdown, /\| 아침 \| 독서/);
  assert.match(markdown, /분수 막대/);
  assert.match(markdown, /- 수요일은 재량휴업일입니다\./);
});

test("날짜별 배정 차시를 과목·교시와 함께 모은다 (캘린더 진도 레이어)", () => {
  const byDate = assignedLessonsByDate(
    calendar,
    { "2학기": timetable },
    {
      "2학기": [
        {
          schoolYear: "2026",
          semester: "2학기",
          subject: "수학",
          rows: [
            {
              order: 1,
              unit: "1. 분수",
              topic: "분수의 의미",
              hours: 2,
              standard: "",
              materials: "",
              unitLink: "",
              assignmentLink: "",
              fixedDate: "",
              fixedPeriod: 0,
              assigned: "",
              note: ""
            }
          ]
        }
      ]
    }
  );
  const monday = byDate.get("2026-08-17") ?? [];
  assert.equal(monday.length, 1, "월요일 1교시 수학 한 차시");
  assert.equal(monday[0].subject, "수학");
  assert.equal(monday[0].period, 1);
  assert.equal(monday[0].topic, "분수의 의미");
  assert.equal(monday[0].semester, "2학기");
  assert.ok(!byDate.has("2026-08-19"), "재량휴업일에는 배정이 없다");
});
