# 003 — Stored XSS: task comment rendered with `v-html`

| | |
|---|---|
| **Type** | Security bug |
| **Severity** | High |
| **Confidence** | Certain |
| **Effort** | Small (one-line template change) |
| **Files** | `src/get-it-done/src/components/molecules/TaskCard.vue` |

## Problem

In `TaskCard.vue`, the expanded details panel renders the user-entered comment like this:

```html
<span class="inline-block grow" v-html="item.comment.replace(/\n/g, '<br/>')"></span>
```

`item.comment` is free-form user input (entered in `MobilePlanningSheet.vue`'s textarea) and is
synced through CouchDB. Rendering it with `v-html` executes any embedded markup, e.g.
`<img src=x onerror=alert(1)>`. Because documents replicate across devices and (in a multi-user
CouchDB deployment) potentially across accounts, this is **stored XSS**, not just self-XSS.

The `replace(/\n/g, '<br/>')` exists only to preserve line breaks — which CSS does safely.

## Fix

Replace the `v-html` binding with plain interpolation plus the Tailwind class that preserves
newlines:

```html
<span class="inline-block grow whitespace-pre-line">{{ item.comment }}</span>
```

That is the entire fix.

## Guardrails — read before editing

- Do **not** add a sanitization library (DOMPurify etc.). There is no requirement to render HTML in
  comments; plain text with preserved line breaks is the intended behavior.
- Do **not** touch the other `v-if="item.comment"` icon in the meta row — only the details-panel
  span uses `v-html`.
- `whitespace-pre-line` is a standard Tailwind v4 utility; no config change is needed.
- Search the whole `src/get-it-done/src` tree for any other `v-html` usage before finishing; at
  analysis time this was the only one, but confirm.

## Acceptance criteria

- Set a task comment to `<img src=x onerror="document.title='pwned'">` plus a second line of text.
  Expand the card details: the literal text is displayed on two lines, no image request, no script
  execution.
- Multi-line comments still display with line breaks preserved.
- `cd src/get-it-done && npm run build` passes with zero errors.
