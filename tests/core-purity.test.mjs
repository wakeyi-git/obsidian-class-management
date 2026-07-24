import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const coreDir = fileURLToPath(new URL("../packages/core/src", import.meta.url));

// 지침 문서 등 리터럴 텍스트의 오탐을 막기 위해 토큰 검사 전에 문자열·주석을 걷어낸다.
function stripLiteralsAndComments(source) {
  return source
    .replace(/`(?:[^`\\]|\\[\s\S])*`/g, '""')
    .replace(/"(?:[^"\\]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\]|\\.)*'/g, '""')
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/[^\n]*/g, "");
}

// 코어에서 금지되는 런타임 토큰 — 타입 표기는 허용하되 실제 호출·접근은 막는다.
const FORBIDDEN_RUNTIME_TOKENS = [
  ["document.", "DOM 전역"],
  ["window.", "브라우저 전역"],
  ["navigator.", "브라우저 전역"],
  ["localStorage", "브라우저 저장소"],
  ["createEl(", "옵시디언 DOM 헬퍼"],
  ["createSpan(", "옵시디언 DOM 헬퍼"],
  ["createDiv(", "옵시디언 DOM 헬퍼"],
  ["addEventListener(", "DOM 이벤트"],
  ["app.vault", "볼트 IO"],
  ["app.workspace", "옵시디언 런타임"],
  ["app.metadataCache", "옵시디언 런타임"],
  ["app.fileManager", "옵시디언 런타임"]
];

test("코어 패키지는 옵시디언 런타임과 플러그인 층에 의존하지 않는다", () => {
  const files = readdirSync(coreDir).filter((name) => name.endsWith(".ts"));
  for (const name of files) {
    const source = readFileSync(path.join(coreDir, name), "utf-8");
    const code = stripLiteralsAndComments(source);

    // 1) import/export … from — 다중 행 구문 포함 전수 검사
    const statements = [...source.matchAll(/(import|export)\s+(type\s)?[^;]*?from\s*"([^"]+)"/g)];
    for (const [statement, , isType, specifier] of statements) {
      const summary = statement.replace(/\s+/g, " ").slice(0, 80);
      if (specifier === "obsidian") {
        assert.ok(isType, `${name}: obsidian은 import type만 허용됩니다 → ${summary}`);
      } else {
        assert.ok(
          specifier.startsWith("./"),
          `${name}: 코어는 상대 경로(코어 내부)만 임포트할 수 있습니다 → ${summary}`
        );
        assert.ok(
          files.includes(`${specifier.replace(/^\.\//, "")}.ts`),
          `${name}: 코어 밖 모듈을 참조합니다 → ${summary}`
        );
      }
    }
    // 모든 from 절이 위 검사에 걸렸는지 교차 검증(놓친 구문 형태 방지)
    const fromCount = (code.match(/\bfrom\s*"/g) ?? []).length;
    assert.equal(
      statements.length,
      fromCount,
      `${name}: 해석되지 않은 import/export from 구문이 있습니다`
    );

    // 2) 부수효과·동적 임포트 금지
    assert.ok(!/import\s*"/.test(code), `${name}: 부수효과 import는 금지됩니다`);
    assert.ok(!/import\s*\(/.test(code), `${name}: 동적 import는 금지됩니다`);
    assert.ok(!/\brequire\s*\(/.test(code), `${name}: require는 금지됩니다`);

    // 3) 런타임 토큰 금지 — 문자열·주석 제거 후 코드만 검사
    for (const [token, label] of FORBIDDEN_RUNTIME_TOKENS) {
      assert.ok(!code.includes(token), `${name}: 코어에서 ${label}(${token}) 사용은 금지됩니다`);
    }
  }
});
