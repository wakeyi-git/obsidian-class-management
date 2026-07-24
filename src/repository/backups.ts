import { TFile, TFolder, type App } from "obsidian";
import type { ClassManagementSettings } from "@core/types";

/**
 * 백업·복구 IO — ClassRepository의 하위 모듈 (repository 분해 1단계).
 * 볼트 IO 단일 창구 원칙은 유지된다: 이 모듈은 ClassRepository 파사드를 통해서만 쓰인다.
 */

export interface MaintenanceResult {
  backupPath: string;
  processed: number;
}

export interface BackupDeps {
  app: App;
  getSettings(): ClassManagementSettings;
  vaultPath(...segments: string[]): string;
  ensureFolder(path: string): Promise<void>;
  baseFolderPath(): string;
  backupsFolderPath(): string;
}

/** 관리 폴더 전체를 볼트 안 백업 폴더로 복제한다. */
export async function createManagedBackup(deps: BackupDeps): Promise<MaintenanceResult> {
  const settings = deps.getSettings();
  const stamp = backupStamp(new Date());
  const backupPath = deps.vaultPath(deps.backupsFolderPath(), stamp);
  await deps.ensureFolder(backupPath);
  const prefix = `${deps.baseFolderPath()}/`;
  const backupPrefix = `${deps.backupsFolderPath()}/`;
  const files = deps.app.vault.getFiles().filter((file) =>
    file.path.startsWith(prefix) && !file.path.startsWith(backupPrefix)
  );
  let processed = 0;
  for (const file of files) {
    const relative = file.path.slice(prefix.length);
    const target = deps.vaultPath(backupPath, relative);
    await ensureParentFolder(deps, target);
    const data = await deps.app.vault.readBinary(file);
    await deps.app.vault.createBinary(target, data);
    processed += 1;
  }
  await deps.app.vault.create(deps.vaultPath(backupPath, "백업 정보.md"), [
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
    `- 원본 기본 폴더: ${deps.baseFolderPath()}`,
    `- 파일 수: ${processed}`,
    "- 이 백업은 Classroom Manager 유지관리 화면에서 누락 파일 복구에 사용할 수 있습니다.",
    ""
  ].join("\n"));
  return { backupPath, processed };
}

/**
 * 대량 쓰기 전 자동 스냅숏 (UIUX §5) — 다시 쓸 노트만 백업 폴더 규격으로 복사한다.
 * 백업 목록·누락 복구 뷰가 그대로 재사용한다(폴더명 접미사 "자동"으로 구분).
 */
export async function createTargetedSnapshot(
  deps: BackupDeps,
  files: TFile[],
  trigger: string
): Promise<MaintenanceResult> {
  const settings = deps.getSettings();
  const stamp = backupStamp(new Date());
  let backupPath = deps.vaultPath(deps.backupsFolderPath(), `${stamp} 자동`);
  let suffix = 2;
  while (deps.app.vault.getAbstractFileByPath(backupPath)) {
    backupPath = deps.vaultPath(deps.backupsFolderPath(), `${stamp} 자동-${suffix}`);
    suffix += 1;
  }
  await deps.ensureFolder(backupPath);
  const prefix = `${deps.baseFolderPath()}/`;
  let processed = 0;
  for (const file of files) {
    if (!file.path.startsWith(prefix)) continue;
    const relative = file.path.slice(prefix.length);
    const target = deps.vaultPath(backupPath, relative);
    await ensureParentFolder(deps, target);
    const data = await deps.app.vault.readBinary(file);
    await deps.app.vault.createBinary(target, data);
    processed += 1;
  }
  await deps.app.vault.create(deps.vaultPath(backupPath, "백업 정보.md"), [
    "---",
    "class-management: backup",
    `schemaVersion: ${settings.schemaVersion}`,
    `class: ${JSON.stringify(settings.className)}`,
    `created: ${JSON.stringify(new Date().toISOString())}`,
    `files: ${processed}`,
    `trigger: ${JSON.stringify(trigger)}`,
    "---",
    "",
    `# ${settings.className} 자동 스냅숏`,
    "",
    `- 계기: ${trigger} (대량 변경 전 자동 백업)`,
    `- 파일 수: ${processed}`,
    "- 유지관리 화면의 누락 파일 복구·수동 확인에 사용할 수 있습니다.",
    ""
  ].join("\n"));
  return { backupPath, processed };
}

export function listManagedBackups(deps: BackupDeps): TFolder[] {
  const root = deps.app.vault.getAbstractFileByPath(deps.backupsFolderPath());
  if (!(root instanceof TFolder)) return [];
  return root.children
    .filter((entry): entry is TFolder => entry instanceof TFolder)
    .sort((a, b) => b.name.localeCompare(a.name));
}

/** 백업에서 현재 볼트에 없는 파일만 복원한다 — 있는 파일은 건드리지 않는다. */
export async function restoreMissingFromBackup(deps: BackupDeps, backup: TFolder): Promise<number> {
  const backupPrefix = `${backup.path}/`;
  const files = collectBackupFiles(backup).filter((file) => file.name !== "백업 정보.md");
  let restored = 0;
  for (const file of files) {
    const relative = file.path.slice(backupPrefix.length);
    const target = deps.vaultPath(deps.baseFolderPath(), relative);
    if (deps.app.vault.getAbstractFileByPath(target)) continue;
    await ensureParentFolder(deps, target);
    await deps.app.vault.createBinary(target, await deps.app.vault.readBinary(file));
    restored += 1;
  }
  return restored;
}

/** 경로 목록을 옵시디언 휴지통으로 옮긴다(복구 가능). 이동한 개수를 돌려준다. */
export async function trashFilesByPath(app: App, paths: Iterable<string>): Promise<number> {
  let moved = 0;
  for (const path of paths) {
    const file = app.vault.getAbstractFileByPath(path);
    if (file instanceof TFile) {
      await app.fileManager.trashFile(file);
      moved += 1;
    }
  }
  return moved;
}

async function ensureParentFolder(deps: BackupDeps, filePath: string): Promise<void> {
  const parent = filePath.split("/").slice(0, -1).join("/");
  if (parent) await deps.ensureFolder(parent);
}

function collectBackupFiles(folder: TFolder): TFile[] {
  return folder.children.flatMap((entry) =>
    entry instanceof TFile ? [entry] : entry instanceof TFolder ? collectBackupFiles(entry) : []
  );
}

function backupStamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}
