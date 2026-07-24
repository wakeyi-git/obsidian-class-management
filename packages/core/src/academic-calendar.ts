import type { TFile } from "obsidian";
import type {
  AcademicCalendar,
  ClosedDay,
  ClosedDayCategory,
  SchoolEvent,
  SchoolEventType,
  VacationRange } from "./types";
import { splitMarkdownTableRow, stringValue, unescapeTableCell, yamlString } from "./utils";

export const CLOSED_DAY_CATEGORIES: readonly ClosedDayCategory[] = ["공휴일", "재량휴업일", "기타"];
export const SCHOOL_EVENT_TYPES: readonly SchoolEventType[] = ["행사", "전일행사", "단축", "연장"];

export type DayKind = "class" | "weekend" | "closed" | "vacation" | "out-of-year";

export interface DayStatus {
  kind: DayKind;
  name: string;
}

const WEEKDAY_LABELS = ["월", "화", "수", "목", "금", "토", "일"] as const;

export function weekdayIndex(date: string): number {
  return (toDate(date).getDay() + 6) % 7;
}

export function weekdayLabel(date: string): string {
  return WEEKDAY_LABELS[weekdayIndex(date)] ?? "";
}

export function addDays(date: string, days: number): string {
  const value = toDate(date);
  value.setDate(value.getDate() + days);
  return formatDate(value);
}

export function mondayOf(date: string): string {
  return addDays(date, -weekdayIndex(date));
}

export function listDates(from: string, to: string): string[] {
  if (!from || !to || from > to) return [];
  const dates: string[] = [];
  for (let date = from; date <= to; date = addDays(date, 1)) dates.push(date);
  return dates;
}

export function dayStatus(calendar: AcademicCalendar, date: string): DayStatus {
  const weekday = weekdayIndex(date);
  if (weekday >= 5) return { kind: "weekend", name: "" };

  // 방학 구간이 등록돼 있으면 학기 범위 안이어도 비수업일이다(행정 학기 지원).
  const vacation = (calendar.vacations ?? []).find((range) => date >= range.from && date <= range.to);
  if (vacation) return { kind: "vacation", name: vacation.name };

  const closed = calendar.closedDays.find((day) => day.date === date);
  if (closed) return { kind: "closed", name: closed.name || closed.category };

  const inSemester1 = calendar.semester1Start && calendar.semester1End &&
    date >= calendar.semester1Start && date <= calendar.semester1End;
  const inSemester2 = calendar.semester2Start && calendar.semester2End &&
    date >= calendar.semester2Start && date <= calendar.semester2End;
  if (inSemester1 || inSemester2) return { kind: "class", name: "" };

  const betweenSemesters = calendar.semester1End && calendar.semester2Start &&
    date > calendar.semester1End && date < calendar.semester2Start;
  if (betweenSemesters) return { kind: "vacation", name: "여름방학" };
  const afterSemester2 = calendar.semester2End && date > calendar.semester2End;
  if (afterSemester2) return { kind: "vacation", name: "겨울방학·학년말" };

  return { kind: "out-of-year", name: "" };
}

export function eventsOn(calendar: AcademicCalendar, date: string): SchoolEvent[] {
  return calendar.events.filter((event) => event.date === date);
}

export function periodCountFor(calendar: AcademicCalendar, date: string): number {
  if (dayStatus(calendar, date).kind !== "class") return 0;
  const base = calendar.weekdayPeriods[weekdayIndex(date)] ?? 0;
  const adjustment = eventsOn(calendar, date).find(
    (event) => event.type === "단축" || event.type === "연장"
  );
  if (adjustment && adjustment.periods.length > 0) return adjustment.periods[0] ?? base;
  return base;
}

export function countClassDays(calendar: AcademicCalendar, from: string, to: string): number {
  return listDates(from, to).filter((date) => dayStatus(calendar, date).kind === "class").length;
}

export function availableHours(calendar: AcademicCalendar, from: string, to: string): number {
  return listDates(from, to).reduce((sum, date) => sum + periodCountFor(calendar, date), 0);
}

export function semesterRange(
  calendar: AcademicCalendar,
  semester: string
): { from: string; to: string } {
  return semester === "2학기"
    ? { from: calendar.semester2Start, to: calendar.semester2End }
    : { from: calendar.semester1Start, to: calendar.semester1End };
}

export function semesterForDate(calendar: AcademicCalendar, date: string): "1학기" | "2학기" | "" {
  if (
    calendar.semester1Start && calendar.semester1End &&
    date >= calendar.semester1Start && date <= calendar.semester1End
  ) {
    return "1학기";
  }
  if (
    calendar.semester2Start && calendar.semester2End &&
    date >= calendar.semester2Start && date <= calendar.semester2End
  ) {
    return "2학기";
  }
  return "";
}

export function parseAcademicCalendar(
  file: TFile,
  frontmatter: Record<string, unknown>,
  content: string
): AcademicCalendar {
  return {
    file,
    schoolYear: stringValue(frontmatter.schoolYear),
    semester1Start: stringValue(frontmatter.semester1Start),
    semester1End: stringValue(frontmatter.semester1End),
    semester2Start: stringValue(frontmatter.semester2Start),
    semester2End: stringValue(frontmatter.semester2End),
    weekdayPeriods: parseWeekdayPeriods(frontmatter.weekdayPeriods),
    closedDays: parseClosedDays(content),
    vacations: parseVacations(content),
    events: parseEvents(content)
  };
}

