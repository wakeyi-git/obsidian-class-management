import { normalizePath } from "obsidian";

export function joinVaultPath(...parts: string[]): string {
  return normalizePath(parts.map((part) => part.trim()).filter(Boolean).join("/"));
}

export function safeFileSegment(value: string): string {
  return value.replace(/[\\/:*?"<>|]/g, "-").replace(/\s+/g, " ").trim();
}

export function yamlString(value: string): string {
  return JSON.stringify(value);
}

export function localDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function localTimeForFile(date = new Date()): string {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  const second = String(date.getSeconds()).padStart(2, "0");
  return `${hour}${minute}${second}`;
}

export function compareStudentNumber(a: string, b: string): number {
  const aNumber = Number(a);
  const bNumber = Number(b);

  if (Number.isFinite(aNumber) && Number.isFinite(bNumber)) {
    return aNumber - bNumber;
  }

  return a.localeCompare(b, "ko", { numeric: true });
}
