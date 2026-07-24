import type { TFile } from "obsidian";
import type { HoursAuditRow, HoursStandard, HoursStandardEntry, SemesterHours } from "./types";
import { sectionTableRows } from "./academic-calendar";
import { yamlString } from "./utils";

/** 구형 2열 표에서 구분을 이름으로 추정한다. */
function inferCategory(subject: string): string {
  return subject.startsWith("창체") ? "창체" : "교과";
}

export function parseHoursStandard(
  file: TFile,
  frontmatter: Record<string, unknown>,
  content: string
): HoursStandard | null {
  if (frontmatter["class-management"] !== "hours-standard") return null;
  const tolerance = Number(frontmatter.tolerancePercent);
  const rows = sectionTableRows(content, "기준 시수");
  // 열 배치는 행 모양으로 해석한다(헤더는 sectionTableRows가 이미 건너뜀):
  // 넷째 칸에 숫자가 있으면 학기형(구분|교과·영역|1학기|2학기|학년), 셋째 칸이면 구형 3열(연간), 아니면 구형 2열.
  const numericAt = (cells: string[], index: number): boolean => {
    const value = (cells[index] ?? "").trim();
    return value !== "" && Number.isFinite(Number(value));
  };
  const layout = rows.some((cells) => numericAt(cells, 3))
    ? "semester"
    : rows.some((cells) => numericAt(cells, 2))
      ? "category-year"
      : "plain-year";
  const toHours = (value: string | undefined): number => {
    const parsed = Number((value ?? "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
  };
  let lastCategory = "";
  const entries = rows
    .map((cells): HoursStandardEntry | null => {
      const rawCategory = layout === "plain-year" ? "" : (cells[0] ?? "").trim();
      const subject = (cells[layout === "plain-year" ? 0 : 1] ?? "").trim();
      if (rawCategory) lastCategory = rawCategory;
      if (!subject) return null;
      let hours1 = 0;
      let hours2 = 0;
      let year = 0;
      if (layout === "semester") {
        hours1 = toHours(cells[2]);
        hours2 = toHours(cells[3]);
        year = toHours(cells[4]) || hours1 + hours2;
      } else {
        year = toHours(cells[layout === "category-year" ? 2 : 1]);
      }
      if (year <= 0) return null;
      // 구분 칸을 비우면 위 행의 구분을 승계한다(병합 셀처럼 쓰는 손 편집 배려).
      const category = layout === "plain-year"
        ? inferCategory(subject)
        : lastCategory || inferCategory(subject);
      return { subject, hours1, hours2, hours: year, category };
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
  const subjectRows = subjects.map((subject) => `| 교과 | ${subject} |  |  |  |`);
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
    "- **행 순서가 시수 점검의 표시 순서**가 됩니다 (학교 편성표 순서대로).",
    "- **학교자율시간 과목·활동**(예: 디지털 놀이터)은 여기에 행을 추가해 등록하세요 — 구분은 학교 편성표에 따라 `교과` 또는 별도 이름.",
    "- 시수 점검은 같은 구분끼리 소계를 냅니다. 학년 칸을 비우면 1·2학기 합으로 계산합니다.",
    "",
    "참고(2022 개정 시간 배당 기준, 학년군 2년 합계): 1~2학년군 총 1,744 ·",
    "3~4학년군 총 1,972 · 5~6학년군 총 2,176. 연간 값은 학교 편성표를 따르세요.",
    "",
    "## 기준 시수",
    "",
    "| 구분 | 교과·영역 | 1학기 | 2학기 | 학년 |",
    "| --- | --- | ---: | ---: | ---: |",
    ...subjectRows,
    "| 창체 | 창체(자율) |  |  |  |",
    "| 창체 | 창체(동아리) |  |  |  |",
    "| 창체 | 창체(봉사) |  |  |  |",
    "| 창체 | 창체(진로) |  |  |  |",
    ""
  ].join("\n");
}

const EMPTY_SEMESTER: SemesterHours = { planned: {}, taught: {} };

/**
 * 기준·편성·실행 대조표를 만든다.
 * 행 순서는 기준 시수 노트의 행 순서 그대로이며(노트에 없는 과목은 해당 구분 끝에 추가),
 * 구분별 소계(항목 2개 이상일 때)와 총계 행이 뒤따른다. 편성·실행은 학기별로 나뉜다.
 */
export function buildHoursAudit(
  standard: HoursStandard | null,
  first: SemesterHours = EMPTY_SEMESTER,
  second: SemesterHours = EMPTY_SEMESTER
): HoursAuditRow[] {
  const tolerance = standard?.tolerancePercent ?? 20;

  // 구분 순서·구분별 과목 순서는 노트 순서를 따른다.
  const categoryOrder: string[] = [];
  const subjectsByCategory = new Map<string, string[]>();
  const standardBySubject = new Map<string, HoursStandardEntry>();
  const push = (category: string, subject: string): void => {
    if (!categoryOrder.includes(category)) categoryOrder.push(category);
    const list = subjectsByCategory.get(category) ?? [];
    if (!list.includes(subject)) list.push(subject);
    subjectsByCategory.set(category, list);
  };
  for (const entry of standard?.entries ?? []) {
    standardBySubject.set(entry.subject, entry);
    push(entry.category, entry.subject);
  }
  for (const maps of [first.planned, first.taught, second.planned, second.taught]) {
    for (const subject of Object.keys(maps)) {
      if (!standardBySubject.has(subject)) push(inferCategory(subject), subject);
    }
  }

  const makeRow = (
    kind: HoursAuditRow["kind"],
    label: string,
    category: string,
    standard1: number,
    standard2: number,
    standardHours: number,
    planned1: number,
    taught1: number,
    planned2: number,
    taught2: number
  ): HoursAuditRow => {
    const plannedHours = planned1 + planned2;
    const taughtHours = taught1 + taught2;
    let deltaPercent = 0;
    let status: HoursAuditRow["status"] = "missing";
    if (standardHours > 0) {
      deltaPercent = Math.round(((plannedHours - standardHours) / standardHours) * 1000) / 10;
      status = deltaPercent > tolerance ? "over" : deltaPercent < -tolerance ? "under" : "ok";
    }
    return {
      kind,
      subject: label,
      category,
      standardHours,
      standard1,
      standard2,
      planned1,
      taught1,
      planned2,
      taught2,
      plannedHours,
      taughtHours,
      deltaPercent,
      status
    };
  };

  const rows: HoursAuditRow[] = [];
  const totals = { s1: 0, s2: 0, standard: 0, p1: 0, t1: 0, p2: 0, t2: 0 };
  for (const category of categoryOrder) {
    const subjects = subjectsByCategory.get(category) ?? [];
    const sub = { s1: 0, s2: 0, standard: 0, p1: 0, t1: 0, p2: 0, t2: 0 };
    for (const subject of subjects) {
      const entry = standardBySubject.get(subject);
      const s1 = entry?.hours1 ?? 0;
      const s2 = entry?.hours2 ?? 0;
      const standardHours = entry?.hours ?? 0;
      const p1 = first.planned[subject] ?? 0;
      const t1 = first.taught[subject] ?? 0;
      const p2 = second.planned[subject] ?? 0;
      const t2 = second.taught[subject] ?? 0;
      rows.push(makeRow("subject", subject, category, s1, s2, standardHours, p1, t1, p2, t2));
      sub.s1 += s1;
      sub.s2 += s2;
      sub.standard += standardHours;
      sub.p1 += p1;
      sub.t1 += t1;
      sub.p2 += p2;
      sub.t2 += t2;
    }
    if (subjects.length >= 2) {
      rows.push(
        makeRow("subtotal", `${category} 소계`, category, sub.s1, sub.s2, sub.standard, sub.p1, sub.t1, sub.p2, sub.t2)
      );
    }
    totals.s1 += sub.s1;
    totals.s2 += sub.s2;
    totals.standard += sub.standard;
    totals.p1 += sub.p1;
    totals.t1 += sub.t1;
    totals.p2 += sub.p2;
    totals.t2 += sub.t2;
  }
  if (rows.length > 0) {
    rows.push(makeRow("total", "총계", "", totals.s1, totals.s2, totals.standard, totals.p1, totals.t1, totals.p2, totals.t2));
  }
  return rows;
}
