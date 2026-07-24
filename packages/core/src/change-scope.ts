/**
 * 부분 갱신 2단계(§7) — 볼트 변경 경로를 영향 범주로 분류한다.
 * 폴더 규약은 저장소가 ManagedFolders로 넘겨주고, 이 모듈은 순수 판정만 한다.
 * 뷰 레지스트리(main)의 dependsOn과 활동 색인 무효화가 이 범주를 소비한다.
 */

export type VaultChangeCategory =
  | "student"
  | "record"
  | "attendance"
  | "assignment"
  | "task"
  | "notice"
  | "routine"
  | "calendar-hours"
  | "timetable"
  | "progress"
  | "curriculum-unit"
  | "curriculum-lesson"
  | "school-event"
  | "achievement-standard"
  | "weekly-plan"
  | "bases"
  | "backup"
  | "other";

/** 저장소 폴더 규약 스냅숏 — 모든 값은 볼트 루트 기준 경로. */
export interface ManagedFolders {
  base: string;
  students: string;
  records: string;
  attendance: string;
  assignments: string;
  tasks: string;
  notices: string;
  routines: string;
  academicCalendar: string;
  timetable: string;
  progress: string;
  curriculumUnits: string;
  curriculumLessons: string;
  events: string;
  standards: string;
  weeklyPlan: string;
  bases: string;
  backups: string;
}

const CATEGORY_BY_FOLDER: ReadonlyArray<[keyof Omit<ManagedFolders, "base">, VaultChangeCategory]> = [
  ["students", "student"],
  ["records", "record"],
  ["attendance", "attendance"],
  ["assignments", "assignment"],
  ["tasks", "task"],
  ["notices", "notice"],
  ["routines", "routine"],
  // 학사일정 폴더에는 학사일정·기준 시수 노트가 함께 산다 — 한 범주로 묶는다.
  ["academicCalendar", "calendar-hours"],
  ["timetable", "timetable"],
  ["progress", "progress"],
  ["curriculumUnits", "curriculum-unit"],
  ["curriculumLessons", "curriculum-lesson"],
  ["events", "school-event"],
  ["standards", "achievement-standard"],
  ["weeklyPlan", "weekly-plan"],
  ["bases", "bases"],
  ["backups", "backup"]
];

/** 기본 폴더 밖이면 null(무시), 안이지만 알려진 하위 폴더가 아니면 "other"(광역 뷰만 갱신). */
export function classifyVaultPath(
  path: string,
  folders: ManagedFolders
): VaultChangeCategory | null {
  const within = (folder: string): boolean =>
    path === folder || path.startsWith(`${folder}/`);
  if (!within(folders.base)) return null;
  for (const [key, category] of CATEGORY_BY_FOLDER) {
    if (within(folders[key])) return category;
  }
  return "other";
}

/** 활동 색인이 읽는 범주 — 이 밖의 변경은 색인을 무효화하지 않는다. */
export const ACTIVITY_INDEX_CATEGORIES: ReadonlyArray<VaultChangeCategory> = [
  "record",
  "attendance",
  "assignment",
  "task",
  "notice",
  "routine",
  "curriculum-lesson"
];
