import { addDays } from "./academic-calendar";

/**
 * 학급 운영 할 일 자동 수집 — skills/task-scan의 규칙표 7종을 플러그인 단독 경로로 내장한 것.
 * sourceKey 규약이 스킬과 동일해 어느 쪽이 먼저 수집해도 중복 생성되지 않는다.
 * 판단·평가는 하지 않는다: 규칙 밖 항목은 만들지 않고, 학생 이름·기록 내용은 제목에 넣지 않는다.
 */

export interface TaskScanInputs {
  /** 오늘 (로컬 날짜, YYYY-MM-DD). */
  today: string;
  /** 규칙 1 — 과제(수행평가): 과제일이 오늘~D+7이면 준비 할 일. */
  assignments: Array<{ fileName: string; title: string; date: string }>;
  /** 규칙 2 — 프로젝트(통합 단원): startDate가 오늘~D+7이면 시작 준비. */
  projects: Array<{ fileName: string; title: string; startDate: string }>;
  /** 규칙 3 — 학사일정 행사: 오늘~D+3이면 준비. */
  events: Array<{ date: string; name: string }>;
  /** 규칙 4 — 가정통신문: 회신 마감이 오늘~D+2이고 미회신이 있으면 확인. */
  notices: Array<{ fileName: string; title: string; dueDate: string; pendingCount: number }>;
  /** 규칙 5 — 시수 점검에서 상태가 적정(ok)이 아닌 과목 행. */
  hoursIssues: Array<{ subject: string; statusLabel: string }>;
  /** 규칙 6 — 운영 중이거나 2주 내 시작하는 단원의 설계 error 이슈(첫 메시지). */
  designIssues: Array<{ fileName: string; title: string; startDate: string; firstError: string }>;
  /** 규칙 7 — 마지막 백업 날짜(YYYY-MM-DD, 없으면 null). */
  lastBackupDate: string | null;
  /** 멱등 게이트 — 볼트의 기존 할 일 sourceKey 전부(완료 포함). */
  existingSourceKeys: ReadonlySet<string>;
}

export interface ScannedTask {
  title: string;
  dueDate: string;
  project: string;
  context: string;
  sourceKey: string;
  detail: string;
}

/** 전 규칙 합계 상한 — 넘으면 due 가까운 순으로 자른다 (스킬 규약). */
const SCAN_LIMIT = 12;
/** 규칙 6(설계 보완)은 상위 3건까지만 — 소음 방지 (스킬 규약). */
const DESIGN_LIMIT = 3;

/** ISO 8601 주차 문자열 (예: 2026-W30) — 주 단위로 다시 알리는 규칙(시수·백업)의 키 재료. */
export function isoWeekOf(date: string): string {
  const value = new Date(`${date}T00:00:00`);
  // ISO 주차: 그 주의 목요일이 속한 해가 주차의 해다.
  const thursday = new Date(value);
  thursday.setDate(value.getDate() + 3 - ((value.getDay() + 6) % 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  const week = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${thursday.getFullYear()}-W${String(week).padStart(2, "0")}`;
}

function inWindow(date: string, today: string, days: number): boolean {
  return date >= today && date <= addDays(today, days);
}

export function scanOperationalTasks(inputs: TaskScanInputs): ScannedTask[] {
  const { today } = inputs;
  const week = isoWeekOf(today);
  const found: ScannedTask[] = [];

  for (const assignment of inputs.assignments) {
    if (!assignment.date || !inWindow(assignment.date, today, 7)) continue;
    found.push({
      title: `◆ ${assignment.title} 평가 준비 — 루브릭·평가지 확인`,
      dueDate: assignment.date,
      project: "교육과정 일체화",
      context: "평가",
      sourceKey: `assignment:${assignment.fileName}`,
      detail: `출처: ${assignment.date} ${assignment.title} 과제 노트`
    });
  }

  for (const unit of inputs.projects) {
    if (!unit.startDate || !inWindow(unit.startDate, today, 7)) continue;
    found.push({
      title: `✦ ${unit.title} 시작 준비 — 전개·준비물 점검`,
      dueDate: unit.startDate,
      project: "교육과정 일체화",
      context: "수업 준비",
      sourceKey: `project-start:${unit.fileName}`,
      detail: `출처: ${unit.startDate} 시작 ${unit.title} 단원 노트`
    });
  }

  for (const event of inputs.events) {
    if (!event.date || !inWindow(event.date, today, 3)) continue;
    found.push({
      title: `행사 준비: ${event.name}`,
      dueDate: event.date,
      project: "학급 운영",
      context: "행정",
      sourceKey: `event:${event.date}:${event.name}`,
      detail: `출처: 학사일정 ${event.date} ${event.name}`
    });
  }

  for (const notice of inputs.notices) {
    if (!notice.dueDate || notice.pendingCount <= 0) continue;
    if (!inWindow(notice.dueDate, today, 2)) continue;
    found.push({
      title: `${notice.title} 미회신 ${notice.pendingCount}명 확인`,
      dueDate: notice.dueDate,
      project: "학급 운영",
      context: "소통",
      sourceKey: `notice:${notice.fileName}:${notice.dueDate}`,
      detail: `출처: ${notice.title} 회신표 (마감 ${notice.dueDate})`
    });
  }

  for (const issue of inputs.hoursIssues) {
    found.push({
      title: `${issue.subject} 시수 ${issue.statusLabel} 확인 — 시수 점검 표`,
      dueDate: "",
      project: "교육과정 일체화",
      context: "계획",
      sourceKey: `hours:${issue.subject}:${week}`,
      detail: "출처: 시간표·시수 뷰의 시수 점검"
    });
  }

  for (const design of inputs.designIssues.slice(0, DESIGN_LIMIT)) {
    found.push({
      title: `${design.title} 설계 보완: ${design.firstError}`,
      dueDate: design.startDate,
      project: "교육과정 일체화",
      context: "계획",
      sourceKey: `design:${design.fileName}`,
      detail: `출처: ${design.title} 단원 설계 점검`
    });
  }

  const backupOverdue =
    !inputs.lastBackupDate || inputs.lastBackupDate <= addDays(today, -30);
  if (backupOverdue) {
    found.push({
      title: "수동 백업 실행 — 백업·유지관리",
      dueDate: "",
      project: "학급 운영",
      context: "유지관리",
      sourceKey: `backup:${week}`,
      detail: inputs.lastBackupDate
        ? `출처: 마지막 백업 ${inputs.lastBackupDate} (30일 경과)`
        : "출처: 백업 기록 없음"
    });
  }

  return found
    .filter((task) => !inputs.existingSourceKeys.has(task.sourceKey))
    .sort((a, b) => (a.dueDate || "9999").localeCompare(b.dueDate || "9999"))
    .slice(0, SCAN_LIMIT);
}
