import type { TFile } from "obsidian";
import type {
  AssignedProgressRow,
  ProgressAssignment,
  ProgressRow,
  ProgressTable,
  SubjectSlot
} from "./types";
import { sectionTableRows, semesterRange } from "./academic-calendar";
import { subjectSlots } from "./timetable";
import { escapeTableCell, splitMarkdownTableRow, yamlString } from "./utils";
import type { AcademicCalendar, BaseTimetable } from "./types";

export const PROGRESS_TABLE_HEADER =
  "| 고정 | 순 | 배정 | 단원·영역 | 학습 내용 | 시수 | 성취기준 | 통합 단원 | 과제 | 준비물 | 비고 |";
export const PROGRESS_TABLE_SEPARATOR =
  "| --- | ---: | --- | --- | --- | ---: | --- | --- | --- | --- | --- |";

type ProgressColumnIndex = {
  fixed: number;
  order: number;
  assigned: number;
  unit: number;
  topic: number;
  hours: number;
  standard: number;
  unitLink: number;
  assignment: number;
  materials: number;
  note: number;
};

const CURRENT_COLUMN_INDEX: ProgressColumnIndex = {
  fixed: 0, order: 1, assigned: 2, unit: 3, topic: 4, hours: 5,
  standard: 6, unitLink: 7, assignment: 8, materials: 9, note: 10
};
const V1_17_COLUMN_INDEX: ProgressColumnIndex = {
  fixed: 0, order: 1, assigned: 2, unit: 3, topic: 4, hours: 5,
  standard: 6, unitLink: -1, assignment: -1, materials: 7, note: 8
};
const V1_10_COLUMN_INDEX: ProgressColumnIndex = {
  order: 0, fixed: 1, assigned: 2, unit: 3, topic: 4, hours: 5,
  standard: 6, unitLink: -1, assignment: -1, materials: 7, note: 8
};
const LEGACY_COLUMN_INDEX: ProgressColumnIndex = {
  order: 0, unit: 1, topic: 2, hours: 3, standard: 4, materials: 5,
  fixed: 6, assigned: 7, unitLink: -1, assignment: -1, note: 8
};

/** 헤더 이름으로 열 위치를 찾고, 이름 매칭이 안 되면 구버전 고정 배치로 되돌아간다. */
function progressColumnIndex(content: string): ProgressColumnIndex {
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^#{2,3}\s+진도표/.test(line.trim()));
  if (start < 0) return CURRENT_COLUMN_INDEX;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (/^#{1,6}\s/.test(line)) break;
    const cells = splitMarkdownTableRow(line);
    if (cells.length === 0) continue;
    const named = columnIndexFromHeader(cells);
    if (named) return named;
    if ((cells[0] ?? "").includes("고정")) return V1_17_COLUMN_INDEX;
    if ((cells[1] ?? "").includes("고정")) return V1_10_COLUMN_INDEX;
    return LEGACY_COLUMN_INDEX;
  }
  return CURRENT_COLUMN_INDEX;
}

function columnIndexFromHeader(cells: string[]): ProgressColumnIndex | null {
  const find = (matcher: (cell: string) => boolean): number =>
    cells.findIndex((cell) => matcher(cell.trim()));
  const index: ProgressColumnIndex = {
    fixed: find((cell) => cell.startsWith("고정")),
    order: find((cell) => cell === "순"),
    assigned: find((cell) => cell === "배정"),
    unit: find((cell) => cell.startsWith("단원")),
    topic: find((cell) => cell === "학습 내용" || cell === "학습내용"),
    hours: find((cell) => cell === "시수"),
    standard: find((cell) => cell === "성취기준"),
    unitLink: find((cell) => cell === "통합 단원"),
    assignment: find((cell) => cell.startsWith("과제")),
    materials: find((cell) => cell === "준비물"),
    note: find((cell) => cell === "비고")
  };
  const core = [index.order, index.unit, index.topic, index.hours];
  if (core.some((position) => position < 0)) return null;
  return index;
}

