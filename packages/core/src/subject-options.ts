import { isRemovedSubject } from "./timetable";
import type { BaseTimetable, HoursStandard, ProgressTable } from "./types";

/** 과목 선택지 목록 — 기준 시수 노트가 있으면 그것이 학급의 교과 목록이다. */
export function collectSubjectOptions(
  schoolSubjects: string[],
  tables: ProgressTable[],
  standard: HoursStandard | null,
  timetable: BaseTimetable | null
): string[] {
  const subjects: string[] = [];
  const push = (subject: string): void => {
    const trimmed = subject.trim();
    if (!trimmed || isRemovedSubject(trimmed)) return;
    if (!subjects.includes(trimmed)) subjects.push(trimmed);
  };
  for (const entry of standard?.entries ?? []) push(entry.subject);
  for (const row of timetable?.grid ?? []) for (const cell of row) push(cell);
  for (const table of tables) push(table.subject);
  for (const area of ["창체(자율)", "창체(동아리)", "창체(진로)"]) push(area);
  if (subjects.length === 0) {
    for (const subject of schoolSubjects) push(subject);
  }
  return subjects;
}
