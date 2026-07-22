---
name: vault-audit
description: 학급운영 데이터의 정합성을 읽기 전용으로 전수 점검한다(진도표 무결·시수·링크·일체화 점수). 트리거 - "볼트 점검", "데이터 검증", "정합 확인", 학기초·대량 작업 후·이상 징후 시.
---

# 볼트 데이터 정합 점검 (읽기 전용 — 어떤 파일도 수정하지 않는다)

코어를 번들해 플러그인과 같은 파서·계산으로 검사한다(REPO=`/Users/wakeyi/Documents/develop/class-management`, VAULT=`/Users/wakeyi/Documents/classroom`).

## 점검 항목

1. **진도표 왕복 무결**: 각 진도표를 parse→serialize→parse 하여 순번·배정·고정·시수·성취기준·링크·비고 동일성 확인(코어 `progress`).
2. **배정 정합**: `assignProgress`/`buildAssignedSlotContents`로 차시=슬롯 일치(부족·잉여), 같은 날짜·교시 중복 배정, 📌 고정 위반 여부.
3. **시수 점검**: `buildHoursAudit`(hours-audit)로 과목별 기준 대비 계획·실행 상태(적정/초과/미달) 표.
4. **링크 무결**: 진도표·설계·과제·근거 노트의 위키링크 대상 존재 확인 — 성취기준 `[[4…]]`, 단원, 과제, 수업일지, 지도서 `#page` 파일. 깨진 링크 목록화.
5. **상호 정합**: 과제 노트의 date·단원 ↔ 진도표 과제 열 링크 양방향 일치, 단원 기간 ↔ 진도표 배정 범위 포함 관계, 수업일지 date·교시 ↔ 진도표 비고 역링크.
6. **일체화 점수**: 설계 노트 전수 `auditCurriculumAlignment`(+통합은 `auditConceptInquiryDesign`) — 100 미만 목록.
7. **원칙 표본**: raw 스탬프 누락(날짜 지난 수업일지 중 recordStatus 없음), 학생 확인표 학생 수 ↔ 현재 명단 차이.

## 보고 형식

항목별 ✅/⚠️ 요약 표 + ⚠️ 상세(파일·행·내용). 수정은 제안만 하고 실행하지 않는다 — 교사가 지시하면 해당 작업은 모드 B 스킬(/unit-scaffold, /assessment-import, /standards-sync) 또는 플러그인 기능으로 수행한다.
