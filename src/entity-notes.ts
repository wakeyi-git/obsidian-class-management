import type { SchoolEvent } from "./types";
import { safeFileSegment, yamlString } from "./utils";

/** 행사 노트 본문 — 리포지토리와 일괄 생성 스크립트가 같은 템플릿을 쓴다. */
export function schoolEventNoteMarkdown(event: SchoolEvent, className: string): string {
  return [
    "---",
    "class-management: school-event",
    `class: ${yamlString(className)}`,
    `eventName: ${yamlString(event.name)}`,
    `date: ${yamlString(event.date)}`,
    `eventType: ${yamlString(event.type)}`,
    `periods: ${yamlString(event.periods.join(","))}`,
    `subject: ${yamlString(event.subject)}`,
    "tags:",
    "  - class-management/school-event",
    "---",
    "",
    `# ${event.date} · ${event.name}`,
    "",
    `- 유형: ${event.type}${event.periods.length ? ` · ${event.periods.join(",")}교시` : ""}${event.subject ? ` · ${event.subject}` : ""}`,
    "",
    "## 계획",
    "",
    "## 준비물",
    "",
    "## 연계 단원·프로젝트",
    "",
    "- ",
    "",
    "## 결과·성찰",
    ""
  ].join("\n");
}

export function schoolEventNoteFileName(event: SchoolEvent): string {
  return `${safeFileSegment(event.date)} ${safeFileSegment(event.name)}.md`;
}

/**
 * 일체화 Bases 보기 정의 — 리포지토리(ensureBasesViews)와 볼트 스크립트의 단일 진실.
 * 파일이 이미 있으면 덮어쓰지 않으므로, 보기 내용을 바꾸려면 볼트에서 지우고 다시 생성한다.
 */
export const BASES_VIEW_FILES: Array<[string, string]> = [
  [
    "통합 단원.base",
    [
      "filters:",
      "  and:",
      "    - 'file.hasTag(\"class-management/curriculum-unit\")'",
      "formulas:",
      "  진행률: 'if(taughtHours, ((taughtHours / plannedHours * 100).round(0)).toString() + \"%\", \"0%\")'",
      "views:",
      "  - type: table",
      '    name: "단원별"',
      "    groupBy:",
      "      property: subject",
      "      direction: ASC",
      "    order:",
      "      - file.name",
      "      - unitName",
      "      - curriculumStatus",
      "      - plannedHours",
      "      - taughtHours",
      "      - formula.진행률",
      "      - alignmentScore",
      ""
    ].join("\n")
  ],
  [
    "수업일지.base",
    [
      "filters:",
      "  and:",
      "    - 'file.hasTag(\"class-management/curriculum-lesson\")'",
      "views:",
      "  - type: table",
      '    name: "날짜별"',
      "    groupBy:",
      "      property: date",
      "      direction: DESC",
      "    order:",
      "      - file.name",
      "      - period",
      "      - subject",
      "      - curriculumUnitTitle",
      "      - lessonStatus",
      "      - recordStatus",
      "  - type: table",
      '    name: "단원별 차시"',
      "    filters:",
      "      and:",
      "        - '!curriculumUnitId.isEmpty()'",
      "    groupBy:",
      "      property: curriculumUnitTitle",
      "      direction: ASC",
      "    order:",
      "      - file.name",
      "      - date",
      "      - subject",
      "      - lessonStatus",
      "      - conceptInquiryPhase",
      ""
    ].join("\n")
  ],
  [
    "과제.base",
    [
      "filters:",
      "  and:",
      "    - 'file.hasTag(\"class-management/assignment\")'",
      "views:",
      "  - type: table",
      '    name: "평가 과제"',
      "    order:",
      "      - file.name",
      "      - date",
      "      - curriculumUnitTitle",
      "  - type: table",
      '    name: "단원 연계만"',
      "    filters:",
      "      and:",
      "        - '!curriculumUnitId.isEmpty()'",
      "    groupBy:",
      "      property: curriculumUnitTitle",
      "      direction: ASC",
      "    order:",
      "      - file.name",
      "      - date",
      ""
    ].join("\n")
  ],
  [
    "행사.base",
    [
      "filters:",
      "  and:",
      "    - 'file.hasTag(\"class-management/school-event\")'",
      "views:",
      "  - type: table",
      '    name: "행사 일지"',
      "    order:",
      "      - file.name",
      "      - date",
      "      - eventType",
      "      - subject",
      ""
    ].join("\n")
  ],
  [
    "학생부 근거.base",
    [
      "filters:",
      "  and:",
      "    - 'file.hasTag(\"class-management/record\")'",
      "    - '!schoolRecordArea.isEmpty()'",
      "views:",
      "  - type: table",
      '    name: "영역별"',
      "    groupBy:",
      "      property: schoolRecordArea",
      "      direction: ASC",
      "    order:",
      "      - file.name",
      "      - studentName",
      "      - date",
      "      - subject",
      "      - reviewStatus",
      "      - curriculumUnitTitle",
      "  - type: table",
      '    name: "검토 대기"',
      "    filters:",
      "      and:",
      "        - 'reviewStatus == \"raw\"'",
      "    order:",
      "      - file.name",
      "      - studentName",
      "      - date",
      ""
    ].join("\n")
  ],
  [
    "주간학습안내.base",
    [
      "filters:",
      "  and:",
      "    - 'file.hasTag(\"class-management/weekly-plan\")'",
      "views:",
      "  - type: table",
      '    name: "주차별"',
      "    order:",
      "      - file.name",
      "      - weekStart",
      "      - weekEnd",
      "      - semester",
      ""
    ].join("\n")
  ],
  [
    "연계 기록.base",
    [
      "# 단원 노트에 임베드해서 쓰는 보기 — 임베드한 노트(this)를 링크한 기록만 모은다.",
      "filters:",
      "  and:",
      "    - 'file.hasLink(this.file)'",
      "    - or:",
      "        - 'file.hasTag(\"class-management/curriculum-lesson\")'",
      "        - 'file.hasTag(\"class-management/assignment\")'",
      "        - 'file.hasTag(\"class-management/record\")'",
      "        - 'file.hasTag(\"class-management/school-event\")'",
      "views:",
      "  - type: table",
      '    name: "이 단원과 연결된 기록"',
      "    order:",
      "      - file.name",
      "      - date",
      "      - subject",
      ""
    ].join("\n")
  ]
];
