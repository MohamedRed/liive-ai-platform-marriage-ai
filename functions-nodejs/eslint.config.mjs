import {fixupConfigRules, fixupPluginRules} from "@eslint/compat";
import typescriptEslint from "@typescript-eslint/eslint-plugin";
import _import from "eslint-plugin-import";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";
import path from "node:path";
import {fileURLToPath} from "node:url";
import js from "@eslint/js";
import {FlatCompat} from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const compat = new FlatCompat({
  baseDirectory: __dirname,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all
});

export default [{
  ignores: ['src/index.ts'],  // Ignore all files in src directory
}, ...fixupConfigRules(compat.extends(
  "eslint:recommended",
  "plugin:import/errors",
  "plugin:import/warnings",
  "plugin:import/typescript",
  "google",
  "plugin:@typescript-eslint/recommended",
  "prettier",
)), {
  plugins: {
    "@typescript-eslint": fixupPluginRules(typescriptEslint),
    import: fixupPluginRules(_import),
  },

  languageOptions: {
    globals: {
      ...globals.node,
    },

    parser: tsParser,
    ecmaVersion: 5,
    sourceType: "module",

    parserOptions: {
      project: ["tsconfig.json", "tsconfig.dev.json"],
    },
  },

  rules: {
    quotes: ["error", "double"],
    "import/no-unresolved": 0,
    "require-jsdoc": 0,
    "valid-jsdoc": "off",
  },
}];
