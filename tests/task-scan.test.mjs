import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { isoWeekOf, scanOperationalTasks } =
  await loadTypeScriptModule("../packages/core/src/task-scan.ts");

const EMPTY = {
  today: "2026-09-07",
  assignments: [],
  projects: [],
  events: [],
  notices: [],
  hoursIssues: [],
  designIssues: [],
  lastBackupDate: "2026-09-01",
  existingSourceKeys: new Set()
};

test("ISO 주차를 계산한다 (연 경계 포함)", () => {
  assert.equal(isoWeekOf("2026-09-07"), "2026-W37");
  assert.equal(isoWeekOf("2026-01-01"), "2026-W01");
  assert.equal(isoWeekOf("2027-01-01"), "2026-W53");
});

test("과제 D-7·행사 D-3·통신문 D-2 창 안만 수집한다", () => {
  const tasks = scanOperationalTasks({
    ...EMPTY,
    assignments: [
      { fileName: "수행평가 - 과학", title: "과학 실험", date: "2026-09-14" },
      { fileName: "수행평가 - 국어", title: "국어 발표", date: "2026-09-15" }
    ],
    events: [
      { date: "2026-09-10", name: "현장체험학습" },
      { date: "2026-09-11", name: "학예회" }
    ],
    notices: [
      { fileName: "통신문A", title: "체험학습 동의서", dueDate: "2026-09-09", pendingCount: 3 },
      { fileName: "통신문B", title: "설문", dueDate: "2026-09-09", pendingCount: 0 }
    ]
  });
  const keys = tasks.map((task) => task.sourceKey);
  assert.ok(keys.includes("assignment:수행평가 - 과학"));
  assert.ok(!keys.includes("assignment:수행평가 - 국어"), "D-8은 창 밖");
  assert.ok(keys.includes("event:2026-09-10:현장체험학습"));
  assert.ok(!keys.includes("event:2026-09-11:학예회"), "D-4는 창 밖");
  assert.ok(keys.includes("notice:통신문A:2026-09-09"));
  assert.ok(!keys.some((key) => key.startsWith("notice:통신문B")), "미회신 0명은 제외");
  assert.match(tasks.find((task) => task.sourceKey.startsWith("notice:")).title, /미회신 3명/);
});

test("기존 sourceKey는 다시 만들지 않는다 (멱등)", () => {
  const tasks = scanOperationalTasks({
    ...EMPTY,
    projects: [{ fileName: "지구를 부탁해", title: "지구를 부탁해", startDate: "2026-09-14" }],
    existingSourceKeys: new Set(["project-start:지구를 부탁해"])
  });
  assert.equal(tasks.length, 0);
});

test("설계 이슈는 3건까지, 전체는 due순 12건까지", () => {
  const designIssues = Array.from({ length: 5 }, (_, index) => ({
    fileName: `단원${index}`,
    title: `단원${index}`,
    startDate: "2026-09-08",
    firstError: "성취기준이 없어 교육과정과 수업의 연결을 확인할 수 없습니다."
  }));
  const events = Array.from({ length: 15 }, (_, index) => ({
    date: "2026-09-10",
    name: `행사${index}`
  }));
  const tasks = scanOperationalTasks({ ...EMPTY, designIssues, events });
  assert.equal(tasks.filter((task) => task.sourceKey.startsWith("design:")).length, 3);
  assert.equal(tasks.length, 12, "전체 상한 12건");
});

test("백업 30일 경과·기록 없음이면 주차 키로 수집한다", () => {
  const overdue = scanOperationalTasks({ ...EMPTY, lastBackupDate: "2026-08-01" });
  assert.equal(overdue.length, 1);
  assert.equal(overdue[0].sourceKey, "backup:2026-W37");

  const missing = scanOperationalTasks({ ...EMPTY, lastBackupDate: null });
  assert.match(missing[0].detail, /백업 기록 없음/);

  const fresh = scanOperationalTasks({ ...EMPTY, lastBackupDate: "2026-09-01" });
  assert.equal(fresh.length, 0);
});

test("시수 이상은 과목·주차 키로 확인 할 일을 만든다", () => {
  const tasks = scanOperationalTasks({
    ...EMPTY,
    hoursIssues: [{ subject: "수학", statusLabel: "미달" }]
  });
  assert.equal(tasks[0].sourceKey, "hours:수학:2026-W37");
  assert.match(tasks[0].title, /수학 시수 미달 확인/);
});
