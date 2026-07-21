import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

async function loadTypeScriptModule(relativePath) {
  const entryPoint = fileURLToPath(new URL(relativePath, import.meta.url));
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    write: false
  });
  const output = result.outputFiles?.[0];
  if (!output) throw new Error(`${relativePath}를 테스트용으로 빌드하지 못했습니다.`);

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(output.contents).toString("base64")}`;
  return import(moduleUrl);
}

const { parseRosterCsv } = await loadTypeScriptModule("../src/csv.ts");

const korean = parseRosterCsv("\uFEFF번호,이름\r\n1,김하늘\r\n2,이바다\r\n");
assert.equal(korean.hasHeader, true);
assert.deepEqual(korean.students, [
  { number: "1", name: "김하늘" },
  { number: "2", name: "이바다" }
]);

const englishReversed = parseRosterCsv('name,number\n"김,하늘",3.0');
assert.deepEqual(englishReversed.students, [{ number: "3", name: "김,하늘" }]);

const withoutHeader = parseRosterCsv("4,박구름\n5,최우주");
assert.equal(withoutHeader.hasHeader, false);
assert.deepEqual(withoutHeader.students, [
  { number: "4", name: "박구름" },
  { number: "5", name: "최우주" }
]);

const tabSeparated = parseRosterCsv("번호\t이름\n7\t윤별\n8\t정새벽");
assert.deepEqual(tabSeparated.students, [
  { number: "7", name: "윤별" },
  { number: "8", name: "정새벽" }
]);

const withIssues = parseRosterCsv("번호,이름\n1,가람\n1,나래\n,다온\n4,");
assert.deepEqual(withIssues.students, [{ number: "1", name: "가람" }]);
assert.equal(withIssues.issues.length, 3);
assert.deepEqual(
  withIssues.issues.map((issue) => issue.row),
  [3, 4, 5]
);

const escapedQuote = parseRosterCsv('번호,이름\n6,"김""하늘"');
assert.deepEqual(escapedQuote.students, [{ number: "6", name: '김"하늘' }]);

assert.throws(
  () => parseRosterCsv("번호,반\n1,김하늘"),
  /번호와 이름 열을 모두 찾을 수 없습니다/
);
assert.throws(() => parseRosterCsv('번호,이름\n1,"김하늘'), /따옴표가 닫히지 않았습니다/);

const { formatAttendanceTableRow, parseAttendanceMetadata } =
  await loadTypeScriptModule("../src/attendance.ts");
const attendance = [
  { studentNumber: "1", studentName: "김하늘", status: "출석" },
  {
    studentNumber: "2",
    studentName: "이%바다",
    status: "지각",
    reason: "버스 지연 | 확인"
  }
];
const attendanceTable = [
  "| 번호 | 학생 | 상태 | 사유 |",
  "| ---: | --- | --- | --- |",
  "| 1 | [[학급운영/학생/01 김하늘\\|1번 김하늘]] | 출석 |  |",
  "| 2 | [[학급운영/학생/02 이%바다\\|2번 이%바다]] | 지각 | 버스 지연 \\| 확인 |"
].join("\n");
assert.deepEqual(parseAttendanceMetadata(attendanceTable), attendance);
const renderedRow = formatAttendanceTableRow(
  attendance[0],
  "학급운영/학생/01 김하늘.md"
);
assert.equal(
  renderedRow,
  "| 1 | [[학급운영/학생/01 김하늘\\|1번 김하늘]] | 출석 |  |"
);
assert.deepEqual(parseAttendanceMetadata(renderedRow), [attendance[0]]);
assert.equal(
  formatAttendanceTableRow(attendance[1], "학급운영/학생/02 이%바다.md"),
  "| 2 | [[학급운영/학생/02 이%바다\\|2번 이%바다]] | 지각 | 버스 지연 \\| 확인 |"
);
const oldThreeColumnRow =
  "| 3 | [[학급운영/학생/03 박구름\\|3번 박구름]] | 결석 |";
assert.deepEqual(parseAttendanceMetadata(oldThreeColumnRow), [
  { studentNumber: "3", studentName: "박구름", status: "결석" }
]);
const legacyAttendance = `%% class-management-attendance: ${JSON.stringify(attendance)} %%`;
assert.deepEqual(parseAttendanceMetadata(legacyAttendance), attendance);
assert.deepEqual(
  parseAttendanceMetadata(
    '%% class-management-attendance: [{"studentNumber":"3","studentName":"박구름","status":"알 수 없음"}] %%'
  ),
  []
);
assert.deepEqual(parseAttendanceMetadata("%% class-management-attendance: invalid %%"), []);

const { formatAssignmentTableRow, parseAssignmentTable } =
  await loadTypeScriptModule("../src/assignment.ts");
const assignments = [
  { studentNumber: "1", studentName: "김하늘", status: "제출" },
  {
    studentNumber: "2",
    studentName: "이바다",
    status: "보완",
    note: "3번 문제 | 다시 풀기"
  }
];
const assignmentTable = [
  "| 번호 | 학생 | 상태 | 메모 |",
  "| ---: | --- | --- | --- |",
  "| 1 | [[학급운영/학생/01 김하늘\\|1번 김하늘]] | 제출 |  |",
  "| 2 | [[학급운영/학생/02 이바다\\|2번 이바다]] | 보완 | 3번 문제 \\| 다시 풀기 |"
].join("\n");
assert.deepEqual(parseAssignmentTable(assignmentTable), assignments);
assert.equal(
  formatAssignmentTableRow(assignments[1], "학급운영/학생/02 이바다.md"),
  "| 2 | [[학급운영/학생/02 이바다\\|2번 이바다]] | 보완 | 3번 문제 \\| 다시 풀기 |"
);
assert.deepEqual(parseAssignmentTable("| 3 | 박구름 | 알 수 없음 |  |"), []);

const { filterActivities } = await loadTypeScriptModule("../src/activity.ts");
const activityFile = { path: "테스트.md", basename: "테스트", stat: { ctime: 1 } };
const activities = [
  {
    id: "1",
    file: activityFile,
    date: "2026-07-21",
    studentNumber: "1",
    studentName: "김하늘",
    kind: "record",
    title: "칭찬",
    status: "칭찬",
    detail: "모둠 발표를 도왔다",
    searchText: "김하늘 칭찬 모둠 발표를 도왔다",
    createdAt: 1
  },
  {
    id: "2",
    file: activityFile,
    date: "2026-07-20",
    studentNumber: "2",
    studentName: "이바다",
    kind: "attendance",
    title: "지각",
    status: "지각",
    detail: "버스 지연",
    searchText: "이바다 지각 버스 지연",
    createdAt: 1
  },
  {
    id: "3",
    file: activityFile,
    date: "2026-07-19",
    studentNumber: "1",
    studentName: "김하늘",
    kind: "assignment",
    title: "수학 익힘",
    status: "미제출",
    detail: "",
    searchText: "김하늘 수학 익힘 미제출",
    createdAt: 1
  }
];
const emptyFilters = {
  query: "",
  studentNumber: "",
  kind: "",
  status: "",
  dateFrom: "",
  dateTo: ""
};
assert.deepEqual(
  filterActivities(activities, { ...emptyFilters, query: "버스" }).map((item) => item.id),
  ["2"]
);
assert.deepEqual(
  filterActivities(activities, {
    ...emptyFilters,
    studentNumber: "1",
    kind: "assignment"
  }).map((item) => item.id),
  ["3"]
);
assert.deepEqual(
  filterActivities(activities, {
    ...emptyFilters,
    status: "칭찬",
    dateFrom: "2026-07-20"
  }).map((item) => item.id),
  ["1"]
);

const { buildCalendarEvents, calendarDays, dateKey, moveCalendarAnchor } =
  await loadTypeScriptModule("../src/calendar.ts");
const julyDays = calendarDays(new Date(2026, 6, 21), "month");
assert.equal(julyDays.length, 35);
assert.equal(dateKey(julyDays[0]), "2026-06-29");
assert.equal(dateKey(julyDays.at(-1)), "2026-08-02");
const weekDays = calendarDays(new Date(2026, 6, 21), "week");
assert.equal(dateKey(weekDays[0]), "2026-07-20");
assert.equal(dateKey(weekDays[6]), "2026-07-26");
assert.equal(
  dateKey(moveCalendarAnchor(new Date(2026, 6, 21), "month", 1)),
  "2026-08-01"
);
const extraAttendance = {
  ...activities[1],
  id: "4",
  studentNumber: "3",
  studentName: "박구름",
  status: "출석",
  title: "출석",
  file: { ...activityFile, path: "2026-07-20 출결.md" }
};
activities[1].file = extraAttendance.file;
const calendarEvents = buildCalendarEvents([...activities, extraAttendance]);
const attendanceEvent = calendarEvents.find((event) => event.kind === "attendance");
assert.equal(attendanceEvent?.studentNumbers.length, 2);
assert.match(attendanceEvent?.detail ?? "", /지각 1명/);

const { formatNoticeTableRow, parseNoticeTable } =
  await loadTypeScriptModule("../src/notice.ts");
const noticeMarks = [
  { studentNumber: "1", studentName: "김하늘", status: "회신 완료", responseDate: "2026-07-21" },
  { studentNumber: "2", studentName: "이바다", status: "확인 필요", note: "서명 | 확인" }
];
const noticeRows = noticeMarks.map((mark) =>
  formatNoticeTableRow(mark, `학급운영/학생/0${mark.studentNumber} ${mark.studentName}.md`)
).join("\n");
assert.deepEqual(parseNoticeTable(noticeRows), noticeMarks);
assert.deepEqual(parseNoticeTable("| 3 | 박구름 | 알 수 없음 | | |"), []);

const { parseRoutineItems, parseRoutineInstanceItems, routineRunsOn } =
  await loadTypeScriptModule("../src/routine.ts");
assert.deepEqual(parseRoutineItems("# 준비\n- [ ] 출석 확인\n- [ ] 알림장 확인"), [
  "출석 확인", "알림장 확인"
]);
assert.deepEqual(parseRoutineInstanceItems("- [x] [아침 준비] 출석 확인\n- [ ] [마무리] 교실 정리"), [
  { line: 0, completed: true, templateTitle: "아침 준비", text: "출석 확인" },
  { line: 1, completed: false, templateTitle: "마무리", text: "교실 정리" }
]);
assert.equal(routineRunsOn({ frequency: "weekly", weekday: 2 }, new Date(2026, 6, 21)), true);

const { analyzeActivities, buildActivitiesCsv, buildReportMarkdown } =
  await loadTypeScriptModule("../src/report.ts");
const expandedActivities = [
  ...activities,
  {
    ...activities[0],
    id: "task-1",
    kind: "task",
    title: "상담 일정 잡기",
    status: "next",
    studentNumber: "",
    studentName: ""
  },
  {
    ...activities[0],
    id: "notice-1",
    kind: "notice",
    title: "동의서",
    status: "미회신"
  }
];
const analytics = analyzeActivities(expandedActivities);
assert.equal(analytics.tasksOpen, 1);
assert.equal(analytics.noticePending, 1);
const report = buildReportMarkdown(
  expandedActivities,
  { title: "7월 보고서", dateFrom: "2026-07-01", dateTo: "2026-07-31", studentNumber: "" },
  "우리 반",
  [{ file: activityFile, number: "1", name: "김하늘" }]
);
assert.match(report, /# 7월 보고서/);
assert.match(report, /\[\[테스트\|원본\]\]/);
assert.ok(buildActivitiesCsv(expandedActivities).startsWith("\uFEFF\"date\""));

const { buildAiDraftMarkdown } = await loadTypeScriptModule("../src/ai-collaboration.ts");
const aiDraft = buildAiDraftMarkdown(
  {
    baseFolder: "학급운영",
    recordsFolder: "기록",
    attendanceFolder: "출결",
    assignmentsFolder: "과제",
    studentsFolder: "학생",
    aiAnonymizeStudents: true
  },
  { file: activityFile, number: "1", name: "김하늘" },
  expandedActivities,
  "feedback",
  "2026-07-01",
  "2026-07-31"
);
assert.match(aiDraft, /학생-S01 학생 피드백 초안/);
assert.match(aiDraft, /draft: true/);
assert.doesNotMatch(aiDraft, /studentName: 김하늘/);

const schoolRecordActivities = [
  {
    ...activities[0],
    id: "creative-1",
    title: "관찰",
    status: "관찰",
    detail: "학급회의에서 친구들의 의견을 조율하고 학급 규칙을 정하는 데 참여함"
  },
  {
    ...activities[0],
    id: "subject-1",
    title: "관찰",
    status: "관찰",
    detail: "수학 분수 문제의 해결 과정을 그림과 식으로 설명함"
  },
  {
    ...activities[0],
    id: "behavior-1",
    title: "칭찬",
    status: "칭찬",
    detail: "모둠에서 어려움을 겪는 친구를 배려하고 역할을 끝까지 수행함"
  },
  {
    ...activities[2],
    id: "assignment-2",
    studentNumber: "1",
    studentName: "김하늘",
    title: "수학 단원 평가 보완",
    status: "보완",
    detail: "풀이 과정을 다시 확인함"
  },
  {
    ...activities[1],
    id: "attendance-2",
    studentNumber: "1",
    studentName: "김하늘",
    status: "지각",
    detail: "병원 진료"
  },
  {
    ...activities[0],
    id: "excluded-1",
    detail: "방과후 영어대회에서 수상함"
  }
];
const { classifySchoolRecordReferences } =
  await loadTypeScriptModule("../src/school-record.ts");
const creativeReferences = classifySchoolRecordReferences(
  schoolRecordActivities,
  "creative-activities"
);
assert.ok(creativeReferences.primary.some((reference) => reference.category === "자율·자치활동"));
assert.ok(creativeReferences.excluded.some((reference) => reference.category === "기재 제외 가능 자료"));
const subjectReferences = classifySchoolRecordReferences(
  schoolRecordActivities,
  "subject-development"
);
assert.ok(subjectReferences.primary.some((reference) => reference.category === "수학"));
assert.ok(subjectReferences.supporting.some((reference) => reference.activity.kind === "assignment"));
assert.ok(subjectReferences.excluded.some((reference) => /방과후/.test(reference.reason)));
const behaviorReferences = classifySchoolRecordReferences(
  schoolRecordActivities,
  "behavior-summary"
);
assert.ok(behaviorReferences.primary.some((reference) => reference.category === "관계·협력"));
assert.ok(behaviorReferences.supporting.some((reference) => reference.category === "출결 맥락 확인"));

const schoolRecordDraft = buildAiDraftMarkdown(
  {
    baseFolder: "학급운영",
    recordsFolder: "기록",
    attendanceFolder: "출결",
    assignmentsFolder: "과제",
    studentsFolder: "학생",
    aiAnonymizeStudents: true
  },
  { file: activityFile, number: "1", name: "김하늘" },
  schoolRecordActivities,
  "school-record",
  "2026-07-01",
  "2026-07-31",
  "subject-development"
);
assert.match(schoolRecordDraft, /schoolRecordArea: "subject-development"/);
assert.match(schoolRecordDraft, /교과학습발달상황\(학기말종합의견\) 초안/);
assert.match(schoolRecordDraft, /## 분류된 참고 자료/);
assert.match(schoolRecordDraft, /### 자동 제외 자료/);
assert.match(schoolRecordDraft, /과제 제출 상태만으로/);

const {
  buildSchoolRecordCoverage,
  defaultSubjectsForGrade,
  emptySchoolRecordEvidence,
  parseSchoolRecordEvidence,
  schoolRecordEvidenceFrontmatter,
  suggestLegacySchoolRecordEvidence,
  validateSchoolRecordEvidence
} = await loadTypeScriptModule("../src/school-record-evidence.ts");
const subjectEvidence = emptySchoolRecordEvidence("subject-development");
Object.assign(subjectEvidence, {
  subject: "수학",
  activityName: "분수의 덧셈",
  achievementStandard: "[4수01-16] 분모가 같은 분수의 덧셈과 뺄셈을 할 수 있다.",
  evaluationElement: "풀이 과정을 식과 말로 설명하기",
  evaluationMethod: "수행평가",
  observedFact: "분수 모형을 이용해 계산 과정을 설명함",
  reviewStatus: "reviewed",
  curriculumUnitId: "unit-1",
  curriculumUnitTitle: "분수의 의미",
  curriculumUnitPath: "[[학급운영/교육과정/설계/수학 분수의 의미]]",
  curriculumLessonId: "lesson-1",
  curriculumLessonPath: "[[학급운영/교육과정/수업일지/차시]]"
});
assert.equal(
  validateSchoolRecordEvidence(subjectEvidence).filter((issue) => issue.severity === "error").length,
  0
);
assert.ok(schoolRecordEvidenceFrontmatter(subjectEvidence).some((line) =>
  line === 'schoolRecordArea: "subject-development"'
));
assert.ok(schoolRecordEvidenceFrontmatter(subjectEvidence).some((line) =>
  line === 'curriculumUnitId: "unit-1"'
));
const parsedEvidence = parseSchoolRecordEvidence({
  schoolRecordArea: "subject-development",
  schoolRecordSubarea: "subject",
  evidenceType: "assessment",
  directObservation: true,
  observer: "교과담당교사",
  subject: "과학",
  reviewStatus: "reviewed"
});
assert.equal(parsedEvidence?.subject, "과학");
assert.equal(parsedEvidence?.reviewStatus, "reviewed");
assert.ok(validateSchoolRecordEvidence({
  ...subjectEvidence,
  observedFact: "교내 수학대회에서 수상함"
}).some((issue) => issue.code === "prohibited-content"));
const negativeBehavior = {
  ...emptySchoolRecordEvidence("behavior-summary"),
  observationContext: "모둠 활동",
  observedFact: "친구의 발표를 반복해서 방해함"
};
assert.ok(validateSchoolRecordEvidence(negativeBehavior).some((issue) =>
  issue.code === "negative-without-history"
));
assert.deepEqual(defaultSubjectsForGrade("1").slice(0, 2), ["국어", "수학"]);
assert.ok(defaultSubjectsForGrade("5").includes("실과"));
const behaviorEvidence = emptySchoolRecordEvidence("behavior-summary");
behaviorEvidence.observedFact = "모둠 친구의 의견을 끝까지 듣고 정리함";
const coverage = buildSchoolRecordCoverage(
  [{ file: activityFile, number: "1", name: "김하늘", status: "active" }],
  [
    {
      file: activityFile,
      number: "1",
      studentNumber: "1",
      studentName: "김하늘",
      recordType: "학생부 근거",
      date: "2026-07-21",
      content: behaviorEvidence.observedFact,
      schoolRecordEvidence: behaviorEvidence
    }
  ],
  ["수학"]
);
assert.equal(coverage.areas.find((area) => area.area === "behavior-summary")?.covered, 1);
assert.equal(coverage.areas.find((area) => area.area === "subject-development")?.gaps.length, 1);
const legacySuggestion = suggestLegacySchoolRecordEvidence(
  "관찰",
  "수학 수업에서 풀이 과정을 설명함"
);
assert.equal(legacySuggestion.area, "subject-development");
assert.equal(legacySuggestion.subject, "수학");
const structuredActivity = {
  ...schoolRecordActivities[1],
  schoolRecordEvidence: subjectEvidence
};
const structuredSubject = classifySchoolRecordReferences(
  [structuredActivity],
  "subject-development"
);
assert.equal(structuredSubject.primary[0]?.category, "수학");
assert.match(structuredSubject.primary[0]?.reason ?? "", /구조화된/);
const rawStructured = classifySchoolRecordReferences(
  [{ ...structuredActivity, schoolRecordEvidence: { ...subjectEvidence, reviewStatus: "raw" } }],
  "subject-development"
);
assert.equal(rawStructured.supporting.length, 1);
const excludedStructured = classifySchoolRecordReferences(
  [{ ...structuredActivity, schoolRecordEvidence: { ...subjectEvidence, reviewStatus: "excluded" } }],
  "subject-development"
);
assert.equal(excludedStructured.excluded[0]?.category, "교사 제외");

const { buildFullExportCsv, buildDiagnosticMarkdown } =
  await loadTypeScriptModule("../src/data-management.ts");
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
const fullExport = buildFullExportCsv(
  profile,
  [{ file: activityFile, number: "1", name: "김하늘", status: "active" }],
  [...expandedActivities, structuredActivity]
);
assert.match(fullExport, /"rowType","class","schoolYear"/);
assert.match(fullExport, /"student","우리 반","2026","1학기","3","2022 개정 교육과정","2026","1","김하늘","active"/);
assert.match(fullExport, /"subject-development","subject","teacher-observation","true","수학"/);
assert.match(fullExport, /"unit-1","분수의 의미","lesson-1"/);
const exportLines = fullExport.trim().split("\r\n");
assert.equal(exportLines[0].split(",").length, exportLines[1].split(",").length);
const diagnostic = buildDiagnosticMarkdown(profile, [
  { level: "warning", code: "missing-student-link", message: "studentPath 확인", source: "기록.md" }
]);
assert.match(diagnostic, /경고: 1건/);
assert.match(diagnostic, /missing-student-link/);

const { isLegacyAttendanceContent, isWikiLinkStudentPath } =
  await loadTypeScriptModule("../src/migration.ts");
assert.equal(isLegacyAttendanceContent("| 번호 | 학생 | 상태 |\n| --- | --- | --- |"), true);
assert.equal(isLegacyAttendanceContent("| 번호 | 학생 | 상태 | 사유 |"), false);
assert.equal(isWikiLinkStudentPath("[[학급운영/학생/01 김하늘]]"), true);
assert.equal(isWikiLinkStudentPath("학급운영/학생/01 김하늘"), false);

const { nextRecurringDate, taskRecurrenceLabel } =
  await loadTypeScriptModule("../src/task.ts");
assert.equal(nextRecurringDate("2026-07-21", "daily"), "2026-07-22");
assert.equal(nextRecurringDate("2026-07-21", "weekly"), "2026-07-28");
assert.equal(nextRecurringDate("2026-01-31", "monthly"), "2026-02-28");
assert.equal(taskRecurrenceLabel("monthly"), "매월 반복");

assert.deepEqual(
  filterActivities([
    ...activities,
    { ...activities[1], id: "attendance-present", status: "출석", title: "출석" }
  ], { ...emptyFilters, kind: "attendance", status: "__attendance-exception__" })
    .map((item) => item.id),
  ["2"]
);

const {
  auditCurriculumAlignment,
  auditConceptInquiryDesign,
  curriculumLessonMarkdown,
  curriculumUnitMarkdown,
  createConceptInquiryStrand,
  emptyCurriculumLesson,
  emptyCurriculumUnit,
  parseCurriculumLesson,
  parseCurriculumUnit,
  taughtHoursForUnit
} = await loadTypeScriptModule("../src/curriculum.ts");
const curriculumSettings = {
  className: "우리 반",
  schoolYear: "2026",
  semester: "1학기",
  grade: "3",
  curriculum: "2022 개정 교육과정",
  schoolSubjects: ["수학", "국어"]
};
const unitDraft = emptyCurriculumUnit(curriculumSettings);
unitDraft.id = "unit-1";
unitDraft.unitName = "분수의 의미";
assert.equal(auditCurriculumAlignment(unitDraft).score, 0);
Object.assign(unitDraft, {
  achievementStandards: "[4수01-10] 분수의 의미를 이해한다.",
  studentNeeds: "생활 속에서 분수를 사용한 경험을 나눈다.",
  enduringUnderstanding: "분수는 전체와 부분의 관계를 나타낸다.",
  essentialQuestion: "같은 양을 서로 다른 분수로 어떻게 나타낼까?",
  assessmentTask: "생활 속 분수 상황을 만들고 설명한다.",
  evaluationCriteria: "전체와 부분의 관계를 분수로 정확히 표현하고 설명한다.",
  evaluationMethods: ["관찰평가", "구술·발표"],
  feedbackPlan: "표현을 비교하고 수정할 재도전 기회를 제공한다.",
  recordFocus: "분수 표현을 선택한 근거와 설명 과정",
  learningPlan: "상황 탐색 → 분수 표현 → 친구의 표현 비교 → 설명 수정"
});
assert.equal(auditCurriculumAlignment(unitDraft).score, 100);
const unitMarkdown = curriculumUnitMarkdown(unitDraft, curriculumSettings);
assert.match(unitMarkdown, /class-management: curriculum-unit/);
assert.match(unitMarkdown, /alignmentScore: 100/);
const strand = createConceptInquiryStrand(1);
Object.assign(strand, {
  title: "분수의 관계",
  generalization: "분수 표현은 전체와 부분의 관계에 따라 달라진다.",
  factualQuestions: "분수의 분모와 분자는 무엇을 나타내는가?",
  conceptualQuestions: "전체가 달라지면 같은 분수의 양은 어떻게 달라지는가?\n분수 표현 사이에는 어떤 관계가 있는가?\n같은 양을 서로 다른 분수로 어떻게 나타낼 수 있는가?",
  debatableQuestions: "분수는 항상 공평한 나눔을 나타내는가?",
  contentKnowledge: "분모, 분자, 단위분수, 동치분수",
  coreSkills: "비교하기, 관계 설명하기, 표현 전이하기",
  evaluationMethods: "관찰평가, 구술·발표"
});
Object.assign(unitDraft, {
  conceptInquiryEnabled: true,
  unitOverview: "생활 속 나눔 상황에서 분수 관계를 탐구한다.",
  keyIdea: "분수는 전체와 부분의 관계를 나타내며 다양한 방식으로 표현할 수 있다.",
  conceptualLens: "관계",
  macroConcepts: ["관계", "표현"],
  microConcepts: ["단위분수", "동치분수"],
  conceptMap: "관계 → 분수 표현 → 전이",
  conceptInquiryStrands: [strand],
  priorKnowledge: "나눔 경험을 그림과 말로 표현한다.",
  transferContext: "다른 크기의 피자 나눔을 비교하여 공정성을 설명한다.",
  studentAgency: "학생이 비교할 사례와 표현 방법을 선택한다.",
  analyticRubric: "지식·이해: 분수 관계 / 과정·기능: 설명 / 가치·태도: 근거 존중"
});
assert.equal(auditConceptInquiryDesign(unitDraft).score, 100);
const conceptMarkdown = curriculumUnitMarkdown(unitDraft, curriculumSettings);
assert.match(conceptMarkdown, /## 개념기반 탐구학습 설계/);
assert.match(conceptMarkdown, /개념적 렌즈: 관계/);
assert.match(conceptMarkdown, /개념적 질문:/);
const unitFile = { path: "학급운영/교육과정/설계/수학 분수의 의미.md", basename: "수학 분수의 의미", stat: { ctime: 10 } };
const parsedUnit = parseCurriculumUnit(unitFile, {
  "class-management": "curriculum-unit",
  curriculumUnitId: unitDraft.id,
  subject: unitDraft.subject,
  unitName: unitDraft.unitName,
  designApproach: unitDraft.designApproach,
  curriculumStatus: unitDraft.status,
  plannedHours: 8,
  achievementStandards: unitDraft.achievementStandards,
  enduringUnderstanding: unitDraft.enduringUnderstanding,
  essentialQuestion: unitDraft.essentialQuestion,
  assessmentTask: unitDraft.assessmentTask,
  evaluationCriteria: unitDraft.evaluationCriteria,
  evaluationMethods: unitDraft.evaluationMethods,
  feedbackPlan: unitDraft.feedbackPlan,
  recordFocus: unitDraft.recordFocus,
  learningPlan: unitDraft.learningPlan
});
assert.equal(parsedUnit?.plannedHours, 8);
assert.deepEqual(parsedUnit?.evaluationMethods, ["관찰평가", "구술·발표"]);
const parsedConceptUnit = parseCurriculumUnit(unitFile, {
  "class-management": "curriculum-unit",
  curriculumUnitId: "unit-1",
  subject: "수학",
  unitName: "분수의 의미",
  conceptInquiryEnabled: true,
  keyIdea: unitDraft.keyIdea,
  conceptualLens: "관계",
  macroConcepts: '["관계","표현"]',
  microConcepts: ["단위분수"],
  conceptInquiryStrands: JSON.stringify([strand]),
  inquiryPhases: '["engage","generalize","transfer","reflect"]',
  knowledgeStructure: "knowledge-process"
});
assert.equal(parsedConceptUnit?.conceptInquiryEnabled, true);
assert.equal(parsedConceptUnit?.conceptInquiryStrands[0]?.generalization, strand.generalization);
assert.deepEqual(parsedConceptUnit?.inquiryPhases, ["engage", "generalize", "transfer", "reflect"]);
const lessonDraft = emptyCurriculumLesson(parsedUnit);
Object.assign(lessonDraft, {
  id: "lesson-1",
  date: "2026-07-21",
  objective: "분수의 의미를 설명한다.",
  activities: "분수 상황을 만들고 비교한다.",
  assessmentEvidence: "분수 표현과 설명",
  status: "completed",
  hours: 2
});
assert.match(curriculumLessonMarkdown(lessonDraft, curriculumSettings), /curriculumUnitPath: "\[\[/);
const parsedLesson = parseCurriculumLesson(
  { path: "학급운영/교육과정/수업일지/차시.md", basename: "차시", stat: { ctime: 11 } },
  {
    "class-management": "curriculum-lesson",
    curriculumLessonId: "lesson-1",
    curriculumUnitId: "unit-1",
    curriculumUnitTitle: "분수의 의미",
    curriculumUnitPath: "[[학급운영/교육과정/설계/수학 분수의 의미]]",
    subject: "수학",
    date: "2026-07-21",
    sequence: 1,
    lessonHours: 2,
    conceptInquiryPhase: "transfer",
    conceptInquiryStrandId: strand.id,
    conceptInquiryStrandTitle: strand.title,
    studentGeneralization: strand.generalization,
    transferEvidence: "다른 크기의 피자 나눔 상황에 적용함",
    lessonStatus: "completed"
  }
);
assert.equal(parsedLesson?.unitPath, "학급운영/교육과정/설계/수학 분수의 의미");
assert.equal(parsedLesson?.conceptInquiryPhase, "transfer");
assert.match(parsedLesson?.transferEvidence ?? "", /피자/);
assert.equal(taughtHoursForUnit("unit-1", [parsedLesson]), 2);

console.log(
  "Data tests passed (CSV 7, attendance 9, assignment 3, activity 4, calendar 7, notice 2, routine 3, task 4, report 5, AI draft 8, school record 9, evidence 17, curriculum 20, export 4, migration 4 cases)."
);
