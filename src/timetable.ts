import type { TFile } from "obsidian";
import type {
  AcademicCalendar,
  BaseTimetable,
  ResolvedDay,
  ResolvedPeriod,
  SubjectSlot,
  TimetableOverride
} from "./types";
import {
  dayStatus,
  eventsOn,
  listDates,
  periodCountFor,
  sectionTableRows,
  weekdayIndex
} from "./academic-calendar";
import { escapeTableCell, splitMarkdownTableRow, unescapeTableCell, yamlString } from "./utils";

const WEEKDAY_HEADERS = ["월", "화", "수", "목", "금"] as const;

// 시간표 변경 표의 과목 칸에 이 표식을 적으면 그날 해당 교시를 운영하지 않는다.
export const REMOVED_PERIOD_SUBJECT = "－";

export function isRemovedSubject(value: string): boolean {
  const trimmed = value.trim();
  return trimmed === "－" || trimmed === "-" || trimmed === "삭제";
}

export function parseBaseTimetable(
  file: TFile,
  frontmatter: Record<string, unknown>,
  content: string
): BaseTimetable {
  const grid = parseGrid(content);
  return {
    file,
    schoolYear: stringValue(frontmatter.schoolYear),
    semester: stringValue(frontmatter.semester),
    periods: grid.length,
    grid,
    overrides: parseOverrides(content)
  };
}

function parseGrid(content: string): string[][] {
  const lines = content.split(/\r?\n/);
  const headingPattern = /^#{2,3}\s+기초시간표/;
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start < 0) return [];

  const grid: string[][] = [];
  let headerSkipped = false;
  for (let index = start + 1; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (/^#{1,6}\s/.test(line)) break;
    const cells = splitMarkdownTableRow(line);
    if (cells.length === 0) continue;
    if (cells.every((cell) => /^:?-{2,}:?$/.test(cell))) continue;
    if (!headerSkipped) {
      headerSkipped = true;
      continue;
    }
    const period = Number(unescapeTableCell(cells[0] ?? "").replace(/교시$/, "").trim());
    if (!Number.isFinite(period) || period < 1) continue;
    const row = WEEKDAY_HEADERS.map((_, weekday) =>
      unescapeTableCell(cells[weekday + 1] ?? "").trim()
    );
    grid[period - 1] = row;
  }
  for (let index = 0; index < grid.length; index += 1) {
    if (!grid[index]) grid[index] = ["", "", "", "", ""];
  }
  return grid;
}

function parseOverrides(content: string): TimetableOverride[] {
  return sectionTableRows(content, "시간표 변경")
    .map((cells): TimetableOverride | null => {
      const date = (cells[0] ?? "").trim();
      const period = Number((cells[1] ?? "").replace(/교시$/, "").trim());
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(period) || period < 1) return null;
      return {
        date,
        period: Math.floor(period),
        subject: (cells[2] ?? "").trim(),
        reason: (cells[3] ?? "").trim()
      };
    })
    .filter((override): override is TimetableOverride => override !== null);
}

export function resolveDay(
  calendar: AcademicCalendar,
  timetable: BaseTimetable | null,
  date: string
): ResolvedDay {
  const status = dayStatus(calendar, date);
  const weekday = weekdayIndex(date);
  const events = eventsOn(calendar, date);
  const day: ResolvedDay = {
    date,
    weekday,
    isClassDay: status.kind === "class",
    reason: status.name,
    periods: [],
    events
  };
  if (!day.isClassDay) return day;

  const periodCount = periodCountFor(calendar, date);
  const allDayEvent = events.find((event) => event.type === "전일행사");
  const periodEvents = events.filter((event) => event.type === "행사");

  // 우선순위: 시간표 변경(오버라이드) > 행사 > 기초시간표.
  // 행사 날에도 교사가 특정 교시를 교과·창체로 배정할 수 있어야 한다.
  for (let period = 1; period <= periodCount; period += 1) {
    const override = timetable?.overrides.find(
      (item) => item.date === date && item.period === period
    );
    const periodEvent = periodEvents.find((event) => event.periods.includes(period));
    let resolved: ResolvedPeriod;
    if (override && isRemovedSubject(override.subject)) {
      continue;
    } else if (override) {
      resolved = { period, subject: override.subject, source: "override" };
    } else if (allDayEvent) {
      resolved = {
        period,
        subject: allDayEvent.subject || allDayEvent.name,
        source: "event"
      };
    } else if (periodEvent) {
      resolved = {
        period,
        subject: periodEvent.subject || periodEvent.name,
        source: "event"
      };
    } else {
      const base = timetable?.grid[period - 1]?.[weekday] ?? "";
      resolved = { period, subject: base, source: "base" };
    }
    day.periods.push(resolved);
  }

  // 기준 교시를 넘는 교시에 기록된 변경·행사는 그날의 교시를 확장한다
  // (예: 5교시 요일의 6교시 수업, 체험학습을 위한 7·8교시 운영).
  const extras = new Map<number, ResolvedPeriod>();
  if (!allDayEvent) {
    for (const event of periodEvents) {
      for (const period of event.periods) {
        if (period <= periodCount) continue;
        extras.set(period, {
          period,
          subject: event.subject || event.name,
          source: "event"
        });
      }
    }
  }
  for (const override of timetable?.overrides ?? []) {
    if (override.date !== date || override.period <= periodCount) continue;
    if (isRemovedSubject(override.subject)) {
      extras.delete(override.period);
      continue;
    }
    extras.set(override.period, {
      period: override.period,
      subject: override.subject,
      source: "override"
    });
  }
  for (const period of [...extras.keys()].sort((a, b) => a - b)) {
    const resolved = extras.get(period);
    if (resolved) day.periods.push(resolved);
  }
  return day;
}

