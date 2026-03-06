Scaffold a new Pinia store for the get-it-done app following its conventions.

The user will specify a store name (e.g. `tasks`, `settings`). If not provided, ask for it.

## Steps

1. Read `src/get-it-done/src/stores/checklists.ts` and `src/get-it-done/src/stores/auth.ts` to understand the existing patterns (Setup API vs Options API, naming conventions, TypeScript style).
2. Create the new store at `src/get-it-done/src/stores/<storeName>.ts` matching those patterns.

## Rules

- Use the same store style (Setup API or Options API) as the existing stores.
- No enums — string literal union types only (`erasableSyntaxOnly` is enabled).
- Strict TypeScript: no implicit `any`, no unused locals.
- Export the composable as `use<StoreName>Store` (e.g. `useTasksStore`).
- If the store manages persisted data, follow the pattern in `checklists.ts` for localStorage / PouchDB integration.

After creating the file, confirm the path and show the store's exported state, getters, and actions interface.
