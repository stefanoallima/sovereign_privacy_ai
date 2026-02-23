# Obsidian Minimal Theme Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reskin the full AILocalMind desktop app to match the Obsidian Minimal (kepano) aesthetic — pure white surfaces, system UI font, hairline borders, flat shadows, tight radius — while preserving all existing features and pane structure exactly.

**Architecture:** CSS-first approach. All token changes land in `index.css`. A small set of targeted component edits remove decorative elements (glows, dot patterns) that clash with Minimal's restraint. No structural changes, no feature removals.

**Tech Stack:** Tailwind CSS v4, CSS custom properties, React 19 component edits (Tailwind class changes only)

**Approved mockup:** `mockup-minimal.html` in repo root — user approved this look.

---

## Task 1: Replace design tokens in `index.css`

**Files:**
- Modify: `apps/desktop/src/index.css`

### What changes

**Font:** Remove Google Fonts `@import` for Inter. Replace `font-family` with system UI stack:
```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

**Light tokens (`:root`):**
```css
--background:        0 0% 100%;          /* #ffffff true white */
--surface-1:         0 0% 100%;          /* panels — same as bg */
--surface-2:         220 14% 96%;        /* #f2f3f5 cards, inputs */
--surface-3:         220 14% 92%;        /* hover states */

--foreground:        222 10% 10%;        /* #1a1a1a near-black */
--foreground-muted:  220 6% 33%;         /* #555 */
--foreground-subtle: 220 4% 60%;         /* #999 */

--card:              0 0% 100%;
--card-foreground:   222 10% 10%;
--popover:           0 0% 100%;
--popover-foreground:222 10% 10%;

--primary:           199 100% 36%;       /* #0077b6 cyan, readable on white */
--primary-foreground:0 0% 100%;

--secondary:         220 14% 96%;
--secondary-foreground:222 10% 10%;
--violet:            255 55% 57%;        /* #6e56cf Obsidian purple */
--violet-muted:      255 40% 80%;

--muted:             220 14% 96%;
--muted-foreground:  220 6% 40%;

--accent:            220 14% 93%;
--accent-foreground: 222 10% 10%;

--destructive:       4 70% 45%;
--destructive-foreground: 0 0% 100%;

--border:            220 13% 91%;        /* hairline — rgba(0,0,0,0.09) equivalent */
--input:             220 13% 91%;
--ring:              255 55% 57%;        /* violet focus ring */

--radius:            0.375rem;           /* tighter than current 0.75rem */

--shadow-sm:  0 1px 2px 0 rgb(0 0 0 / 0.05);
--shadow:     0 2px 6px -1px rgb(0 0 0 / 0.07), 0 1px 3px -1px rgb(0 0 0 / 0.05);
--shadow-md:  0 4px 10px -2px rgb(0 0 0 / 0.08), 0 2px 5px -2px rgb(0 0 0 / 0.05);
--shadow-lg:  0 10px 20px -4px rgb(0 0 0 / 0.09), 0 4px 8px -4px rgb(0 0 0 / 0.05);
--shadow-glow-cyan:   none;
--shadow-glow-violet: none;
```

**Dark tokens (`.dark`):** Keep existing dark values — user only cares about light mode for now, dark mode unchanged.

**Remove from `:root`:** `--gradient-bg` variable if present (used only by `.aurora-bg`).

### Decorative class cleanup (same file)

Remove `@keyframes aurora` block and `.aurora-bg` class entirely.

Make `.pattern-dots` a no-op in light mode:
```css
.pattern-dots {
  background-image: none;
}
```

Make glow classes no-ops in light (they already use `--shadow-glow-*` which is now `none`):
```css
.glow-cyan  { box-shadow: none; }
.glow-violet { box-shadow: none; }
```

Remove the `translateY(-2px)` from `.hover-lift:hover` (keep shadow change):
```css
.hover-lift:hover {
  transform: none;
  box-shadow: var(--shadow-md);
}
```

### Test
Run `pnpm tauri dev`, visually confirm:
- App shell is white/off-white, no colored gradients
- Text is near-black, readable
- Borders are hairline
- Corners are tighter

---

## Task 2: Remove decorative elements from components

**Files:**
- Modify: `apps/desktop/src/components/chat/ChatWindow.tsx`
- Modify: `apps/desktop/src/components/chat/CanvasPanel.tsx`
- Modify: `apps/desktop/src/components/chat/Sidebar.tsx`

### ChatWindow.tsx

Find the empty state div (around line 619):
```tsx
<div className="flex flex-1 flex-col items-center justify-center text-center p-8 pattern-dots">
```
Remove `pattern-dots` class:
```tsx
<div className="flex flex-1 flex-col items-center justify-center text-center p-8">
```

Find the send button (around line 1182) — remove `shadow-[var(--shadow-glow-cyan)]`:
```tsx
// Before
"bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 shadow-[var(--shadow-glow-cyan)] active:scale-95"
// After
"bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 active:scale-95"
```

### CanvasPanel.tsx

Find the empty state div (around line 38):
```tsx
<div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 pattern-dots">
```
Remove `pattern-dots`:
```tsx
<div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
```

### Sidebar.tsx

Find conversation/chat list items. Tighten vertical padding from `py-2` → `py-1.5` on list items for Minimal's denser feel. This applies to the individual conversation `<button>` or `<div>` row elements, not the project headers.

Also: active conversation highlight — if currently using a filled background chip, change to add a left border accent instead:
```tsx
// Active state class: add left border, use subtle bg
"border-l-2 border-[hsl(var(--violet))] bg-[hsl(var(--accent))] text-[hsl(var(--foreground))]"
// Inactive:
"border-l-2 border-transparent text-[hsl(var(--muted-foreground))] hover:bg-[hsl(var(--accent))] hover:text-[hsl(var(--foreground))]"
```

### Test
Visually confirm:
- Empty states are clean white, no dot grid
- Send button has no cyan glow halo
- Sidebar items are denser, active item has violet left border

---

## Task 3: Commit

```bash
git add apps/desktop/src/index.css \
        apps/desktop/src/components/chat/ChatWindow.tsx \
        apps/desktop/src/components/chat/CanvasPanel.tsx \
        apps/desktop/src/components/chat/Sidebar.tsx
git commit -m "Apply Obsidian Minimal theme: tokens, system font, hairline borders, clean components"
```

---

## Notes

- `mockup-minimal.html` in repo root can be deleted after implementation is verified, or kept as design reference
- All panes preserved: sidebar with projects, canvas, context pane, privacy review
- Dark mode tokens intentionally unchanged — user only needs light mode review now
- If any radius values look too sharp in practice, `0.375rem` can be bumped to `0.5rem` per component
