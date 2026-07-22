import type { ActivityEntry, ActivityKind, ActivityListFilters } from "./types";

export const ACTIVITY_KIND_LABELS: Record<ActivityKind, string> = {
  record: "학생 기록",
  attendance: "출결",
  assignment: "과제",
  task: "할 일",
  notice: "가정통신문",
  routine: "루틴",
  curriculum: "수업일지"
};

export const EMPTY_ACTIVITY_FILTERS: ActivityListFilters = {
  query: "",
  studentNumber: "",
  kind: "",
  status: "",
  dateFrom: "",
  dateTo: ""
};

export function filterActivities(
  activities: ActivityEntry[],
  filters: ActivityListFilters
): ActivityEntry[] {
  const query = normalizeSearch(filters.query);

  return activities.filter((activity) => {
    if (filters.studentNumber && activity.studentNumber !== filters.studentNumber) {
      return false;
    }
    if (filters.kind && activity.kind !== filters.kind) return false;
    if (filters.status === "__attendance-exception__") {
      if (activity.kind !== "attendance" || activity.status === "출석") return false;
    } else if (filters.status && activity.status !== filters.status) return false;
    if (filters.dateFrom && activity.date < filters.dateFrom) return false;
    if (filters.dateTo && activity.date > filters.dateTo) return false;
    if (query && !normalizeSearch(activity.searchText).includes(query)) return false;
    return true;
  });
}

export function uniqueActivityStatuses(
  activities: ActivityEntry[],
  kind: "" | ActivityKind
): string[] {
  return Array.from(
    new Set(
      activities
        .filter((activity) => !kind || activity.kind === kind)
        .map((activity) => activity.status)
        .filter(Boolean)
    )
  ).sort((a, b) => a.localeCompare(b, "ko"));
}

export function normalizeSearch(value: string): string {
  return value.toLocaleLowerCase("ko").replace(/\s+/g, " ").trim();
}