export function parseProgressTable(
  file: TFile,
  frontmatter: Record<string, unknown>,
  content: string
): ProgressTable {
  const columns = progressColumnIndex(content);
  const rows = sectionTableRows(content, "진도표")
    .map((cells, index): ProgressRow | null => {
      const topic = (cells[columns.topic] ?? "").trim();
      const unit = (cells[columns.unit] ?? "").trim();
      if (!topic && !unit) return null;
      const order = Number((cells[columns.order] ?? "").trim());
      const hours = Number((cells[columns.hours] ?? "").trim());
      const assigned = (cells[columns.assigned] ?? "").trim();
      const fixed = parseFixedCell((cells[columns.fixed] ?? "").trim(), assigned);
      return {
        order: Number.isFinite(order) && order > 0 ? Math.floor(order) : index + 1,
        unit,
        topic,
        hours: Number.isFinite(hours) && hours > 0 ? Math.floor(hours) : 1,
        standard: (cells[columns.standard] ?? "").trim(),
        unitLink: columns.unitLink >= 0 ? (cells[columns.unitLink] ?? "").trim() : "",
        assignmentLink: columns.assignment >= 0 ? (cells[columns.assignment] ?? "").trim() : "",
        materials: (cells[columns.materials] ?? "").trim(),
        fixedDate: fixed.date,
        fixedPeriod: fixed.period,
        assigned,
        note: (cells[columns.note] ?? "").trim()
      };
    })
    .filter((row): row is ProgressRow => row !== null)
    .sort((a, b) => a.order - b.order);

  return {
    file,
    schoolYear: stringValue(frontmatter.schoolYear),
    semester: stringValue(frontmatter.semester),
    subject: stringValue(frontmatter.subject),
    rows
  };
}

const FIXED_MARKER = "📌";

/**
 * 고정 칸을 해석한다. 허용 표기:
 * - `📌` (또는 `고정`) — 위치는 배정 칸의 첫 슬롯에서 가져온다
 * - `📌 2026-10-15(3)` — 명시 위치 (배정이 아직 비어 있을 때)
 * - `2026-10-15(3)`, `2026-10-15 3교시`, `2026-10-15` — 이전 버전 표기
 */
export function parseFixedCell(
  value: string,
  assigned: string
): { date: string; period: number } {
  const trimmed = value.trim();
  if (!trimmed) return { date: "", period: 0 };
  const withoutMarker = trimmed.replace(/^(?:📌|고정)\s*/u, "");
  const hadMarker = withoutMarker !== trimmed;

  const explicit = withoutMarker.match(
    /^(\d{4}-\d{2}-\d{2})(?:[\s(]+(\d{1,2})\s*\)?\s*교?시?)?\s*$/
  );
  if (explicit) {
    const period = Number(explicit[2] ?? "0");
    return {
      date: explicit[1] ?? "",
      period: Number.isFinite(period) && period > 0 ? Math.floor(period) : 0
    };
  }
  if (!hadMarker) return { date: "", period: 0 };

  const firstSlot = assigned.match(/(\d{4}-\d{2}-\d{2})\((\d{1,2})\)/);
  if (!firstSlot) return { date: "", period: 0 };
  return { date: firstSlot[1] ?? "", period: Number(firstSlot[2] ?? "0") || 0 };
}

export function formatFixedCell(date: string, period: number): string {
  if (!date) return "";
  return period > 0 ? `${date}(${period})` : date;
}

/** 배정 칸이 고정 위치를 이미 담고 있으면 `📌`만, 아니면 위치를 함께 적는다. */
export function serializeFixedCell(row: ProgressRow): string {
  if (!row.fixedDate) return "";
  const firstSlot = row.assigned.match(/(\d{4}-\d{2}-\d{2})\((\d{1,2})\)/);
  const matchesAssigned =
    firstSlot !== null &&
    firstSlot[1] === row.fixedDate &&
    (row.fixedPeriod === 0 || Number(firstSlot[2]) === row.fixedPeriod);
  if (matchesAssigned) return FIXED_MARKER;
  return `${FIXED_MARKER} ${formatFixedCell(row.fixedDate, row.fixedPeriod)}`;
}

export function progressRowLine(row: ProgressRow): string {
  return [
    "|",
    serializeFixedCell(row),
    "|",
    String(row.order),
    "|",
    escapeTableCell(row.assigned),
    "|",
    escapeTableCell(row.unit),
    "|",
    escapeTableCell(row.topic),
    "|",
    String(row.hours),
    "|",
    escapeTableCell(row.standard),
    "|",
    escapeTableCell(row.unitLink ?? ""),
    "|",
    escapeTableCell(row.assignmentLink ?? ""),
    "|",
    escapeTableCell(row.materials),
    "|",
    escapeTableCell(row.note),
    "|"
  ].join(" ");
}

