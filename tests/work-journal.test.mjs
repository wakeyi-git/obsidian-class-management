import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { workJournalMarkdown } = await loadTypeScriptModule("../packages/core/src/work-journal.ts");

test("업무일지 스캐폴드는 판별자·날짜·기록 절을 갖는다", () => {
  const doc = workJournalMarkdown("2026-09-07", {
    className: "우리 반",
    schoolYear: "2026",
    semester: "2학기"
  });
  assert.match(doc, /class-management: work-journal/);
  assert.match(doc, /date: "2026-09-07"/);
  assert.match(doc, /# 2026-09-07 업무일지/);
  assert.match(doc, /## 기록/);
  assert.match(doc, /class-management\/work-journal/);
});
