import type { NoticeMark, NoticeStatus } from "./types";

export const NOTICE_STATUSES: readonly NoticeStatus[] = [
  "미회신",
  "회신 완료",
  "확인 필요"
];

export function formatNoticeTableRow(mark: NoticeMark, studentPath?: string): string {
  const label = `${mark.studentNumber}번 ${mark.studentName}`;
  const studentCell = studentPath
    ? `[[${studentPath.replace(/\.md$/i, "")}\\|${escapeCell(label)}]]`
    : escapeCell(label);
  return `| ${escapeCell(mark.studentNumber)} | ${studentCell} | ${mark.status} | ${escapeCell(mark.responseDate ?? "")} | ${escapeCell(mark.note ?? "")} |`;
}

export function parseNoticeTable(content: string): NoticeMark[] {
  return content
    .split(/\r?\n/)
    .map(parseRow)
    .filter((mark): mark is NoticeMark => mark !== null);
}

function parseRow(line: string): NoticeMark | null {
  const cells = splitRow(line);
  if (cells.length !== 5) return null;
  const studentNumber = unescapeCell(cells[0] ?? "").trim();
  const status = unescapeCell(cells[2] ?? "").trim();
  if (!studentNumber || !isNoticeStatus(status)) return null;
  const studentName = nameFromCell(cells[1] ?? "", studentNumber);
  if (!studentName) return null;
  const responseDate = unescapeCell(cells[3] ?? "").trim();
  const note = unescapeCell(cells[4] ?? "").trim();
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

function splitRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];
  const cells: string[] = [];
  let current = "";
  const body = trimmed.slice(1, -1);
  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "|" && body[index - 1] !== "\\") {
      cells.push(current.trim());
      current = "";
    } else current += character;
  }
  cells.push(current.trim());
  return cells;
}

function nameFromCell(cell: string, number: string): string {
  const trimmed = cell.trim();
  let label = trimmed;
  if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
    const body = trimmed.slice(2, -2);
    const alias = body.indexOf("\\|");
    label = alias >= 0 ? body.slice(alias + 2) : (body.split("/").pop() ?? "");
  }
  label = unescapeCell(label).trim();
  const prefix = `${number}번 `;
  return label.startsWith(prefix)
    ? label.slice(prefix.length).trim()
    : label.replace(/^0*\d+\s+/, "").trim();
}

function escapeCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function unescapeCell(value: string): string {
  return value.replace(/\\\|/g, "|");
}
