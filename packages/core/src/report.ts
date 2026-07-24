import { ACTIVITY_KIND_LABELS } from "./activity";
import type { ActivityEntry, ActivityKind, ReportOptions, StudentEntry } from "./types";
import { csvCell, escapeTableCell, localDate, yamlString } from "./utils";

export interface ActivityAnalytics {
  total: number;
  byKind: Record<ActivityKind, number>;
  attendanceExceptions: number;
  assignmentsPending: number;
  noticePending: number;
  tasksOpen: number;
  routinesIncomplete: number;
}

export function selectReportActivities(
  activities: ActivityEntry[],
  options: Pick<ReportOptions, "dateFrom" | "dateTo" | "studentNumber">
): ActivityEntry[] {
  return activities.filter((activity) =>
    (!options.dateFrom || activity.date >= options.dateFrom) &&
    (!options.dateTo || activity.date <= options.dateTo) &&
    (!options.studentNumber || activity.studentNumber === options.studentNumber)
  );
}

export function analyzeActivities(activities: ActivityEntry[]): ActivityAnalytics {
  const byKind: Record<ActivityKind, number> = {
    record: 0,
    attendance: 0,
    assignment: 0,
    task: 0,
    notice: 0,
    routine: 0,
    curriculum: 0
  };
  activities.forEach((activity) => (byKind[activity.kind] += 1));
  return {
    total: activities.length,
    byKind,
    attendanceExceptions: activities.filter((item) =>
      item.kind === "attendance" && item.status !== "출석"
    ).length,
    assignmentsPending: activities.filter((item) =>
      item.kind === "assignment" && item.status !== "제출"
    ).length,
    noticePending: activities.filter((item) =>
      item.kind === "notice" && item.status !== "회신 완료"
    ).length,
    tasksOpen: activities.filter((item) =>
      item.kind === "task" && item.status !== "done"
    ).length,
    routinesIncomplete: activities.filter((item) =>
      item.kind === "routine" && item.status !== "완료"
    ).length
  };
}

export function buildReportMarkdown(
  activities: ActivityEntry[],
  options: ReportOptions,
  className: string,
  students: StudentEntry[]
): string {
  const selected = selectReportActivities(activities, options);
  const analytics = analyzeActivities(selected);
  const student = students.find((entry) => entry.number === options.studentNumber);
  const scope = student ? `${student.number}번 ${student.name}` : "학급 전체";
  const kindRows = (Object.entries(ACTIVITY_KIND_LABELS) as Array<[ActivityKind, string]>)
    .map(([kind, label]) => `| ${label} | ${analytics.byKind[kind]} |`);
  const studentRows = buildStudentRows(selected, students);
  const exceptions = selected.filter(isException);
  const trends = buildTrendSummary(selected, options.dateFrom, options.dateTo);

  return [
    "---",
    "class-management: report",
    `reportTitle: ${yamlString(options.title)}`,
    `class: ${yamlString(className)}`,
    `dateFrom: ${yamlString(options.dateFrom)}`,
    `dateTo: ${yamlString(options.dateTo)}`,
    `studentNumber: ${yamlString(options.studentNumber)}`,
    `created: ${localDate()}`,
    "cssclasses:",
    "  - class-management-print",
    "tags:",
    "  - class-management/report",
    "---",
    "",
    `# ${options.title}`,
    "",
    `- 범위: ${options.dateFrom || "전체"} ~ ${options.dateTo || "전체"}`,
    `- 대상: ${scope}`,
    `- 자료: ${analytics.total}건`,
    "",
    "## 운영 요약",
    "",
    `- 출결 예외: ${analytics.attendanceExceptions}건`,
    `- 미제출·보완 과제: ${analytics.assignmentsPending}건`,
    `- 미회신·확인 필요: ${analytics.noticePending}건`,
    `- 미완료 할 일: ${analytics.tasksOpen}건`,
    `- 미완료 루틴: ${analytics.routinesIncomplete}건`,
    "",
    "| 자료 유형 | 건수 |",
    "| --- | ---: |",
    ...kindRows,
    "",
    "## 기간 변화 점검",
    "",
    ...trends,
    "",
    "## 학생별 현황",
    "",
    "| 학생 | 학생 기록 | 출결 예외 | 과제 예외 | 회신 예외 |",
    "| --- | ---: | ---: | ---: | ---: |",
    ...(studentRows.length ? studentRows : ["| 해당 없음 | 0 | 0 | 0 | 0 |"]),
    "",
    "## 확인할 항목",
    "",
    ...(exceptions.length
      ? exceptions.map((activity) => evidenceBullet(activity))
      : ["- 확인이 필요한 예외 항목이 없습니다."]),
    "",
    "## 전체 근거",
    "",
    ...(selected.length
      ? selected.map((activity) => evidenceBullet(activity))
      : ["- 선택한 기간에 자료가 없습니다."]),
    ""
  ].join("\n");
}

