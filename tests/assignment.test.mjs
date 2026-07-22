import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { formatAssignmentTableRow, parseAssignmentTable } =
  await loadTypeScriptModule("../packages/core/src/assignment.ts");

const assignments = [
  { studentNumber: "1", studentName: "김하늘", status: "제출" },
  {
    studentNumber: "2",
    studentName: "이바다",
    status: "보완",
    note: "3번 문제 | 다시 풀기"
  }
];

test("과제 표를 파싱한다", () => {
  const assignmentTable = [
    "| 번호 | 학생 | 상태 | 메모 |",
    "| ---: | --- | --- | --- |",
    "| 1 | [[학급운영/학생/01 김하늘\\|1번 김하늘]] | 제출 |  |",
    "| 2 | [[학급운영/학생/02 이바다\\|2번 이바다]] | 보완 | 3번 문제 \\| 다시 풀기 |"
  ].join("\n");
  assert.deepEqual(parseAssignmentTable(assignmentTable), assignments);
});

test("과제 행을 만들 수 있다", () => {
  assert.equal(
    formatAssignmentTableRow(assignments[1], "학급운영/학생/02 이바다.md"),
    "| 2 | [[학급운영/학생/02 이바다\\|2번 이바다]] | 보완 | 3번 문제 \\| 다시 풀기 |"
  );
});

test("알 수 없는 상태는 거른다", () => {
  assert.deepEqual(parseAssignmentTable("| 3 | 박구름 | 알 수 없음 |  |"), []);
});
