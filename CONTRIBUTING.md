# 기여 안내

Classroom Manager는 학생 개인정보를 다루므로 데이터 보존성과 명시적 사용자 동의를 기능 편의보다 우선합니다.

## 개발 준비

Node.js 18 이상에서 다음 명령을 실행합니다.

```bash
npm ci
npm run check
```

실제 업무 Vault가 아닌 별도 개발 Vault의 `.obsidian/plugins/class-management/`에 저장소를 두고 테스트하세요. `npm run dev`는 변경을 감시해 `main.js`를 다시 만듭니다.

## 변경 원칙

- 핵심 자료는 일반 Markdown 또는 CSV로 남겨야 합니다.
- 기존 노트와 지침 파일을 묵시적으로 덮어쓰지 않습니다.
- 삭제가 필요한 기능은 Obsidian 휴지통과 명시적 확인을 사용합니다.
- 외부 네트워크, 텔레메트리, 계정, 결제, API 키 저장 기능을 추가하지 않습니다.
- 학생 자료의 외부 전달이 필요한 변경은 범위 미리보기, 기본 비활성화, 익명화, 교사 검토를 포함해야 합니다.
- 새 파서·변환에는 `tests/csv.test.mjs` 또는 별도 테스트를 추가합니다.
- UI 입력에는 연결된 레이블이나 `aria-label`을 제공하고 모바일 너비에서 확인합니다.

## 제출 전 확인

```bash
npm run check
```

변경 목적, 데이터 형식 영향, 마이그레이션 필요 여부, 수동 테스트 결과를 Pull Request에 적어 주세요. 보안 문제는 공개 이슈 대신 [SECURITY.md](SECURITY.md)를 따릅니다.