export function resolveWeek(
  calendar: AcademicCalendar,
  timetable: BaseTimetable | null,
  monday: string
): ResolvedDay[] {
  return [0, 1, 2, 3, 4].map((offset) =>
    resolveDay(calendar, timetable, addDaysLocal(monday, offset))
  );
}

export function subjectSlots(
  calendar: AcademicCalendar,
  timetable: BaseTimetable,
  from: string,
  to: string,
  subject: string
): SubjectSlot[] {
  const slots: SubjectSlot[] = [];
  for (const date of listDates(from, to)) {
    const day = resolveDay(calendar, timetable, date);
    for (const period of day.periods) {
      if (period.subject === subject) slots.push({ date, period: period.period });
    }
  }
  return slots;
}

export function plannedHoursBySubject(
  calendar: AcademicCalendar,
  timetable: BaseTimetable,
  from: string,
  to: string
): Record<string, number> {
  const hours: Record<string, number> = {};
  for (const date of listDates(from, to)) {
    const day = resolveDay(calendar, timetable, date);
    for (const period of day.periods) {
      const subject = period.subject.trim();
      if (!subject) continue;
      hours[subject] = (hours[subject] ?? 0) + 1;
    }
  }
  return hours;
}

export function baseTimetableMarkdown(
  schoolYear: string,
  semester: string,
  className: string,
  weekdayPeriods: number[]
): string {
  const maxPeriods = Math.max(...weekdayPeriods, 1);
  const rows = [];
  for (let period = 1; period <= maxPeriods; period += 1) {
    const cells = WEEKDAY_HEADERS.map((_, weekday) =>
      period <= (weekdayPeriods[weekday] ?? 0) ? " " : "－"
    );
    rows.push(`| ${period} | ${cells.join(" | ")} |`);
  }
  return [
    "---",
    "class-management: timetable",
    `class: ${yamlString(className)}`,
    `schoolYear: ${yamlString(schoolYear)}`,
    `semester: ${yamlString(semester)}`,
    "tags:",
    "  - class-management/timetable",
    "---",
    "",
    `# ${schoolYear} ${semester} 기초시간표`,
    "",
    "빈 칸에 과목명(국어·수학·창체(자율) 등)을 적습니다. `－`는 기준 교시 밖 표시이며 지워도 됩니다.",
    "",
    "## 기초시간표",
    "",
    `| 교시 | ${WEEKDAY_HEADERS.join(" | ")} |`,
    `| ---: | ${WEEKDAY_HEADERS.map(() => "---").join(" | ")} |`,
    ...rows,
    "",
    "## 시간표 변경",
    "",
    "특정 날짜의 교시만 다른 과목으로 바꿀 때 사용합니다.",
    "",
    "| 날짜 | 교시 | 과목 | 사유 |",
    "| --- | ---: | --- | --- |",
    ""
  ].join("\n");
}

export function overrideTableRow(override: TimetableOverride): string {
  return `| ${override.date} | ${override.period} | ${escapeTableCell(override.subject)} | ${escapeTableCell(override.reason)} |`;
}

const OVERRIDE_TABLE_HEADER = "| 날짜 | 교시 | 과목 | 사유 |";
const OVERRIDE_TABLE_SEPARATOR = "| --- | ---: | --- | --- |";

export function upsertTimetableOverrideContent(
  content: string,
  override: TimetableOverride
): string {
  const overrides = parseOverrides(content).filter(
    (item) => !(item.date === override.date && item.period === override.period)
  );
  overrides.push(override);
  return writeOverrideSection(content, overrides);
}

export function removeTimetableOverrideContent(
  content: string,
  date: string,
  period: number
): string {
  const overrides = parseOverrides(content).filter(
    (item) => !(item.date === date && item.period === period)
  );
  return writeOverrideSection(content, overrides);
}

function writeOverrideSection(content: string, overrides: TimetableOverride[]): string {
  const sorted = overrides
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date) || a.period - b.period);
  const table = [
    OVERRIDE_TABLE_HEADER,
    OVERRIDE_TABLE_SEPARATOR,
    ...sorted.map((item) => overrideTableRow(item))
  ];

  const lines = content.split(/\r?\n/);
  const headingIndex = lines.findIndex((line) => /^#{2,3}\s+시간표 변경/.test(line.trim()));
  if (headingIndex < 0) {
    const trimmed = content.replace(/\n+$/, "");
    return [trimmed, "", "## 시간표 변경", "", ...table, ""].join("\n");
  }

  let sectionEnd = lines.length;
  for (let index = headingIndex + 1; index < lines.length; index += 1) {
    if (/^#{1,6}\s/.test((lines[index] ?? "").trim())) {
      sectionEnd = index;
      break;
    }
  }
  let tableStart = -1;
  let tableEnd = -1;
  for (let index = headingIndex + 1; index < sectionEnd; index += 1) {
    if ((lines[index] ?? "").trim().startsWith("|")) {
      if (tableStart < 0) tableStart = index;
      tableEnd = index;
    } else if (tableStart >= 0) {
      break;
    }
  }

  if (tableStart < 0) {
    const insertion = [...table, ""];
    return [...lines.slice(0, sectionEnd), ...insertion, ...lines.slice(sectionEnd)].join("\n");
  }
  return [...lines.slice(0, tableStart), ...table, ...lines.slice(tableEnd + 1)].join("\n");
}

function addDaysLocal(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12);
  value.setDate(value.getDate() + days);
  const resultYear = value.getFullYear();
  const resultMonth = String(value.getMonth() + 1).padStart(2, "0");
  const resultDay = String(value.getDate()).padStart(2, "0");
  return `${resultYear}-${resultMonth}-${resultDay}`;
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : value == null ? "" : String(value).trim();
}
