import type { App } from "obsidian";
import type { ClassRepository } from "./class-repository";
import type { ActivityEntry, ClassProfile, CurriculumUnit, StudentEntry } from "@core/types";
import { validateSchoolRecordEvidence } from "@core/school-record-evidence";
import { auditConceptInquiryDesign, auditCurriculumAlignment } from "@core/curriculum";
import { csvCell, escapeTableCell } from "@core/utils";

export type DiagnosticLevel = "error" | "warning" | "info";

export interface DiagnosticIssue {
  level: DiagnosticLevel;
  code: string;
  message: string;
  source?: string;
}

export function buildFullExportCsv(
  profile: ClassProfile,
  students: StudentEntry[],
  activities: ActivityEntry[],
  curriculumUnits: CurriculumUnit[] = []
): string {
  const header = [
    "rowType", "class", "schoolYear", "semester", "grade", "curriculum", "guidelineYear", "studentNumber", "studentName",
    "studentStatus", "date", "kind", "title", "status", "detail", "schoolRecordArea",
    "schoolRecordSubarea", "evidenceType", "directObservation", "subject",
    "achievementStandard", "conceptualUnderstanding", "inquiryProcess",
    "studentTransferEvidence", "reviewStatus", "curriculumUnitId", "curriculumUnitTitle",
    "curriculumLessonId", "source"
  ];
  const studentRows = students.map((student) => [
    "student", profile.name, profile.schoolYear, profile.semester, profile.grade,
    profile.curriculum, profile.schoolRecordGuidelineYear, student.number,
    student.name, student.status, "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", "", student.file.path
  ]);
  const activityRows = activities.map((activity) => {
    const evidence = activity.schoolRecordEvidence;
    return [
      "activity", profile.name, profile.schoolYear, profile.semester, profile.grade,
      profile.curriculum, profile.schoolRecordGuidelineYear,
      activity.studentNumber, activity.studentName, "", activity.date, activity.kind,
      activity.title, activity.status, activity.detail, evidence?.area ?? "",
      evidence?.subarea ?? "", evidence?.evidenceType ?? "",
      evidence ? String(evidence.directObservation) : "", evidence?.subject ?? "",
      evidence?.achievementStandard ?? "", evidence?.conceptualUnderstanding ?? "",
      evidence?.inquiryProcess ?? "", evidence?.studentTransferEvidence ?? "",
      evidence?.reviewStatus ?? "",
      evidence?.curriculumUnitId ?? "", evidence?.curriculumUnitTitle ?? "",
      evidence?.curriculumLessonId ?? "", activity.file.path
    ];
  });
  const curriculumRows = curriculumUnits.map((unit) => [
    "curriculum-unit", profile.name, profile.schoolYear, unit.semester, unit.grade,
    profile.curriculum, profile.schoolRecordGuidelineYear, "", "", "",
    unit.startDate, "curriculum", unit.unitName, unit.status, unit.theme,
    "", "", "", "", unit.subject, unit.achievementStandards, "", "", "", "",
    unit.id, unit.unitName, "", unit.file.path
  ]);
  return `\uFEFF${[header, ...studentRows, ...curriculumRows, ...activityRows]
    .map((row) => row.map(csvCell).join(","))
    .join("\r\n")}\r\n`;
}

