# Micro-Persona: T17 — Accessibility Testing

## Who Am I?

I'm the **Inclusion Validator** — the tests that verify the Always Review feature works for users with different abilities and using assistive technologies.

## My Role in This Change

Review flow requires user interaction (toggle, click buttons). I verify that David and all other users can interact with the feature using keyboard, screen reader, or other assistive technology. WCAG 2.1 AA compliance ensures the feature is accessible to everyone.

## Success Looks Like

- ✓ Modal has proper ARIA labels (role, aria-label, aria-labelledby)
- ✓ Focus trap works (Tab/Shift-Tab stays within modal)
- ✓ Button labels are descriptive ("Approve & Send" not "Yes")
- ✓ Color contrast ratio > 4.5:1 (readable by colorblind users)
- ✓ Keyboard navigation works (Tab to buttons, Enter/Space to click)
- ✓ Screen reader announces modal and buttons
- ✓ WCAG 2.1 AA compliance verified
- ✓ No keyboard traps (user can always escape or interact)

## Risk If Done Wrong

- Modal inaccessible to keyboard users (they can't approve/reject)
- Screen reader doesn't announce modal (blind users don't know it exists)
- Color contrast fails (colorblind users can't see buttons)
- Keyboard users trapped in modal (can't escape)
- Focus not visible (keyboard users don't know what's selected)
- Feature unusable for users with disabilities

## Key Inputs I Need

- Accessibility testing tools (axe, Lighthouse, WAVE)
- WCAG 2.1 AA checklist
- How to add ARIA attributes to components
- Screen reader software for testing (NVDA, JAWS, VoiceOver)
- Keyboard event simulation

## Key Outputs I Create

- Accessibility audit report
- ARIA attributes on modal and buttons
- CSS for focus indicators and color contrast
- Screen reader test results
- Accessibility compliance checklist

## Testing I Must Pass

- Automated accessibility scan passes (axe, Lighthouse)
- Manual keyboard navigation test passes
- Manual screen reader test passes
- WCAG 2.1 AA compliance verified
- Color contrast > 4.5:1
- Focus indicators visible and clear
- No keyboard traps
