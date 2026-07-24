import { Modal, Notice, Setting, SuggestModal } from "obsidian";
import {
  covaultNoticeMarkdown,
  parseCovaultStatsCsv,
  reconcileAssignmentRates,
  stripFrontmatter
} from "@core/covault-bridge";
import { localDate } from "@core/utils";
import type ClassManagementPlugin from "./main";

type CovaultExportChoice =
  | { kind: "notice"; title: string; dueDate: string }
  | { kind: "weekly"; title: string; path: string };

/** CoVault 알림장 내보내기 — 가정통신문·주간학습안내를 `covault: notice` 초안으로 만든다(단방향). */
export class CovaultExportModal extends SuggestModal<CovaultExportChoice> {
  constructor(private readonly plugin: ClassManagementPlugin) {
    super(plugin.app);
    this.setPlaceholder("CoVault 알림장으로 내보낼 자료 검색 (가정통신문·주간학습안내)");
  }

  getSuggestions(query: string): CovaultExportChoice[] {
    const normalized = query.trim().toLocaleLowerCase("ko");
    const notices = this.plugin.repository.getNoticeSummaries().map(
      (summary): CovaultExportChoice => ({
        kind: "notice",
        title: summary.title,
        dueDate: summary.dueDate
      })
    );
    const weekly = this.plugin.repository.getWeeklyPlanFiles().map(
      (entry): CovaultExportChoice => ({
        kind: "weekly",
        title: `주간학습안내 (${entry.weekStart} ~ ${entry.weekEnd})`,
        path: entry.file.path
      })
    );
    return [...weekly, ...notices].filter((choice) =>
      choice.title.toLocaleLowerCase("ko").includes(normalized)
    );
  }

  renderSuggestion(choice: CovaultExportChoice, element: HTMLElement): void {
    element.createEl("div", { text: choice.title });
    element.createEl("small", {
      text: choice.kind === "weekly" ? "주간학습안내 → 알림장" : `가정통신문 → 알림장${choice.dueDate ? ` (회신 마감 ${choice.dueDate})` : ""}`
    });
  }

  onChooseSuggestion(choice: CovaultExportChoice): void {
    void this.export(choice);
  }

  private async export(choice: CovaultExportChoice): Promise<void> {
    try {
      let body: string;
      if (choice.kind === "weekly") {
        const file = this.plugin.app.vault.getFileByPath(choice.path);
        if (!file) throw new Error("주간학습안내 노트를 찾을 수 없습니다.");
        body = stripFrontmatter(await this.plugin.app.vault.cachedRead(file));
      } else {
        body = [
          "안녕하세요, 학부모님.",
          "",
          "(안내 내용을 적어 주세요.)",
          "",
          ...(choice.dueDate ? [`회신 마감: ${choice.dueDate}`] : [])
        ].join("\n");
      }
      const content = covaultNoticeMarkdown(choice.title, body);
      const file = await this.plugin.repository.saveCovaultExport(choice.title, content);
      new Notice(
        `CoVault 알림장 초안을 만들었습니다 — ${file.path}. CoVault 볼트의 알림장 폴더로 옮긴 뒤 발행(published)하세요.`
      );
      await this.plugin.openFile(file);
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "CoVault 내보내기에 실패했습니다.");
    }
  }
}

/** CoVault 통계 대사 — 성적부 CSV를 붙여넣으면 확인표 제출률과 이름 기준으로 대조한 보고서를 만든다(읽기 전용). */
export class CovaultStatsModal extends Modal {
  private csv = "";

  constructor(private readonly plugin: ClassManagementPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("CoVault 통계 대사");
    this.contentEl.createEl("p", {
      cls: "setting-item-description",
      text: "CoVault 대시보드 → 종합 통계의 `CSV 내보내기`로 복사한 내용을 붙여넣으세요. 과제 제출률을 확인표와 이름으로 대조해 보고서를 만듭니다 — 데이터는 수정하지 않습니다."
    });
    new Setting(this.contentEl).setName("통계 CSV").addTextArea((input) => {
      input.setPlaceholder("구성원,알림장 읽음률,…").onChange((value) => (this.csv = value));
      input.inputEl.rows = 8;
      window.setTimeout(() => input.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).addButton((button) =>
      button.setButtonText("대사 보고서 만들기").setCta().onClick(() => void this.reconcile())
    );
  }

  private async reconcile(): Promise<void> {
    const stats = parseCovaultStatsCsv(this.csv);
    if (stats.rows.length === 0) {
      new Notice("CSV에서 구성원 행을 읽지 못했습니다. 머리글을 포함해 붙여넣어 주세요.");
      return;
    }
    try {
      const repository = this.plugin.repository;
      const students = repository.getStudents();
      const totals = new Map<string, { submitted: number; total: number }>();
      for (const summary of repository.getAssignmentSummaries()) {
        const sheet = await repository.loadAssignment(summary);
        for (const mark of sheet.marks) {
          const bucket = totals.get(mark.studentName) ?? { submitted: 0, total: 0 };
          bucket.total += 1;
          if (mark.status === "제출") bucket.submitted += 1;
          totals.set(mark.studentName, bucket);
        }
      }
      const localRates = students.map((student) => {
        const bucket = totals.get(student.name);
        return {
          name: student.name,
          rate: bucket && bucket.total > 0
            ? Math.round((bucket.submitted / bucket.total) * 1000) / 10
            : null
        };
      });
      const result = reconcileAssignmentRates(stats, localRates);
      const lines = [
        `# CoVault 과제 대사 (${localDate()})`,
        "",
        "- CoVault 제출률은 플랫폼 제출 기준, 확인표 제출률은 교사 체크 기준입니다 — 차이 자체가 확인할 정보입니다.",
        "",
        "| 학생 | CoVault 제출률 | 확인표 제출률 | 차이(%p) |",
        "| --- | ---: | ---: | ---: |",
        ...result.rows.map((row) =>
          `| ${row.name} | ${row.covaultRate ?? "—"} | ${row.localRate ?? "—"} | ${row.gap ?? "—"} |`
        ),
        "",
        ...(result.covaultOnly.length
          ? [`- CoVault에만 있는 이름: ${result.covaultOnly.join(", ")}`]
          : []),
        ...(result.localOnly.length
          ? [`- 학급 명단에만 있는 이름: ${result.localOnly.join(", ")}`]
          : []),
        ""
      ].join("\n");
      const file = await repository.saveReport("CoVault 과제 대사", lines);
      new Notice(`대사 보고서를 만들었습니다 — 구성원 ${result.rows.length}명 대조.`);
      await this.plugin.openFile(file);
      this.close();
    } catch (error) {
      new Notice(error instanceof Error ? error.message : "대사 보고서를 만들지 못했습니다.");
    }
  }
}
