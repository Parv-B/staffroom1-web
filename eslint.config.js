import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules", "src/**/*.gen.*", "src/routeTree.gen.ts", "playwright-report", "test-results"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: { ...globals.browser },
      parserOptions: { projectService: { allowDefaultProject: ["*.js", "scripts/*.mjs"] }, tsconfigRootDir: import.meta.dirname },
    },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unsafe-argument": "error",
      "@typescript-eslint/no-unsafe-assignment": "error",
      "@typescript-eslint/no-unsafe-member-access": "error",
      "@typescript-eslint/no-unsafe-return": "error",
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      // TanStack Router's redirect()/notFound() are thrown by design.
      "@typescript-eslint/only-throw-error": [
        "error",
        { allow: [{ from: "package", package: "@tanstack/router-core", name: ["Redirect", "NotFoundError"] }] },
      ],
      // Tokens and transcript text must never reach the console.
      "no-console": "error",
    },
  },
  {
    ...tseslint.configs.disableTypeChecked,
    files: ["scripts/**/*.mjs", "*.js"],
    languageOptions: { ...tseslint.configs.disableTypeChecked.languageOptions, globals: { ...globals.node } },
    rules: { ...tseslint.configs.disableTypeChecked.rules, "no-console": "off" },
  },
);
