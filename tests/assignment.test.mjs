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

test("도달수준 5열 확인표를 쓰고 되읽는다 (구형 4열 호환)", async () => {
  const { formatAssignmentTableRow, parseAssignmentTable } =
    await loadTypeScriptModule("../packages/core/src/assignment.ts");
  const withLevel = formatAssignmentTableRow(
    { studentNumber: "1", studentName: "김하늘", status: "제출", level: "◎", note: "발표" },
    "학급운영/학생/1번 김하늘.md",
    true
  );
  assert.match(withLevel, /\| 제출 \| ◎ \| 발표 \|/);

  const parsed = parseAssignmentTable([
    "| 번호 | 학생 | 상태 | 도달수준 | 메모 |",
    "| ---: | --- | --- | :---: | --- |",
    withLevel,
    "| 2 | 이바다 | 보완 |  | 재제출 |",
    "| 3 | 최강 | 제출 | X | 무효 기호 |"
  ].join("\n"));
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].level, "◎");
  assert.equal(parsed[1].level, undefined, "빈 도달수준은 미기록");
  assert.equal(parsed[1].note, "재제출");
  assert.equal(parsed[2].level, undefined, "허용 기호 밖은 무시");

  const legacy = parseAssignmentTable("| 1 | 김하늘 | 제출 | 메모 |");
  assert.equal(legacy[0].note, "메모", "구형 4열도 그대로 읽힌다");
  assert.equal(legacy[0].level, undefined);
});
