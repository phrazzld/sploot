import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const eslintConfig = [
  ...compat.extends("next/core-web-vitals"),
  {
    rules: {
      // Terminal aesthetic enforcement: No rounded corners allowed
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/rounded-/]',
          message: 'Terminal aesthetic violation: Use square corners only (no rounded- classes). All border-radius values are set to 0px in @theme config.',
        },
        {
          selector: 'TemplateElement[value.raw=/rounded-/]',
          message: 'Terminal aesthetic violation: Use square corners only (no rounded- classes). All border-radius values are set to 0px in @theme config.',
        },
      ],
    },
  },
];

export default eslintConfig;
