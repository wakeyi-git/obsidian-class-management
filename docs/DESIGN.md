# Classroom Manager 디자인 가이드

> AI 에이전트와 기여자가 일관된 Obsidian UI를 만들기 위한 구현 규격이다. 새 화면을 설계하거나 기존 화면을 수정할 때 이 문서를 먼저 읽는다.

## 1. 규칙의 우선순위

충돌이 생기면 다음 순서로 판단한다.

1. 현재 작업에서 사용자가 명시한 요구사항
2. 이 문서의 시각·컴포넌트 규칙
3. [`UIUX-PRINCIPLES.md`](UIUX-PRINCIPLES.md)의 상호작용·용어·안전 규칙
4. [`UX-FLOWS.md`](UX-FLOWS.md)의 화면 구조와 진입 경로
5. [`PRODUCT.md`](PRODUCT.md)의 제품 목표와 데이터 원칙
6. 기존 구현

기존 코드와 이 문서가 다르면 기존 구현을 새 규칙의 근거로 삼지 않는다. 작업 범위 안에서 고치거나, 범위를 벗어나면 `UIUX-PRINCIPLES.md`의 리팩토링 백로그에 남긴다.

이 문서에서 **해야 한다**는 필수, **권장한다**는 특별한 이유가 없으면 따르는 기본값, **하지 않는다**는 금지를 뜻한다.

## 2. 디자인 방향

Classroom Manager의 UI는 **조용하고 밀도 높은 교사의 작업대**다.

- **Obsidian답게**: 별도의 웹앱처럼 꾸미지 않고 현재 Obsidian 테마, 글꼴, 컨트롤을 따른다.
- **한눈에 스캔 가능하게**: 장식보다 날짜, 과목, 학생, 상태와 다음 행동의 위계를 분명히 한다.
- **운영 중 빠르게**: 자주 쓰는 행동은 가까이 두고 입력 단계를 줄인다. 화면 전환과 모달을 남발하지 않는다.
- **안전하고 차분하게**: 위험·경고 색은 실제 예외에만 쓴다. 대량 변경과 파괴적 행동은 평상시 행동과 시각적으로 구분한다.
- **연결을 보이게**: 교육과정 → 수업 → 평가 → 기록의 관계가 제목, 메타데이터, 링크와 배치에서 드러나야 한다.
- **평면적으로 구조화하기**: 여백, 제목, 정렬, 구분선으로 먼저 위계를 만든다. 배경 상자와 카드 테두리는 마지막 수단이다.

장식적 대시보드, 마케팅 페이지, 모바일 앱 스타일의 큰 카드와 과도한 색상은 이 제품의 시각 언어가 아니다. 배경·테두리·그림자를 제거해도 정보 묶음이 이해된다면 카드로 만들지 않는다.

## 3. 에이전트 작업 순서

UI 코드를 쓰기 전에 반드시 다음을 수행한다.

1. 위의 설계 문서와 [`CLAUDE.md`](../CLAUDE.md)를 읽는다.
2. `src/`와 `styles.css`에서 같은 역할의 화면을 찾는다. 이름이 아니라 **화면 유형과 행동**이 비슷한 구현을 찾는다.
3. 아래 화면 유형 중 하나를 선택하고 그 구조를 따른다.
4. 기존 공용 클래스로 표현할 수 있으면 재사용한다. 역할이 다른데 모양만 같다는 이유로 클래스를 공유하지 않는다.
5. 카드 CSS를 쓰기 전에 같은 내용을 **제목+여백**, **구분선 목록**, **표**, **인라인 상태**로 표현할 수 있는지 먼저 확인한다.
6. 데스크톱, 좁은 패널, 모바일, 키보드 조작을 함께 설계한다.
7. 구현 뒤 이 문서 끝의 완료 체크리스트를 검증한다.

### 화면 유형

| 유형 | 기본 구조 | 참고 구현 |
|---|---|---|
| 시작·요약 | 헤더 → 요약 지표 → 1~2열 핵심 패널 | `src/dashboard-view.ts` |
| 운영 화면 | 설정 상태 → 기간 탐색 → 운영 표 → 점검 → 행동 | `src/curriculum-ops-view.ts` |
| 검색·목록 | 헤더 → 필터 → 결과 수 → 표 또는 목록 | `src/activity-list-view.ts` |
| 시간 기반 | 기간 탐색 → 범례/필터 → 캘린더·타임라인 | `src/calendar-view.ts` |
| 오른쪽 패널 | 짧은 헤더 → 작은 요약 → 섹션 목록 → 보조 행동 | `src/today-view.ts`, `src/student-inspector-view.ts` |
| 입력 모달 | 제목·설명 → `Setting` 필드 → 검증 → 취소·저장 | `src/curriculum-unit-modal.ts` |

## 4. Obsidian 네이티브 원칙

### 4.1 기본 API

