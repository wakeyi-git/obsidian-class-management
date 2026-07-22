import type { ProgressRow, ProgressTable } from "./types";
import { splitDelimited } from "./progress";
import { yamlString } from "./utils";

/*
 * 계획 수립 도구 3종의 순수 로직 (PRODUCT §10 R0).
 * LLM 협업 경로(스킬)를 대체하지 않는 단독 경로 — 진도표만으로 동작하고 지도서 전문은 수기 보완 전제.
 */

/* ---------- 1) 일반 단원 스캐폴드 ---------- */

export interface UnitScaffold {
  unitName: string;
  plannedHours: number;
  /** 통합(프로젝트) 단원으로 이관 운영되는 시수 합. */
  integratedHours: number;
  startDate: string;
  endDate: string;
  /** 진도표 성취기준 열 원문 토큰(위키링크 표기 유지, 중복 제거). */
  standards: string[];
  integratedTargets: string[];
  /** 전개(차시 흐름) — 단원 노트 learningPlan에 그대로 들어간다. */
  learningPlan: string;
  /** theme·unitOverview에 쓰는 한 줄 요약. */
  summary: string;
}

function assignedDate(row: ProgressRow): string {
  const match = row.assigned.match(/\d{4}-\d{2}-\d{2}/);
  return match ? match[0] : "";
}

function monthDay(date: string): string {
  return date ? `${Number(date.slice(5, 7))}/${Number(date.slice(8, 10))}` : "";
}

/** `[[경로\|별칭]]`·`[[이름]]` 위키링크에서 표시 텍스트만 얻는다(표 셀의 `\|` 이스케이프 처리). */
export function wikiLinkText(link: string): string {
  const match = link.trim().match(/\[\[([^\]]+)\]\]/);
  if (!match) return link.trim();
  const inner = (match[1] ?? "").replace(/\\\|/g, "|");
  const pipe = inner.lastIndexOf("|");
  return (pipe >= 0 ? inner.slice(pipe + 1) : inner).trim();
}

/** `[[경로\|별칭]]` 위키링크에서 링크 대상(경로)만 얻는다 — wikiLinkText의 짝. */
export function wikiLinkTarget(link: string): string {
  const match = link.trim().match(/\[\[([^\]]+)\]\]/);
  if (!match) return "";
  const inner = (match[1] ?? "").replace(/\\\|/g, "|");
  const pipe = inner.lastIndexOf("|");
  return (pipe >= 0 ? inner.slice(0, pipe) : inner).trim();
}

export interface PdfPageLink {
  /** "과학3-2_지도서.pdf#page=5" 형태 — openLinkText에 그대로 쓴다. */
  target: string;
  label: string;
}

