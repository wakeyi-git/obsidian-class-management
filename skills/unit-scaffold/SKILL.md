---
name: unit-scaffold
description: 진도표를 근거로 일반 단원 계획 노트를 일괄 생성한다(전개·성취기준·수행평가·지도서 딥링크·통합 이관 표시). 트리거 - "일반 단원 생성", "단원 노트 스캐폴드", "단원 계획 일괄", 새 학기·학년 0단계 4번. 통합(프로젝트) 단원 설계는 이 스킬이 아니라 교사와의 설계 대화로 진행한다.
---

# 일반 단원 스캐폴드 (모드 B — 교사의 명시적 지시 필요)

볼트 `AGENTS.md` 모드 B와 3계명(코어 직렬화·왕복 검증+백업·멱등)을 준수한다. 산출물은 초안이며 교육적 서술(학생 요구·핵심역량 등)은 교사 몫으로 비워 둔다.

## 경로

- 저장소: `/Users/wakeyi/Documents/develop/class-management` (이하 REPO)
- 볼트: `/Users/wakeyi/Documents/classroom` (이하 VAULT), 대상 폴더 `VAULT/학급운영/교육과정/설계/`

## 절차

1. **입력 확인**: 대상 학기(예: "1학기"). 진도표(`VAULT/학급운영/교육과정/진도표/{연도} {학기} {과목} 진도표.md`)가 채워져 있어야 한다. 지도서 목차(`VAULT/지도서/*_지도서.목차.md`)가 있으면 딥링크에 사용.
2. **진도표 파싱** — 표 분할은 반드시 이스케이프 인지: `re.split(r'(?<!\\)\|', row)`. 행에서 수집: 순번·단원·영역·학습 내용·시수·배정 날짜들·성취기준 코드·프로젝트 열(구명 "통합 단원" 헤더도 존재 가능) 링크 별칭(`re.findall(r'\\\|([^\]]+)\]\]', cell)` — 복수 가능).
   - 그룹 규칙: 국·수·사·과·도·미·영은 단원명 그대로, **음악·체육은 대단원 권역**(단원명 번호 접두로 묶고 노트명은 목차의 대단원명). 행사·창체·'프로젝트'·Special 행은 제외.
3. **수행평가 매칭**: `VAULT/학급운영/과제/*수행평가*.md`에서 `- 단원:` 라인으로 그룹에 연결(◎ 기준·방법·날짜·파일명 수집).
4. **생성** — 코어를 번들해 플러그인과 같은 함수로 쓴다:
   ```js
   import { build } from "REPO/node_modules/esbuild/lib/main.js";
   await build({ entryPoints: ["REPO/packages/core/src/curriculum.ts"], bundle: true,
     format: "esm", platform: "node", outfile: "<scratch>/curriculum.mjs", external: ["obsidian"] });
   const { curriculumUnitMarkdown, auditCurriculumAlignment, DEFAULT_CONCEPT_INQUIRY_PHASES } = await import(...);
   ```
   필드 규칙: `designApproach: "within-subject"`, `conceptInquiryEnabled: false`, `status: "ready"`, 기간·시수=배정 집계, `learningPlan`=차시 전개(각 행 `순번. 학습내용 (M/D, N시수)` + 이관 차시는 ` → {프로젝트명} 통합 운영`), `achievementStandards`=코드+전문(성취기준 노트에서 statement 읽기 — 없으면 코드만), 평가 3종=수행평가에서(없으면 상시 관찰 문구), **개요는 `theme`에**(unitOverview는 CI 전용이라 본문 미표시), 핵심 이해·질문은 성취기준에서 1문장씩 도출하되 교사 검토 대상임을 보고에 명시.
   파일명 `{과목} {단원명}.md` — `<>` 등 금지 문자는 공백 치환. **기존 파일은 건너뛴다.**
5. **검증·보고**: 단원별 `auditCurriculumAlignment` 점수 출력(100 목표), 생성/건너뜀 개수, 이관 표시 건수. 링크(수행평가·지도서·프로젝트)가 실제 파일을 가리키는지 존재 확인.

## 함정

- 단원 노트 frontmatter를 다시 읽을 땐 따옴표 선택 정규식(`"?...?"`) — Obsidian이 정규화할 수 있음.
- 표 셀 안 위키링크 `|`는 `\|` (escapeTableCell이 처리하지만 직접 셀을 만들 땐 주의).
- 성취기준 전문이 없으면 지어내지 말고 코드만 남긴다(전문 생성은 /standards-sync).
