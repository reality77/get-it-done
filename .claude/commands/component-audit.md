Audit all Vue components in the get-it-done app for atomic design layer compliance and usage.

## Steps

1. List every `.vue` file under `src/get-it-done/src/components/`, grouped by layer (`atoms/`, `molecules/`, `organisms/`, `templates/`).
2. For each component, search the codebase for its import statement to determine if it is used.
3. Flag any **unused** components (no imports found).
4. Flag any components that appear **misplaced** for their layer, based on these guidelines:
   - **atoms/** — single-responsibility UI primitives (buttons, inputs, badges, checkboxes)
   - **molecules/** — small compositions of atoms (rows, tab items, badges with labels)
   - **organisms/** — feature-complete sections wired to store data (cards, panels, forms)
   - **templates/** — full view layouts that compose organisms and connect to Pinia stores

## Output

A concise table per layer:

| Component | Used? | Layer OK? | Notes |
|---|---|---|---|
| atoms/AppButton.vue | ✅ | ✅ | |
| molecules/SomeWidget.vue | ❌ | ✅ | No imports found |

Finish with a short summary of any issues and suggested next steps.