/**
 * 학부모 상담 준비 자료 — 교사 본인용 실명 문서 (내보내기 폴더 · 인쇄 규격).
 * AI 익명 내보내기와 반대 방향의 비AI 경로: 외부로 나가지 않는 전제이므로 이름·원본 링크를 담는다.
 */
export function buildCounselingMarkdown(
  activities: ActivityEntry[],
  options: { dateFrom: string; dateTo: string; studentNumber: string },
  className: string,
  students: StudentEntry[]
): string {
  const student = students.find((entry) => entry.number === options.studentNumber);
  const label = student ? `${student.number}번 ${student.name}` : "학생";
  const selected = selectReportActivities(activities, options);
  const byDate = [...selected].sort((a, b) => a.date.localeCompare(b.date));

  const attendance = byDate.filter((item) => item.kind === "attendance");
  const attendanceCounts = new Map<string, number>();
  for (const item of attendance) {
    attendanceCounts.set(item.status, (attendanceCounts.get(item.status) ?? 0) + 1);
  }
  const attendanceExceptions = attendance.filter((item) => item.status !== "출석");

  const records = byDate.filter((item) => item.kind === "record");
  const assignments = byDate.filter((item) => item.kind === "assignment");
  const assignmentExceptions = assignments.filter((item) => item.status !== "제출");
  const noticeExceptions = byDate.filter(
    (item) => item.kind === "notice" && item.status !== "회신 완료"
  );

  const line = (item: ActivityEntry): string => {
    const description = [item.status, item.detail || item.title].filter(Boolean).join(" · ");
    return `- ${item.date} · ${description} ([[${withoutExtension(item.file.path)}|원본]])`;
  };

  return [
    "---",
    "class-management: report",
    `reportTitle: ${yamlString(`상담 자료 - ${label}`)}`,
    `class: ${yamlString(className)}`,
    `dateFrom: ${yamlString(options.dateFrom)}`,
    `dateTo: ${yamlString(options.dateTo)}`,
    `studentNumber: ${yamlString(options.studentNumber)}`,
    `created: ${localDate()}`,
    "cssclasses:",
    "  - class-management-print",
    "tags:",
    "  - class-management/report",
    "---",
    "",
    `# ${label} 상담 자료`,
    "",
    `- 학급: ${className} · 기간: ${options.dateFrom || "전체"} ~ ${options.dateTo || "전체"}`,
    `- 작성일: ${localDate()} · 교사 본인 확인용 자료입니다 — 외부 공유 시 개인정보에 유의하세요.`,
    "",
    "## 출결",
    "",
    attendance.length
      ? `- 집계: ${[...attendanceCounts.entries()].map(([status, count]) => `${status} ${count}`).join(" · ")}`
      : "- 기간 내 출결 기록이 없습니다.",
    ...(attendanceExceptions.length
      ? ["", "예외 내역:", "", ...attendanceExceptions.map(line)]
      : []),
    "",
    "## 학생 기록",
    "",
    ...(records.length ? records.map(line) : ["- 기간 내 학생 기록이 없습니다."]),
    "",
    "## 과제",
    "",
    `- 기간 내 과제 확인 ${assignments.length}건 중 미제출·보완 ${assignmentExceptions.length}건`,
    ...(assignmentExceptions.length ? ["", ...assignmentExceptions.map(line)] : []),
    ...(noticeExceptions.length
      ? ["", "## 가정통신문", "", ...noticeExceptions.map(line)]
      : []),
    "",
    "## 상담 메모",
    "",
    "- 상담 안건: ",
    "- 학부모 의견: ",
    "- 학생과 약속한 것: ",
    "- 후속 확인: ",
    ""
  ].join("\n");
}

