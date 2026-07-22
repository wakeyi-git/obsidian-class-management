import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { formatAttendanceTableRow, parseAttendanceMetadata } =
  await loadTypeScriptModule("../packages/core/src/attendance.ts");

const attendance = [
  { studentNumber: "1", studentName: "김하늘", status: "출석" },
  {
    studentNumber: "2",
    studentName: "이%바다",
    status: "지각",
    reason: "버스 지연 | 확인"
  }
];

test("출결 표를 파싱한다", () => {
  const attendanceTable = [
    "| 번호 | 학생 | 상태 | 사유 |",
    "| ---: | --- | --- | --- |",
    "| 1 | [[학급운영/학생/01 김하늘\\|1번 김하늘]] | 출석 |  |",
    "| 2 | [[학급운영/학생/02 이%바다\\|2번 이%바다]] | 지각 | 버스 지연 \\| 확인 |"
  ].join("\n");
  assert.deepEqual(parseAttendanceMetadata(attendanceTable), attendance);
});

test("출결 행을 만들고 되읽을 수 있다", () => {
  const renderedRow = formatAttendanceTableRow(
    attendance[0],
    "학급운영/학생/01 김하늘.md"
  );
  assert.equal(
    renderedRow,
    "| 1 | [[학급운영/학생/01 김하늘\\|1번 김하늘]] | 출석 |  |"
  );
  assert.deepEqual(parseAttendanceMetadata(renderedRow), [attendance[0]]);
  assert.equal(
    formatAttendanceTableRow(attendance[1], "학급운영/학생/02 이%바다.md"),
    "| 2 | [[학급운영/학생/02 이%바다\\|2번 이%바다]] | 지각 | 버스 지연 \\| 확인 |"
  );
});

test("레거시 3열 표를 읽는다", () => {
  const oldThreeColumnRow =
    "| 3 | [[학급운영/학생/03 박구름\\|3번 박구름]] | 결석 |";
  assert.deepEqual(parseAttendanceMetadata(oldThreeColumnRow), [
    { studentNumber: "3", studentName: "박구름", status: "결석" }
  ]);
});

test("레거시 JSON 주석 포맷을 읽고 잘못된 값은 거른다", () => {
  const legacyAttendance = `%% class-management-attendance: ${JSON.stringify(attendance)} %%`;
  assert.deepEqual(parseAttendanceMetadata(legacyAttendance), attendance);
  assert.deepEqual(
    parseAttendanceMetadata(
      '%% class-management-attendance: [{"studentNumber":"3","studentName":"박구름","status":"알 수 없음"}] %%'
    ),
    []
  );
  assert.deepEqual(parseAttendanceMetadata("%% class-management-attendance: invalid %%"), []);
});
