import { Modal, Notice, Setting } from "obsidian";
import { localDate } from "@core/utils";
import type ClassManagementPlugin from "./main";

/**
 * 학년도 마감·이월 안내 — 흩어져 있던 마감 동작(백업→보존 정리→새 프로필→계획 원장)을
 * 한 화면의 순서 있는 체크리스트로 잇는다. 각 단계는 기존 기능을 호출할 뿐 새 동작을 만들지 않는다.
 */
export class YearEndModal extends Modal {
  constructor(private readonly plugin: ClassManagementPlugin) {
    super(plugin.app);
  }

  onOpen(): void {
    this.setTitle("학년도 마감·이월");
    const { contentEl } = this;
    const settings = this.plugin.settings;

    contentEl.createEl("p", {
      cls: "setting-item-description",
      text: `현재 학급: ${settings.className} (${settings.schoolYear} ${settings.semester}) · 위에서 아래 순서로 진행하세요. 데이터는 삭제되지 않고 모두 볼트에 남습니다.`
    });

    const lastBackup = this.plugin.repository.lastBackupDate();
    const backupDone = lastBackup === localDate();
    new Setting(contentEl)
      .setName(`1. 마감 백업${backupDone ? " ✓" : ""}`)
      .setDesc(
        lastBackup
          ? `마지막 백업: ${lastBackup}${backupDone ? " (오늘)" : " — 마감 시점 백업을 새로 만드세요."}`
          : "백업 기록이 없습니다 — 마감 전에 꼭 만들어 두세요."
      )
      .addButton((button) =>
        button.setButtonText("지금 백업 만들기").onClick(() => {
          void this.plugin.repository
            .createManagedBackup()
            .then((result) => {
              new Notice(`백업 완료 · ${result.processed}개 파일`);
              this.reopen();
            })
            .catch((error: unknown) =>
              new Notice(error instanceof Error ? error.message : "백업하지 못했습니다.")
            );
        })
      );

    new Setting(contentEl)
      .setName("2. 보존 정리 (선택)")
      .setDesc("보관 기간이 지난 관리 파일을 검토·정돈합니다. 자동 삭제는 없습니다.")
      .addButton((button) =>
        button.setButtonText("백업·유지관리 열기").onClick(() => {
          this.close();
          void this.plugin.openMaintenance();
        })
      );

    const nextYear = String(Number(settings.schoolYear) + 1);
    const hasNextProfile = settings.classProfiles.some(
      (profile) => profile.schoolYear === nextYear && !profile.archived
    );
    new Setting(contentEl)
      .setName(`3. 새 학년 프로필${hasNextProfile ? " ✓" : ""}`)
      .setDesc(
        hasNextProfile
          ? `${nextYear} 프로필이 이미 있습니다. 전환만 하면 됩니다.`
          : `${nextYear}학년도 프로필을 만들고 전환하세요. 필요하면 현재 명단을 복사해 이월할 수 있고, 기본 폴더를 다르게 하면 새 학년 데이터가 깨끗하게 분리됩니다.`
      )
      .addButton((button) =>
        button.setButtonText("학급·학기 추가 및 전환").onClick(() => {
          this.close();
          this.plugin.openClassProfileModal();
        })
      );

    new Setting(contentEl)
      .setName("4. 이전 학급 읽기 전용 보관")
      .setDesc("새 프로필로 전환한 뒤, 같은 화면에서 지난 학급을 '보관'으로 표시하면 실수로 고치는 일을 막습니다.")
      .addButton((button) =>
        button.setButtonText("학급·학기 추가 및 전환").onClick(() => {
          this.close();
          this.plugin.openClassProfileModal();
        })
      );

    new Setting(contentEl)
      .setName("5. 새 학년 계획 수립")
      .setDesc("새 프로필에서 시간표·시수 뷰의 체크리스트(학사일정→기준 시수→기초시간표→진도표)를 위에서부터 채우면 신학년 준비가 끝납니다.")
      .addButton((button) =>
        button.setButtonText("시간표·시수 열기").onClick(() => {
          this.close();
          void this.plugin.openCurriculumOps();
        })
      );
  }

  private reopen(): void {
    this.onClose();
    this.contentEl.empty();
    this.onOpen();
  }
}
