import { yamlString } from "./utils";

/**
 * 업무일지 — 교사 업무(수업 외)의 날짜별 기록. 하루 1노트, 본문은 자유 편집.
 * GTD 할 일이 '앞으로 할 일'을 담는다면 업무일지는 '오늘 처리한 일과 특이사항'의 서술 기록이다.
 */
export function workJournalMarkdown(
  date: string,
  settings: { className: string; schoolYear: string; semester: string }
): string {
  return [
    "---",
    "class-management: work-journal",
    `class: ${yamlString(settings.className)}`,
    `schoolYear: ${yamlString(settings.schoolYear)}`,
    `semester: ${yamlString(settings.semester)}`,
    `date: ${yamlString(date)}`,
    "tags:",
    "  - class-management/work-journal",
    "---",
    "",
    `# ${date} 업무일지`,
    "",
    "## 기록",
    "",
    "- ",
    ""
  ].join("\n");
}
