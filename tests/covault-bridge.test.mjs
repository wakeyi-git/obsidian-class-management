import assert from "node:assert/strict";
import { test } from "node:test";
import { loadTypeScriptModule } from "./helpers.mjs";

const {
  covaultNoticeMarkdown,
  parseCovaultStatsCsv,
  reconcileAssignmentRates,
  stripFrontmatter
} = await loadTypeScriptModule("../packages/core/src/covault-bridge.ts");

test("CoVault 알림장 초안은 마커·발행 전 상태를 갖는다", () => {
  const doc = covaultNoticeMarkdown("체험학습 안내", "본문입니다.");
  assert.match(doc, /^---\ncovault: notice\n/);
  assert.match(doc, /title: "체험학습 안내"/);
  assert.match(doc, /published: false/);
  assert.match(doc, /responses: true/);
  assert.match(doc, /본문입니다\./);
});

test("frontmatter를 떼고 본문만 남긴다", () => {
  const body = stripFrontmatter("---\nclass-management: weekly-plan\n---\n\n# 주간학습안내\n표");
  assert.equal(body, "# 주간학습안내\n표");
  assert.equal(stripFrontmatter("본문만"), "본문만");
});

test("성적부 CSV를 구성원 행으로 파싱한다 (평균 행 제외)", () => {
  const stats = parseCovaultStatsCsv(
    ["구성원,알림장 읽음률,과제 제출률", "김하늘,100,80", "이바다,90,", "학급 평균,95,80"].join("\n")
  );
  assert.deepEqual(stats.columns, ["알림장 읽음률", "과제 제출률"]);
  assert.equal(stats.rows.length, 2);
  assert.equal(stats.rows[0].values["과제 제출률"], 80);
  assert.equal(stats.rows[1].values["과제 제출률"], null);
});

test("과제 제출률을 이름으로 대사하고 차이 큰 순으로 정렬한다", () => {
  const stats = parseCovaultStatsCsv(
    ["구성원,과제 제출률", "김하늘,80", "이바다,100", "전학생,50"].join("\n")
  );
  const result = reconcileAssignmentRates(stats, [
    { name: "김하늘", rate: 100 },
    { name: "이바다", rate: 100 },
    { name: "박새로", rate: null }
  ]);
  assert.equal(result.rows[0].name, "김하늘", "차이 20%p가 맨 위");
  assert.equal(result.rows[0].gap, -20);
  assert.equal(result.rows.find((row) => row.name === "이바다").gap, 0);
  assert.deepEqual(result.covaultOnly, ["전학생"]);
  assert.deepEqual(result.localOnly, ["박새로"]);
});
