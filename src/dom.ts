export interface ViewScaffold {
  header: HTMLElement;
  heading: HTMLElement;
  actions: HTMLElement;
  toolbar: HTMLElement;
  body: HTMLElement;
}

/**
 * 표준 뷰 골격 (DESIGN §6.5) — 헤더·툴바는 고정, 바디가 유일한 세로 스크롤러다.
 * 제목은 탭 이름(getDisplayText)과 같게 쓰고, 설명은 결과 중심 한 문장으로 쓴다.
 * actions는 화면 전역 행동(≤3, CTA 1)만, toolbar는 필터 바 또는 화면 전역 기간 탐색만 담는다.
 */
export function scaffoldView(
  root: HTMLElement,
  options: { cls: string; title: string; description?: string }
): ViewScaffold {
  root.addClass("class-management-view", options.cls);
  const header = root.createDiv({ cls: "class-management-view-header" });
  const heading = header.createDiv();
  heading.createEl("h2", { text: options.title });
  if (options.description) heading.createEl("p", { text: options.description });
  const actions = header.createDiv({ cls: "class-management-actions" });
  const toolbar = root.createDiv({ cls: "class-management-view-toolbar" });
  const body = root.createDiv({ cls: "class-management-view-body" });
  return { header, heading, actions, toolbar, body };
}

export function addOption(select: HTMLSelectElement, value: string, text: string): void {
  const option = select.createEl("option", { text });
  option.value = value;
}

/** 필터 바 컨트롤의 상시 표시 라벨 (DESIGN §7.3). */
export function filterLabel(container: HTMLElement, text: string): HTMLLabelElement {
  const label = container.createEl("label");
  label.createSpan({ text });
  return label;
}

/**
 * 길게 누르기(터치)를 우클릭 등가로 등록한다 (UIUX §1 터치 등가).
 * 10px 이상 움직이면 스크롤로 보고 취소하며, 발화 후의 탭(click)은 삼킨다.
 */
export function registerLongPress(
  el: HTMLElement,
  handler: (x: number, y: number) => void,
  ms = 500
): void {
  let timer: number | null = null;
  let startX = 0;
  let startY = 0;
  let fired = false;
  const cancel = (): void => {
    if (timer !== null) {
      window.clearTimeout(timer);
      timer = null;
    }
  };
  el.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1) {
        cancel();
        return;
      }
      const touch = event.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      fired = false;
      cancel();
      timer = window.setTimeout(() => {
        timer = null;
        fired = true;
        handler(startX, startY);
      }, ms);
    },
    { passive: true }
  );
  el.addEventListener(
    "touchmove",
    (event) => {
      const touch = event.touches[0];
      if (!touch) return;
      if (Math.hypot(touch.clientX - startX, touch.clientY - startY) > 10) cancel();
    },
    { passive: true }
  );
  el.addEventListener("touchend", (event) => {
    cancel();
    if (fired) event.preventDefault();
  });
  el.addEventListener("touchcancel", cancel);
  el.classList.add("class-management-longpress");
}
