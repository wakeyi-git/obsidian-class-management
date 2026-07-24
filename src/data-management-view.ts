import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { scaffoldView, type ViewScaffold } from "./dom";
import { ClassProfileModal } from "./class-profile-modal";
import {
  buildDiagnosticMarkdown,
  buildFullExportCsv,
  runDataDiagnostics,
  type DiagnosticIssue
} from "./data-management";
import type ClassManagementPlugin from "./main";
import { StudentEditModal } from "./student-edit-modal";
import { RetentionModal } from "./retention-modal";

export const DATA_MANAGEMENT_VIEW_TYPE = "class-management-data-view";

export class DataManagementView extends ItemView {
  private layout!: ViewScaffold;
  private issues: DiagnosticIssue[] = [];

  constructor(
    leaf: WorkspaceLeaf,
    private readonly plugin: ClassManagementPlugin
  ) {
    super(leaf);
  }

  getViewType(): string {
    return DATA_MANAGEMENT_VIEW_TYPE;
  }

  getDisplayText(): string {
    return "학급·데이터 관리";
  }

  getIcon(): string {
    return "database";
  }

  async onOpen(): Promise<void> {
    await this.refresh();
  }

  async refresh(): Promise<void> {
    this.render();
  }

  private render(): void {
    this.contentEl.empty();
    this.layout = scaffoldView(this.contentEl, {
      cls: "class-management-data-view",
      title: "학급·학기와 데이터 관리",
      description: "학급을 전환하고, 재적 상태·내보내기·연결 무결성을 관리합니다."
    });
    const add = this.layout.actions.createEl("button", { text: "학급 추가·전환", cls: "mod-cta" });
    add.addEventListener("click", () => new ClassProfileModal(this.plugin).open());

    const grid = this.layout.body.createDiv({ cls: "class-management-data-grid" });
    this.renderProfiles(grid);
    this.renderStudents(grid);
    this.renderTools(grid);
    if (this.issues.length) this.renderIssues();
  }

  private renderProfiles(container: HTMLElement): void {
    const panel = container.createDiv({ cls: "class-management-panel" });
    panel.createEl("h3", { text: `학급 프로필 ${this.plugin.settings.classProfiles.length}개` });
    this.plugin.settings.classProfiles.forEach((profile) => {
      const row = panel.createDiv({ cls: "class-management-profile-row" });
      const text = row.createDiv();
      text.createEl("strong", { text: `${profile.schoolYear} ${profile.semester} · ${profile.grade}학년 · ${profile.name}` });
      text.createEl("span", { text: `${profile.curriculum} · ${profile.baseFolder}${profile.archived ? " · 보관됨" : ""}` });
      if (profile.id === this.plugin.settings.activeClassId) {
        row.addClass("is-active");
        row.createEl("span", { text: "현재", cls: "class-management-status-chip" });
      } else {
        const switchButton = row.createEl("button", { text: "전환" });
        switchButton.addEventListener("click", () => void this.switchProfile(profile.id));
      }
    });
    const active = this.plugin.activeClassProfile;
    const archive = panel.createEl("button", {
      text: active.archived ? "현재 학급 보관 해제" : "현재 학급 읽기 전용 보관"
    });
    archive.addEventListener("click", () => void this.toggleArchive());
  }

  private renderStudents(container: HTMLElement): void {
    const students = this.plugin.repository.getStudents(true);
    const panel = container.createDiv({ cls: "class-management-panel" });
    panel.createEl("h3", { text: `학생 재적 관리 ${students.length}명` });
    if (!students.length) {
      panel.createEl("p", { text: "등록된 학생이 없습니다." });
      return;
    }
    students.forEach((student) => {
      const row = panel.createDiv({ cls: "class-management-data-student-row" });
      const label = row.createDiv();
      label.createEl("strong", { text: `${student.number}번 ${student.name}` });
      label.createEl("span", { text: studentStatusLabel(student.status) });
      const edit = row.createEl("button", { text: "변경" });
      edit.disabled = this.plugin.activeClassProfile.archived;
      edit.addEventListener("click", () =>
        new StudentEditModal(this.plugin, student, () => void this.refresh()).open()
      );
    });
  }

