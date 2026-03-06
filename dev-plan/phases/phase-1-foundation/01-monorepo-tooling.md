# 01 — Monorepo & Tooling Setup

## Objective

Configure ESLint, Prettier, TypeScript path aliases, and lint-staged across the entire monorepo so that every package shares consistent code quality standards from day one.

## Dependencies

- None — this is the first task in the project

## Files to Create

| File                          | Purpose                                                  |
| ----------------------------- | -------------------------------------------------------- |
| `.eslintrc.cjs`               | Root ESLint config with TypeScript plugin                |
| `.prettierrc`                 | Prettier formatting rules                                |
| `.prettierignore`             | Ignore generated files (dist, node_modules, prisma)      |
| `packages/api/.eslintrc.cjs`  | API-specific ESLint overrides (Node env)                 |
| `packages/web/.eslintrc.cjs`  | Web-specific ESLint overrides (React plugin)             |
| `packages/core/.eslintrc.cjs` | Core-specific ESLint (library mode)                      |
| `packages/api/tsconfig.json`  | API TypeScript config with path aliases                  |
| `packages/web/tsconfig.json`  | Web TypeScript config (already exists, may need updates) |
| `packages/core/tsconfig.json` | Core TypeScript config for library output                |

## Files to Modify

| File                   | Changes                                                           |
| ---------------------- | ----------------------------------------------------------------- |
| `package.json` (root)  | Add lint-staged config, husky prepare script, format/lint scripts |
| `tsconfig.json` (root) | Add project references for all 3 packages                         |

## Detailed Sub-Tasks

### 1. Install dev dependencies at root level

```bash
npm install -D eslint @typescript-eslint/eslint-plugin @typescript-eslint/parser \
  eslint-plugin-react eslint-plugin-react-hooks eslint-plugin-import \
  prettier eslint-config-prettier \
  husky lint-staged
```

### 2. Create root `.eslintrc.cjs`

- Parser: `@typescript-eslint/parser`
- Plugins: `@typescript-eslint`, `import`
- Extends: `eslint:recommended`, `plugin:@typescript-eslint/recommended`, `prettier`
- Rules:
  - `@typescript-eslint/no-explicit-any`: `error`
  - `@typescript-eslint/no-unused-vars`: `error` with `argsIgnorePattern: "^_"`
  - `import/order`: `warn` with groups `[builtin, external, internal, parent, sibling]`
  - `no-console`: `warn` (allow in dev, catch in review)
  - `@typescript-eslint/consistent-type-imports`: `error` (enforce `import type {}`)

### 3. Create `.prettierrc`

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

### 4. Create `.prettierignore`

```
dist/
build/
node_modules/
coverage/
*.prisma
package-lock.json
```

### 5. Create package-specific ESLint configs

- `packages/api/.eslintrc.cjs`: Extend root, set `env: { node: true }`, disable `no-console` for dev
- `packages/web/.eslintrc.cjs`: Extend root + `plugin:react/recommended` + `plugin:react-hooks/recommended`, set `env: { browser: true }`, add `settings: { react: { version: 'detect' } }`
- `packages/core/.eslintrc.cjs`: Extend root only, strictest rules

### 6. Configure TypeScript project references

Update root `tsconfig.json`:

```json
{
  "references": [
    { "path": "./packages/core" },
    { "path": "./packages/api" },
    { "path": "./packages/web" }
  ]
}
```

### 7. Configure tsconfig path aliases

- `packages/api/tsconfig.json`: Add `paths: { "@shipscope/core/*": ["../core/src/*"] }`, set `outDir: "./dist"`, `rootDir: "./src"`
- `packages/core/tsconfig.json`: Set `composite: true`, `declaration: true`, `declarationMap: true`, `outDir: "./dist"`, `rootDir: "./src"`
- Verify `packages/web/tsconfig.json` has correct paths for core import

### 8. Set up lint-staged + husky

- `npx husky init` to create `.husky/` directory
- Create `.husky/pre-commit` hook that runs `npx lint-staged`
- Add to root `package.json`:
  ```json
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,css}": ["prettier --write"]
  }
  ```

### 9. Add scripts to root package.json

```json
{
  "scripts": {
    "lint": "eslint 'packages/*/src/**/*.{ts,tsx}'",
    "lint:fix": "eslint 'packages/*/src/**/*.{ts,tsx}' --fix",
    "format": "prettier --write 'packages/*/src/**/*.{ts,tsx,json,css}'",
    "format:check": "prettier --check 'packages/*/src/**/*.{ts,tsx,json,css}'",
    "typecheck": "tsc --noEmit -p packages/api/tsconfig.json && tsc --noEmit -p packages/web/tsconfig.json"
  }
}
```

### 10. Verify everything works

- Run `npm run lint` — should pass (no source files yet is OK)
- Run `npm run format:check` — should pass
- Run `npm run typecheck` — should pass or only show expected missing files
- Make a test commit to verify husky pre-commit hook fires

## Acceptance Criteria

- [ ] `npm run lint` executes without configuration errors
- [ ] `npm run format:check` passes on all existing files
- [ ] Husky pre-commit hook runs lint-staged on `git commit`
- [ ] TypeScript path alias `@shipscope/core` resolves in both api and web packages
- [ ] Root `tsconfig.json` has project references for all 3 packages
- [ ] No `any` types allowed (ESLint rule enforced)
- [ ] Import ordering is enforced (ESLint rule)
- [ ] Consistent type imports enforced (`import type {}`)

## Complexity Estimate

**M (Medium)** — Standard tooling setup, but must be done carefully as every package inherits these configs. Mistakes here cascade to all future work.

## Risk Factors & Mitigations

| Risk                                 | Impact                                             | Mitigation                                                                                                      |
| ------------------------------------ | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| ESLint + Prettier conflicts          | Medium — formatting wars between tools             | Use `eslint-config-prettier` to disable ESLint formatting rules                                                 |
| Path alias resolution in Vite vs tsc | High — imports work in one but not the other       | Test alias resolution in both `vite.config.ts` and `tsconfig.json`; Vite uses `resolve.alias`, tsc uses `paths` |
| npm workspaces + husky compatibility | Low — husky v9 changed install location            | Use `npx husky init` (not `husky install`) for v9+ compatibility                                                |
| lint-staged running on wrong files   | Medium — could miss files or lint unnecessary ones | Test with a deliberate lint violation before finalizing config                                                  |
