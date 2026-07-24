import type { ResolvedDay, WeeklyPlanCell, WeeklyPlanDay, WeeklyPlanInput, ProgressRow } from "./types";
import { weekdayLabel } from "./academic-calendar";
import { escapeTableCell, localDate, yamlString } from "./utils";

export function buildWeeklyPlanDays(
  days: ResolvedDay[],
  contentFor: (date: string, period: number) => ProgressRow | undefined
): WeeklyPlanDay[] {
  return days.map((day) => ({
    date: day.date,
    weekday: day.weekday,
    isClassDay: day.isClassDay,
    reason: day.reason,
    cells: day.periods.map((period): WeeklyPlanCell => {
      const row = contentFor(day.date, period.period);
      return {
        period: period.period,
        subject: period.subject,
        unit: row?.unit ?? "",
        topic: row?.topic ?? "",
        materials: row?.materials ?? ""
      };
    })
  }));
}

export function buildWeeklyPlanMarkdown(input: WeeklyPlanInput): string {
  const maxPeriods = Math.max(
    1,
    ...input.days.flatMap((day) => day.cells.map((cell) => cell.period))
  );
  const headerCells = input.days.map(
    (day) => `${day.date.slice(5)} (${weekdayLabel(day.date)})`
  );

  const periodRows: string[] = [];
  for (let period = 1; period <= maxPeriods; period += 1) {
    const cells = input.days.map((day) => {
      if (!day.isClassDay) return period === 1 ? escapeTableCell(day.reason || "휴업") : "";
      const cell = day.cells.find((item) => item.period === period);
      if (!cell) return "";
      const parts = [cell.subject, cell.unit, cell.topic]
        .map((part) => part.trim())
        .filter(Boolean);
      return escapeTableCell(parts.join("<br>"));
    });
    periodRows.push(`| ${period} | ${cells.join(" | ")} |`);
  }

  const materialsRow = input.days.map((day) => {
    const materials = [...new Set(
      day.cells.map((cell) => cell.materials.trim()).filter(Boolean)
    )];
    return escapeTableCell(materials.join(", "));
  });

  const morningRow = input.days.map(() =>
    escapeTableCell(input.morningActivities.join(", "))
  );

  return [
    "---",
    "class-management: weekly-plan",
    `class: ${yamlString(input.className)}`,
    `schoolYear: ${yamlString(input.schoolYear)}`,
    `semester: ${yamlString(input.semester)}`,
    `weekStart: ${yamlString(input.weekStart)}`,
    `weekEnd: ${yamlString(input.weekEnd)}`,
    `created: ${localDate()}`,
    "cssclasses:",
    "  - class-management-print",
    "tags:",
    "  - class-management/weekly-plan",
    "---",
    "",
    `# 주간학습안내 (${input.weekStart} ~ ${input.weekEnd})`,
    "",
    `- 학급: ${input.className}`,
    `- 생성일: ${localDate()} · 학사일정·시간표·진도표에서 자동 생성되었습니다. 변경 사항이 있으면 다시 생성하세요.`,
    "",
    "## 주간 시간표",
    "",
    `| 교시 | ${headerCells.join(" | ")} |`,
    `| ---: | ${input.days.map(() => "---").join(" | ")} |`,
    ...(input.morningActivities.length
      ? [`| 아침 | ${morningRow.join(" | ")} |`]
      : []),
    ...periodRows,
    `| 준비물 | ${materialsRow.join(" | ")} |`,
    "",
    "## 알림 사항",
    "",
    ...(input.notices.length
      ? input.notices.map((notice) => `- ${notice}`)
      : ["- (알림 사항을 적으세요)"]),
    ""
  ].join("\n");
}
