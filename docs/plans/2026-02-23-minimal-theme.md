# Obsidian Minimal Theme — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Reskin the full AILocalMind desktop app to match the Obsidian Minimal (kepano) aesthetic — true white surfaces, system UI font, hairline borders, flat shadows, tighter radius — preserving all features and pane structure exactly.

**Architecture:** Two-step CSS-first approach. Task 1 replaces all design tokens in `index.css` and removes decorative animation/glow classes. Task 2 removes the handful of hardcoded decorative Tailwind classes in components (glow on send button, dot pattern on empty states, gradient logo in sidebar header). No structural changes, no pane removals, no feature changes.

**Tech Stack:** Tailwind CSS v4, CSS custom properties, React 19 (Tailwind class edits only — no logic changes)

**Approved visual reference:** `mockup-minimal.html` in repo root.

---

### Task 1: Replace design tokens and clean up decorative CSS

**Files:**
- Modify: `apps/desktop/src/index.css`

**Step 1: Remove the Google Fonts import**

At line 1, delete the entire `@import url('https://fonts.googleapis.com/css2?...')` line.
Result: line 1 becomes `@import "tailwindcss";`

**Step 2: Replace the `:root` light token block**

Replace the entire `:root { ... }` block (lines 8–69) with:

```css
:root {
  /* Depth layers — Minimal light */
  --background: 0 0% 100%;            /* true white */
  --surface-1:  0 0% 100%;            /* panels — no depth distinction */
  --surface-2:  220 14% 96%;          /* #f2f3f5 — cards, inputs, bubbles */
  --surface-3:  220 14% 92%;          /* hover targets */

  /* Foreground */
  --foreground:        222 10% 10%;   /* #1a1a1a */
  --foreground-muted:  220 6% 33%;    /* #555 */
  --foreground-subtle: 220 4% 60%;    /* #999 */

  /* Aliases */
  --card:              0 0% 100%;
  --card-foreground:   222 10% 10%;
  --popover:           0 0% 100%;
  --popover-foreground:222 10% 10%;

  /* Primary — Sovereign Cyan (readable on white) */
  --primary:           199 100% 36%;  /* #0077b6 */
  --primary-foreground:0 0% 100%;

  /* Secondary */
  --secondary:         220 14% 96%;
  --secondary-foreground:222 10% 10%;

  /* Violet — Obsidian purple */
  --violet:            255 55% 57%;   /* #6e56cf */
  --violet-muted:      255 40% 80%;

  /* Muted */
  --muted:             220 14% 96%;
  --muted-foreground:  220 6% 40%;

  /* Accent */
  --accent:            220 14% 93%;
  --accent-foreground: 222 10% 10%;

  /* Destructive */
  --destructive:       4 70% 45%;
  --destructive-foreground: 0 0% 100%;

  /* Borders — hairline */
  --border: 220 13% 91%;
  --input:  220 13% 91%;
  --ring:   255 55% 57%;              /* violet focus ring */

  /* Radius — tighter than before */
  --radius: 0.375rem;

  /* Easing */
  --ease-out-expo: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-in-out:   cubic-bezier(0.4, 0, 0.2, 1);

  /* Shadows — flat, no glows */
  --shadow-sm: 0 1px 2px 0 rgb(0 0 0 / 0.05);
  --shadow:    0 2px 6px -1px rgb(0 0 0 / 0.07), 0 1px 3px -1px rgb(0 0 0 / 0.05);
  --shadow-md: 0 4px 10px -2px rgb(0 0 0 / 0.08), 0 2px 5px -2px rgb(0 0 0 / 0.05);
  --shadow-lg: 0 10px 20px -4px rgb(0 0 0 / 0.09), 0 4px 8px -4px rgb(0 0 0 / 0.05);
  --shadow-glow-cyan:   none;
  --shadow-glow-violet: none;

  /* Glass */
  --glass-border: 0 0 0 / 0.06;
}
```

