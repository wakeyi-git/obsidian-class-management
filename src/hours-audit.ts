import type { TFile } from "obsidian";
import type { CurriculumLesson, HoursAuditRow, HoursStandard, HoursStandardEntry } from "./types";
import { sectionTableRows } from "./academic-calendar";
import { yamlString } from "./utils";

export function parseHoursStandard(
  file: TFile,
  frontmatter: Record<string, unknown>,
  content: string
): HoursStandard {
  const tolerance = Number(frontmatter.tolerancePercent);
  const entries = sectionTableRows(content, "기준 시수")
    .map((cells): HoursStandardEntry | null => {
      const subject = (cells[0] ?? "").trim();
      const hours = Number((cells[1] ?? "").trim());
      if (!subject || !Number.isFinite(hours) || hours <= 0) return null;
      return { subject, hours: Math.floor(hours) };
    })
    .filter((entry): entry is HoursStandardEntry => entry !== null);

  return {
    file,
    schoolYear: typeof frontmatter.schoolYear === "string" ? frontmatter.schoolYear.trim() : "",
    tolerancePercent: Number.isFinite(tolerance) && tolerance >= 0 ? tolerance : 20,
    entries
  };
}

export function hoursStandardMarkdown(
  schoolYear: string,
  className: string,
  subjects: string[]
): string {
  const subjectRows = subjects.map((subject) => `| ${subject} |  |`);
  return [
    "---",
    "class-management: hours-standard",
    `class: ${yamlString(className)}`,
    `schoolYear: ${yamlString(schoolYear)}`,
    "tolerancePercent: 20",
    "tags:",
    "  - class-management/hours-standard",
    "---",
    "",
    `# ${schoolYear} 기준 시수`,
    "",
    "학교 교육과정에서 확정한 우리 학년의 연간 기준 시수를 적습니다.",
    "증감 허용 범위(%)는 위 `tolerancePercent` 속성에서 바꿉니다.",
    "",
    "참고(2022 개정 시간 배당 기준, 학년군 2년 합계): 1~2학년군 총 1,744 ·",
    "3~4학년군 총 1,972 · 5~6학년군 총 2,176. 연간 값은 학교 편성표를 따르세요.",
    "",
    "## 기준 시수",
    "",
    "| 교과·영역 | 연간 기준 시수 |",
    "| --- | ---: |",
    ...subjectRows,
    "| 창체(자율) |  |",
    "| 창체(동아리) |  |",
    "| 창체(봉사) |  |",
    "| 창체(진로) |  |",
    ""
  ].join("\n");
}

export function taughtHoursBySubject(lessons: CurriculumLesson[]): Record<string, number> {
  const hours: Record<string, number> = {};
  for (const lesson of lessons) {
    if (lesson.status !== "completed") continue;
    const subject = lesson.subject.trim();
    if (!subject) continue;
    hours[subject] = (hours[subject] ?? 0) + (Number.isFinite(lesson.hours) ? lesson.hours : 0);
  }
  return hours;
}

export function buildHoursAudit(
  standard: HoursStandard | null,
  planned: Record<string, number>,
  taught: Record<string, number>
): HoursAuditRow[] {
  const tolerance = standard?.tolerancePercent ?? 20;
  const subjects = new Set<string>();
  for (const entry of standard?.entries ?? []) subjects.add(entry.subject);
  for (const subject of Object.keys(planned)) subjects.add(subject);
  for (const subject of Object.keys(taught)) subjects.add(subject);

  const rows: HoursAuditRow[] = [];
  for (const subject of subjects) {
    const standardHours = standard?.entries.find((entry) => entry.subject === subject)?.hours ?? 0;
    const plannedHours = planned[subject] ?? 0;
    const taughtHours = taught[subject] ?? 0;
    let deltaPercent = 0;
    let status: HoursAuditRow["status"] = "missing";
    if (standardHours > 0) {
      deltaPercent = Math.round(((plannedHours - standardHours) / standardHours) * 1000) / 10;
      status = deltaPercent > tolerance ? "over" : deltaPercent < -tolerance ? "under" : "ok";
    }
    rows.push({ subject, standardHours, plannedHours, taughtHours, deltaPercent, status });
  }
  return rows.sort((a, b) => {
    if ((b.standardHours > 0 ? 1 : 0) !== (a.standardHours > 0 ? 1 : 0)) {
      return (b.standardHours > 0 ? 1 : 0) - (a.standardHours > 0 ? 1 : 0);
    }
    return b.standardHours - a.standardHours || a.subject.localeCompare(b.subject, "ko");
  });
}
