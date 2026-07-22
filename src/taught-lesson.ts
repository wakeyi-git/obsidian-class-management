import { addDays, listDates, semesterRange } from "./academic-calendar";
import { resolveDay } from "./timetable";
import type {
  AcademicCalendar,
  BaseTimetable,
  ProgressRow,
  TaughtLessonEntry
} from "./types";

/**
 * 학기 시작~기준일(포함)의 실시 차시를 수집한다.
 * 과거는 재배정되지 않으므로 이 목록은 불변 기록의 원천이다.
 * 과목 없는 행사 교시(unmapped)와 삭제된 교시는 수업이 아니므로 제외한다.
 */
export function collectTaughtSlots(
  calendar: AcademicCalendar,
  timetable: BaseTimetable,
  semester: string,
  contents: Map<string, ProgressRow>,
  through: string,
  lessonLogs: Map<string, string> = new Map()
): TaughtLessonEntry[] {
  const range = semesterRange(calendar, semester);
  if (!range.from || !range.to || range.from > through) return [];
  const end = range.to < through ? range.to : through;
  const entries: TaughtLessonEntry[] = [];
  for (const date of listDates(range.from, end)) {
    const day = resolveDay(calendar, timetable, date);
    if (!day.isClassDay) continue;
    for (const period of day.periods) {
      const subject = period.subject.trim();
      if (!subject || period.unmapped) continue;
      const row = contents.get(`${date}|${period.period}`);
      entries.push({
        date,
        period: period.period,
        subject,
        semester,
        source: period.source,
        unit: row?.unit ?? "",
        topic: row?.topic ?? "",
        hours: row?.hours ?? 1,
        standard: row?.standard ?? "",
        order: row?.order ?? 0,
        lessonLog: lessonLogs.get(`${date}|${period.period}`) ?? ""
      });
    }
  }
  return entries;
}

/** 어제 날짜 — 실시 차시 확정 기준일. */
export function taughtThroughDate(today: string): string {
  return addDays(today, -1);
}

export function distinctDates(entries: TaughtLessonEntry[]): number {
  return new Set(entries.map((entry) => entry.date)).size;
}
