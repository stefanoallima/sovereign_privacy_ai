# AILocalMind Test Suite

Comprehensive regression and unit tests for AILocalMind personas store functionality.

## Test Files

### `stores/personas.test.ts`

Complete regression test suite for the personas store covering:

1. **localStorage Migration v2 → v3** (5 tests)
   - Migration correctness with all personas
   - Selected persona ID preservation
   - Custom personas merge with defaults
   - Deduplication of custom personas
   - Property preservation during migration

2. **Original 4 Personas** (5 tests)
   - Psychologist persona loads correctly
   - Life Coach persona loads correctly
   - Career Coach persona loads correctly
   - Tax Accountant persona with PII vault requirement
   - All original personas present with `isBuiltIn: true`

3. **Batch 1 Personas (5 personas)** (6 tests)
   - Tax Audit Assistant with backend configuration
   - Personal Branding Coach persona
   - Social Media Strategist persona
   - Real Estate Advisor with PII vault
   - Cybersecurity Advisor with Ollama backend
   - Immigration/Visa Advisor with required backend
   - All batch 1 personas have correct backend configs

4. **Built-in Persona Protection** (5 tests)
   - Prevent deletion of psychologist
   - Prevent deletion of tax-accountant
   - Prevent deletion of tax-audit
   - Prevent deletion of all built-in personas
   - Allow deletion of custom personas

5. **Custom Personas Survival** (3 tests)
   - Preserve custom personas during migration
   - Prevent duplication during migration
   - Preserve custom persona properties (name, icon, temperature, etc.)

6. **Persona Selection** (12 tests)
   - Select each original persona
   - Select each batch 1 persona
   - Select custom personas
   - Null selection support
   - Toggle between personas
   - Update getSelectedPersona

7. **Integration Tests** (5 tests)
   - Persona count and selection consistency
   - Duplicate persona creation
   - Custom persona workflow (create, select, update, delete)
   - Built-in persona immutability
   - Batch 1 preservation after multiple operations

## Test Coverage

**Total Tests: 41**
- localStorage Migration: 5 tests
- Original 4 Personas: 5 tests
- Batch 1 Personas: 6 tests
- Built-in Protection: 5 tests
- Custom Persistence: 3 tests
- Selection Behavior: 12 tests
- Integration: 5 tests

**Coverage Target: >80% for personas.ts**

### Covered Scenarios

✅ All 4 original personas (psychologist, life-coach, career-coach, tax-accountant)
✅ All 6 batch 1 personas (tax-audit, personal-branding-coach, social-media-strategist, real-estate-advisor, cybersecurity-advisor, immigration-visa-advisor)
✅ localStorage v2→v3 migration
✅ Custom persona creation, update, deletion
✅ Persona selection and getSelectedPersona behavior
✅ Built-in persona immutability
✅ Backend configuration preservation
✅ PII vault requirements
✅ Anonymization mode settings
✅ System prompt validation
✅ Temperature and maxTokens consistency

### NOT Covered (Batch 2 testing deferred)

- Batch 2 personas (real-estate-advisor, cybersecurity-advisor, immigration-visa-advisor) - will be tested in T06
- Note: These personas are included but not separately tested as "batch 2" since they were added in batch 1

## Running Tests

### Prerequisites

Install test dependencies:
```bash
pnpm add -D vitest @vitest/ui happy-dom
```

### Commands

```bash
# Run tests in watch mode
pnpm test

# Run tests once
pnpm test:run

# Run tests with coverage
pnpm test:coverage
```

### Test Environment

- Framework: Vitest
- DOM Environment: happy-dom (lightweight, no browser needed)
- Node: >=18.0.0
- Configuration: `vitest.config.ts`

## Test Structure

Each test suite follows the pattern:

```typescript
describe('Feature Name', () => {
  beforeEach(() => {
    // Setup
  });

  afterEach(() => {
    // Cleanup
  });

  it('should do something specific', () => {
    // Arrange
    // Act
    // Assert
  });
});
```

## Key Test Data

### Original 4 Personas
- **psychologist**: temperature 0.7, hybrid backend optional
- **life-coach**: temperature 0.8, no specific backend config
- **career-coach**: temperature 0.7, no specific backend config
- **tax-accountant**: temperature 0.6, hybrid backend required, PII vault

### Batch 1 Personas (6 total)
- **tax-audit**: temperature 0.5, hybrid backend required, PII vault
- **personal-branding-coach**: temperature 0.75, hybrid backend optional
- **social-media-strategist**: temperature 0.7, hybrid backend optional
- **real-estate-advisor**: temperature 0.6, hybrid backend required, PII vault
- **cybersecurity-advisor**: temperature 0.65, ollama backend optional
- **immigration-visa-advisor**: temperature 0.65, hybrid backend required, PII vault

## Migration Strategy (v2 → v3)

The migration:
1. Loads v2 state from localStorage
2. Extracts custom personas (isBuiltIn: false)
3. Starts with all DEFAULT_PERSONAS
4. Merges custom personas by ID (custom takes precedence on collision)
5. Preserves selectedPersonaId
6. Returns merged state with v3 version

## Assertions Used

- `toBe()`: Exact equality check
- `toEqual()`: Deep equality check
- `toBeDefined()`: Value is not undefined
- `toBeUndefined()`: Value is undefined
- `toBeNull()`: Value is null
- `toBeGreaterThan()`: Numeric comparison
- `toBeGreaterThanOrEqual()`: Numeric comparison

## Common Test Patterns

### Testing Persona Loading
```typescript
const persona = store.getPersonaById('id');
expect(persona).toBeDefined();
expect(persona?.isBuiltIn).toBe(true);
expect(persona?.systemPrompt.length).toBeGreaterThan(100);
```

### Testing Selection
```typescript
store.selectPersona('id');
expect(store.selectedPersonaId).toBe('id');
expect(store.getSelectedPersona()?.id).toBe('id');
```

### Testing Immutability
```typescript
const countBefore = store.personas.length;
store.deletePersona('built-in-id');
expect(store.personas.length).toBe(countBefore);
```

## Notes

- All tests are idempotent (can run in any order)
- localStorage is cleared before/after each test
- No external API calls or side effects
- Tests focus on regression: ensuring existing functionality still works
- Integration tests verify cross-feature interactions

## Future Enhancements

- Add snapshot tests for system prompts
- Test batch 2 personas specifically (T06)
- Add performance tests for large persona sets
- Test concurrent selection/deletion operations
- Add browser storage quota tests
