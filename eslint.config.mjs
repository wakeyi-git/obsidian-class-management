import tseslint from "typescript-eslint";

/**
 * TS 레이어(src + packages/core) 전용 린트 — strict tsc가 못 잡는 부류만 겨냥한다:
 * 떠 있는 프로미스, 프로미스 오용, 미사용 심벌. (§7 백로그 — ESLint 도입)
 * 테스트·스크립트(.mjs)는 node --test와 실행 자체가 검증이라 대상에서 제외한다.
 */
export default tseslint.config(
  {
    ignores: ["main.js", "node_modules/**", "tmp/**", "*.mjs", "scripts/**", "tests/**"]
  },
  {
    files: ["src/**/*.ts", "packages/core/src/**/*.ts"],
    extends: [...tseslint.configs.recommended],
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/await-thenable": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }
      ]
    }
  }
);