export function progressTableMarkdown(
  schoolYear: string,
  semester: string,
  subject: string,
  className: string,
  rows: ProgressRow[]
): string {
  return [
    "---",
    "class-management: subject-progress",
    `class: ${yamlString(className)}`,
    `schoolYear: ${yamlString(schoolYear)}`,
    `semester: ${yamlString(semester)}`,
    `subject: ${yamlString(subject)}`,
    "tags:",
    "  - class-management/subject-progress",
    "---",
    "",
    `# ${schoolYear} ${semester} ${subject} 진도표`,
    "",
    "행을 직접 추가·수정하거나 `진도표 차시 가져오기` 명령으로 붙여넣을 수 있습니다.",
    "고정 칸의 `📌`는 그 차시가 배정 칸의 자리에 고정되어 있다는 뜻입니다. 주간 시간표의 칸 클릭 → '이 교시에 차시 고정'으로 관리하거나, 직접 `📌 2026-10-15(3)`처럼 적을 수도 있습니다.",
    "",
    "## 진도표",
    "",
    PROGRESS_TABLE_HEADER,
    PROGRESS_TABLE_SEPARATOR,
    ...rows.map((row) => progressRowLine(row)),
    ""
  ].join("\n");
}

export interface ProgressImportResult {
  rows: ProgressRow[];
  issues: string[];
}

export function parseProgressImport(text: string, startOrder: number): ProgressImportResult {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/^﻿/, ""));
  const rows: ProgressRow[] = [];
  const issues: string[] = [];
  let order = startOrder;

  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (!line) continue;
    const cells = splitDelimited(line);
    if (cells.length < 2) {
      issues.push(`${index + 1}행: 열이 2개 미만이라 건너뜁니다.`);
      continue;
    }
    if (index === 0 && isHeaderRow(cells)) continue;
    const unit = (cells[0] ?? "").trim();
    const topic = (cells[1] ?? "").trim();
    if (!topic) {
      issues.push(`${index + 1}행: 학습 내용이 비어 있어 건너뜁니다.`);
      continue;
    }
    const hours = Number((cells[2] ?? "1").trim() || "1");
    rows.push({
      order,
      unit,
      topic,
      hours: Number.isFinite(hours) && hours > 0 ? Math.floor(hours) : 1,
      standard: (cells[3] ?? "").trim(),
      unitLink: "",
      assignmentLink: "",
      materials: (cells[4] ?? "").trim(),
      fixedDate: "",
      fixedPeriod: 0,
      assigned: "",
      note: (cells[5] ?? "").trim()
    });
    order += 1;
  }
  return { rows, issues };
}

function isHeaderRow(cells: string[]): boolean {
  const joined = cells.join(" ");
  return /단원|학습\s*내용|차시|시수|영역/.test(joined) && !/\d{4}-\d{2}-\d{2}/.test(joined);
}

export function splitDelimited(line: string): string[] {
  if (line.includes("\t")) return line.split("\t");
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quoted) {
      if (character === '"' && line[index + 1] === '"') {
        current += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        current += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      cells.push(current);
      current = "";
    } else {
      current += character;
    }
  }
  cells.push(current);
  return cells;
}

