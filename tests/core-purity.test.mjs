import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const coreDir = fileURLToPath(new URL("../packages/core/src", import.meta.url));

test("코어 패키지는 옵시디언 런타임과 플러그인 층에 의존하지 않는다", () => {
  for (const name of readdirSync(coreDir).filter((n) => n.endsWith(".ts"))) {
    const source = readFileSync(path.join(coreDir, name), "utf-8");
    for (const line of source.split(/\r?\n/)) {
      const importLine = line.match(/^import\s+(type\s+)?.*from\s+"([^"]+)"/);
      if (!importLine) continue;
      const [, isType, specifier] = importLine;
      if (specifier === "obsidian") {
        assert.ok(isType, `${name}: obsidian은 import type만 허용됩니다 → ${line.trim()}`);
      } else {
        assert.ok(
          specifier.startsWith("./"),
          `${name}: 코어는 상대 경로(코어 내부)만 임포트할 수 있습니다 → ${line.trim()}`
        );
        const target = specifier.replace(/^\.\//, "");
        assert.ok(
          readdirSync(coreDir).includes(`${target}.ts`),
          `${name}: 코어 밖 모듈을 참조합니다 → ${line.trim()}`
        );
      }
    }
  }
});
