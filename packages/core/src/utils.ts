export function joinVaultPath(...parts: string[]): string {
  const joined = parts
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/")
    .replace(/[\u00A0\u202F]/g, " ")
    .replace(/\\/g, "/")
    .replace(/\/{2,}/g, "/")
    .replace(/^\/+|\/+$/g, "");
  return joined || "/";
}

export function safeFileSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|#^[\]]/g, "-").replace(/\s+/g, " ").trim();
}

export function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localTimeForFile(date = new Date()): string {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${hour}${minute}${second}`;
}

export function compareStudentNumber(a: string, b: string): number {
  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return a.localeCompare(b, "ko", { numeric: true });
}

/** frontmatter 값을 문자열로 정규화한다 — 앞뒤 공백 제거, null·undefined는 fallback. */
export function stringValue(value: unknown, fallback = ""): string {
  return value === undefined || value === null ? fallback : String(value).trim();
}

export function booleanValue(value: unknown, fallback: boolean): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (value.toLowerCase() === "true") return true;
    if (value.toLowerCase() === "false") return false;
  }
  return fallback;
}

export function csvCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

export function splitMarkdownTableRow(line: string): string[] {
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

export function studentNameFromCell(cell: string, studentNumber: string): string {
  const trimmed = cell.trim();
  let label = trimmed;

  if (trimmed.startsWith("[[") && trimmed.endsWith("]]")) {
    const linkBody = trimmed.slice(2, -2);
    // 별칭 구분자는 첫 파이프 — 표 셀 규약 `\|`와 손편집 일반 `|` 모두 읽는다(노트가 진실).
    const pipe = linkBody.indexOf("|");
    label = pipe >= 0
      ? linkBody.slice(pipe + 1)
      : (linkBody.split("/").pop() ?? "");
  }

  label = unescapeTableCell(label).trim();
  const expectedPrefix = `${studentNumber}번 `;
  if (label.startsWith(expectedPrefix)) return label.slice(expectedPrefix.length).trim();

  return label.replace(/^0*\d+\s+/, "").trim();
}

export function escapeTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
}

export function unescapeTableCell(value: string): string {
  return value.replace(/\\\|/g, "|");
}
