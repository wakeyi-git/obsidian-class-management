import type { NoticeMark, NoticeStatus } from "./types";
import { escapeTableCell, splitMarkdownTableRow, studentNameFromCell, unescapeTableCell } from "./utils";

export const NOTICE_STATUSES: readonly NoticeStatus[] = [
  "미회신",
  "회신 완료",
  "확인 필요"
];

export function formatNoticeTableRow(mark: NoticeMark, studentPath?: string): string {
  const label = `${mark.studentNumber}번 ${mark.studentName}`;
  const studentCell = studentPath
    ? `[[${studentPath.replace(/\.md$/i, "")}\\|${escapeTableCell(label)}]]`
    : escapeTableCell(label);
  return `| ${escapeTableCell(mark.studentNumber)} | ${studentCell} | ${mark.status} | ${escapeTableCell(mark.responseDate ?? "")} | ${escapeTableCell(mark.note ?? "")} |`;
}

export function parseNoticeTable(content: string): NoticeMark[] {
  return content
    .split(/\r?\n/)
    .map(parseRow)
    .filter((mark): mark is NoticeMark => mark !== null);
}

function parseRow(line: string): NoticeMark | null {
  const cells = splitMarkdownTableRow(line);
  if (cells.length !== 5) return null;
  const studentNumber = unescapeTableCell(cells[0] ?? "").trim();
  const status = unescapeTableCell(cells[2] ?? "").trim();
  if (!studentNumber || !isNoticeStatus(status)) return null;
  const studentName = studentNameFromCell(cells[1] ?? "", studentNumber);
  if (!studentName) return null;
  const responseDate = unescapeTableCell(cells[3] ?? "").trim();
  const note = unescapeTableCell(cells[4] ?? "").trim();
  return {
    studentNumber,
    studentName,
    status,
    ...(responseDate ? { responseDate } : {}),
    ...(note ? { note } : {})
  };
}

function isNoticeStatus(value: string): value is NoticeStatus {
  return NOTICE_STATUSES.some((status) => status === value);
}
