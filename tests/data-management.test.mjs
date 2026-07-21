import assert from "node:assert/strict";
import { test } from "node:test";
import {
  loadTypeScriptModule,
  makeActivityFile,
  makeExpandedActivities,
  makeSchoolRecordActivities,
  makeSubjectEvidence
} from "./helpers.mjs";

const { buildFullExportCsv, buildDiagnosticMarkdown } =
  await loadTypeScriptModule("../src/data-management.ts");
const { emptySchoolRecordEvidence } =
  await loadTypeScriptModule("../src/school-record-evidence.ts");

const profile = {
  id: "class-1",
  name: "우리 반",
  schoolYear: "2026",
  semester: "1학기",
  schoolLevel: "elementary",
  grade: "3",
  curriculum: "2022 개정 교육과정",
  schoolRecordGuidelineYear: "2026",
  schoolSubjects: ["수학"],
  baseFolder: "학급운영",
  archived: false
};

test("전체 CSV에 학생·근거·단원 연결이 들어간다", () => {
  const activityFile = makeActivityFile();
  const structuredActivity = {
    ...makeSchoolRecordActivities(activityFile)[1],
    schoolRecordEvidence: makeSubjectEvidence(emptySchoolRecordEvidence)
  };
  const fullExport = buildFullExportCsv(
    profile,
    [{ file: activityFile, number: "1", name: "김하늘", status: "active" }],
    [...makeExpandedActivities(activityFile), structuredActivity]
  );
  assert.match(fullExport, /"rowType","class","schoolYear"/);
  assert.match(fullExport, /"student","우리 반","2026","1학기","3","2022 개정 교육과정","2026","1","김하늘","active"/);
  assert.match(fullExport, /"subject-development","subject","teacher-observation","true","수학"/);
  assert.match(fullExport, /"unit-1","분수의 의미","lesson-1"/);
  const exportLines = fullExport.trim().split("\r\n");
  assert.equal(exportLines[0].split(",").length, exportLines[1].split(",").length);
});

test("진단 Markdown에 수준별 집계가 들어간다", () => {
  const diagnostic = buildDiagnosticMarkdown(profile, [
    { level: "warning", code: "missing-student-link", message: "studentPath 확인", source: "기록.md" }
  ]);
  assert.match(diagnostic, /경고: 1건/);
  assert.match(diagnostic, /missing-student-link/);
});