- 아이콘은 `setIcon()`과 Lucide 이름을 사용한다. 직접 SVG, 아이콘 폰트, 장식용 이모지를 추가하지 않는다.
- 폼은 가능한 한 Obsidian의 `Setting`, `TextComponent`, `DropdownComponent`, `ToggleComponent`, `ButtonComponent`를 사용한다.
- 팝업 선택지는 `Menu`, 짧은 피드백은 `Notice`, 집중 입력은 `Modal`, 지속 탐색은 `ItemView`를 사용한다.
- 주요 버튼은 Obsidian의 `mod-cta` 또는 `setCta()`를 사용한다.
- 위험 버튼은 `setWarning()`을 사용한다. 위험을 표현하려고 별도의 빨간 버튼 CSS를 만들지 않는다.
- 본문 글꼴과 기본 컨트롤 높이, 테두리, 그림자는 Obsidian에 맡긴다.

### 4.2 테마 호환

색은 반드시 Obsidian CSS 변수 또는 그 변수의 `color-mix()` 결과로 표현한다.

```css
/* 좋음 */
color: var(--text-muted);
border-color: var(--background-modifier-border);
background: color-mix(in srgb, var(--interactive-accent) 10%, transparent);

/* 금지 */
color: #6b7280;
background: rgba(124, 58, 237, 0.12);
```

`#hex`, `rgb()`, `hsl()`, CSS 색상 이름을 새로 추가하지 않는다. fallback에 하드코딩 색을 넣는 것도 금지한다. 그림자는 꼭 필요할 때만 Obsidian의 그림자 변수를 사용하고, 카드 구분은 기본적으로 배경과 1px 테두리로 해결한다.

## 5. 시각 토큰

### 5.1 색상 역할

| 역할 | 변수 | 사용처 |
|---|---|---|
| 기본 캔버스 | `--background-primary` | 뷰 배경, 표 셀 |
| 기본 표면 | `--background-secondary` | 패널, 필터 바, 보조 묶음 |
| 약한 표면 | `--background-primary-alt`, `--background-secondary-alt` | 중첩 카드, 비활성 영역 |
| 기본 경계 | `--background-modifier-border` | 카드, 표, 구분선 |
| 호버 | `--background-modifier-hover` | 클릭 가능한 행과 항목 |
| 본문 | `--text-normal` | 기본 텍스트 |
| 보조 | `--text-muted` | 설명, 날짜, 메타데이터 |
| 더 약한 보조 | `--text-faint` | 섹션 라벨, 빈 셀 |
| 강조 | `--interactive-accent`, `--text-accent` | 현재 선택, 핵심 연결, 통합 단원 |
| 강조 위 텍스트 | `--text-on-accent` | 강조 배경 위의 글자 |
| 성공 | `--text-success`, `--color-green` | 완료, 정상, 충족 |
| 경고 | `--text-warning`, `--color-orange` | 확인 필요, 과제 ◆ |
| 오류·위험 | `--text-error`, `--color-red` | 실패, 파괴적 상태, 오늘 표시 |
| 행사 | `--color-purple` | 행사 ● |

색만으로 의미를 전달하지 않는다. 텍스트, 아이콘, 모양, 패턴 중 하나를 함께 사용한다. 예를 들어 과제는 주황색뿐 아니라 `◆`, 행사는 보라색뿐 아니라 `●`로 구분한다.

### 5.2 간격

새 UI는 다음 4px 기반 스케일을 우선 사용한다.

| 값 | 용도 |
|---|---|
| `4px` | 아이콘과 짧은 라벨, 조밀한 행 내부 |
| `6px` | 작은 버튼 묶음, 조밀한 목록 간격 |
| `8px` | 일반 컨트롤 간격, 행 패딩 |
| `12px` | 카드 내부, 필터 바, 섹션 내 요소 |
| `16px` | 패널 내부, 섹션 사이 |
| `24px` | 중앙 뷰 바깥 여백, 큰 구획 사이 |

한 컴포넌트 안에서 임의의 `5px`, `7px`, `9px`, `11px`, `13px`를 새로 만들지 않는다. 기존 컴포넌트를 수정할 때는 주변 값과 정렬을 우선 보존하되, 새 컴포넌트는 위 스케일을 따른다.

### 5.3 모서리와 경계

| 반경 | 대상 |
|---|---|
| `6px` | 작은 행, 이벤트, 내부 항목 |
| `8px` | 입력 묶음, 작은 카드, 사이드 패널 지표 |
| `12px` | 필터 바, 표 래퍼, 일반 패널 |
| `14px` | 중앙 뷰의 큰 요약 카드 |
| `999px` | 상태 칩과 진행 막대만 |

- 경계는 기본적으로 `1px solid var(--background-modifier-border)`다.
- 중첩된 모든 요소에 테두리와 그림자를 반복하지 않는다. 바깥 패널에 경계가 있으면 내부 행은 구분선 또는 배경 변화만 사용한다.
- 둥근 모서리는 정보 위계를 나타내기 위해 사용한다. 모든 텍스트 조각을 알약 모양으로 만들지 않는다.
- 패널·카드의 한쪽 면만 강조색으로 두껍게 칠하지 않는다. 특히 `border-left`와 둥근 모서리를 결합하지 않는다.
- 원형 요소와 상태 칩을 제외한 반경은 `14px`를 넘지 않는다.

