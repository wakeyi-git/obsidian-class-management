import type { ActivityEntry, SchoolRecordArea, StudentEntry } from "./types";
import { localDate, yamlString } from "./utils";

/**
 * NEIS 대비 내보내기 — 검토 완료 학생부 근거를 영역별 붙여넣기 재료로 모으고,
 * 최종 문구의 자수는 `NEIS 글자수 검사`가 잰다. NEIS 자동 전송은 비목표(수동 붙여넣기 보조까지만).
 */

export interface NeisCharCount {
  withSpaces: number;
  withoutSpaces: number;
}

/** 자수 세기 — 코드포인트 기준(한글 1자=1자), 줄바꿈은 공백과 같이 1자로 센다. */
export function countNeisChars(text: string): NeisCharCount {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  return {
    withSpaces: [...normalized].length,
    withoutSpaces: [...normalized.replace(/\s/g, "")].length
  };
}

export const NEIS_AREA_LABELS: Record<SchoolRecordArea, string> = {
  "creative-activities": "창의적 체험활동",
  "subject-development": "교과 학습발달상황 (세부능력 및 특기사항)",
  "behavior-summary": "행동특성 및 종합의견"
};

/** 기본 자수 한도 — 학교 기재요령에 따라 검사 모달에서 조정한다. */
export const DEFAULT_NEIS_CHAR_LIMIT = 500;

interface EvidenceGroup {
  /** 창체는 하위 영역(자율·동아리·진로), 교과는 과목명, 행동은 빈 문자열. */
  key: string;
  items: ActivityEntry[];
}

function groupEvidence(records: ActivityEntry[], area: SchoolRecordArea): EvidenceGroup[] {
  const groups = new Map<string, ActivityEntry[]>();
  for (const record of records) {
    const evidence = record.schoolRecordEvidence;
    if (!evidence || evidence.area !== area) continue;
    const key = area === "creative-activities"
      ? evidence.subarea || "(하위 영역 미지정)"
      : area === "subject-development"
        ? evidence.subject || "(교과 미지정)"
        : "";
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return [...groups.entries()]
    .map(([key, items]) => ({
      key,
      items: items.sort((a, b) => a.date.localeCompare(b.date))
    }))
    .sort((a, b) => a.key.localeCompare(b.key));
}

function evidenceLine(record: ActivityEntry): string {
  const evidence = record.schoolRecordEvidence;
  const facts = [
    record.detail || record.title,
    evidence?.changeGrowth,
    evidence?.conceptualUnderstanding
  ].filter((part): part is string => Boolean(part && part.trim()));
  const meta = [
    evidence?.achievementStandard,
    evidence?.evaluationElement,
    evidence?.directObservation ? "직접 관찰" : ""
  ].filter(Boolean);
  return `- ${record.date} ${facts.join(" / ")}${meta.length ? ` (${meta.join(" · ")})` : ""}`;
}

/**
 * 학생·영역별 붙여넣기 재료 문서 — 검토 완료(reviewed) 근거만 담는다.
 * 최종 문구 작성·확정은 교사, 이 문서는 재료와 분량 감각을 준다.
 */
export function buildNeisExportMarkdown(
  activities: ActivityEntry[],
  students: StudentEntry[],
  options: {
    className: string;
    guidelineYear: string;
    studentNumber?: string;
    dateFrom?: string;
    dateTo?: string;
  }
): string {
  const targets = options.studentNumber
    ? students.filter((student) => student.number === options.studentNumber)
    : students;
  const reviewed = activities.filter(
    (activity) =>
      activity.kind === "record" &&
      activity.schoolRecordEvidence?.reviewStatus === "reviewed" &&
      (!options.dateFrom || activity.date >= options.dateFrom) &&
      (!options.dateTo || activity.date <= options.dateTo)
  );

  const sections: string[] = [];
  for (const student of targets) {
    const records = reviewed.filter((record) => record.studentNumber === student.number);
    sections.push("", `## ${student.number}번 ${student.name}`, "");
    if (records.length === 0) {
      sections.push("- 검토 완료된 학생부 근거가 없습니다. — `근거 검토 상태`에서 raw → 검토로 승격하세요.");
      continue;
    }
    for (const area of Object.keys(NEIS_AREA_LABELS) as SchoolRecordArea[]) {
      const groups = groupEvidence(records, area);
      if (groups.length === 0) continue;
      sections.push(`### ${NEIS_AREA_LABELS[area]}`, "");
      for (const group of groups) {
        if (group.key) sections.push(`**${group.key}**`, "");
        const lines = group.items.map(evidenceLine);
        sections.push(...lines);
        const material = countNeisChars(lines.join(" "));
        sections.push("", `> 재료 분량: 공백 포함 ${material.withSpaces}자 — 최종 문구는 기재요령 한도에 맞춰 줄여 쓰세요.`, "");
      }
    }
  }

  return [
    "---",
    "class-management: report",
    `reportTitle: ${yamlString("NEIS 붙여넣기 자료")}`,
    `class: ${yamlString(options.className)}`,
    `created: ${localDate()}`,
    "cssclasses:",
    "  - class-management-print",
    "tags:",
    "  - class-management/report",
    "---",
    "",
    "# NEIS 붙여넣기 자료",
    "",
    `- 학급: ${options.className} · 기간: ${options.dateFrom || "전체"} ~ ${options.dateTo || "전체"} · 기재요령 연도: ${options.guidelineYear}`,
    "- **검토 완료 근거만** 담았습니다. 최종 문구는 교사가 작성·확정하며, 붙여넣기 전 `NEIS 글자수 검사` 명령으로 자수를 확인하세요.",
    "- 이 문서는 NEIS에 그대로 넣는 완성 문구가 아니라 작성 재료입니다 — 학생에게 불리한 표현·추측성 서술이 없는지 검토하세요.",
    ...sections,
    ""
  ].join("\n");
}
