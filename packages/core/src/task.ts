import { yamlString } from "./utils";
import type { TaskEntry, NewTask } from "./types";

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

/** 할 일 노트 본문 — 플러그인과 예약 수집 스킬이 같은 형식을 쓴다. extra는 sourceKey 같은 추가 프론트매터. */
export function taskMarkdown(
  task: NewTask,
  settings: { className: string; schoolYear: string; semester: string },
  createdDate: string,
  extra: Record<string, string> = {}
): string {
  const title = task.title.trim();
  return [
    "---",
    "class-management: task",
    `class: ${yamlString(settings.className)}`,
    `schoolYear: ${yamlString(settings.schoolYear)}`,
    `semester: ${yamlString(settings.semester)}`,
    `taskTitle: ${yamlString(title)}`,
    `taskStatus: ${yamlString(task.status)}`,
    `project: ${yamlString(task.project)}`,
    `context: ${yamlString(task.context)}`,
    `startDate: ${yamlString(task.startDate)}`,
    `dueDate: ${yamlString(task.dueDate)}`,
    `priority: ${yamlString(task.priority)}`,
    `recurrence: ${yamlString(task.recurrence)}`,
    `studentNumber: ${yamlString(task.studentNumber)}`,
    `studentName: ${yamlString(task.studentName)}`,
    ...Object.entries(extra).map(([key, value]) => `${key}: ${yamlString(value)}`),
    `created: ${createdDate}`,
    "tags:",
    "  - class-management/task",
    "---",
    "",
    `# ${title}`,
    "",
    task.detail.trim(),
    ""
  ].join("\n");
}