export function buildActivitiesCsv(activities: ActivityEntry[]): string {
  const header = ["date", "studentNumber", "studentName", "kind", "title", "status", "detail", "source"];
  const rows = activities.map((activity) => [
    activity.date,
    activity.studentNumber,
    activity.studentName,
    activity.kind,
    activity.title,
    activity.status,
    activity.detail,
    activity.file.path
  ]);
  return `\uFEFF${[header, ...rows].map((row) => row.map(csvCell).join(",")).join("\r\n")}\r\n`;
}

function buildStudentRows(activities: ActivityEntry[], students: StudentEntry[]): string[] {
  return students
    .map((student) => {
      const selected = activities.filter((activity) => activity.studentNumber === student.number);
      if (selected.length === 0) return "";
      return `| [[${withoutExtension(student.file.path)}\|${escapeTableCell(`${student.number}번 ${student.name}`)}]] | ${count(selected, "record")} | ${selected.filter((item) => item.kind === "attendance" && item.status !== "출석").length} | ${selected.filter((item) => item.kind === "assignment" && item.status !== "제출").length} | ${selected.filter((item) => item.kind === "notice" && item.status !== "회신 완료").length} |`;
    })
    .filter(Boolean);
}

function evidenceBullet(activity: ActivityEntry): string {
  const student = activity.studentNumber
    ? `${activity.studentNumber}번 ${activity.studentName} · `
    : "";
  const description = [activity.status, activity.detail || activity.title]
    .filter(Boolean).join(" · ");
  return `- ${activity.date} · ${student}${ACTIVITY_KIND_LABELS[activity.kind]} · ${escapeTableCell(description)} ([[${withoutExtension(activity.file.path)}|원본]])`;
}

function isException(activity: ActivityEntry): boolean {
  if (activity.kind === "attendance") return activity.status !== "출석";
  if (activity.kind === "assignment") return activity.status !== "제출";
  if (activity.kind === "notice") return activity.status !== "회신 완료";
  if (activity.kind === "task") return activity.status !== "done";
  if (activity.kind === "routine") return activity.status !== "완료";
  return false;
}

function count(activities: ActivityEntry[], kind: ActivityKind): number {
  return activities.filter((activity) => activity.kind === kind).length;
}

function buildTrendSummary(
  activities: ActivityEntry[],
  dateFrom: string,
  dateTo: string
): string[] {
  const from = new Date(`${dateFrom}T00:00:00`).getTime();
  const to = new Date(`${dateTo}T23:59:59`).getTime();
  if (!dateFrom || !dateTo || !Number.isFinite(from) || !Number.isFinite(to) || from > to) {
    return ["- 시작일과 종료일을 지정하면 기간 전반·후반의 건수를 비교합니다."];
  }
  const midpoint = from + (to - from) / 2;
  const early = activities.filter((activity) => new Date(`${activity.date}T12:00:00`).getTime() <= midpoint);
  const late = activities.filter((activity) => new Date(`${activity.date}T12:00:00`).getTime() > midpoint);
  return [
    `- 학생 기록: 기간 전반 ${count(early, "record")}건 → 후반 ${count(late, "record")}건`,
    `- 출결·과제·회신 예외: 기간 전반 ${early.filter(isException).length}건 → 후반 ${late.filter(isException).length}건`,
    "- 건수 변화는 경향을 확정하지 않습니다. 원본 근거와 학급 일정 맥락을 함께 확인하세요."
  ];
}

function withoutExtension(path: string): string {
  return path.replace(/\.md$/i, "");
}

