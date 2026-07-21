import type { AssignmentMark, AssignmentStatus } from "./types";
import { escapeTableCell, splitMarkdownTableRow, studentNameFromCell, unescapeTableCell } from "./utils";

export const ASSIGNMENT_STATUSES: readonly AssignmentStatus[] = [
  "제출",
  "미제출",
  "보완"
];

export function formatAssignmentTableRow(
  mark: AssignmentMark,
  studentPath?: string
): string {
  const studentLabel = `${mark.studentNumber}번 ${mark.studentName}`;
  const studentCell = studentPath
    ? `[[${studentPath.replace(/\.md$/i, "")}\\|${escapeTableCell(studentLabel)}]]`
    : escapeTableCell(studentLabel);

  return `| ${escapeTableCell(mark.studentNumber)} | ${studentCell} | ${mark.status} | ${escapeTableCell(mark.note ?? "")} |`;
}

export function parseAssignmentTable(content: string): AssignmentMark[] {
  return content
    .split(/\r?\n/)
    .map(parseAssignmentTableRow)
    .filter((mark): mark is AssignmentMark => mark !== null);
}

function parseAssignmentTableRow(line: string): AssignmentMark | null {
  const cells = splitMarkdownTableRow(line);
  if (cells.length !== 4) return null;

  const studentNumber = unescapeTableCell(cells[0] ?? "").trim();
  const status = unescapeTableCell(cells[2] ?? "").trim();
  if (!studentNumber || !isAssignmentStatus(status)) return null;

  const studentName = studentNameFromCell(cells[1] ?? "", studentNumber);
  if (!studentName) return null;
  const note = unescapeTableCell(cells[3] ?? "").trim();

  return note
    ? { studentNumber, studentName, status, note }
    : { studentNumber, studentName, status };
}

function isAssignmentStatus(value: string): value is AssignmentStatus {
  return ASSIGNMENT_STATUSES.some((status) => status === value);
}

