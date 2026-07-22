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
