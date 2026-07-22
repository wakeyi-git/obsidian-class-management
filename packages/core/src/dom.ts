export function addOption(select: HTMLSelectElement, value: string, text: string): void {
  const option = select.createEl("option", { text });
  option.value = value;
}
