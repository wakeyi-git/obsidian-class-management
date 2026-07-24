import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { loadTypeScriptModule } from "./helpers.mjs";

const { NOTE_KINDS } = await loadTypeScriptModule("../packages/core/src/types.ts");
const root = fileURLToPath(new URL("..", import.meta.url));

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (name.endsWith(".ts") || name.endsWith(".mjs")) out.push(full);
  }
  return out;
}

test("NOTE_KINDS는 22종이고 중복이 없다", () => {
  assert.equal(NOTE_KINDS.length, 22);
  assert.equal(new Set(NOTE_KINDS).size, NOTE_KINDS.length);
});

test("소스의 class-management 판별자 리터럴은 전부 NOTE_KINDS 안에 있다", () => {
  const known = new Set(NOTE_KINDS);
  const files = [
    ...walk(path.join(root, "packages/core/src")),
    ...walk(path.join(root, "src")),
    ...walk(path.join(root, "scripts"))
  ];
  for (const file of files) {
    const source = readFileSync(file, "utf-8");
    for (const match of source.matchAll(/class-management:\s*([a-z][a-z-]*)/g)) {
      assert.ok(
        known.has(match[1]),
        `${path.relative(root, file)}: 미등록 kind "${match[1]}" — core/types.ts NOTE_KINDS에 먼저 등록하세요`
      );
    }
  }
});
