import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const { parseRoutineItems, parseRoutineInstanceItems, routineRunsOn } =
  await loadTypeScriptModule("../src/routine.ts");

test("템플릿 체크리스트 항목을 파싱한다", () => {
  assert.deepEqual(parseRoutineItems("# 준비\n- [ ] 출석 확인\n- [ ] 알림장 확인"), [
    "출석 확인", "알림장 확인"
  ]);
});

test("실행 노트의 완료 상태와 템플릿 이름을 파싱한다", () => {
  assert.deepEqual(parseRoutineInstanceItems("- [x] [아침 준비] 출석 확인\n- [ ] [마무리] 교실 정리"), [
    { line: 0, completed: true, templateTitle: "아침 준비", text: "출석 확인" },
    { line: 1, completed: false, templateTitle: "마무리", text: "교실 정리" }
  ]);
});

test("주간 루틴은 지정 요일에 실행된다", () => {
  assert.equal(routineRunsOn({ frequency: "weekly", weekday: 2 }, new Date(2026, 6, 21)), true);
});
