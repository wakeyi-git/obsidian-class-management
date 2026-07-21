import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { isLegacyAttendanceContent, isWikiLinkStudentPath } =
  await loadTypeScriptModule("../src/migration.ts");

test("레거시 3열 출결 표를 식별한다", () => {
  assert.equal(isLegacyAttendanceContent("| 번호 | 학생 | 상태 |\n| --- | --- | --- |"), true);
  assert.equal(isLegacyAttendanceContent("| 번호 | 학생 | 상태 | 사유 |"), false);
});

test("위키링크 studentPath를 식별한다", () => {
  assert.equal(isWikiLinkStudentPath("[[학급운영/학생/01 김하늘]]"), true);
  assert.equal(isWikiLinkStudentPath("학급운영/학생/01 김하늘"), false);
});
