import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { ACTIVITY_INDEX_CATEGORIES, classifyVaultPath } =
  await loadTypeScriptModule("../packages/core/src/change-scope.ts");

const folders = {
  base: "학급운영",
  students: "학급운영/학생",
  records: "학급운영/학생 기록",
  attendance: "학급운영/출결",
  assignments: "학급운영/과제",
  tasks: "학급운영/할 일",
  notices: "학급운영/가정통신문",
  routines: "학급운영/루틴",
  academicCalendar: "학급운영/교육과정/학사일정",
  timetable: "학급운영/교육과정/시간표",
  progress: "학급운영/교육과정/진도표",
  curriculumUnits: "학급운영/교육과정/단원",
  curriculumLessons: "학급운영/교육과정/수업일지",
  events: "학급운영/교육과정/행사",
  standards: "학급운영/교육과정/성취기준",
  weeklyPlan: "학급운영/교육과정/주간학습안내",
  bases: "학급운영/교육과정/모아보기",
  backups: "학급운영/백업"
};

test("기본 폴더 밖 경로는 무시(null)한다", () => {
  assert.equal(classifyVaultPath("일기/2026-07-24.md", folders), null);
  assert.equal(classifyVaultPath("학급운영2/메모.md", folders), null);
});

test("폴더 규약대로 범주를 판정한다", () => {
  assert.equal(classifyVaultPath("학급운영/출결/2026-07-24 출결.md", folders), "attendance");
  assert.equal(classifyVaultPath("학급운영/학생 기록/1번 김하늘 칭찬.md", folders), "record");
  assert.equal(classifyVaultPath("학급운영/교육과정/진도표/2026 2학기 수학 진도표.md", folders), "progress");
  assert.equal(classifyVaultPath("학급운영/교육과정/학사일정/2026 학사일정.md", folders), "calendar-hours");
  assert.equal(classifyVaultPath("학급운영/교육과정/수업일지/차시.md", folders), "curriculum-lesson");
  assert.equal(classifyVaultPath("학급운영/백업/2026-07-24 120000/파일.md", folders), "backup");
});

test("학생 폴더와 학생 기록 폴더는 접두사가 겹쳐도 구분된다", () => {
  assert.equal(classifyVaultPath("학급운영/학생/1번 김하늘.md", folders), "student");
  assert.equal(classifyVaultPath("학급운영/학생 기록/메모.md", folders), "record");
});

test("기본 폴더 안 미등록 위치는 other — 광역 뷰만 갱신 대상", () => {
  assert.equal(classifyVaultPath("학급운영/학급 홈.md", folders), "other");
  assert.equal(classifyVaultPath("학급운영/교육과정/기타 메모.md", folders), "other");
});

test("색인 범주는 색인이 실제로 읽는 7종이다", () => {
  assert.deepEqual(
    [...ACTIVITY_INDEX_CATEGORIES].sort(),
    ["attendance", "assignment", "curriculum-lesson", "notice", "record", "routine", "task"].sort()
  );
});
