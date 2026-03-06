Run TypeScript type-checking only (no Vite bundling) for fast validation during development.

```bash
cd src/get-it-done && npx vue-tsc -b
```

- If it exits cleanly, confirm zero type errors.
- If there are errors, quote each one with its `file:line:column` location and suggest a fix.
- Do not modify any files unless asked to fix the errors.
