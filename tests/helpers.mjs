import { Buffer } from "node:buffer";
import { fileURLToPath } from "node:url";
import esbuild from "esbuild";

export async function loadTypeScriptModule(relativePath) {
  const entryPoint = fileURLToPath(new URL(relativePath, import.meta.url));
  const result = await esbuild.build({
    entryPoints: [entryPoint],
    bundle: true,
    format: "esm",
    platform: "node",
    target: "node18",
    alias: { "@core": fileURLToPath(new URL("../packages/core/src", import.meta.url)) },
    write: false
  });
  const output = result.outputFiles?.[0];
  if (!output) throw new Error(`${relativePath}를 테스트용으로 빌드하지 못했습니다.`);

  const moduleUrl = `data:text/javascript;base64,${Buffer.from(output.contents).toString("base64")}`;
  return import(moduleUrl);
}

export const EMPTY_FILTERS = Object.freeze({
  query: "",
  studentNumber: "",
  kind: "",
  status: "",
  dateFrom: "",
  dateTo: ""
});

export const AI_SETTINGS = Object.freeze({
  baseFolder: "학급운영",
  recordsFolder: "기록",
  attendanceFolder: "출결",
  assignmentsFolder: "과제",
  studentsFolder: "학생",
  aiAnonymizeStudents: true
});

export function makeActivityFile() {
  return { path: "테스트.md", basename: "테스트", stat: { ctime: 1 } };
}

export function makeActivities(activityFile = makeActivityFile()) {
  return [
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
}

export function makeExpandedActivities(activityFile = makeActivityFile()) {
  const activities = makeActivities(activityFile);
  return [
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
}

export function makeSchoolRecordActivities(activityFile = makeActivityFile()) {
  const activities = makeActivities(activityFile);
  return [
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
}

export function makeSubjectEvidence(emptySchoolRecordEvidence) {
  const evidence = emptySchoolRecordEvidence("subject-development");
  Object.assign(evidence, {
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
  return evidence;
}
