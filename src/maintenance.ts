import { App, TFile, TFolder } from "obsidian";
import type { ClassRepository } from "./class-repository";
import { isLegacyAttendanceContent, isWikiLinkStudentPath } from "./migration";
import type { ClassManagementSettings } from "./types";

export interface MigrationPreview {
  legacyAttendance: TFile[];
  legacyStudentPaths: TFile[];
}

export interface MaintenanceResult {
  backupPath: string;
  processed: number;
}

export async function createManagedBackup(
  app: App,
  repository: ClassRepository,
  settings: ClassManagementSettings
): Promise<MaintenanceResult> {
  const stamp = backupStamp(new Date());
  const backupPath = joinPath(repository.backupsFolderPath, stamp);
  await ensureFolder(app, backupPath);
  const prefix = `${repository.baseFolderPath}/`;
  const backupPrefix = `${repository.backupsFolderPath}/`;
  const files = app.vault.getFiles().filter((file) =>
    file.path.startsWith(prefix) && !file.path.startsWith(backupPrefix)
  );
  let processed = 0;
  for (const file of files) {
    const relative = file.path.slice(prefix.length);
    const target = joinPath(backupPath, relative);
    await ensureFolder(app, target.split("/").slice(0, -1).join("/"));
    const data = await app.vault.readBinary(file);
    await app.vault.createBinary(target, data);
    processed += 1;
  }
  const manifestPath = joinPath(backupPath, "백업 정보.md");
  await app.vault.create(manifestPath, [
    "---",
    "class-management: backup",
    `schemaVersion: ${settings.schemaVersion}`,
    `class: ${JSON.stringify(settings.className)}`,
    `created: ${JSON.stringify(new Date().toISOString())}`,
    `files: ${processed}`,
    "---",
    "",
    `# ${settings.className} 백업`,
    "",
    `- 원본 기본 폴더: ${repository.baseFolderPath}`,
    `- 파일 수: ${processed}`,
    "- 이 백업은 Classroom Manager 유지관리 화면에서 누락 파일 복구에 사용할 수 있습니다.",
    ""
  ].join("\n"));
  return { backupPath, processed };
}

export function listManagedBackups(app: App, repository: ClassRepository): TFolder[] {
  const root = app.vault.getAbstractFileByPath(repository.backupsFolderPath);
  if (!(root instanceof TFolder)) return [];
  return root.children
    .filter((entry): entry is TFolder => entry instanceof TFolder)
    .sort((a, b) => b.name.localeCompare(a.name));
}

export async function restoreMissingFromBackup(
  app: App,
  repository: ClassRepository,
  backup: TFolder
): Promise<number> {
  const backupPrefix = `${backup.path}/`;
  const files = collectFiles(backup).filter((file) => file.name !== "백업 정보.md");
  let restored = 0;
  for (const file of files) {
    const relative = file.path.slice(backupPrefix.length);
    const target = joinPath(repository.baseFolderPath, relative);
    if (app.vault.getAbstractFileByPath(target)) continue;
    await ensureFolder(app, target.split("/").slice(0, -1).join("/"));
    await app.vault.createBinary(target, await app.vault.readBinary(file));
    restored += 1;
  }
  return restored;
}

export async function previewMigrations(
  app: App,
  repository: ClassRepository
): Promise<MigrationPreview> {
  const legacyAttendance: TFile[] = [];
  for (const summary of repository.getAttendanceSummaries()) {
    const content = await app.vault.cachedRead(summary.file);
    if (isLegacyAttendanceContent(content)) legacyAttendance.push(summary.file);
  }
  const legacyStudentPaths = repository.getRecords()
    .filter((record) => {
      const path = String(
        app.metadataCache.getFileCache(record.file)?.frontmatter?.studentPath ?? ""
      );
      return !isWikiLinkStudentPath(path);
    })
    .map((record) => record.file);
  return { legacyAttendance, legacyStudentPaths };
}

export async function migrateLegacyNotes(
  app: App,
  repository: ClassRepository,
  settings: ClassManagementSettings
): Promise<MaintenanceResult> {
  const preview = await previewMigrations(app, repository);
  const backup = await createManagedBackup(app, repository, settings);
  for (const file of preview.legacyAttendance) {
    const date = repository.getAttendanceSummaries().find((item) => item.file.path === file.path)?.date;
    if (!date) continue;
    const marks = repository.parseAttendanceContent(await app.vault.cachedRead(file));
    await repository.saveAttendance(date, marks);
  }
  const students = repository.getStudents(true);
  for (const file of preview.legacyStudentPaths) {
    const frontmatter = app.metadataCache.getFileCache(file)?.frontmatter;
    const number = String(frontmatter?.studentNumber ?? "");
    const student = students.find((entry) => entry.number === number);
    if (!student) continue;
    await app.fileManager.processFrontMatter(file, (values) => {
      values.studentPath = `[[${student.file.path.replace(/\.md$/i, "")}]]`;
    });
  }
  return {
    backupPath: backup.backupPath,
    processed: preview.legacyAttendance.length + preview.legacyStudentPaths.length
  };
}

function collectFiles(folder: TFolder): TFile[] {
  return folder.children.flatMap((entry) =>
    entry instanceof TFile ? [entry] : entry instanceof TFolder ? collectFiles(entry) : []
  );
}

async function ensureFolder(app: App, path: string): Promise<void> {
  if (!path) return;
  const parts = path.split("/").filter(Boolean);
  let current = "";
  for (const part of parts) {
    current = joinPath(current, part);
    if (!app.vault.getAbstractFileByPath(current)) await app.vault.createFolder(current);
  }
}

function joinPath(...parts: string[]): string {
  return parts.join("/").replace(/\\/g, "/").replace(/\/{2,}/g, "/").replace(/^\/|\/$/g, "");
}

function backupStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
