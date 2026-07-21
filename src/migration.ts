export function isLegacyAttendanceContent(content: string): boolean {
  return /%%\s*class-management-attendance:/.test(content) ||
    /^\|\s*번호\s*\|\s*학생\s*\|\s*상태\s*\|\s*$/m.test(content);
}

export function isWikiLinkStudentPath(value: string): boolean {
  return /^\[\[[^\]]+\]\]$/.test(value.trim());
}
