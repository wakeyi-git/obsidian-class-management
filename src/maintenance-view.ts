import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { scaffoldView } from "./dom";
import type { MigrationPreview } from "./class-repository";
import type ClassManagementPlugin from "./main";

export const MAINTENANCE_VIEW_TYPE = "class-management-maintenance-view";

export class MaintenanceView extends ItemView {
  private migration?: MigrationPreview;
  private busy = false;

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return MAINTENANCE_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "백업·복구·마이그레이션";
  }

  getIcon(): string {
    return "shield-check";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.contentEl.empty();
    this.contentEl.createEl("p", { text: "유지관리 상태를 확인하고 있습니다…" });
    this.migration = await this.plugin.repository.previewMigrations();
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    const { body } = scaffoldView(this.contentEl, {
      cls: "class-management-maintenance-view",
      title: "백업·복구·마이그레이션",
      description: "관리 폴더를 Vault 안에 복제하고, 누락 파일만 복원하며, 레거시 형식을 안전하게 정규화합니다."
    });

    const grid = body.createDiv({ cls: "class-management-maintenance-grid" });
    this.renderBackup(grid);
    this.renderRecovery(grid);
    this.renderMigration(grid);
    this.renderOperationalChecks(grid);
  }

  private renderBackup(container: HTMLElement): void {
    const backups = this.plugin.repository.listManagedBackups();
    const panel = container.createDiv({ cls: "class-management-panel" });
    panel.createEl("h3", { text: "수동 백업" });
    panel.createEl("p", {
      text: `현재 학급 관리 파일을 ${this.plugin.repository.backupsFolderPath}/ 아래에 시간별 사본으로 보존합니다.`
    });
    panel.createEl("p", { text: `사용 가능한 백업 ${backups.length}개` });
    const create = panel.createEl("button", { text: "지금 백업 만들기", cls: "mod-cta" });
    create.disabled = this.busy;
    create.addEventListener("click", () => void this.createBackup());
  }

  private renderRecovery(container: HTMLElement): void {
    const backups = this.plugin.repository.listManagedBackups();
    const latest = backups[0];
    const panel = container.createDiv({ cls: "class-management-panel" });
    panel.createEl("h3", { text: "누락 파일 복구" });
    panel.createEl("p", {
      text: "가장 최근 백업에서 현재 기본 폴더에 없는 파일만 복구합니다. 같은 경로의 기존 파일은 절대 덮어쓰지 않습니다."
    });
    panel.createEl("p", { text: latest ? `최근 백업: ${latest.name}` : "사용 가능한 백업 없음" });
    const restore = panel.createEl("button", { text: "최근 백업에서 누락 파일 복구" });
    restore.disabled = !latest || this.busy;
    restore.addEventListener("click", () => latest && void this.restore(latest));
  }

  private renderMigration(container: HTMLElement): void {
    const attendance = this.migration?.legacyAttendance.length ?? 0;
    const studentPaths = this.migration?.legacyStudentPaths.length ?? 0;
    const panel = container.createDiv({ cls: "class-management-panel" });
    panel.createEl("h3", { text: "데이터 형식 마이그레이션" });
    panel.createEl("p", {
      text: `레거시 출결 ${attendance}개 · 위키링크가 아닌 studentPath ${studentPaths}개`
    });
    panel.createEl("p", {
      text: "실행 시 먼저 전체 관리 폴더 백업을 만든 뒤 출결을 4열 표로, studentPath를 [[위키링크]]로 정규화합니다.",
      cls: "setting-item-description"
    });
    const migrate = panel.createEl("button", { text: "백업 후 마이그레이션" });
    migrate.disabled = attendance + studentPaths === 0 || this.busy || this.plugin.activeClassProfile.archived;
    migrate.addEventListener("click", () => void this.migrate());
  }

  private renderOperationalChecks(container: HTMLElement): void {
    const panel = container.createDiv({ cls: "class-management-panel" });
    panel.createEl("h3", { text: "운영 안정성" });
    const checks = [
      "활동 색인은 메모리 캐시와 변경 이벤트 디바운스를 사용합니다.",
      "대용량 원본 읽기는 제한된 동시성으로 처리합니다.",
      "통합 목록은 점진적으로 행을 표시합니다.",
      "모든 핵심 버튼은 텍스트 또는 aria-label을 제공합니다.",
      "모바일에서는 단일 열 레이아웃과 가로 스크롤 표를 사용합니다."
    ];
    const list = panel.createEl("ul");
    checks.forEach((check) => list.createEl("li", { text: check }));
  }

  private async createBackup(): Promise<void> {
    this.busy = true;
    this.render();
    try {
      const result = await this.plugin.repository.createManagedBackup();
      new Notice(`백업 완료 · ${result.processed}개 파일 · ${result.backupPath}`);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "백업을 만들지 못했습니다.");
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  private async restore(backup: import("obsidian").TFolder): Promise<void> {
    this.busy = true;
    this.render();
    try {
      const restored = await this.plugin.repository.restoreMissingFromBackup(backup);
      new Notice(`누락 파일 ${restored}개를 복구했습니다. 기존 파일은 유지했습니다.`);
      this.plugin.activityIndex.invalidate();
      await this.plugin.refreshAllViews();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "파일을 복구하지 못했습니다.");
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }

  private async migrate(): Promise<void> {
    this.busy = true;
    this.render();
    try {
      const result = await this.plugin.repository.migrateLegacyNotes();
      new Notice(`${result.processed}개 노트를 마이그레이션했습니다. 백업: ${result.backupPath}`);
      this.plugin.activityIndex.invalidate();
      await this.plugin.refreshAllViews();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "마이그레이션을 완료하지 못했습니다.");
    } finally {
      this.busy = false;
      await this.refresh();
    }
  }
}
