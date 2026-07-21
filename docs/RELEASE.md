# 릴리스와 커뮤니티 제출

## 릴리스 준비

1. `npm run version -- 1.0.1`처럼 버전을 올립니다.
2. `CHANGELOG.md`를 갱신합니다.
3. `npm run check`를 실행합니다.
4. 실제 Obsidian 데스크톱·모바일 테스트 체크리스트를 완료합니다.
5. 버전과 정확히 같은 태그를 사용합니다. `v1.0.0`이 아니라 `1.0.0` 형식입니다.

태그를 push하면 릴리스 워크플로가 `main.js`, `manifest.json`, `styles.css`를 GitHub Release 첨부 파일로 게시합니다. 저장소 루트의 manifest도 같은 버전이어야 합니다.

## 최초 커뮤니티 제출

현재 공식 절차는 `obsidian-releases` 저장소 Pull Request가 아니라 [Obsidian Community directory](https://community.obsidian.md)의 **Plugins → New plugin** 화면에서 GitHub 저장소 URL을 제출하는 방식입니다.

제출 전 다음을 확인합니다.

- 공개 GitHub 저장소에 소스, `README.md`, `LICENSE`, 정확한 `manifest.json`이 있음
- manifest `id`가 고유하고 소문자·하이픈만 사용하며 `obsidian`을 포함하지 않음
- `1.0.0` GitHub Release에 `main.js`, `manifest.json`, `styles.css`가 첨부됨
- README에 네트워크·계정·결제·텔레메트리·외부 파일 접근 여부가 공개됨
- [Obsidian Developer policies](https://docs.obsidian.md/Developer+policies)와 [plugin submission guide](https://docs.obsidian.md/Plugins/Releasing/Submit+your+plugin)를 다시 확인함
- 자동 검토 결과의 오류를 수정할 때 버전을 올리고 새 Release를 게시함

저장소 URL과 유지관리 책임은 실제 배포자가 확정해야 합니다.