### 5.4 왼쪽 강조선 카드 금지와 대안

다음 조합은 중요도나 상태를 표현하는 기본 패턴으로 사용하지 않는다.

```css
/* 금지: LLM이 반복해서 만드는 왼쪽 강조선 카드 */
.class-management-example-card {
  padding: 16px;
  border: 1px solid var(--background-modifier-border);
  border-left: 4px solid var(--interactive-accent);
  border-radius: 12px;
  background: var(--background-secondary);
  box-shadow: var(--shadow-s);
}
```

`::before` 가상 요소, `inset` 그림자, 그라디언트로 왼쪽 색 띠를 흉내 내는 것도 같은 패턴으로 본다. 선택, 경고, 진행 상태라는 이유로 예외를 만들지 않는다. 기존 코드에 유사한 표현이 있어도 새 UI의 근거로 복제하지 않는다.

표현하려는 의미에 따라 다음 대안을 선택한다.

| 의도 | 사용하지 않을 것 | 기본 대안 |
|---|---|---|
| 섹션 구분 | 둥근 배경 카드 | 제목, 설명, 위쪽 구분선, 충분한 세로 여백 |
| 반복 항목 | 항목마다 독립 카드 | 하나의 목록 안에서 행 간 구분선 |
| 현재 선택 | 왼쪽 강조선 카드 | 행 전체의 약한 선택 배경 + 강조 텍스트/아이콘 + `aria-current` |
| 경고·오류 | 색 띠가 있는 경고 카드 | 입력 가까운 상태 문구 + 아이콘/라벨 + `Notice` 또는 위험 버튼 |
| 진행률 | 강조선 요약 카드 | 수치 텍스트 + 얇은 진행 막대 |
| 동등한 개체 비교 | 서로 다른 색의 카드 묶음 | 정렬된 표·목록; 꼭 필요할 때만 동일한 중립 카드 |

#### 대안 A: 평면 섹션

```ts
const section = container.createEl("section", {
  cls: "class-management-example-section"
});
const heading = section.createDiv({
  cls: "class-management-example-section-heading"
});
const text = heading.createDiv();
text.createEl("h3", { text: "오늘 루틴" });
text.createEl("p", { text: "완료할 항목을 확인합니다." });
heading.createEl("span", {
  text: "0/4 완료",
  cls: "class-management-example-section-status"
});
```

```css
.class-management-example-section {
  padding-block: 16px;
  border-top: 1px solid var(--background-modifier-border);
}

.class-management-example-section:first-child {
  padding-top: 0;
  border-top: 0;
}

.class-management-example-section-heading {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
}

.class-management-example-section-heading h3,
.class-management-example-section-heading p {
  margin: 0;
}

.class-management-example-section-heading p,
.class-management-example-section-status {
  color: var(--text-muted);
  font-size: var(--font-ui-smaller);
}
```

#### 대안 B: 카드 대신 구분선 목록

```css
.class-management-example-list {
  border-block: 1px solid var(--background-modifier-border);
}

.class-management-example-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 0;
  border-bottom: 1px solid var(--background-modifier-border);
}

.class-management-example-row:last-child {
  border-bottom: 0;
}
```

#### 대안 C: 현재 선택 행

```css
.class-management-example-nav-item[aria-current="page"] {
  color: var(--text-accent);
  background: var(--background-modifier-hover);
  font-weight: 600;
}
```

선택 배경은 행 전체에 균일하게 적용한다. 왼쪽 띠, 과도한 라운딩, 그림자를 추가하지 않는다. 상태가 자주 바뀌는 체크리스트는 각 항목을 카드로 만들지 말고 하나의 목록 안에서 체크박스, 텍스트, 구분선으로 표현한다.

### 5.5 타이포그래피

- 기본 글꼴과 본문 크기는 상속한다.
- 뷰 제목 `h2`: `1.7rem`, 굵게, 아래 설명과 4px 간격.
- 섹션 제목 `h3`: 기본 UI 제목 크기, 패널 위쪽에 배치.
- 핵심 수치: `1.45rem`; 사이드 패널 수치: `1.1em`.
- 보조 설명: `var(--font-ui-small)`.
- 날짜·상태·메타데이터: `var(--font-ui-smaller)`.
- 모노스페이스는 Markdown/CSV 원문, 경로, 진단 데이터에만 `var(--font-monospace)`로 쓴다.
- 긴 제목은 한 줄 말줄임, 설명과 관찰 내용은 줄바꿈을 기본으로 한다. 중요한 내용 전체를 말줄임으로 숨기지 않는다.
- 대문자와 자간을 사용하는 섹션 라벨은 좁은 사이드 패널에서만 허용한다.

