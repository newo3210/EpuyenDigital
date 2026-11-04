import tseslint from 'typescript-eslint';

// Lint rules - TypeScript recommended set for framework-free shared code.
export default tseslint.config(...tseslint.configs.recommended);
