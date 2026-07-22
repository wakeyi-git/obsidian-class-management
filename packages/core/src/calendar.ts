import type { ActivityEntry, ActivityKind } from "./types";

export interface CalendarEvent {
  id: string;
  date: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  file: ActivityEntry["file"];
  studentNumbers: string[];
}

export function buildCalendarEvents(activities: ActivityEntry[]): CalendarEvent[] {
  const grouped = new Map<string, ActivityEntry[]>();
  activities.forEach((activity) => {
    const key = activity.kind === "record"
      ? activity.id
      : `${activity.kind}:${activity.file.path}:${activity.date}`;
    const group = grouped.get(key) ?? [];
    group.push(activity);
    grouped.set(key, group);
  });

  return Array.from(grouped.entries())
    .map(([id, group]) => toCalendarEvent(id, group))
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title, "ko"));
}

export function calendarDays(anchor: Date, mode: "month" | "week"): Date[] {
  if (mode === "week") {
    const start = startOfWeek(anchor);
    return Array.from({ length: 7 }, (_, index) => addDays(start, index));
  }

  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const last = new Date(anchor.getFullYear(), anchor.getMonth() + 1, 0);
  const start = startOfWeek(first);
  const end = addDays(startOfWeek(last), 6);
  const length = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Array.from({ length }, (_, index) => addDays(start, index));
}

export function dateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function moveCalendarAnchor(
  anchor: Date,
  mode: "month" | "week",
  amount: number
): Date {
  return mode === "month"
    ? new Date(anchor.getFullYear(), anchor.getMonth() + amount, 1)
    : addDays(anchor, amount * 7);
}

function toCalendarEvent(id: string, group: ActivityEntry[]): CalendarEvent {
  const first = group[0];
  if (!first) throw new Error("빈 캘린더 이벤트 그룹입니다.");
  const studentNumbers = Array.from(new Set(group.map((item) => item.studentNumber)));

  if (first.kind === "record") {
    return {
      id,
      date: first.date,
      kind: first.kind,
      title: `${first.studentName} · ${first.title}`,
      detail: first.detail,
      file: first.file,
      studentNumbers
    };
  }

  if (first.kind === "task" || first.kind === "curriculum") {
    return {
      id,
      date: first.date,
      kind: first.kind,
      title: first.title,
      detail: [first.status, first.detail].filter(Boolean).join(" · "),
      file: first.file,
      studentNumbers
    };
  }

  const counts = countStatuses(group);
  const detail = Array.from(counts.entries())
    .map(([status, count]) => `${status} ${count}명`)
    .join(" · ");
  return {
    id,
    date: first.date,
    kind: first.kind,
    title: first.kind === "attendance"
      ? "출결"
      : first.kind === "routine"
        ? "루틴"
        : first.title,
    detail,
    file: first.file,
    studentNumbers
  };
}

function countStatuses(group: ActivityEntry[]): Map<string, number> {
  const counts = new Map<string, number>();
  group.forEach((item) => counts.set(item.status, (counts.get(item.status) ?? 0) + 1));
  return counts;
}

function startOfWeek(date: Date): Date {
  const day = date.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + mondayOffset);
}

function addDays(date: Date, amount: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount);
}
