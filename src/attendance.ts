import type { AttendanceMark, AttendanceStatus } from "./types";
import { escapeTableCell, splitMarkdownTableRow, studentNameFromCell, unescapeTableCell } from "./utils";

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

