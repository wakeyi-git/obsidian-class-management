import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { formatNoticeTableRow, parseNoticeTable } =
  await loadTypeScriptModule("../src/notice.ts");

test("회신 표를 만들고 되읽을 수 있다", () => {
  const noticeMarks = [
    { studentNumber: "1", studentName: "김하늘", status: "회신 완료", responseDate: "2026-07-21" },
    { studentNumber: "2", studentName: "이바다", status: "확인 필요", note: "서명 | 확인" }
  ];
  const noticeRows = noticeMarks.map((mark) =>
    formatNoticeTableRow(mark, `학급운영/학생/0${mark.studentNumber} ${mark.studentName}.md`)
  ).join("\n");
  assert.deepEqual(parseNoticeTable(noticeRows), noticeMarks);
});

test("알 수 없는 상태는 거른다", () => {
  assert.deepEqual(parseNoticeTable("| 3 | 박구름 | 알 수 없음 | | |"), []);
});
