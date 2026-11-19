import { defineConfig, globalIgnores } from 'eslint/config';
import nextVitals from 'eslint-config-next/core-web-vitals';
import nextTs from 'eslint-config-next/typescript';

const eslintConfig = defineConfig([
   globalIgnores(['.next/**']),
   ...nextVitals,
   ...nextTs,
   {
      // eslint-plugin-react-hooks 7 (via eslint-config-next 16) adds the React
      // Compiler rules to its recommended set. Kept off so lint checks what it
      // checked before the upgrade; adopting them is a separate change.
      rules: {
         'react-hooks/preserve-manual-memoization': 'off',
         'react-hooks/purity': 'off',
         'react-hooks/refs': 'off',
         'react-hooks/set-state-in-effect': 'off',
         'react-hooks/use-memo': 'off',
      },
   },
   {
      // Vendored bazza/ui data-table-filter (kept close to upstream for easy updates)
      files: ['components/data-table-filter/**/*.{ts,tsx}'],
      rules: {
         '@typescript-eslint/no-unused-vars': 'off',
         '@typescript-eslint/no-explicit-any': 'off',
         '@typescript-eslint/no-this-alias': 'off',
         'react-hooks/rules-of-hooks': 'off',
         'react-hooks/exhaustive-deps': 'off',
      },
   },
   {
      files: ['tests/helpers/fixtures.ts'],
      rules: {
         'react-hooks/rules-of-hooks': 'off',
      },
   },
]);

export default eslintConfig;
