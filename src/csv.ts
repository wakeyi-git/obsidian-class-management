import type { NewStudent } from "./types";

export interface CsvIssue {
  row: number;
  message: string;
}

export interface RosterCsvResult {
  students: NewStudent[];
  issues: CsvIssue[];
  hasHeader: boolean;
}

interface CsvRow {
  cells: string[];
  rowNumber: number;
}

const NUMBER_HEADERS = new Set([
  "번호",
  "학생번호",
  "출석번호",
  "number",
  "no",
  "studentnumber"
]);

const NAME_HEADERS = new Set([
  "이름",
  "성명",
  "학생명",
  "name",
  "studentname"
]);

export function parseRosterCsv(text: string): RosterCsvResult {
  const normalizedText = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(normalizedText);
  const rows = parseCsvRows(normalizedText, delimiter).filter((row) =>
    row.cells.some((cell) => cleanCell(cell).length > 0)
  );

  if (rows.length === 0) {
    throw new Error("CSV 파일에 학생 정보가 없습니다.");
  }

  const firstCells = rows[0]?.cells ?? [];
  const normalizedHeaders = firstCells.map(normalizeHeader);
  const numberHeaderIndex = normalizedHeaders.findIndex((header) =>
    NUMBER_HEADERS.has(header)
  );
  const nameHeaderIndex = normalizedHeaders.findIndex((header) => NAME_HEADERS.has(header));
  const hasAnyKnownHeader = numberHeaderIndex >= 0 || nameHeaderIndex >= 0;

  if (hasAnyKnownHeader && (numberHeaderIndex < 0 || nameHeaderIndex < 0)) {
    throw new Error("CSV 첫 줄에서 번호와 이름 열을 모두 찾을 수 없습니다.");
  }

  const hasHeader = numberHeaderIndex >= 0 && nameHeaderIndex >= 0;
  const numberIndex = hasHeader ? numberHeaderIndex : 0;
  const nameIndex = hasHeader ? nameHeaderIndex : 1;
  const dataRows = hasHeader ? rows.slice(1) : rows;
  const students: NewStudent[] = [];
  const issues: CsvIssue[] = [];
  const seenNumbers = new Set<string>();

  for (const row of dataRows) {
    const number = normalizeStudentNumber(row.cells[numberIndex] ?? "");
    const name = cleanCell(row.cells[nameIndex] ?? "");

    if (!number && !name) continue;
    if (!number) {
      issues.push({ row: row.rowNumber, message: "번호가 없어 건너뛰었습니다." });
      continue;
    }
    if (!name) {
      issues.push({ row: row.rowNumber, message: "이름이 없어 건너뛰었습니다." });
      continue;
    }

    const duplicateKey = number.toLocaleLowerCase("ko");
    if (seenNumbers.has(duplicateKey)) {
      issues.push({
        row: row.rowNumber,
        message: `${number}번이 CSV 안에서 중복되어 건너뛰었습니다.`
      });
      continue;
    }

    seenNumbers.add(duplicateKey);
    students.push({ number, name });
  }

  if (students.length === 0) {
    throw new Error("가져올 수 있는 학생 정보가 없습니다.");
  }

  return { students, issues, hasHeader };
}

export function decodeCsv(buffer: ArrayBuffer): string {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr").decode(buffer);
  }
}

function parseCsvRows(text: string, delimiter: "," | "\t"): CsvRow[] {
  const rows: CsvRow[] = [];
  let cells: string[] = [];
  let field = "";
  let inQuotes = false;
  let rowNumber = 1;
  let currentRowNumber = 1;

  const finishRow = (): void => {
    cells.push(field);
    rows.push({ cells, rowNumber: currentRowNumber });
    cells = [];
    field = "";
    currentRowNumber = rowNumber + 1;
  };

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];

    if (inQuotes) {
      if (character === '"') {
        if (text[index + 1] === '"') {
          field += '"';
          index += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += character;
        if (character === "\n") rowNumber += 1;
      }
      continue;
    }

    if (character === '"' && field.length === 0) {
      inQuotes = true;
    } else if (character === delimiter) {
      cells.push(field);
      field = "";
    } else if (character === "\n" || character === "\r") {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      finishRow();
      rowNumber += 1;
    } else {
      field += character;
    }
  }

  if (inQuotes) {
    throw new Error("CSV의 따옴표가 닫히지 않았습니다.");
  }

  if (field.length > 0 || cells.length > 0) {
    cells.push(field);
    rows.push({ cells, rowNumber: currentRowNumber });
  }

  return rows;
}

function detectDelimiter(text: string): "," | "\t" {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  return firstLine.includes("\t") && !firstLine.includes(",") ? "\t" : ",";
}

function cleanCell(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeHeader(value: string): string {
  return cleanCell(value).toLocaleLowerCase("ko").replace(/[\s_.-]/g, "");
}

function normalizeStudentNumber(value: string): string {
  const cleaned = cleanCell(value);
  const excelInteger = cleaned.match(/^(\d+)\.0+$/);
  return excelInteger?.[1] ?? cleaned;
}
