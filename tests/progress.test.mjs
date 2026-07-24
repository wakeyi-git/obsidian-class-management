import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const {
  assignProgress,
  crossCurricularThemes,
  formatAssignedSlots,
  parseProgressImport,
  parseProgressTable,
  progressTableMarkdown,
  slotContentMap
} = await loadTypeScriptModule("../packages/core/src/progress.ts");

const file = { path: "진도표.md", basename: "진도표", stat: { ctime: 1 } };

function makeRow(order, topic, hours, fixedDate = "", fixedPeriod = 0) {
  return {
    order,
    unit: "1. 분수",
    topic,
    hours,
    standard: "",
    materials: "",
    fixedDate,
    fixedPeriod,
    assigned: "",
    note: ""
  };
}

test("진도표 Markdown을 되읽을 수 있다", () => {
  const markdown = progressTableMarkdown("2026", "2학기", "수학", "우리 반", [
    makeRow(1, "분수의 의미", 2),
    { ...makeRow(2, "분수 비교 | 정리", 1), materials: "분수 막대", standard: "[4수01-10]" }
  ]);
  const parsed = parseProgressTable(file, { "class-management": "subject-progress", schoolYear: "2026", semester: "2학기", subject: "수학" }, markdown);
  assert.equal(parsed.subject, "수학");
  assert.equal(parsed.rows.length, 2);
  assert.equal(parsed.rows[0].hours, 2);
  assert.equal(parsed.rows[1].topic, "분수 비교 | 정리");
  assert.equal(parsed.rows[1].materials, "분수 막대");
});

test("TSV·CSV 차시 자료를 가져온다", () => {
  const tsv = "단원\t학습 내용\t시수\n1. 분수\t분수의 의미\t2\n1. 분수\t분수 비교\t";
  const imported = parseProgressImport(tsv, 1);
  assert.equal(imported.rows.length, 2);
  assert.equal(imported.rows[0].hours, 2);
  assert.equal(imported.rows[1].hours, 1);
  assert.equal(imported.rows[1].order, 2);

  const csv = '1. 분수,"분수, 나눗셈",1,[4수01-10]';
  const csvImported = parseProgressImport(csv, 5);
  assert.equal(csvImported.rows[0].topic, "분수, 나눗셈");
  assert.equal(csvImported.rows[0].order, 5);
  assert.equal(csvImported.rows[0].standard, "[4수01-10]");

  const empty = parseProgressImport("단원\t\t\n한줄", 1);
  assert.equal(empty.rows.length, 0);
  assert.ok(empty.issues.length >= 1);
});

test("진도를 수업 시간에 순서대로 배정한다", () => {
  const slots = [
    { date: "2026-08-17", period: 2 },
    { date: "2026-08-19", period: 3 },
    { date: "2026-08-21", period: 1 }
  ];
  const assignment = assignProgress([makeRow(1, "분수의 의미", 2), makeRow(2, "분수 비교", 1)], slots);
  assert.deepEqual(assignment.rows[0].slots, [
    { date: "2026-08-17", period: 2 },
    { date: "2026-08-19", period: 3 }
  ]);
  assert.deepEqual(assignment.rows[1].slots, [{ date: "2026-08-21", period: 1 }]);
  assert.equal(assignment.issues.length, 0);
  assert.equal(assignment.unassignedSlots.length, 0);
});

test("고정 날짜 차시가 먼저 배정된다", () => {
  const slots = [
    { date: "2026-08-17", period: 2 },
    { date: "2026-08-19", period: 3 },
    { date: "2026-08-21", period: 1 }
  ];
  const assignment = assignProgress(
    [makeRow(1, "일반 차시", 2), makeRow(2, "국악 강사 수업", 1, "2026-08-19")],
    slots
  );
  assert.deepEqual(assignment.rows[1].slots, [{ date: "2026-08-19", period: 3 }]);
  assert.deepEqual(assignment.rows[0].slots, [
    { date: "2026-08-17", period: 2 },
    { date: "2026-08-21", period: 1 }
  ]);
});

test("부족·잉여 시수를 경고한다", () => {
  const shortage = assignProgress([makeRow(1, "차시", 3)], [{ date: "2026-08-17", period: 1 }]);
  assert.equal(shortage.rows[0].shortage, 2);
  assert.ok(shortage.issues.some((issue) => /2차시 부족/.test(issue)));

  const leftover = assignProgress([makeRow(1, "차시", 1)], [
    { date: "2026-08-17", period: 1 },
    { date: "2026-08-18", period: 1 }
  ]);
  assert.ok(leftover.issues.some((issue) => /남는 수업 시간/.test(issue)));

  const missingFixed = assignProgress([makeRow(1, "고정", 1, "2026-08-20")], [
    { date: "2026-08-17", period: 1 }
  ]);
  assert.ok(missingFixed.issues.some((issue) => /수업이 없습니다/.test(issue)));
});

