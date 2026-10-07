import eslintPluginAstro from 'eslint-plugin-astro';
import tseslint from 'typescript-eslint';

export default [
  { ignores: ['dist/', '.astro/', '.wrangler/', 'redesign/', 'node_modules/'] },
  ...tseslint.configs.recommended,
  ...eslintPluginAstro.configs.recommended,
];
