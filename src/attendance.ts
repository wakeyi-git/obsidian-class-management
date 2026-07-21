import type { AttendanceMark, AttendanceStatus } from "./types";

export const ATTENDANCE_STATUSES: readonly AttendanceStatus[] = [
  "출석",
  "지각",
  "결석",
  "조퇴",
  "결과"
];

export function parseAttendanceMetadata(content: string): AttendanceMark[] {
  const legacy = parseLegacyMetadata(content);
  if (legacy !== null) return legacy;

  return content
    .split(/\r?\n/)
    .map(parseAttendanceTableRow)
    .filter((mark): mark is AttendanceMark => mark !== null);
}

export function formatAttendanceTableRow(
  mark: AttendanceMark,
  studentPath?: string
): string {
  const studentLabel = `${mark.studentNumber}번 ${mark.studentName}`;
  const studentCell = studentPath
    ? `[[${studentPath.replace(/\.md$/i, "")}\\|${escapeTableCell(studentLabel)}]]`
    : escapeTableCell(studentLabel);

  return `| ${escapeTableCell(mark.studentNumber)} | ${studentCell} | ${mark.status} | ${escapeTableCell(mark.reason ?? "")} |`;
}

function parseLegacyMetadata(content: string): AttendanceMark[] | null {
  const match = content.match(/^%% class-management-attendance: (.+) %%$/m);
  if (!match?.[1]) return null;

  try {
    const parsed = JSON.parse(match[1]) as unknown;
    if (!Array.isArray(parsed)) return null;

    return parsed
      .map(normalizeAttendanceMark)
      .filter((mark): mark is AttendanceMark => mark !== null);
  } catch {
    return null;
  }
}

export function isAttendanceStatus(value: string): value is AttendanceStatus {
  return ATTENDANCE_STATUSES.some((status) => status === value);
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizeAttendanceMark(value: unknown): AttendanceMark | null {
  if (!isObject(value)) return null;
  const studentNumber = String(value.studentNumber ?? "");
  const studentName = String(value.studentName ?? "");
  const status = String(value.status ?? "");
  if (!studentNumber || !studentName || !isAttendanceStatus(status)) return null;
  const reason = String(value.reason ?? "").trim();
  return reason
    ? { studentNumber, studentName, status, reason }
    : { studentNumber, studentName, status };
}

function parseAttendanceTableRow(line: string): AttendanceMark | null {
  const cells = splitMarkdownTableRow(line);
  if (cells.length !== 3 && cells.length !== 4) return null;

  const studentNumber = unescapeTableCell(cells[0] ?? "").trim();
  const status = unescapeTableCell(cells[2] ?? "").trim();
  if (!studentNumber || !isAttendanceStatus(status)) return null;

  const studentName = studentNameFromCell(cells[1] ?? "", studentNumber);
  if (!studentName) return null;
  const reason = unescapeTableCell(cells[3] ?? "").trim();
  return reason
    ? { studentNumber, studentName, status, reason }
    : { studentNumber, studentName, status };
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

function unescapeTableCell(value: string): string {
  return value.replace(/\\\|/g, "|");
}

function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}