test("고정 표식을 해석하고 되쓴다", () => {
  const file = { path: "사회.md", basename: "사회", stat: { ctime: 1 } };
  const frontmatter = { "class-management": "subject-progress", schoolYear: "2026", semester: "2학기", subject: "사회" };

  // 배정이 비어 있으면 위치를 명시해 잃지 않는다
  const unassigned = progressTableMarkdown("2026", "2학기", "사회", "우리 반", [
    { ...makeRow(1, "다문화 놀이 한마당", 2, "2026-10-15", 3), unit: "1. 사회 변화와 다양한 문화" }
  ]);
  assert.match(unassigned, /📌 2026-10-15\(3\)/);
  let parsed = parseProgressTable(file, frontmatter, unassigned);
  assert.equal(parsed.rows[0].fixedDate, "2026-10-15");
  assert.equal(parsed.rows[0].fixedPeriod, 3);

  // 배정이 고정 위치를 담고 있으면 📌만 남는다
  const assigned = progressTableMarkdown("2026", "2학기", "사회", "우리 반", [
    {
      ...makeRow(1, "다문화 놀이 한마당", 2, "2026-10-15", 3),
      assigned: "2026-10-15(3), 2026-10-15(4)"
    }
  ]);
  assert.match(assigned, /\| 📌 \| 1 \| 2026-10-15\(3\), 2026-10-15\(4\) \|/);
  parsed = parseProgressTable(file, frontmatter, assigned);
  assert.equal(parsed.rows[0].fixedDate, "2026-10-15");
  assert.equal(parsed.rows[0].fixedPeriod, 3);

  // 이전 버전 표기(마커 없는 날짜)도 그대로 읽힌다
  const legacy = [
    "## 진도표",
    "| 순 | 단원·영역 | 학습 내용 | 시수 | 성취기준 | 준비물 | 고정 날짜 | 배정 | 비고 |",
    "| ---: | --- | --- | ---: | --- | --- | --- | --- | --- |",
    "| 1 | 단원 | 차시 | 1 |  |  | 2026-11-09 |  |  |"
  ].join("\n");
  parsed = parseProgressTable(file, frontmatter, legacy);
  assert.equal(parsed.rows[0].fixedDate, "2026-11-09");
  assert.equal(parsed.rows[0].fixedPeriod, 0);
});

test("교시까지 고정한 차시는 정확한 자리를 먼저 차지한다", () => {
  const slots = [
    { date: "2026-10-15", period: 1 },
    { date: "2026-10-15", period: 3 },
    { date: "2026-10-15", period: 4 },
    { date: "2026-10-16", period: 2 }
  ];
  const assignment = assignProgress(
    [
      makeRow(1, "일반 차시 A", 1),
      makeRow(2, "행사 연계 차시", 2, "2026-10-15", 3),
      makeRow(3, "일반 차시 B", 1)
    ],
    slots
  );
  assert.deepEqual(assignment.rows[1].slots, [
    { date: "2026-10-15", period: 3 },
    { date: "2026-10-15", period: 4 }
  ]);
  assert.deepEqual(assignment.rows[0].slots, [{ date: "2026-10-15", period: 1 }]);
  assert.deepEqual(assignment.rows[2].slots, [{ date: "2026-10-16", period: 2 }]);
  assert.equal(assignment.issues.length, 0);
});

test("고정한 교시에 과목 수업이 없으면 경고하고 배정하지 않는다", () => {
  const assignment = assignProgress(
    [makeRow(1, "행사 연계 차시", 1, "2026-10-15", 5)],
    [{ date: "2026-10-15", period: 1 }]
  );
  assert.equal(assignment.rows[0].slots.length, 0);
  assert.equal(assignment.rows[0].shortage, 1);
  assert.ok(assignment.issues.some((issue) => /5교시에 해당 과목 수업이 없습니다/.test(issue)));

  const conflict = assignProgress(
    [
      makeRow(1, "먼저 고정", 1, "2026-10-15", 3),
      makeRow(2, "나중 고정", 1, "2026-10-15", 3)
    ],
    [{ date: "2026-10-15", period: 3 }]
  );
  assert.equal(conflict.rows[0].slots.length, 1);
  assert.equal(conflict.rows[1].slots.length, 0);
  assert.ok(conflict.issues.some((issue) => /나중 고정/.test(issue)));
});

test("배정 결과 표기와 슬롯 맵을 만든다", () => {
  const assignment = assignProgress([makeRow(1, "분수의 의미", 2)], [
    { date: "2026-08-17", period: 2 },
    { date: "2026-08-19", period: 3 }
  ]);
  assert.equal(
    formatAssignedSlots(assignment.rows[0].slots),
    "2026-08-17(2), 2026-08-19(3)"
  );
  const map = slotContentMap(assignment);
  assert.equal(map.get("2026-08-19|3")?.topic, "분수의 의미");
});