export async function runDataDiagnostics(
  app: App,
  repository: ClassRepository,
  activities: ActivityEntry[]
): Promise<DiagnosticIssue[]> {
  const issues: DiagnosticIssue[] = [];
  const students = repository.getStudents(true);
  const numberGroups = new Map<string, StudentEntry[]>();
  students.forEach((student) => {
    const group = numberGroups.get(student.number) ?? [];
    group.push(student);
    numberGroups.set(student.number, group);
  });
  numberGroups.forEach((group, number) => {
    if (group.length > 1) {
      issues.push({
        level: "error",
        code: "duplicate-student-number",
        message: `${number}번 학생 노트가 ${group.length}개입니다.`,
        source: group.map((student) => student.file.path).join(", ")
      });
    }
  });

  const knownNumbers = new Set(students.map((student) => student.number));
  const orphaned = activities.filter(
    (activity) => activity.studentNumber && !knownNumbers.has(activity.studentNumber)
  );
  orphaned.slice(0, 100).forEach((activity) => issues.push({
    level: "warning",
    code: "unknown-student",
    message: `${activity.studentNumber}번 ${activity.studentName} 활동이 현재 명단과 연결되지 않습니다.`,
    source: activity.file.path
  }));

  repository.getRecords().forEach((record) => {
    const frontmatter = app.metadataCache.getFileCache(record.file)?.frontmatter;
    const raw = String(frontmatter?.studentPath ?? "");
    const link = raw.match(/^\[\[([^\]|]+)(?:\|[^\]]+)?\]\]$/)?.[1]?.trim();
    if (!link) {
      issues.push({
        level: "warning",
        code: "missing-student-link",
        message: "학생 기록의 studentPath가 위키링크가 아닙니다.",
        source: record.file.path
      });
      return;
    }
    const path = link.endsWith(".md") ? link : `${link}.md`;
    if (!app.vault.getAbstractFileByPath(path)) {
      issues.push({
        level: "error",
        code: "broken-student-link",
        message: `연결된 학생 노트를 찾을 수 없습니다: ${raw}`,
        source: record.file.path
      });
    }
    if (record.schoolRecordEvidence) {
      validateSchoolRecordEvidence(record.schoolRecordEvidence).forEach((validation) => {
        issues.push({
          level: validation.severity === "error" ? "error" : "warning",
          code: `school-record-${validation.code}`,
          message: validation.message,
          source: record.file.path
        });
      });
    }
  });

  const unitIds = new Set(repository.getCurriculumUnits().map((unit) => unit.id));
  repository.getRecords().forEach((record) => {
    const linkedId = record.schoolRecordEvidence?.curriculumUnitId;
    if (linkedId && !unitIds.has(linkedId)) issues.push({
      level: "error",
      code: "broken-record-curriculum-link",
      message: `학생 근거가 존재하지 않는 통합 단원 ID를 가리킵니다: ${linkedId}`,
      source: record.file.path
    });
  });
  repository.getCurriculumUnits().forEach((unit) => {
    [...auditCurriculumAlignment(unit).issues, ...auditConceptInquiryDesign(unit).issues].forEach((audit) => issues.push({
      level: audit.severity === "error" ? "error" : "warning",
      code: `curriculum-${audit.stage}`,
      message: audit.message,
      source: unit.file.path
    }));
  });
  repository.getCurriculumLessons().forEach((lesson) => {
    if (!unitIds.has(lesson.unitId)) issues.push({
      level: "error",
      code: "broken-curriculum-unit-link",
      message: `수업일지가 존재하지 않는 단원 ID를 가리킵니다: ${lesson.unitId}`,
      source: lesson.file.path
    });
  });

  [
    repository.studentsFolderPath,
    repository.recordsFolderPath,
    repository.attendanceFolderPath,
    repository.assignmentsFolderPath,
    repository.tasksFolderPath,
    repository.noticesFolderPath,
    repository.routinesFolderPath,
    repository.curriculumFolderPath
  ].forEach((path) => {
    if (!app.vault.getAbstractFileByPath(path)) issues.push({
      level: "error",
      code: "missing-folder",
      message: `필수 폴더가 없습니다: ${path}`
    });
  });

  if (issues.length === 0) {
    issues.push({
      level: "info",
      code: "healthy",
      message: "중복 학생, 연결 오류, 필수 폴더 누락을 찾지 못했습니다."
    });
  }
  return issues;
}

export function buildDiagnosticMarkdown(
  profile: ClassProfile,
  issues: DiagnosticIssue[]
): string {
  return [
    "---",
    "class-management: diagnostics",
    `class: ${JSON.stringify(profile.name)}`,
    `schoolYear: ${JSON.stringify(profile.schoolYear)}`,
    `semester: ${JSON.stringify(profile.semester)}`,
    `grade: ${JSON.stringify(profile.grade)}`,
    `curriculum: ${JSON.stringify(profile.curriculum)}`,
    `schoolRecordGuidelineYear: ${JSON.stringify(profile.schoolRecordGuidelineYear)}`,
    "---",
    "",
    `# ${profile.name} 데이터 진단`,
    "",
    `- 오류: ${issues.filter((issue) => issue.level === "error").length}건`,
    `- 경고: ${issues.filter((issue) => issue.level === "warning").length}건`,
    "",
    "| 수준 | 코드 | 내용 | 원본 |",
    "| --- | --- | --- | --- |",
    ...issues.map((issue) =>
      `| ${levelLabel(issue.level)} | ${escapeTableCell(issue.code)} | ${escapeTableCell(issue.message)} | ${escapeTableCell(issue.source ?? "")} |`
    ),
    ""
  ].join("\n");
}

function levelLabel(level: DiagnosticLevel): string {
  return level === "error" ? "오류" : level === "warning" ? "경고" : "정보";
}

