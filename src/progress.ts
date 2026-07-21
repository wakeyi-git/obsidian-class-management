import type { TFile } from "obsidian";
import type {
  AssignedProgressRow,
  ProgressAssignment,
  ProgressRow,
  ProgressTable,
  SubjectSlot
} from "./types";
import { sectionTableRows } from "./academic-calendar";
import { escapeTableCell, yamlString } from "./utils";

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
      const fixedDate = (cells[6] ?? "").trim();
      return {
        order: Number.isFinite(order) && order > 0 ? Math.floor(order) : index + 1,
        unit,
        topic,
        hours: Number.isFinite(hours) && hours > 0 ? Math.floor(hours) : 1,
        standard: (cells[4] ?? "").trim(),
        materials: (cells[5] ?? "").trim(),
        fixedDate: /^\d{4}-\d{2}-\d{2}$/.test(fixedDate) ? fixedDate : "",
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
    row.fixedDate,
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
    "고정 날짜를 지정한 차시는 항상 그 날짜의 수업 시간에 배정됩니다.",
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

  for (const entry of assigned) {
    if (!entry.row.fixedDate) continue;
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

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}
