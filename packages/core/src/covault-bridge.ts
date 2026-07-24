import { splitDelimited } from "./progress";
import { yamlString } from "./utils";

/**
 * CoVault 다리 1단계 (R3) — 단방향 내보내기와 읽기 전용 통계 대사.
 * 역할 분담: 플러그인=교사 개인 운영(마크다운), CoVault=학생 공유(DB). 형식의 근거는
 * obsidian-covault `core/classroom/templates.ts`(covault: notice 마커)·GradebookView CSV.
 */

/** CoVault 알림장 초안 — 파일을 CoVault 볼트로 옮기면 플러그인이 인식한다(발행 전 published: false). */
export function covaultNoticeMarkdown(title: string, body: string): string {
  return [
    "---",
    "covault: notice",
    `title: ${yamlString(title)}`,
    "published: false",
    "pinned: false",
    "responses: true",
    "---",
    "",
    body.trim(),
    ""
  ].join("\n");
}

/** 본문에서 frontmatter 블록을 뗀다 — 주간학습안내 노트를 알림장 본문으로 옮길 때 사용. */
export function stripFrontmatter(content: string): string {
  return content.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "").trim();
}

export interface CovaultStatsRow {
  name: string;
  /** 열 제목 → 수치(빈 칸은 null). */
  values: Record<string, number | null>;
}

export interface CovaultStats {
  columns: string[];
  rows: CovaultStatsRow[];
}

/** CoVault 성적부 CSV(구성원, 지표…, 마지막 학급 평균 행)를 파싱한다. 평균 행은 제외. */
export function parseCovaultStatsCsv(text: string): CovaultStats {
  const lines = text
    .replace(/^﻿/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return { columns: [], rows: [] };
  const header = splitDelimited(lines[0] ?? "");
  const columns = header.slice(1).map((column) => column.trim());
  const rows: CovaultStatsRow[] = [];
  for (const line of lines.slice(1)) {
    const cells = splitDelimited(line);
    const name = (cells[0] ?? "").trim();
    if (!name || name.includes("평균")) continue;
    const values: Record<string, number | null> = {};
    columns.forEach((column, index) => {
      const raw = (cells[index + 1] ?? "").trim().replace(/%$/, "");
      values[column] = raw === "" ? null : Number(raw);
    });
    rows.push({ name, values });
  }
  return { columns, rows };
}

export interface AssignmentReconcileRow {
  name: string;
  covaultRate: number | null;
  localRate: number | null;
  /** 퍼센트포인트 차 — 둘 다 있을 때만. */
  gap: number | null;
}

export interface AssignmentReconcileResult {
  rows: AssignmentReconcileRow[];
  /** CoVault에만 있는 이름. */
  covaultOnly: string[];
  /** 학급 명단에만 있는 이름. */
  localOnly: string[];
}

/**
 * CoVault 과제 제출률과 확인표 제출률을 이름으로 대사한다 — 읽기 전용 보고.
 * CoVault는 플랫폼 제출 기준, 확인표는 교사 체크 기준이라 차이 자체가 정보다.
 */
export function reconcileAssignmentRates(
  stats: CovaultStats,
  localRates: Array<{ name: string; rate: number | null }>
): AssignmentReconcileResult {
  const rateColumn = stats.columns.find((column) => column.includes("과제"));
  const covaultByName = new Map(
    stats.rows.map((row) => [row.name, rateColumn ? row.values[rateColumn] ?? null : null])
  );
  const localByName = new Map(localRates.map((entry) => [entry.name, entry.rate]));

  const rows: AssignmentReconcileRow[] = [];
  for (const [name, localRate] of localByName) {
    const covaultRate = covaultByName.get(name);
    if (covaultRate === undefined) continue;
    const gap =
      covaultRate !== null && localRate !== null
        ? Math.round((covaultRate - localRate) * 10) / 10
        : null;
    rows.push({ name, covaultRate, localRate, gap });
  }
  rows.sort((a, b) => Math.abs(b.gap ?? 0) - Math.abs(a.gap ?? 0) || a.name.localeCompare(b.name));
  return {
    rows,
    covaultOnly: stats.rows.map((row) => row.name).filter((name) => !localByName.has(name)),
    localOnly: localRates.map((entry) => entry.name).filter((name) => !covaultByName.has(name))
  };
}
