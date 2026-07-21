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
import { escapeTableCell, yamlString } from "./utils";
import type { AcademicCalendar, BaseTimetable } from "./types";

export const PROGRESS_TABLE_HEADER =
  "| 순 | 단원·영역 | 학습 내용 | 시수 | 성취기준 | 준비물 | 고정 날짜 | 배정 | 비고 |";
export const PROGRESS_TABLE_SEPARATOR =
  "| ---: | --- | --- | ---: | --- | --- | --- | --- | --- |";

export function parseProgressTable(
  file: TFile,
  frontmatter: Record<string, unknown>,
  content: string
): ProgressTable {
  const rows = sectionTableRows(content, "진도표")
    .map((cells, index): ProgressRow | null => {
      const topic = (cells[2] ?? "").trim();
      const unit = (cells[1] ?? "").trim();
      if (!topic && !unit) return null;
      const order = Number((cells[0] ?? "").trim());
      const hours = Number((cells[3] ?? "").trim());
      const fixed = parseFixedCell((cells[6] ?? "").trim());
      return {
        order: Number.isFinite(order) && order > 0 ? Math.floor(order) : index + 1,
        unit,
        topic,
        hours: Number.isFinite(hours) && hours > 0 ? Math.floor(hours) : 1,
        standard: (cells[4] ?? "").trim(),
        materials: (cells[5] ?? "").trim(),
        fixedDate: fixed.date,
        fixedPeriod: fixed.period,
        assigned: (cells[7] ?? "").trim(),
        note: (cells[8] ?? "").trim()
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

/** `2026-10-15`, `2026-10-15(3)`, `2026-10-15 3교시` 표기를 해석한다. */
export function parseFixedCell(value: string): { date: string; period: number } {
  const match = value.match(/^(\d{4}-\d{2}-\d{2})(?:[\s(]+(\d{1,2})\s*\)?\s*교?시?)?\s*$/);
  if (!match) return { date: "", period: 0 };
  const period = Number(match[2] ?? "0");
  return {
    date: match[1] ?? "",
    period: Number.isFinite(period) && period > 0 ? Math.floor(period) : 0
  };
}

export function formatFixedCell(date: string, period: number): string {
  if (!date) return "";
  return period > 0 ? `${date}(${period})` : date;
}

export function progressRowLine(row: ProgressRow): string {
  return [
    "|",
    String(row.order),
    "|",
    escapeTableCell(row.unit),
    "|",
    escapeTableCell(row.topic),
    "|",
    String(row.hours),
    "|",
    escapeTableCell(row.standard),
    "|",
    escapeTableCell(row.materials),
    "|",
    formatFixedCell(row.fixedDate, row.fixedPeriod),
    "|",
    escapeTableCell(row.assigned),
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
    "고정 날짜에 `2026-10-15`(날짜 고정) 또는 `2026-10-15(3)`(3교시까지 고정)을 적으면 그 차시가 항상 그 자리에 배정됩니다.",
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

function splitDelimited(line: string): string[] {
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
  return slots
    .map((slot) => `${slot.date.slice(5)}(${slot.period})`)
    .join(", ");
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
