import type { AssignmentMark, AssignmentStatus } from "./types";

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

function splitMarkdownTableRow(line: string): string[] {
  const trimmed = line.trim();
  if (!trimmed.startsWith("|") || !trimmed.endsWith("|")) return [];

  const body = trimmed.slice(1, -1);
  const cells: string[] = [];
  let current = "";

  for (let index = 0; index < body.length; index += 1) {
    const character = body[index];
    if (character === "|" && body[index - 1] !== "\\") {
      cells.push(current.trim());
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current.trim());
  return cells;
}

function studentNameFromCell(cell: string, studentNumber: string): string {
  const trimmed = cell.trim();
  let label = trimmed;

  if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
    const linkBody = trimmed.slice(2, -2);
    const aliasIndex = linkBody.indexOf("\\|");
    label = aliasIndex >= 0
      ? linkBody.slice(aliasIndex + 2)
      : (linkBody.split("/").pop() ?? "");
  }

  label = unescapeTableCell(label).trim();
  const expectedPrefix = `${studentNumber}번 `;
  if (label.startsWith(expectedPrefix)) return label.slice(expectedPrefix.length).trim();
  return label.replace(/^0*\d+\s+/, "").trim();
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

function unescapeTableCell(value: string): string {
  return value.replace(/\\\|/g, "|");
}