/** 텍스트에서 PDF 쪽 딥링크([[…\.pdf#page=N\|라벨]])를 순서대로 추출한다(중복 제거). */
export function pdfPageLinks(text: string): PdfPageLink[] {
  const links: PdfPageLink[] = [];
  for (const match of text.matchAll(/\[\[([^\]|]+\.pdf#page=\d+)(?:\\?\|([^\]]+))?\]\]/g)) {
    const target = (match[1] ?? "").trim();
    if (links.some((link) => link.target === target)) continue;
    links.push({ target, label: (match[2] ?? "").trim() || "지도서" });
  }
  return links;
}

/** 진도표를 과목·단원별로 묶어 단원 노트 초안 재료를 만든다. 단원명이 빈 행은 제외. */
export function unitScaffoldsFromProgress(table: Pick<ProgressTable, "rows">): UnitScaffold[] {
  const groups = new Map<string, ProgressRow[]>();
  for (const row of table.rows) {
    const name = row.unit.trim();
    if (!name) continue;
    const list = groups.get(name) ?? [];
    list.push(row);
    groups.set(name, list);
  }
  const scaffolds: UnitScaffold[] = [];
  for (const [unitName, rows] of groups) {
    const dates = rows.map(assignedDate).filter(Boolean).sort();
    const standards: string[] = [];
    for (const row of rows) {
      for (const token of row.standard.split(",")) {
        const value = token.trim();
        if (value && !standards.includes(value)) standards.push(value);
      }
    }
    const integratedTargets: string[] = [];
    let integratedHours = 0;
    const lines = rows.map((row) => {
      const day = monthDay(assignedDate(row));
      let line = `${row.order}. ${row.topic} (${day || "미배정"}, ${row.hours}시수)`;
      if (row.unitLink.trim()) {
        const target = wikiLinkText(row.unitLink);
        line += ` → ${target} 통합 운영`;
        integratedHours += row.hours;
        if (!integratedTargets.includes(target)) integratedTargets.push(target);
      }
      return line;
    });
    const plannedHours = rows.reduce((sum, row) => sum + row.hours, 0);
    const startDate = dates[0] ?? "";
    const endDate = dates[dates.length - 1] ?? "";
    const range = startDate ? `(${monthDay(startDate)}~${monthDay(endDate)})` : "(배정 전)";
    const integratedNote = integratedHours > 0
      ? ` · ${integratedHours}시수는 ${integratedTargets.join("·")} 통합 운영(전개의 → 표시)`
      : "";
    scaffolds.push({
      unitName,
      plannedHours,
      integratedHours,
      startDate,
      endDate,
      standards,
      integratedTargets,
      learningPlan: lines.join("\n"),
      summary: `진도표 차시 흐름 기반 일반 단원 초안 · ${rows.length}차시${range}${integratedNote} · 지도서 전문은 수기 보완`
    });
  }
  return scaffolds;
}

/* ---------- 2) 평가 계획 가져오기 ---------- */

export interface AssessmentPlanItem {
  /** 원문 시기 표현("9월 3주", "10/15", "2026-11-07" 등). */
  timing: string;
  unit: string;
  element: string;
  criteria: string;
  method: string;
}

export interface AssessmentPlanImportResult {
  items: AssessmentPlanItem[];
  issues: string[];
}

/** 붙여넣은 평가계획 표를 파싱한다. 열 순서: 시기 | 단원 | 평가 요소 | 평가 기준 | 평가 방법(선택). */
export function parseAssessmentPlanImport(text: string): AssessmentPlanImportResult {
  const lines = text.split(/\r?\n/).map((line) => line.replace(/^﻿/, ""));
  const items: AssessmentPlanItem[] = [];
  const issues: string[] = [];
  for (let index = 0; index < lines.length; index += 1) {
    const line = (lines[index] ?? "").trim();
    if (!line) continue;
    const cells = splitDelimited(line);
    if (cells.length < 3) {
      issues.push(`${index + 1}행: 열이 3개 미만이라 건너뜁니다.`);
      continue;
    }
    if (index === 0 && /시기|평가\s*요소|평가\s*기준/.test(cells.join(" "))) continue;
    const element = (cells[2] ?? "").trim();
    if (!element) {
      issues.push(`${index + 1}행: 평가 요소가 비어 있어 건너뜁니다.`);
      continue;
    }
    items.push({
      timing: (cells[0] ?? "").trim(),
      unit: (cells[1] ?? "").trim(),
      element,
      criteria: (cells[3] ?? "").trim(),
      method: (cells[4] ?? "").trim()
    });
  }
  return { items, issues };
}

export interface AssessmentDateContext {
  /** 학기 시작·끝(YYYY-MM-DD). 비어 있으면 연도 추정만 제한적으로 동작한다. */
  semesterFrom: string;
  semesterTo: string;
  /** 같은 과목 진도표 행 — 시기 창과 겹치는 배정일을 찾는 데 쓴다. */
  rows: ProgressRow[];
}

export interface ResolvedAssessmentDate {
  date: string;
  /** 명시=원문에 날짜, 진도표=배정일 매칭, 주초=창 시작일 폴백. */
  source: "명시" | "진도표" | "주초" | "";
  issue?: string;
}

function normalizedUnitName(value: string): string {
  return value.replace(/[\d.\s()·\-~]/g, "");
}

function unitMatches(rowUnit: string, planUnit: string): boolean {
  const a = normalizedUnitName(rowUnit);
  const b = normalizedUnitName(planUnit);
  if (!a || !b) return false;
  return a.includes(b) || b.includes(a);
}

function pad2(value: number): string {
  return String(value).padStart(2, "0");
}

/** month가 학기 범위 안에 오는 연도를 고른다(2학기는 해를 넘길 수 있다). */
function yearForMonth(month: number, from: string, to: string): number {
  const candidates = new Set<number>();
  if (from) candidates.add(Number(from.slice(0, 4)));
  if (to) candidates.add(Number(to.slice(0, 4)));
  for (const year of candidates) {
    const first = `${year}-${pad2(month)}-01`;
    const last = `${year}-${pad2(month)}-31`;
    if ((!from || last >= from) && (!to || first <= to)) return year;
  }
  return from ? Number(from.slice(0, 4)) : new Date().getFullYear();
}

/**
 * 평가 시기 표현을 날짜로 바꾼다.
 * "N월 M주"는 일자 창((M-1)*7+1일~M*7일)과 겹치는 진도표 배정일 중 단원 일치 행을 우선한다
 * — 실기 차시가 아닌 단원 종합 평가는 계획 시기를 따른다는 규칙(§UIUX 5)과 같은 계산.
 */
export function resolveAssessmentDate(
  timing: string,
  planUnit: string,
  context: AssessmentDateContext
): ResolvedAssessmentDate {
  const text = timing.trim();
  if (!text) return { date: "", source: "", issue: "시기가 비어 있습니다." };

  const iso = text.match(/\d{4}-\d{2}-\d{2}/);
  if (iso) return { date: iso[0], source: "명시" };

  const dayForm = text.match(/(\d{1,2})\s*[월\/]\s*(\d{1,2})일?/);
  if (dayForm && !/주/.test(text)) {
    const month = Number(dayForm[1]);
    const day = Number(dayForm[2]);
    if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
      const year = yearForMonth(month, context.semesterFrom, context.semesterTo);
      return { date: `${year}-${pad2(month)}-${pad2(day)}`, source: "명시" };
    }
  }

  const weekForm = text.match(/(\d{1,2})월\s*(\d{1,2})주/);
  const monthForm = text.match(/(\d{1,2})월/);
  if (weekForm || monthForm) {
    const month = Number((weekForm ?? monthForm)![1]);
    const year = yearForMonth(month, context.semesterFrom, context.semesterTo);
    const week = weekForm ? Number(weekForm[2]) : 0;
    const fromDay = week > 0 ? (week - 1) * 7 + 1 : 1;
    const toDay = week > 0 ? week * 7 : 31;
    const windowFrom = `${year}-${pad2(month)}-${pad2(Math.min(fromDay, 31))}`;
    const windowTo = `${year}-${pad2(month)}-${pad2(Math.min(toDay, 31))}`;
    const inWindow = context.rows
      .map((row) => ({ row, date: assignedDate(row) }))
      .filter((entry) => entry.date && entry.date >= windowFrom && entry.date <= windowTo)
      .sort((a, b) => a.date.localeCompare(b.date));
    const unitHit = inWindow.find((entry) => unitMatches(entry.row.unit, planUnit));
    if (unitHit) return { date: unitHit.date, source: "진도표" };
    const first = inWindow[0];
    if (first) return { date: first.date, source: "진도표" };
    if (week > 0) {
      const fallback = windowFrom;
      const clamped =
        context.semesterFrom && fallback < context.semesterFrom ? context.semesterFrom : fallback;
      return { date: clamped, source: "주초" };
    }
    return { date: "", source: "", issue: `"${text}"에 해당하는 배정 차시를 찾지 못했습니다.` };
  }

  return { date: "", source: "", issue: `시기 "${text}"를 날짜로 해석하지 못했습니다.` };
}

/* ---------- 3) 성취기준 도구 ---------- */

export const STANDARD_CODE_REGEX = /\d[가-힣]{1,2}\d{2}-\d{2}/g;

/** 텍스트에서 성취기준 코드를 등장 순서대로 중복 없이 추출한다. */
export function extractStandardCodes(text: string): string[] {
  const codes: string[] = [];
  for (const match of text.matchAll(STANDARD_CODE_REGEX)) {
    if (!codes.includes(match[0])) codes.push(match[0]);
  }
  return codes;
}

const SUBJECT_BY_LETTER: Record<string, string> = {
  국: "국어",
  수: "수학",
  사: "사회",
  과: "과학",
  영: "영어",
  음: "음악",
  미: "미술",
  체: "체육",
  도: "도덕",
  실: "실과",
  바: "바른 생활",
  슬: "슬기로운 생활",
  즐: "즐거운 생활"
};

export function standardSubject(code: string): string {
  const letters = code.match(/^\d([가-힣]{1,2})/)?.[1] ?? "";
  return SUBJECT_BY_LETTER[letters] ?? SUBJECT_BY_LETTER[letters.slice(0, 1)] ?? "";
}

export function standardGradeBand(code: string): string {
  const digit = code.slice(0, 1);
  if (digit === "2") return "1~2학년군";
  if (digit === "4") return "3~4학년군";
  if (digit === "6") return "5~6학년군";
  if (digit === "9") return "중학교";
  return "";
}

export interface AchievementStandardNoteInput {
  code: string;
  /** 전문 — 스캐폴드 단계에서는 비워 두고 수기 보완한다. */
  statement: string;
  /** 이 코드를 쓰는 진도표 노트 이름들(위키링크 대상). */
  progressLinks: string[];
}

export function achievementStandardMarkdown(input: AchievementStandardNoteInput): string {
  const subject = standardSubject(input.code);
  const gradeBand = standardGradeBand(input.code);
  const statement = input.statement.trim();
  const lines = [
    "---",
    "class-management: achievement-standard",
    `standardCode: ${yamlString(input.code)}`,
    `subject: ${yamlString(subject)}`,
    `gradeBand: ${yamlString(gradeBand)}`,
    `statement: ${yamlString(statement)}`,
    "tags:",
    "  - class-management/achievement-standard",
    "---",
    "",
    `# [${input.code}]`,
    "",
    `> ${statement || "(전문 미입력 — 교육과정 원문을 붙여넣어 주세요)"}`,
    "",
    `- 과목: ${subject || "미상"}${gradeBand ? ` · ${gradeBand}` : ""}`,
    ""
  ];
  if (input.progressLinks.length > 0) {
    lines.push("## 진도표", "");
    for (const name of input.progressLinks) lines.push(`- [[${name}]]`);
    lines.push("");
  }
  return lines.join("\n");
}

/**
 * 진도표 성취기준 셀의 `[코드]`·맨 코드를 `[[코드]]`로 바꾼다.
 * 이미 링크된 코드는 그대로 두므로 여러 번 실행해도 결과가 같다.
 */
export function linkifyStandardCell(cell: string): string {
  return cell.replace(
    /\[\[(\d[가-힣]{1,2}\d{2}-\d{2})\]\]|\[(\d[가-힣]{1,2}\d{2}-\d{2})\]|(\d[가-힣]{1,2}\d{2}-\d{2})/g,
    (match, linked: string | undefined, bracketed: string | undefined, bare: string | undefined) =>
      linked ? match : `[[${bracketed ?? bare}]]`
  );
}
