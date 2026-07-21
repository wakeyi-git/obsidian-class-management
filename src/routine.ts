import type {
  RoutineFrequency,
  RoutineInstanceItem,
  RoutineTemplate
} from "./types";

export function parseRoutineItems(content: string): string[] {
  return content
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*-\s+\[\s*\]\s+(.+)$/)?.[1]?.trim() ?? "")
    .filter(Boolean);
}

export function parseRoutineInstanceItems(content: string): RoutineInstanceItem[] {
  return content
    .split(/\r?\n/)
    .map((line, index): RoutineInstanceItem | null => {
      const match = line.match(/^\s*-\s+\[([ xX])\]\s+\[([^\]]+)\]\s+(.+)$/);
      if (!match?.[2] || !match[3]) return null;
      return {
        line: index,
        completed: match[1]?.toLocaleLowerCase() === "x",
        templateTitle: match[2].trim(),
        text: match[3].trim()
      };
    })
    .filter((item): item is RoutineInstanceItem => item !== null);
}

export function routineRunsOn(template: RoutineTemplate, date: Date): boolean {
  if (template.frequency === "daily") return true;
  if (template.frequency === "weekly") return template.weekday === date.getDay();
  return template.monthDay === date.getDate();
}

export function frequencyLabel(frequency: RoutineFrequency): string {
  return frequency === "daily" ? "매일" : frequency === "weekly" ? "매주" : "매월";
}