## 6. 레이아웃

### 6.1 중앙 뷰

- 기본 바깥 여백은 `24px`, 모바일은 `14px`다.
- 상단 헤더는 왼쪽에 제목·한 줄 설명, 오른쪽에 행동을 둔다.
- 헤더 행동은 `display: flex; flex-wrap: wrap; gap: 8px`를 기본으로 한다.
- 핵심 요약은 한 줄 요약이나 정의 목록을 기본으로 한다. 서로 독립적으로 비교해야 하는 핵심 수치가 2~4개일 때만 동일 폭 카드를 사용한다. 수치가 5개 이상이면 표나 인라인 요약으로 바꾼다.
- 본문 그리드는 `minmax(0, 1fr)`를 사용해 긴 텍스트가 레이아웃을 밀지 않게 한다.
- 콘텐츠 폭을 임의의 고정 `px`로 제한하지 않는다. 표·보드처럼 구조 보존이 더 중요한 경우에만 `min-width`와 가로 스크롤을 함께 쓴다.

### 6.2 사이드 패널

- 바깥 여백은 `10px 8px` 정도로 조밀하게 유지한다.
- 카드보다 섹션과 구분선을 우선 사용한다.
- 제목은 짧게, 한 항목은 가능하면 두 줄 이내로 유지한다.
- 아이콘 전용 버튼은 툴바에서만 허용하며 `aria-label`과 `title`을 모두 제공한다.
- 중앙 뷰를 축소 복제하지 않는다. 오늘의 상태, 선택한 대상, 즉시 가능한 행동만 보여 준다.

### 6.3 모달

- 단순 입력은 Obsidian 기본 폭을 유지한다.
- 중간 폼은 `width: min(760px, 94vw)`, 넓은 표·복합 폼은 최대 `min(1040px, 96vw)` 범위에서 선택한다.
- 긴 폼은 전체 모달이 아니라 `.modal-content` 또는 본문 영역만 스크롤되게 한다.
- 필드는 의미 단위로 `h3`와 설명을 사용해 묶는다. 장식용 카드로 모든 섹션을 감싸지 않는다.
- 하단 행동은 **취소 → 보조 행동 → 저장** 순서로 놓고, CTA는 저장 하나만 둔다.
- 저장 중에는 중복 제출을 막고 버튼 문구나 설명으로 상태를 알린다. 입력 내용을 지우지 않는다.

### 6.4 반응형

기본 분기점은 다음 두 개만 사용한다.

- `700px`: 다열 레이아웃을 한 열로 전환하고 헤더 행동을 아래로 내린다.
- `600px`: 조밀한 운영 표와 작은 화면 전용 크기를 조정한다.

모바일 규칙:

- 클릭·탭 대상의 최소 높이는 `40px`다.
- 호버할 때만 보이는 행동은 모바일에서 항상 보이게 한다.
- 두 열 이상의 폼과 카드는 한 열로 바꾼다.
- 표의 의미가 무너지면 카드로 억지 변환하지 말고 가로 스크롤을 제공한다.
- `100vh` 고정 높이를 피하고, 스크롤 영역에는 `max-height`를 사용한다.
- 우클릭 동작에는 길게 누르기 또는 인스펙터 버튼이라는 터치 등가 경로가 있어야 한다.

## 7. 표준 컴포넌트

### 7.1 뷰 헤더

순서는 제목, 한 줄 설명, 행동이다. 설명은 사용자가 이 화면에서 얻는 결과를 말하며 기능 목록을 나열하지 않는다.

```ts
const header = container.createDiv({ cls: "class-management-view-header" });
const heading = header.createDiv();
heading.createEl("h2", { text: "화면 제목" });
heading.createEl("p", { text: "이 화면에서 확인하고 완료할 일을 한 문장으로 설명합니다." });

const actions = header.createDiv({ cls: "class-management-actions" });
actions.createEl("button", { text: "주요 행동", cls: "mod-cta" });
actions.createEl("button", { text: "보조 행동" });
```

- 한 행동 묶음에 CTA는 하나만 둔다.
- 자주 쓰는 행동부터 왼쪽에 둔다. 파괴적 행동은 일상 행동 옆에 두지 않는다.
- 버튼 라벨은 `동사 + 대상`을 기본으로 하고, 대상이 명확한 경우에만 `열기`, `편집…`, `저장`처럼 줄인다.

### 7.2 섹션, 패널과 요약 카드

- 패널은 하나의 질문에 답해야 한다. 예: “오늘 미체크 출결은?”, “최근 기록은?”
- 기본 표현은 평면 섹션이다. 패널은 서로 독립적으로 스크롤되거나 배경 구분이 꼭 필요한 영역에만 사용한다.
- 요약 카드는 `작은 라벨 → 큰 값` 순서이며 카드 전체를 클릭 가능하게 만들지 않는다. 탐색이 필요하면 명시적 링크나 버튼을 둔다.
- 같은 수준의 패널은 같은 배경, 반경, 패딩을 사용한다.
- 한 화면에 카드 안의 카드가 두 단계 이상 중첩되지 않게 한다.
- 반복되는 체크 항목, 설정 행, 탐색 항목은 카드가 아니라 목록과 구분선으로 표현한다.
- 카드가 꼭 필요해도 강조색 왼쪽 테두리, 장식용 그림자, 서로 다른 파스텔 배경을 사용하지 않는다.

