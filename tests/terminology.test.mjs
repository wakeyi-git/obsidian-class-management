import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

/*
 * 용어 사전 가드 (UIUX §2) — 사용자에게 노출되는 소스 문자열 리터럴에서
 * 금지 유의어를 검출한다. 주석은 대상이 아니다(사용자 비노출).
 */

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const SOURCE_DIRS = ["src", "packages/core/src"];

/** 금지 유의어 규칙. allow의 정규식과 일치하는 리터럴은 예외로 허용한다. */
const RULES = [
  { term: "수업 기록", standard: "수업일지" },
  { term: "차시 기록", standard: "수업일지" },
  { term: "이 교시 기록", standard: "수업일지" },
  {
    term: "수업 실행",
    standard: "수업일지",
    allow: [/실행 완료/] // 상태어(계획→실행 완료)는 §2 표준
  },
  { term: "차시 실행", standard: "수업일지", allow: [/실행 완료/] },
  { term: "과제(평가)", standard: "과제" },
  { term: "평가 과제", standard: "과제(assignment) 또는 수행과제(단원 설계)" },
  {
    term: "수행평가",
    standard: "과제 (라벨 금지 — 노트 제목 고유명·평가방법 예시만 허용)",
    allow: [
      /수행평가 - /, // 과제 노트 제목 규약: "{과목} 수행평가 - {요소}"
      /^ 수행평가$/, // 제목 규약을 되파싱하는 구분자
      /예: [^]*수행평가/ // 평가방법 입력 예시(방법 이름으로서의 쓰임)
    ]
  },
  { term: "RAW 근거", standard: "학생부 근거 (RAW)" },
  { term: "생활 기록", standard: "학생 기록 (폴더명과 동일)" }
];

/** 소스에서 문자열 리터럴("…", '…', `…`)만 추출한다. 템플릿 내 표현식은 통째로 둔다. */
function stringLiterals(source) {
  const literals = [];
  const pattern = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\]|\\.)*`/g;
  for (const match of source.matchAll(pattern)) {
    const line = source.slice(0, match.index).split("\n").length;
    literals.push({ text: match[0].slice(1, -1), line });
  }
  return literals;
}

function sourceFiles() {
  const files = [];
  for (const dir of SOURCE_DIRS) {
    for (const name of readdirSync(path.join(root, dir))) {
      if (name.endsWith(".ts")) files.push(path.join(dir, name));
    }
  }
  return files;
}

test("금지 유의어가 사용자 노출 문자열에 없다 (UIUX §2)", () => {
  const violations = [];
  for (const file of sourceFiles()) {
    const source = readFileSync(path.join(root, file), "utf-8");
    for (const { text, line } of stringLiterals(source)) {
      for (const rule of RULES) {
        if (!text.includes(rule.term)) continue;
        if ((rule.allow ?? []).some((pattern) => pattern.test(text))) continue;
        violations.push(`${file}:${line} "${text.slice(0, 60)}" — "${rule.term}" 대신 "${rule.standard}"`);
      }
    }
  }
  assert.deepEqual(violations, [], `용어 사전 위반 ${violations.length}건:\n${violations.join("\n")}`);
});
