import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { parseRosterCsv } = await loadTypeScriptModule("../packages/core/src/csv.ts");

test("헤더 있는 한글 CSV와 BOM을 인식한다", () => {
  const korean = parseRosterCsv("﻿번호,이름\r\n1,김하늘\r\n2,이바다\r\n");
  assert.equal(korean.hasHeader, true);
  assert.deepEqual(korean.students, [
    { number: "1", name: "김하늘" },
    { number: "2", name: "이바다" }
  ]);
});

test("영문 역순 헤더와 따옴표 셀을 처리한다", () => {
  const englishReversed = parseRosterCsv('name,number\n"김,하늘",3.0');
  assert.deepEqual(englishReversed.students, [{ number: "3", name: "김,하늘" }]);
});

test("헤더 없는 2열 CSV를 처리한다", () => {
  const withoutHeader = parseRosterCsv("4,박구름\n5,최우주");
  assert.equal(withoutHeader.hasHeader, false);
  assert.deepEqual(withoutHeader.students, [
    { number: "4", name: "박구름" },
    { number: "5", name: "최우주" }
  ]);
});

test("탭 구분 명렬표를 처리한다", () => {
  const tabSeparated = parseRosterCsv("번호\t이름\n7\t윤별\n8\t정새벽");
  assert.deepEqual(tabSeparated.students, [
    { number: "7", name: "윤별" },
    { number: "8", name: "정새벽" }
  ]);
});

test("중복 번호와 누락 값을 문제로 보고한다", () => {
  const withIssues = parseRosterCsv("번호,이름\n1,가람\n1,나래\n,다온\n4,");
  assert.deepEqual(withIssues.students, [{ number: "1", name: "가람" }]);
  assert.equal(withIssues.issues.length, 3);
  assert.deepEqual(
    withIssues.issues.map((issue) => issue.row),
    [3, 4, 5]
  );
});

test("이스케이프된 따옴표를 복원한다", () => {
  const escapedQuote = parseRosterCsv('번호,이름\n6,"김""하늘"');
  assert.deepEqual(escapedQuote.students, [{ number: "6", name: '김"하늘' }]);
});

test("잘못된 형식은 한국어 메시지로 거부한다", () => {
  assert.throws(
    () => parseRosterCsv("번호,반\n1,김하늘"),
    /번호와 이름 열을 모두 찾을 수 없습니다/
  );
  assert.throws(() => parseRosterCsv('번호,이름\n1,"김하늘'), /따옴표가 닫히지 않았습니다/);
});
