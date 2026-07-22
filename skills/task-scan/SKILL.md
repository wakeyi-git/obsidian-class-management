---
name: task-scan
description: 학급 운영(교육과정 일체화 업무 전반)을 규칙 기반으로 스캔해 GTD 할 일을 수집한다 — 마감 임박 과제·프로젝트 시작·행사·미회신·시수 이상·설계 미완·백업 경과. 멱등(sourceKey). 트리거 - "할 일 수집 스캔", "task-scan", 예약 작업(평일 아침).
---

# 학급 운영 GTD 할 일 자동 수집

볼트를 **읽기 전용으로 스캔**해 실행 가능한 할 일만 `학급운영/할 일/`에 생성한다. 판단·평가는 하지 않는다 — 아래 규칙표가 전부이고, 규칙 밖 항목은 만들지 않는다.

- 볼트: `/Users/wakeyi/Documents/classroom` (이하 VAULT)
- 저장소: `/Users/wakeyi/Documents/develop/class-management` — **core를 esbuild로 번들해 같은 직렬화 사용** (손으로 형식 흉내 금지)
- 쓰기는 `VAULT/학급운영/할 일/`에만. 다른 폴더는 절대 쓰지 않는다 (AGENTS.md 모드 B·RAW 불변 준수)

## 절차

1. **core 번들**: 스크래치에 esbuild(절대 경로 `저장소/node_modules/esbuild/lib/main.js`)로 `packages/core/src/index.ts` 번들. 사용 함수: `parseProgressTable`·`parseAcademicCalendar`·`parseBaseTimetable`·`semesterRange`·`plannedHoursBySubject`·`buildHoursAudit`·`parseHoursStandard`·`auditCurriculumAlignment`·`taskMarkdown`·`extractStandardCodes`. YAML 파싱은 스크래치 `yamltool/node_modules/js-yaml`(없으면 `npm install --prefix <스크래치>/yamltool js-yaml`).
2. **기존 sourceKey 수집**: `할 일/*.md` 프론트매터의 `sourceKey` 전부 (완료 포함). **이미 있는 키는 절대 재생성하지 않는다** — 사용자가 삭제한 할 일도 같은 실행일이면 부활 금지(키에 기준일 포함으로 자연 해결).
3. **규칙표 평가** (오늘 = core `localDate()` — 로컬 시간대 기준, UTC 금지. 학기 설정은 plugin data.json의 semester):

| # | 규칙 | 할 일 제목 | due | project/context | sourceKey |
|---|---|---|---|---|---|
| 1 | 과제일 D-7 이내(미래) | `◆ {과제명} 평가 준비 — 루브릭·평가지 확인` | 과제일 | 교육과정 일체화 / 평가 | `assignment:{파일명}` |
| 2 | 프로젝트 startDate D-7 이내(미래) | `✦ {프로젝트} 시작 준비 — 전개·준비물 점검` | startDate | 교육과정 일체화 / 수업 준비 | `project-start:{단원파일명}` |
| 3 | 행사 D-3 이내(미래) | `행사 준비: {이름}` | 행사일 | 학급 운영 / 행정 | `event:{날짜}:{이름}` |
| 4 | 가정통신문 dueDate D-2 이내·미회신 있음 | `{제목} 미회신 {N}명 확인` | dueDate | 학급 운영 / 소통 | `notice:{파일명}:{기준일}` |
| 5 | 시수 점검 부족/잉여(soft: 상태 ok 아님) | `{과목} 시수 {상태} 확인 — 시수 점검 표` | (없음) | 교육과정 일체화 / 계획 | `hours:{과목}:{ISO주차}` |
| 6 | 운영 중·2주 내 시작 단원의 설계 error 이슈 | `{단원} 설계 보완: {첫 error 메시지}` | startDate | 교육과정 일체화 / 계획 | `design:{단원파일명}` |
| 7 | 마지막 백업 30일 경과 | `수동 백업 실행 — 백업·유지관리` | (없음) | 학급 운영 / 유지관리 | `backup:{ISO주차}` |

- 규칙 6은 **상위 3건까지만** (소음 방지). 전 규칙 합계 상한 12건 — 넘으면 due 가까운 순.
- 학생 이름·기록 내용은 할 일 제목에 넣지 않는다 (규칙 4는 인원수만).
4. **생성**: `taskMarkdown(task, settings, 오늘, { sourceKey })`로 본문 생성, `status: "inbox"`, `recurrence: "none"`, detail에 근거 한 줄(예: "출처: 2026-09-18 과학 수행평가 노트"). 파일명 `{오늘} {HHMMSS} {제목 safe}.md` (repository 규칙과 동일). 존재 파일명 충돌 시 ` 2` 접미.
5. **요약 출력**: 규칙별 생성/건너뜀 수, 생성된 제목 목록. 생성 0건이면 "새 할 일 없음"이라고만.

## 함정

- 과제일·행사일은 학기 밖(방학)이어도 D-창에 들면 수집한다 (개학 준비).
- 프로젝트 = `conceptInquiryEnabled: true` 단원. frontmatter는 js-yaml로 파싱(strands는 JSON 문자열일 수 있음 — 무시 가능).
- 진도표 프로젝트 열 링크의 `\|` 이스케이프 주의.
- 백업 최신성은 `학급운영/백업/` 폴더명(YYYY-MM-DD 접두) 최댓값으로 판단.
- 실행 환경이 헤드리스여도 파일 쓰기는 유효 — Obsidian이 다음 실행 때 인덱싱한다.