### 7.3 필터 바

- 순서는 검색 → 주요 범주 → 상태 → 기간 → 초기화다.
- 각 컨트롤에는 항상 보이는 `<label>`이 있어야 한다. placeholder로 라벨을 대신하지 않는다.
- 필터 변경 결과는 가능한 한 즉시 갱신하고, 필터 아래에 `N건` 결과 수를 보여 준다.
- 적용 버튼이 필요하다면 한 번의 비싼 조회나 대량 작업처럼 즉시 반영이 부적절한 경우로 제한한다.

### 7.4 목록과 클릭 가능한 행

행 전체가 하나의 행동이면 실제 `<button>`을 사용한다. 복합 컨트롤 때문에 `div`를 써야 한다면 다음을 모두 제공한다.

- `role="button"`
- `tabindex="0"`
- Enter와 Space의 클릭 동등 동작
- Space에서 `preventDefault()`
- `aria-label`
- `:hover`와 `:focus-visible` 상태
- 모바일 최소 높이 40px

한 행의 좌클릭과 우클릭은 서로 다른 일을 동시에 실행하지 않는다. 표준은 **좌클릭=보기, 우클릭=편집 메뉴**다. `aria-label`은 `클릭: …, 우클릭: …` 형식으로 두 경로를 설명한다.

### 7.5 버튼

- 텍스트 버튼을 기본으로 한다. 아이콘은 인지를 돕되 라벨을 대체하지 않는다.
- 아이콘 전용 버튼은 좁은 툴바의 반복 행동에만 사용한다.
- 비활성 버튼은 이유를 근처 설명이나 `title`로 알린다.
- 비동기 행동은 실행 중 버튼을 비활성화하고 중복 실행을 막는다.
- `div`나 `span`에 클릭 이벤트를 달아 버튼처럼 꾸미지 않는다.
- 버튼 안에 버튼을 중첩하지 않는다.

### 7.6 폼

- 새 모달은 `Setting`을 기본 단위로 사용한다.
- 라벨은 명사, 도움말은 입력 목적과 형식, placeholder는 실제 예시를 담당한다.
- 날짜는 `YYYY-MM-DD` 형식을 사용하고 가능한 경우 입력 맥락으로 미리 채운다.
- 필수값은 저장 시뿐 아니라 입력 가까이에서 검증한다.
- 오류는 `--text-error`, 경고는 `--text-warning`을 사용하고 구체적인 해결 방법을 함께 쓴다.
- 사용자가 입력한 값을 검증 실패 때문에 버리지 않는다.
- 자동 제안은 사용자가 수정할 수 있어야 하며, 자동 판단을 확정 상태로 저장하지 않는다.

### 7.7 표

- `width: 100%`, `border-collapse: collapse`를 기본으로 한다.
- 운영 표는 `table-layout: fixed`를 사용한다. 첫 열처럼 의미가 고정된 열만 폭을 지정하고 나머지는 균등하게 둔다.
- 헤더는 긴 표에서 sticky로 유지한다.
- 숫자는 같은 정렬을 사용하고, 본문은 읽기 방향에 맞춰 왼쪽 정렬한다.
- 긴 텍스트는 `overflow-wrap: break-word`로 처리한다. 상세 내용 전체를 한 줄 말줄임으로만 감추지 않는다.
- 작은 화면에서는 표 래퍼에 가로 스크롤을 주고 표 자체에 필요한 `min-width`를 둔다.
- 행 호버만으로 편집 가능성을 알리지 않는다. 키보드 포커스와 모바일 대체 경로도 제공한다.

### 7.8 상태와 배지

- 상태 클래스는 `is-active`, `is-complete`, `is-warning`, `is-error`, `is-disabled`처럼 `is-` 접두사를 쓴다.
- 선택 상태에는 `aria-current`, `aria-pressed` 또는 `aria-selected` 중 의미에 맞는 속성을 함께 쓴다.
- 배지는 짧은 분류나 상태에만 사용한다. 문장, 버튼, 일반 메타데이터를 배지로 만들지 않는다.
- 정상 상태를 모두 초록색으로 칠하지 않는다. 정상은 기본색으로 두고 완료 확인이 중요한 곳에서만 성공색을 쓴다.

### 7.9 빈 상태, 로딩, 오류