export function assignProgress(rows: ProgressRow[], slots: SubjectSlot[]): ProgressAssignment {
  const issues: string[] = [];
  const slotPool = slots
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period)
    .map((slot) => ({ slot, taken: false }));

  const assigned: AssignedProgressRow[] = rows.map((row) => ({ row, slots: [], shortage: 0 }));

  // 1순위: 날짜+교시 고정 차시가 정확한 자리를 먼저 확보한다.
  for (const entry of assigned) {
    if (!entry.row.fixedDate || entry.row.fixedPeriod <= 0) continue;
    const daySlots = slotPool
      .filter(
        (item) =>
          !item.taken &&
          item.slot.date === entry.row.fixedDate &&
          item.slot.period >= entry.row.fixedPeriod
      )
      .sort((a, b) => a.slot.period - b.slot.period);
    const exact = daySlots[0];
    if (!exact || exact.slot.period !== entry.row.fixedPeriod) {
      issues.push(
        `${entry.row.order}. ${entry.row.topic}: 고정한 ${entry.row.fixedDate} ${entry.row.fixedPeriod}교시에 해당 과목 수업이 없습니다. 주간 시간표에서 그 교시에 과목을 먼저 배치하세요.`
      );
      entry.shortage = entry.row.hours;
      continue;
    }
    for (const item of daySlots.slice(0, entry.row.hours)) {
      item.taken = true;
      entry.slots.push(item.slot);
    }
    entry.shortage = Math.max(0, entry.row.hours - entry.slots.length);
    if (entry.shortage > 0) {
      issues.push(
        `${entry.row.order}. ${entry.row.topic}: 고정 교시부터 배정할 수업 시간이 ${entry.shortage}차시 부족합니다.`
      );
    }
  }

  // 2순위: 날짜만 고정한 차시.
  for (const entry of assigned) {
    if (!entry.row.fixedDate || entry.row.fixedPeriod > 0) continue;
    const daySlots = slotPool.filter(
      (item) => !item.taken && item.slot.date === entry.row.fixedDate
    );
    if (daySlots.length === 0) {
      issues.push(
        `${entry.row.order}. ${entry.row.topic}: 고정 날짜 ${entry.row.fixedDate}에 해당 과목 수업이 없습니다.`
      );
    }
    for (const item of daySlots.slice(0, entry.row.hours)) {
      item.taken = true;
      entry.slots.push(item.slot);
    }
    entry.shortage = Math.max(0, entry.row.hours - entry.slots.length);
    if (entry.slots.length > 0 && entry.shortage > 0) {
      issues.push(
        `${entry.row.order}. ${entry.row.topic}: 고정 날짜의 수업 시간이 ${entry.shortage}차시 부족합니다.`
      );
    }
  }

  for (const entry of assigned) {
    if (entry.row.fixedDate) continue;
    let needed = entry.row.hours;
    for (const item of slotPool) {
      if (needed <= 0) break;
      if (item.taken) continue;
      item.taken = true;
      entry.slots.push(item.slot);
      needed -= 1;
    }
    entry.shortage = needed;
    if (needed > 0) {
      issues.push(`${entry.row.order}. ${entry.row.topic}: 배정할 수업 시간이 ${needed}차시 부족합니다.`);
    }
  }

  const unassignedSlots = slotPool.filter((item) => !item.taken).map((item) => item.slot);
  if (unassignedSlots.length > 0) {
    issues.push(`진도 없이 남는 수업 시간이 ${unassignedSlots.length}차시 있습니다.`);
  }
  return { rows: assigned, unassignedSlots, issues };
}

export function formatAssignedSlots(slots: SubjectSlot[]): string {
  return slots.map((slot) => `${slot.date}(${slot.period})`).join(", ");
}

export function slotContentMap(
  assignment: ProgressAssignment
): Map<string, ProgressRow> {
  const map = new Map<string, ProgressRow>();
  for (const entry of assignment.rows) {
    for (const slot of entry.slots) {
      map.set(`${slot.date}|${slot.period}`, entry.row);
    }
  }
  return map;
}

/** 두 학기의 진도표를 각 학기 시간표·기간에 배정해 날짜|교시 → 차시 맵으로 합친다. */
export function buildAssignedSlotContents(
  calendar: AcademicCalendar,
  timetables: Record<string, BaseTimetable | null>,
  tablesBySemester: Record<string, ProgressTable[]>
): Map<string, ProgressRow> {
  const contents = new Map<string, ProgressRow>();
  for (const semester of Object.keys(timetables)) {
    const timetable = timetables[semester];
    if (!timetable) continue;
    const range = semesterRange(calendar, semester);
    if (!range.from || !range.to) continue;
    for (const table of tablesBySemester[semester] ?? []) {
      const slots = subjectSlots(calendar, timetable, range.from, range.to, table.subject);
      const assignment = assignProgress(table.rows, slots);
      for (const [key, row] of slotContentMap(assignment)) contents.set(key, row);
    }
  }
  return contents;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}
