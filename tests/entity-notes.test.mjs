import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { BASES_VIEW_FILES, schoolEventNoteFileName, schoolEventNoteMarkdown } =
  await loadTypeScriptModule("../packages/core/src/entity-notes.ts");

const event = {
  name: "현장체험학습",
  date: "2026-05-12",
  type: "체험",
  periods: [1, 2, 3],
  subject: "통합"
};

test("행사 노트는 kind·태그·머리글과 교시 정보를 담는다", () => {
  const markdown = schoolEventNoteMarkdown(event, "우리 반");
  assert.match(markdown, /class-management: school-event/);
  assert.match(markdown, /- class-management\/school-event/);
  assert.match(markdown, /# 2026-05-12 · 현장체험학습/);
  assert.match(markdown, /유형: 체험 · 1,2,3교시 · 통합/);
  assert.match(markdown, /## 결과·성찰/);
});

test("교시·과목이 없는 행사는 유형만 표기한다", () => {
  const markdown = schoolEventNoteMarkdown(
    { ...event, periods: [], subject: "" },
    "우리 반"
  );
  assert.match(markdown, /- 유형: 체험\n/);
  assert.doesNotMatch(markdown, /교시/);
});

test("행사 파일 이름은 금지 문자를 정리한다", () => {
  assert.equal(
    schoolEventNoteFileName({ ...event, name: "가을 운동회: 예행/연습" }),
    "2026-05-12 가을 운동회- 예행-연습.md"
  );
});

test("Bases 보기 7종은 이름이 고유하고 필터·표 보기를 갖춘다", () => {
  assert.equal(BASES_VIEW_FILES.length, 7);
  const names = BASES_VIEW_FILES.map(([name]) => name);
  assert.equal(new Set(names).size, names.length);
  for (const [name, content] of BASES_VIEW_FILES) {
    assert.match(name, /\.base$/, `${name}: .base 확장자가 아닙니다`);
    assert.match(content, /filters:/, `${name}: filters가 없습니다`);
    assert.match(content, /- type: table/, `${name}: table 보기가 없습니다`);
    assert.ok(content.endsWith("\n"), `${name}: 끝 개행이 없습니다`);
  }
});

test("연계 기록 보기는 임베드한 노트(this)를 기준으로 거른다", () => {
  const linked = BASES_VIEW_FILES.find(([name]) => name === "연계 기록.base");
  assert.ok(linked);
  assert.match(linked[1], /file\.hasLink\(this\.file\)/);
  // 단원에 링크될 수 있는 네 종류를 모두 포함한다
  for (const tag of ["curriculum-lesson", "assignment", "record", "school-event"]) {
    assert.match(linked[1], new RegExp(`class-management/${tag}`));
  }
});