- 빈 상태는 `무엇이 없음 + 다음 행동`을 한 문장으로 안내한다.
- 사용자가 바로 해결할 수 있으면 CTA 하나를 제공한다.
- 로딩 중 기존 내용을 무조건 지우지 않는다. 새 화면이라면 짧은 로딩 문구를, 갱신이라면 기존 내용을 유지한 채 관련 컨트롤만 비활성화한다.
- 오류는 `…하지 못했습니다.` 뒤에 가능한 원인을 보존하고 재시도 또는 설정 경로를 안내한다.
- 성공 Notice는 `대상 + 완료 결과`, 대량 작업은 처리 건수를 포함한다.

## 8. 아이콘과 시각 표식

기존 개념은 같은 아이콘을 유지한다.

| 개념 | 표식 |
|---|---|
| 수업일지 | Lucide `notebook-pen` |
| 단원 | Lucide `book-open-check` |
| 통합 단원 | Lucide `sparkles`, 강조색 |
| 교육과정 로드맵 | Lucide `gantt-chart` |
| 고정 차시 | 텍스트 `📌` |
| 과제 | 주황색 `◆` |
| 행사 | 보라색 `●` |
| 오늘 | 빨간 선 또는 텍스트 표식 |

새 아이콘을 정하기 전에 `src/`에서 같은 개념이 이미 쓰였는지 검색한다. 같은 아이콘을 서로 다른 핵심 개념에 재사용하지 않는다. 장식만을 위한 아이콘은 추가하지 않는다.

## 9. 상호작용

- 좌클릭 또는 탭은 보기, 우클릭 또는 길게 누르기는 편집 메뉴다.
- 즉시 선택 가능한 값은 컨텍스트 메뉴에 둔다. 자유 입력이나 사유가 필요할 때만 모달을 연다.
- 모달을 여는 라벨은 대상이 명확하면 `편집…`, 아니면 `동사 + 대상`으로 쓴다.
- 기록 생성 화면은 현재 날짜, 교시, 과목, 단원, 차시, 학생을 가능한 만큼 미리 채운다.
- 애니메이션은 상태 변화의 이해를 실제로 돕는 경우에만 사용한다. 장식용 등장 애니메이션, 자동 재생, 지속적인 맥박 효과는 사용하지 않는다.
- `prefers-reduced-motion: reduce`에서 의미가 손실되면 안 된다.

## 10. 접근성

다음은 선택 사항이 아니라 완료 조건이다.

- 모든 기능은 키보드만으로 도달하고 실행할 수 있어야 한다.
- 포커스 가능한 요소에는 명확한 `:focus-visible` 윤곽선이 있어야 한다.
- 아이콘 전용 버튼에는 `aria-label`과 `title`이 있어야 한다.
- 입력에는 실제 라벨이 연결되어야 한다.
- 선택·확장·현재 상태는 적절한 ARIA 속성으로 노출한다.
- 텍스트와 배경색을 임의 지정하지 않고 테마 변수를 사용해 대비를 보존한다.
- 색 외의 상태 단서를 제공한다.
- 시각적으로 숨긴 행동은 포커스를 받았을 때 나타나야 하며, 터치 화면에서는 항상 보여야 한다.
- 스크린리더가 읽을 필요 없는 장식 아이콘은 숨기고, 의미 있는 아이콘은 주변 텍스트나 레이블로 설명한다.

## 11. 문구와 정보 위계

화면 문구는 [`UIUX-PRINCIPLES.md`](UIUX-PRINCIPLES.md)의 용어 사전을 그대로 따른다. 특히 `수업일지`, `과제`, `단원`, `학생부 근거`, `진도표`, `차시`를 다른 유의어로 바꾸지 않는다.

- 제목은 명사형으로 짧게 쓴다.
- 버튼은 행동 결과가 드러나는 동사형으로 쓴다.
- 설명은 사용자가 얻게 될 결과와 다음 행동을 말한다.
- 확인 문구에는 대상, 변경 내용, 영향 범위를 포함한다.
- 내부 타입명, 파일 경로, 구현 용어를 일반 UI에 노출하지 않는다.
- 교사가 판단해야 하는 내용을 “자동 확정”, “완벽”, “안전 보장”처럼 표현하지 않는다.

## 12. CSS와 DOM 구현 규칙

### 12.1 클래스 이름

```text
class-management-<기능>-<요소>
class-management-<기능>-<요소>.is-<상태>
```

예: `class-management-calendar-event`, `class-management-calendar-event.is-assignment`.

- 플러그인의 모든 스타일은 `.class-management-*` 아래로 범위를 제한한다.
- `.card`, `.header`, `button`, `table`처럼 Obsidian 전체에 영향을 주는 전역 선택자를 만들지 않는다.
- Obsidian modifier인 `mod-cta` 등은 기존 의미 그대로 사용한다.
- 이름은 모양이 아니라 역할을 설명해야 한다. `blue-box`, `left-thing` 같은 이름은 금지한다.

### 12.2 재사용 기준

