# class-management — 에이전트 작업 지침

Classroom Manager 옵시디언 플러그인 저장소. 실사용 볼트는 `~/Documents/classroom`(민감한 학생 데이터 — 볼트 작업 시 그쪽 `AGENTS.md`의 모드 A/B 규약을 먼저 읽을 것).

## 필독 설계 문서 (새 기능은 이 순서로 검토)

1. [docs/PRODUCT.md](docs/PRODUCT.md) — 목표·비목표·아키텍처 3원칙(노트=진실/원장=계산/과거=불변)·데이터 모델(kind 22종)·LLM 협업 모델(§9-1)·로드맵(§10, R0가 최우선)
2. [docs/UX-FLOWS.md](docs/UX-FLOWS.md) — 뷰 지도·워크플로 0~6·진입 규약(좌클릭=보기/우클릭=편집)
3. [docs/DESIGN.md](docs/DESIGN.md) — AI 에이전트용 시각 언어·토큰·레이아웃·컴포넌트·반응형·접근성 구현 규격
4. [docs/UIUX-PRINCIPLES.md](docs/UIUX-PRINCIPLES.md) — 상호작용 규약·**용어 사전(§2: 수업일지/과제/단원/학생부 근거 — 유의어 금지)**·알림 문형·LLM 협업 규약(§6-1)·리팩토링 백로그(§7)

## 코드 경계 (테스트로 강제됨)

- `packages/core` = 순수 도메인 로직. **obsidian은 `import type`만**, 코어 밖 모듈 참조 금지 — `tests/core-purity.test.mjs`가 검사. 플러그인 쪽에서는 `@core/*` 별칭으로 임포트.
- 볼트 IO는 `src/class-repository.ts`로만. 뷰·모달은 plugin 메서드 호출.
- 노트 직렬화·Bases 정의는 core가 단일 진실 — 볼트 데이터 스크립트도 core를 esbuild로 번들해 같은 함수를 쓴다(손으로 형식 흉내 금지).

## 검증·릴리스 절차

```bash
npx tsc -noEmit -skipLibCheck && npm test   # 테스트 94+개, 전부 통과 필수
```

릴리스: CHANGELOG 항목 추가 → `npm run version -- X.Y.Z` → `npm run check` → `npm run deploy`(볼트 배포) → 커밋(메시지 끝 `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`) → `git push` → 태그 `X.Y.Z`(v 접두사 없음) push → release.yml 성공 확인.

- gh CLI 토큰에 workflow 스코프가 없으므로 push는 일반 `git push`.
- 의존성·워크스페이스 변경 시 `npm install`로 package-lock.json 동기화(안 하면 CI `npm ci` 실패).
- 배포 후 사용자가 플러그인을 다시 로드해야 반영됨 — 요약에 명시할 것.

## 프로젝트 스킬 (skills/ — `.claude/skills`는 이곳을 가리키는 심링크)

LLM 협업 경로의 표준 절차가 스킬로 패키징되어 있다 — 해당 작업 요청 시 반드시 스킬을 먼저 호출한다:
`/unit-scaffold`(일반 단원 일괄) · `/assessment-import`(평가계획→과제·루브릭) · `/standards-sync`(성취기준 노트·링크) · `/vault-audit`(정합 점검, 읽기 전용) · `/record-draft`(생기부 초안, 모드 A).

## 볼트 데이터 작업 3계명 (UIUX §6-1)

① core 직렬화 함수 사용 ② 대량 변경은 왕복 파싱 검증 + 사전 백업 + 결과 요약 ③ 생성은 멱등(존재 시 건너뜀). 학생 확인표 상태·출결·기록 내용은 수정 금지, 산출물은 교사 검토 전 확정 상태로 승격 금지, 판단·평가는 위임받지 않음.
