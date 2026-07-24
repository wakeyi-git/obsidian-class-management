import type { AssignmentLevel, AssignmentMark, AssignmentStatus } from "./types";
import { escapeTableCell, splitMarkdownTableRow, studentNameFromCell, unescapeTableCell } from "./utils";

export const ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  "제출",
  "미제출",
  "보완"
];

/** 도달수준 선택지 — 학교 루브릭(◎○△)과 같은 기호를 쓴다. */
export const ASSIGNMENT_LEVELS: readonly AssignmentLevel[] = ["◎", "○", "△"];

export function formatAssignmentTableRow(
  mark: AssignmentMark,
  studentPath?: string,
  includeLevel = false
): string {
  const studentLabel = `${mark.studentNumber}번 ${mark.studentName}`;
  const studentCell = studentPath
    ? `[[${studentPath.replace(/\.md$/i, "")}\\|${escapeTableCell(studentLabel)}]]`
    : escapeTableCell(studentLabel);
  const levelCell = includeLevel ? ` ${mark.level ?? ""} |` : "";

  return `| ${escapeTableCell(mark.studentNumber)} | ${studentCell} | ${mark.status} |${levelCell} ${escapeTableCell(mark.note ?? "")} |`;
}

export function parseAssignmentTable(content: string): AssignmentMark[] {
  return content
    .split(/\r?\n/)
    .map(parseAssignmentTableRow)
    .filter((mark): mark is AssignmentMark => mark !== null);
}

/** 4열(구형)·5열(도달수준 포함) 확인표 행을 모두 읽는다 — 표는 손편집 가능해야 한다(§6 원칙 1). */
function parseAssignmentTableRow(line: string): AssignmentMark | null {
  const cells = splitMarkdownTableRow(line);
  if (cells.length !== 4 && cells.length !== 5) return null;
  const hasLevel = cells.length === 5;

  const studentNumber = unescapeTableCell(cells[0] ?? "").trim();
  const status = unescapeTableCell(cells[2] ?? "").trim();
  if (!studentNumber || !isAssignmentStatus(status)) return null;

  const studentName = studentNameFromCell(cells[1] ?? "", studentNumber);
  if (!studentName) return null;
  const level = hasLevel ? unescapeTableCell(cells[3] ?? "").trim() : "";
  const note = unescapeTableCell(cells[hasLevel ? 4 : 3] ?? "").trim();

  const mark: AssignmentMark = { studentNumber, studentName, status };
  if (isAssignmentLevel(level)) mark.level = level;
  if (note) mark.note = note;
  return mark;
}

function isAssignmentStatus(value: string): value is AssignmentStatus {
  return ASSIGNMENT_STATUSES.some((status) => status === value);
}

function isAssignmentLevel(value: string): value is AssignmentLevel {
  return ASSIGNMENT_LEVELS.some((level) => level === value);
}