**Step 3: Update the `html, body` font stack**

Find:
```css
  font-family: 'Inter', system-ui, sans-serif;
```
Replace with:
```css
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
```

**Step 4: Disable `.pattern-dots` in light mode**

Find the `.pattern-dots` rule:
```css
.pattern-dots {
  background-color: transparent;
  background-image: radial-gradient(hsl(var(--muted-foreground) / 0.15) 1px, transparent 1px);
  background-size: 24px 24px;
}
```
Replace with:
```css
.pattern-dots {
  background-image: none;
}
```

**Step 5: Disable glow utilities**

Find:
```css
.glow-cyan { box-shadow: var(--shadow-glow-cyan); }
.glow-violet { box-shadow: var(--shadow-glow-violet); }
```
Replace with:
```css
.glow-cyan  { box-shadow: none; }
.glow-violet { box-shadow: none; }
```

**Step 6: Remove aurora animation**

Delete the entire `@keyframes aurora { ... }` block (approx lines 241–266) and the `.aurora-bg { ... }` class (approx lines 268–280). These are dead code — no component uses `.aurora-bg` currently, but removing them prevents future accidents.

**Step 7: Remove translateY from hover-lift**

Find:
```css
.hover-lift:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}
```
Replace with:
```css
.hover-lift:hover {
  transform: none;
  box-shadow: var(--shadow-md);
}
```

**Step 8: Visual check**

Run `pnpm tauri dev` from `apps/desktop/`. Confirm:
- App shell is white, no gradients in background
- All text is near-black, readable
- Borders appear as thin hairlines
- Corners are noticeably tighter across buttons and panels

---

### Task 2: Remove hardcoded decorative classes from components

**Files:**
- Modify: `apps/desktop/src/components/chat/ChatWindow.tsx` (lines 619, 1182)
- Modify: `apps/desktop/src/components/chat/CanvasPanel.tsx` (line 38)
- Modify: `apps/desktop/src/components/chat/Sidebar.tsx` (line 107)

**Step 1: ChatWindow.tsx — remove pattern-dots from empty state**

Line 619. Find:
```tsx
<div className="flex flex-1 flex-col items-center justify-center text-center p-8 pattern-dots">
```
Replace with:
```tsx
<div className="flex flex-1 flex-col items-center justify-center text-center p-8">
```

**Step 2: ChatWindow.tsx — remove glow from send button**

Line 1182. Find:
```tsx
? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 shadow-[var(--shadow-glow-cyan)] active:scale-95"
```
Replace with:
```tsx
? "bg-[hsl(var(--primary))] text-[hsl(var(--primary-foreground))] hover:opacity-90 active:scale-95"
```

**Step 3: CanvasPanel.tsx — remove pattern-dots from empty state**

Line 38. Find:
```tsx
<div className="flex-1 flex flex-col items-center justify-center p-8 gap-6 pattern-dots">
```
Replace with:
```tsx
<div className="flex-1 flex flex-col items-center justify-center p-8 gap-6">
```

**Step 4: Sidebar.tsx — replace gradient logo with flat violet icon**

Line 107. Find:
```tsx
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-[hsl(var(--primary))] to-[hsl(162_78%_50%)] text-white shadow-sm">
```
Replace with:
```tsx
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[hsl(var(--violet)/0.12)] text-[hsl(var(--violet))]">
```

**Step 5: Visual check**

With `pnpm tauri dev` still running, confirm:
- Chat empty state has clean white background, no dot grid
- Send button has no cyan glow halo around it
- Canvas empty state is clean white
- Sidebar logo is a flat violet icon, no gradient

---

### Task 3: Commit

```bash
cd apps/desktop
git add src/index.css \
        src/components/chat/ChatWindow.tsx \
        src/components/chat/CanvasPanel.tsx \
        src/components/chat/Sidebar.tsx
git commit -m "Apply Obsidian Minimal theme: system font, true-white surfaces, hairline borders, flat components"
```