/** `## 방학` 표(시작|종료|이름) — 행정 학기(방학 포함)와 함께 쓰면 방학이 비수업일로 판정된다. */
function parseVacations(content: string): VacationRange[] {
  return sectionTableRows(content, "방학")
    .map((cells): VacationRange | null => {
      const from = normalizeDate(cells[0] ?? "");
      const to = normalizeDate(cells[1] ?? "");
      if (!from || !to) return null;
      return { from, to, name: (cells[2] ?? "").trim() || "방학" };
    })
    .filter((range): range is VacationRange => range !== null);
}

export function parseWeekdayPeriods(value: unknown): number[] {
  const raw = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [];
  const periods = raw.map((item) => {
    const parsed = Number(String(item).trim());
    return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 0;
  });
  while (periods.length < 5) periods.push(0);
  return periods.slice(0, 5);
}

function parseClosedDays(content: string): ClosedDay[] {
  return sectionTableRows(content, "휴업일")
    .map((cells): ClosedDay | null => {
      const date = normalizeDate(cells[0] ?? "");
      if (!date) return null;
      const category = (cells[1] ?? "").trim();
      return {
        date,
        category: CLOSED_DAY_CATEGORIES.some((item) => item === category)
          ? (category as ClosedDayCategory)
          : "기타",
        name: (cells[2] ?? "").trim()
      };
    })
    .filter((day): day is ClosedDay => day !== null);
}

function parseEvents(content: string): SchoolEvent[] {
  return sectionTableRows(content, "행사")
    .map((cells): SchoolEvent | null => {
      const date = normalizeDate(cells[0] ?? "");
      const type = (cells[1] ?? "").trim();
      if (!date || !SCHOOL_EVENT_TYPES.some((item) => item === type)) return null;
      return {
        date,
        type: type as SchoolEventType,
        name: (cells[2] ?? "").trim(),
        periods: parsePeriodsCell(cells[3] ?? ""),
        subject: (cells[4] ?? "").trim()
      };
    })
    .filter((event): event is SchoolEvent => event !== null);
}

export function parsePeriodsCell(value: string): number[] {
  const trimmed = unescapeTableCell(value).trim();
  if (!trimmed) return [];
  const periods = new Set<number>();
  for (const part of trimmed.split(",")) {
    const range = part.trim().match(/^(\d+)\s*[-~]\s*(\d+)$/);
    if (range) {
      const start = Number(range[1]);
      const end = Number(range[2]);
      for (let period = start; period <= end && period - start < 20; period += 1) periods.add(period);
      continue;
    }
    const single = Number(part.trim());
    if (Number.isFinite(single) && single > 0) periods.add(Math.floor(single));
  }
  return [...periods].sort((a, b) => a - b);
}

export function sectionTableRows(content: string, heading: string): string[][] {
  const lines = content.split(/\r?\n/);
  const headingPattern = new RegExp(`^#{2,3}\\s+${heading}`);
  const start = lines.findIndex((line) => headingPattern.test(line.trim()));
  if (start < 0) return [];

  const rows: string[][] = [];
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
    rows.push(cells.map((cell) => unescapeTableCell(cell)));
  }
  return rows;
}

function normalizeDate(value: string): string {
  const trimmed = unescapeTableCell(value).trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : "";
}

export function academicCalendarMarkdown(schoolYear: string, className: string): string {
  const year = Number(schoolYear) || new Date().getFullYear();
  const next = year + 1;
  return [
    "---",
    "class-management: academic-calendar",
    `class: ${yamlString(className)}`,
    `schoolYear: ${yamlString(String(year))}`,
    `semester1Start: ${yamlString(`${year}-03-02`)}`,
    `semester1End: ${yamlString(`${year}-07-17`)}`,
    `semester2Start: ${yamlString(`${year}-08-17`)}`,
    `semester2End: ${yamlString(`${next}-01-09`)}`,
    "weekdayPeriods: \"5, 6, 5, 6, 5\"",
    "tags:",
    "  - class-management/academic-calendar",
    "---",
    "",
    `# ${year} 학사일정`,
    "",
    "학기 시작·종료일과 요일별 기준 교시 수는 위 속성에서 수정합니다.",
    "",
    "## 방학",
    "",
    "행정 학기(방학 포함)로 학기 시작·종료를 적었다면 방학 구간을 여기에 등록하세요 — 시간표·시수·수업일수에서 제외됩니다.",
    "",
    "| 시작 | 종료 | 이름 |",
    "| --- | --- | --- |",
    "|  |  | 여름방학 |",
    "|  |  | 겨울방학 |",
    "",
    "## 휴업일",
    "",
    "음력 공휴일(설날·추석·석가탄신일)과 대체공휴일, 학교 재량휴업일은 직접 추가하세요.",
    "",
    "| 날짜 | 구분 | 명칭 |",
    "| --- | --- | --- |",
    `| ${year}-05-05 | 공휴일 | 어린이날 |`,
    `| ${year}-06-06 | 공휴일 | 현충일 |`,
    `| ${year}-10-03 | 공휴일 | 개천절 |`,
    `| ${year}-10-09 | 공휴일 | 한글날 |`,
    `| ${year}-12-25 | 공휴일 | 성탄절 |`,
    `| ${next}-01-01 | 공휴일 | 신정 |`,
    "",
    "## 행사",
    "",
    "유형: `행사`(지정 교시를 행사로 대체) · `전일행사`(하루 전체) · `단축`/`연장`(그날 교시 수 변경)",
    "교시: 행사는 `1-2` 또는 `1,3`, 단축·연장은 변경된 교시 수 하나를 적습니다.",
    "",
    "| 날짜 | 유형 | 명칭 | 교시 | 과목 | 비고 |",
    "| --- | --- | --- | --- | --- | --- |",
    `| ${year}-03-02 | 단축 | 입학식·개학일 | 3 |  |  |`,
    ""
  ].join("\n");
}


function toDate(date: string): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
