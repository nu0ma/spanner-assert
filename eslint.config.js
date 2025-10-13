import path from "node:path";

import js from "@eslint/js";
import tseslintPlugin from "@typescript-eslint/eslint-plugin";
import tsParser from "@typescript-eslint/parser";
import importPlugin from "eslint-plugin-import";

const tsPlugin = tseslintPlugin;
const tsConfigPath = path.resolve("./tsconfig.json");

const tsConfigs = tsPlugin.configs["flat/recommended"].map((config) => {
  const files = config.files ?? ["**/*.ts", "**/*.tsx", "**/*.mts", "**/*.cts"];

  return {
    ...config,
    files,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      parser: tsParser,
      ...(config.languageOptions ?? {}),
    },
    plugins: {
      ...(config.plugins ?? {}),
      "@typescript-eslint": tsPlugin,
    },
    rules: {
      ...(config.rules ?? {}),
      "@typescript-eslint/no-explicit-any": "off",
    },
  };
});

export default [
  {
    ignores: ["dist", "node_modules", "coverage"],
  },
  js.configs.recommended,
  ...tsConfigs,
  {
    files: ["**/*.ts", "**/*.tsx"],
    plugins: {
      import: importPlugin,
    },
    settings: {
      "import/parsers": {
        "@typescript-eslint/parser": [".ts", ".tsx"],
      },
      "import/resolver": {
        typescript: {
          project: tsConfigPath,
        },
      },
    },
    rules: {
      ...importPlugin.configs.recommended.rules,
      "import/order": [
        "warn",
        {
          alphabetize: { order: "asc", caseInsensitive: true },
          groups: [
            "builtin",
            "external",
            "internal",
            "parent",
            "sibling",
            "index",
          ],
          "newlines-between": "always",
        },
      ],
    },
  },
];