- 의미와 구조가 같은 컴포넌트는 기존 클래스를 재사용한다.
- 모양만 우연히 같고 역할이 다르면 기능별 클래스를 만든다.
- 같은 값이 한 기능 안에서 3회 이상 반복되면 기능 루트에 `--class-management-*` 변수를 둘 수 있다.
- 한 번만 쓰는 값을 추상화하거나 범용 컴포넌트 시스템을 새로 만들지 않는다.
- 스타일은 가능하면 해당 기능 블록 가까이에 추가하고, 반응형 규칙도 같은 기능을 찾기 쉽게 유지한다.

### 12.3 DOM

- Obsidian의 `createEl`, `createDiv`, `setIcon`을 우선 사용한다.
- 정적 마크업 문자열과 `innerHTML`로 UI를 만들지 않는다.
- 시맨틱 HTML을 먼저 선택하고 ARIA로 잘못된 요소를 보정하려 하지 않는다.
- 클릭 리스너를 다시 렌더링할 때 중복 등록하지 않는다.
- 목록을 다시 그릴 때 포커스와 스크롤을 불필요하게 초기화하지 않는다.

## 13. LLM 디자인 클리셰 금지

LLM은 별도 요청이 없어도 아래 장식을 습관적으로 추가하는 경향이 있다. 익숙해 보인다는 이유만으로 사용하지 않는다. 각 장식이 사용자 과업이나 데이터 의미에 왜 필요한지 한 문장으로 설명할 수 없으면 제거한다.

| 클리셰 | 금지되는 코드·형태 | 대안 |
|---|---|---|
| 왼쪽 강조선 카드 | 카드·패널의 `border-left`, `::before` 색 띠, `inset` 강조선 | 제목+여백, 구분선 목록, 인라인 상태 |
| 카드 만능 레이아웃 | 모든 섹션·행·체크 항목을 둥근 상자로 감싸기 | 시맨틱 섹션, 표, 하나의 목록과 행 구분선 |
| 떠 있는 카드 | 모든 상자의 `box-shadow`, 호버 시 `translateY()`·`scale()` | 1px 경계, 배경 변화, 포커스 윤곽선 |
| 큰 라운딩 | 일반 컨테이너의 `16px` 이상 반경, 중첩된 둥근 상자 | 행 `0~6px`, 패널 `8~12px`, 큰 요약 `14px` 이하 |
| 그라디언트 장식 | `linear-gradient()`, `radial-gradient()`, `conic-gradient()` 배경 | 테마의 단색 배경과 여백 |
| 글래스모피즘 | 반투명 겹침, `backdrop-filter`, 광택 테두리 | `--background-primary/secondary`의 불투명 표면 |
| 파스텔 색상 세트 | 카드마다 다른 accent 혼합 배경, 무지개 카테고리 | 동일한 중립 표면 + 필요한 상태 텍스트/표식 |
| 아이콘 메달리온 | 모든 제목 앞의 색 원·둥근 사각형 안 아이콘 | 평범한 Lucide 아이콘 또는 텍스트 제목 |
| 배지 남발 | 날짜·개수·일반 메타데이터까지 모두 `999px` pill | 점 구분 텍스트, 열 정렬, 짧은 상태에만 배지 |
| 통계 카드 남발 | 숫자 하나마다 동일한 카드 생성 | 한 줄 요약, 정의 목록, 표; 핵심 수치만 카드 |
| 앱 안의 히어로 영역 | 과도하게 큰 제목, 추상적 부제, 장식 배경 | 표준 `h2` + 과업을 설명하는 한 문장 |
| 장식용 진행률 | 실제 분모·목표가 없는 progress bar·도넛 | 정확한 상태 문구 또는 건수 |
| 모션 과장 | `transition: all`, 호버 부유, 자동 펄스·반짝임 | 필요한 속성만 짧게 전환하거나 애니메이션 없음 |
| 아이콘 버튼 행렬 | 모든 행동을 둥근 아이콘 버튼으로 변환 | 텍스트 버튼; 좁은 반복 툴바만 아이콘 허용 |
| 가짜 빈 상태 | 큰 일러스트·로켓·반짝이와 감성 문구 | 무엇이 없는지와 다음 행동을 짧게 안내 |

### 13.1 코드 수준 금지 사항

다음 패턴을 새 코드에 추가하지 않는다.

- 하드코딩 색상 또는 라이트·다크 모드별 수동 색상 분기
- 플러그인 범위를 벗어나는 전역 CSS
- 패널·카드·목록 행의 장식용 `border-left`
- 장식용 `box-shadow`, 그라디언트, `backdrop-filter`
- `transition: all`, 호버 `transform`, 지속 애니메이션
- 원형 요소와 상태 칩을 제외한 `14px` 초과 `border-radius`
- 한 화면에 여러 개의 동등한 CTA
- 색으로만 표현한 상태
- 호버해야만 발견할 수 있는 핵심 행동
- `div`를 버튼처럼 사용하면서 키보드 동작을 빠뜨리는 구현
- 장식용 이모지와 직접 만든 SVG
- 모바일에서 화면 밖으로 잘리는데 스크롤 대안이 없는 고정 폭
- placeholder만 있고 라벨이 없는 입력
- 저장 실패 시 입력을 잃는 모달
- 즉시 선택으로 끝날 작업을 위한 새 모달
- 현재 화면의 맥락을 다시 입력하게 하는 생성 흐름
- Obsidian의 기본 버튼·`Setting`·`Menu`를 CSS로 다시 만든 컨트롤