test("진도표 헤더: 새 이름 프로젝트와 구명 통합 단원을 모두 읽는다", () => {
  const rows = [makeRow(1, "차시", 1)];
  const serialized = progressTableMarkdown("2026", "2학기", "과학", "우리 반", rows);
  assert.match(serialized, /\| 프로젝트 \|/);
  const parsedNew = parseProgressTable(file, { "class-management": "subject-progress" }, serialized);
  assert.equal(parsedNew.rows.length, 1);

  const legacy = serialized.replace("| 프로젝트 |", "| 통합 단원 |");
  const parsedLegacy = parseProgressTable(file, { "class-management": "subject-progress" }, legacy);
  assert.equal(parsedLegacy.rows.length, 1);
  const withLink = legacy
    .split("\n")
    .map((line) => (line.startsWith("|  | 1 |") ? line.replace("차시 | 1 |  |  |", "차시 | 1 |  | [[프로젝트 P]] |") : line))
    .join("\n");
  assert.equal(parseProgressTable(file, { "class-management": "subject-progress" }, withLink).rows[0].unitLink, "[[프로젝트 P]]");
});

test("판별자가 다른 노트는 진도표로 파싱하지 않는다", () => {
  const markdown = progressTableMarkdown("2026", "2학기", "수학", "우리 반", []);
  assert.equal(parseProgressTable(file, { "class-management": "timetable" }, markdown), null);
  assert.equal(parseProgressTable(file, {}, markdown), null);
});

test("구분행이 헤더보다 먼저 나와도 이름 기반 열 해석이 유지된다", () => {
  const malformed = [
    "## 진도표",
    "| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "| 고정 | 순 | 배정 | 단원 | 학습 내용 | 시수 | 성취기준 | 프로젝트 | 과제 | 준비물 | 비고 |",
    "| ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
    "|  | 1 |  | 1. 큰 수 | 자리값 알기 | 2 |  |  |  |  | 메모 |"
  ].join("\n");
  const parsed = parseProgressTable(
    file,
    { "class-management": "subject-progress", schoolYear: "2026", semester: "2학기", subject: "수학" },
    malformed
  );
  assert.equal(parsed.rows.length, 1);
  assert.equal(parsed.rows[0].note, "메모"); // 구분행을 헤더로 오인하면 구버전 배치가 되어 비고가 어긋난다
});

test("범교과 주제어를 비고 태그에서 집계한다", () => {
  const table = (semester, subject, rows) => ({
    file, schoolYear: "2026", semester, subject, rows
  });
  const themes = crossCurricularThemes({
    "1학기": [
      table("1학기", "체육", [
        { ...makeRow(1, "안전하게 놀기", 2), note: "#안전" },
        { ...makeRow(2, "표현", 1), note: "" }
      ])
    ],
    "2학기": [
      table("2학기", "국어", [
        { ...makeRow(1, "토론", 1), note: "#인성 #안전 메모" }
      ]),
      table("2학기", "창체(자율)", [
        { ...makeRow(2, "소방 대피 훈련", 1), note: "#안전 #안전" }
      ])
    ]
  });
  const safety = themes.find((theme) => theme.tag === "안전");
  assert.equal(safety.lessons, 3, "같은 칸의 중복 태그는 1차시로 센다");
  assert.equal(safety.hours, 4);
  assert.equal(safety.hoursBySemester["1학기"], 2);
  assert.equal(safety.hoursBySemester["2학기"], 2);
  assert.equal(safety.subjects[0].subject, "체육");
  assert.equal(themes[0].tag, "안전", "시수 많은 순 정렬");
  assert.equal(themes.find((theme) => theme.tag === "인성").hours, 1);
});

test("재구성 기록을 비고의 `재구성:` 관례에서 모은다", async () => {
  const { reconstructionNotes } = await loadTypeScriptModule("../packages/core/src/progress.ts");
  const notes = reconstructionNotes({
    "2학기": [
      {
        file, schoolYear: "2026", semester: "2학기", subject: "국어",
        rows: [
          { ...makeRow(3, "토론하기", 1), note: "재구성: 독도 프로젝트로 이관하며 2차시→1차시 축약 #안전" },
          { ...makeRow(1, "일반", 1), note: "메모만" }
        ]
      },
      {
        file, schoolYear: "2026", semester: "2학기", subject: "과학",
        rows: [{ ...makeRow(2, "실험", 1), note: "재구성： 순서 이동(3단원 뒤로)" }]
      }
    ]
  });
  assert.equal(notes.length, 2);
  assert.equal(notes[0].subject, "과학", "과목명 정렬");
  assert.equal(notes[1].memo, "독도 프로젝트로 이관하며 2차시→1차시 축약 #안전");
  assert.equal(notes[0].memo, "순서 이동(3단원 뒤로)", "전각 콜론도 허용");
});
