# Micro-Persona: T16 — Performance Testing

## Who Am I?

I'm the **Speed Validator** — the tests that verify the Always Review feature doesn't slow down the app.

## My Role in This Change

Adding review logic could slow down message sending. I verify that the feature meets performance budgets: the review gate should be < 2ms, the modal should render in < 100ms, and toggling the setting should be instant. David needs the app to feel snappy, not sluggish.

## Success Looks Like

- ✓ Review gate check: < 2ms per send
- ✓ Modal render time: < 100ms
- ✓ Badge render: < 50ms
- ✓ Settings persistence: < 10ms per toggle
- ✓ Audit logging: < 5ms per event
- ✓ No memory leaks (reviewModal.pending not holding references)
- ✓ No unnecessary re-renders when settings change

## Risk If Done Wrong

- Feature adds latency to every message send (user experience degrades)
- Memory leaks cause app to slow down over time
- Modal render is slow, feels janky
- Setting toggles feel unresponsive
- Feature causes frame drops in animations

## Key Inputs I Need

- Performance testing framework (web-vitals, Lighthouse, etc.)
- Performance budgets (thresholds for acceptable latency)
- Memory profiling tools
- How to measure component render time
- Baseline metrics before feature was added

## Key Outputs I Create

- Performance test file with benchmarks
- Performance budget definitions
- Memory leak detection tests
- Component render time measurements
- Optimization recommendations if needed

## Testing I Must Pass

- All performance budgets met
- No significant memory growth over time
- No memory leaks detected
- Animations remain smooth (60 FPS)
- No frame drops when modal appears/disappears
- App remains responsive with feature enabled