`border-left`, `box-shadow`, `gradient`, `backdrop-filter`, `transition: all`, `translateY`, `scale`을 새로 작성했다면 완료 전에 diff에서 다시 찾는다. 데이터 시각화나 실제 공간 관계처럼 의미상 필수인 경우가 아니면 제거한다. 기존 `styles.css`의 유사 코드는 호환을 위해 남아 있을 수 있으나 복제 근거가 아니다.

## 14. 표준 뷰 CSS 골격

새 중앙 뷰를 만들 때 필요한 부분만 가져와 기능명에 맞게 바꾼다. 완성된 컴포넌트 라이브러리가 아니라 일관된 시작점이다.

```css
.class-management-example-view {
  padding: 24px;
}

.class-management-example-layout {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 24px;
}

.class-management-example-section {
  min-width: 0;
  padding-block: 16px;
  border-top: 1px solid var(--background-modifier-border);
}

.class-management-example-section h3 {
  margin: 0 0 8px;
}

.class-management-example-list {
  border-block: 1px solid var(--background-modifier-border);
}

.class-management-example-row {
  display: flex;
  align-items: center;
  gap: 8px;
  min-height: 40px;
  padding: 8px 4px;
  border-bottom: 1px solid var(--background-modifier-border);
}

.class-management-example-row:last-child {
  border-bottom: 0;
}

.class-management-example-row:hover {
  background: var(--background-modifier-hover);
}

.class-management-example-row:focus-visible {
  outline: 2px solid var(--interactive-accent);
  outline-offset: -2px;
}

@media (max-width: 700px) {
  .class-management-example-view {
    padding: 14px;
  }

  .class-management-example-layout {
    grid-template-columns: 1fr;
  }
}
```

## 15. 완료 체크리스트

### 구조와 문구

- [ ] 가장 가까운 화면 유형과 기존 구현을 확인했다.
- [ ] 화면 제목, 설명, 주요 행동의 위계가 분명하다.
- [ ] CTA는 행동 묶음당 하나다.
- [ ] 표준 용어와 알림 문형을 사용했다.
- [ ] 빈 상태에 다음 행동이 있다.

### 시각

- [ ] 모든 색이 Obsidian 테마 변수 또는 `color-mix()`를 사용한다.
- [ ] 간격과 반경이 이 문서의 스케일을 따른다.
- [ ] 카드보다 평면 섹션·목록·표를 먼저 사용했다.
- [ ] 왼쪽 강조선이 있는 둥근 카드가 없다.
- [ ] 장식용 그림자·그라디언트·유리 효과·호버 부유 효과가 없다.
- [ ] 원형 요소와 상태 칩을 제외한 반경이 14px 이하다.
- [ ] 배지, 아이콘 메달리온, 통계 카드가 반복되지 않는다.
- [ ] 긴 한국어 텍스트, 긴 과목명, 두 자리 학생 번호에서도 깨지지 않는다.
- [ ] 기본 라이트·다크 테마에서 상태와 텍스트를 읽을 수 있다.

### 상호작용과 접근성

- [ ] 좌클릭=보기, 우클릭=편집 규약을 지켰다.
- [ ] 마우스 없이 모든 기능을 실행할 수 있다.
- [ ] 포커스 표시, 라벨, 필요한 ARIA 상태가 있다.
- [ ] 색 이외의 상태 단서가 있다.
- [ ] 비동기 버튼의 중복 실행을 막았다.
- [ ] 실패해도 사용자의 입력이 보존된다.

### 반응형

- [ ] 넓은 중앙 뷰, 좁은 오른쪽 패널, 700px 이하 화면을 확인했다.
- [ ] 터치 대상은 최소 40px이고 호버 전용 핵심 행동이 없다.
- [ ] 표·보드·간트가 잘리지 않거나 가로 스크롤을 제공한다.
- [ ] 다열 폼과 카드가 모바일에서 한 열로 바뀐다.

### 검증

- [ ] TypeScript 검사와 관련 테스트가 통과한다.
- [ ] 변경 diff에서 `border-left`, 그림자, gradient, `transition: all`, 호버 transform을 검색하고 불필요한 항목을 제거했다.
- [ ] Obsidian에서 실제 화면을 열어 라이트·다크, 키보드, 스크롤을 확인했다.
- [ ] 새 스타일이 플러그인 밖의 Obsidian UI에 영향을 주지 않는다.
- [ ] 변경한 UI와 관련 문서의 설명이 서로 일치한다.

AI 에이전트는 작업 완료 보고에 적용한 화면 유형, 재사용한 패턴, 확인한 반응형·접근성 항목, 남은 예외를 짧게 포함한다.
