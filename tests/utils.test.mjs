import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const {
  booleanValue,
  compareStudentNumber,
  csvCell,
  escapeTableCell,
  joinVaultPath,
  localDate,
  safeFileSegment,
  splitMarkdownTableRow,
  stringValue,
  studentNameFromCell,
  unescapeTableCell,
  yamlString
} = await loadTypeScriptModule("../packages/core/src/utils.ts");

test("joinVaultPath는 구분자와 공백 문자를 정규화한다", () => {
  assert.equal(joinVaultPath("학급운영", "학생", "명단.md"), "학급운영/학생/명단.md");
  assert.equal(joinVaultPath("/학급운영/", "/출결/"), "학급운영/출결");
  assert.equal(joinVaultPath("a\\b", "c//d"), "a/b/c/d");
  assert.equal(joinVaultPath("", "  "), "/");
});

test("safeFileSegment는 금지 문자를 대체하고 공백을 정리한다", () => {
  assert.equal(safeFileSegment('과학: 힘과 우리 생활?'), "과학- 힘과 우리 생활-");
  assert.equal(safeFileSegment("a/b\\c|d"), "a-b-c-d");
  assert.equal(safeFileSegment("  여러   칸  "), "여러 칸");
});

test("yamlString과 csvCell은 따옴표를 안전하게 감싼다", () => {
  assert.equal(yamlString('말 "인용" 포함'), '"말 \\"인용\\" 포함"');
  assert.equal(csvCell('쉼표, 그리고 "따옴표"'), '"쉼표, 그리고 ""따옴표"""');
});

test("localDate는 주입한 날짜를 YYYY-MM-DD로 만든다", () => {
  assert.equal(localDate(new Date(2026, 0, 5)), "2026-01-05");
  assert.equal(localDate(new Date(2026, 11, 31)), "2026-12-31");
});

test("stringValue는 공백을 다듬고 null·undefined에 fallback을 쓴다", () => {
  assert.equal(stringValue("  값  "), "값");
  assert.equal(stringValue(3), "3");
  assert.equal(stringValue(null), "");
  assert.equal(stringValue(undefined, "기본"), "기본");
});

test("booleanValue는 문자열 불리언을 해석하고 그 외엔 fallback", () => {
  assert.equal(booleanValue(true, false), true);
  assert.equal(booleanValue("TRUE", false), true);
  assert.equal(booleanValue("false", true), false);
  assert.equal(booleanValue("아니오", true), true);
});

test("compareStudentNumber는 숫자 우선, 그 외 한국어 자연 정렬", () => {
  assert.ok(compareStudentNumber("2", "10") < 0);
  assert.ok(compareStudentNumber("10", "2") > 0);
  assert.ok(compareStudentNumber("가1", "가2") < 0);
});

test("splitMarkdownTableRow는 이스케이프된 파이프를 셀 안에 남긴다", () => {
  assert.deepEqual(splitMarkdownTableRow("| 1 | 김하늘 | 지각 |"), ["1", "김하늘", "지각"]);
  assert.deepEqual(splitMarkdownTableRow("| a\\|b | c |"), ["a\\|b", "c"]);
  assert.deepEqual(splitMarkdownTableRow("표가 아닌 줄"), []);
});

test("escapeTableCell 왕복 — 파이프 보존, 줄바꿈은 공백으로", () => {
  assert.equal(unescapeTableCell(escapeTableCell("a|b")), "a|b");
  assert.equal(escapeTableCell("한 줄\n두 줄"), "한 줄 두 줄");
});

test("studentNameFromCell은 규약 표기와 손편집 표기를 모두 읽는다", () => {
  // 규약: 표 셀 안 이스케이프 별칭
  assert.equal(
    studentNameFromCell("[[학급운영/학생/1번 김하늘\\|1번 김하늘]]", "1"),
    "김하늘"
  );
  // 손편집: 일반 파이프 별칭도 그대로 읽는다(노트가 진실)
  assert.equal(
    studentNameFromCell("[[학급운영/학생/1번 김하늘|1번 김하늘]]", "1"),
    "김하늘"
  );
  // 별칭 없는 링크는 파일 이름에서 번호 접두사를 걷어낸다
  assert.equal(studentNameFromCell("[[학급운영/학생/1번 김하늘]]", "1"), "김하늘");
  // 링크가 아닌 일반 텍스트
  assert.equal(studentNameFromCell("03 박준", "3"), "박준");
});
