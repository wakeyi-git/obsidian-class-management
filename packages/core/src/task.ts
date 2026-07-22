import type { TaskEntry } from "./types";

export function nextRecurringDate(
  date: string,
  recurrence: Exclude<TaskEntry["recurrence"], "none">
): string {
  const value = new Date(`${date}T00:00:00`);
  if (recurrence === "daily") value.setDate(value.getDate() + 1);
  else if (recurrence === "weekly") value.setDate(value.getDate() + 7);
  else {
    const day = value.getDate();
    value.setDate(1);
    value.setMonth(value.getMonth() + 1);
    const lastDay = new Date(value.getFullYear(), value.getMonth() + 1, 0).getDate();
    value.setDate(Math.min(day, lastDay));
  }
  return formatDate(value);
}

export function taskRecurrenceLabel(
  recurrence: Exclude<TaskEntry["recurrence"], "none">
): string {
  return recurrence === "daily"
    ? "매일 반복"
    : recurrence === "weekly"
      ? "매주 반복"
      : "매월 반복";
}

function formatDate(value: Date): string {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, "0");
  const day = String(value.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