  private renderTools(container: HTMLElement): void {
    const panel = container.createDiv({ cls: "class-management-panel" });
    panel.createEl("h3", { text: "내보내기와 진단" });
    panel.createEl("p", {
      text: "학생 명단과 전체 활동을 CSV 한 파일로 내보내거나 중복 번호·깨진 studentPath·필수 폴더를 검사합니다."
    });
    const actions = panel.createDiv({ cls: "class-management-data-actions" });
    const exportButton = actions.createEl("button", { text: "전체 데이터 CSV" });
    exportButton.addEventListener("click", () => void this.exportAll());
    const diagnosticButton = actions.createEl("button", { text: "데이터 진단 실행", cls: "mod-cta" });
    diagnosticButton.addEventListener("click", () => void this.diagnose());
    const cutoff = retentionCutoff(this.plugin.settings.retentionYears);
    const candidates = this.plugin.repository.getRetentionCandidates(cutoff);
    const retention = actions.createEl("button", {
      text: `보관 기간 검토 ${candidates.length}건`
    });
    retention.addEventListener("click", () => {
      if (candidates.length === 0) {
        new Notice("설정한 보관 기간을 지난 관리 파일이 없습니다.");
        return;
      }
      new RetentionModal(this.plugin, candidates, cutoff, () => void this.plugin.refreshAllViews()).open();
    });
    const maintenance = actions.createEl("button", { text: "백업·복구·마이그레이션" });
    maintenance.addEventListener("click", () => void this.plugin.openMaintenance());
  }

  private renderIssues(): void {
    const panel = this.layout.body.createDiv({ cls: "class-management-panel class-management-diagnostic-panel" });
    panel.createEl("h3", { text: `최근 진단 결과 ${this.issues.length}건` });
    this.issues.forEach((issue) => {
      const row = panel.createDiv({ cls: `class-management-diagnostic-row is-${issue.level}` });
      row.createEl("strong", { text: issue.level === "error" ? "오류" : issue.level === "warning" ? "경고" : "정보" });
      row.createEl("span", { text: issue.message });
      if (issue.source) row.createEl("small", { text: issue.source });
    });
  }

  private async switchProfile(id: string): Promise<void> {
    await this.plugin.switchClassProfile(id);
    new Notice(`${this.plugin.settings.className}으로 전환했습니다.`);
    await this.refresh();
  }

  private async toggleArchive(): Promise<void> {
    const profile = this.plugin.activeClassProfile;
    const archive = !profile.archived;
    await this.plugin.setClassArchived(profile.id, archive);
    new Notice(archive ? "학급을 읽기 전용으로 보관했습니다." : "학급 보관을 해제했습니다.");
    await this.refresh();
  }

  private async exportAll(): Promise<void> {
    const activities = await this.plugin.activityIndex.getEntries();
    const content = buildFullExportCsv(
      this.plugin.activeClassProfile,
      this.plugin.repository.getStudents(true),
      activities,
      this.plugin.repository.getCurriculumUnits()
    );
    const file = await this.plugin.repository.saveExport("전체 데이터", content);
    new Notice("현재 학급 전체 데이터를 CSV로 저장했습니다.");
    await this.plugin.openFile(file);
  }

  private async diagnose(): Promise<void> {
    const activities = await this.plugin.activityIndex.getEntries();
    this.issues = await runDataDiagnostics(this.app, this.plugin.repository, activities);
    const content = buildDiagnosticMarkdown(this.plugin.activeClassProfile, this.issues);
    const file = await this.plugin.repository.saveExport("데이터 진단", content, "md");
    new Notice("데이터 진단 결과를 저장했습니다.");
    this.render();
    await this.plugin.openFile(file);
  }
}

function studentStatusLabel(status: "active" | "transferred" | "graduated"): string {
  return status === "active" ? "재적" : status === "transferred" ? "전출" : "졸업·진급";
}

function retentionCutoff(years: number): Date {
  const now = new Date();
  return new Date(now.getFullYear() - years, now.getMonth(), now.getDate());
}
