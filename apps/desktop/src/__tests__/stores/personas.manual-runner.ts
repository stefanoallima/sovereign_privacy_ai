/**
 * Manual Test Runner for Personas Store
 *
 * This is a standalone test runner that can be executed without Vitest.
 * It provides basic test assertions and reporting.
 *
 * Usage: npx ts-node src/__tests__/stores/personas.manual-runner.ts
 */

// Simple test framework
class TestRunner {
  private passedTests = 0;
  private failedTests = 0;
  private currentSuite = '';
  private testStack: Array<{ name: string; fn: () => void }> = [];

  describe(name: string, fn: () => void) {
    this.currentSuite = name;
    console.log(`\n📋 ${name}`);
    fn();
  }

  it(name: string, fn: () => void) {
    try {
      fn();
      this.passedTests++;
      console.log(`  ✅ ${name}`);
    } catch (error) {
      this.failedTests++;
      console.log(`  ❌ ${name}`);
      console.log(`     Error: ${(error as Error).message}`);
    }
  }

  expect(value: unknown) {
    return {
      toBe: (expected: unknown) => {
        if (value !== expected) {
          throw new Error(`Expected ${expected}, got ${value}`);
        }
      },
      toEqual: (expected: unknown) => {
        if (JSON.stringify(value) !== JSON.stringify(expected)) {
          throw new Error(
            `Expected ${JSON.stringify(expected)}, got ${JSON.stringify(value)}`
          );
        }
      },
      toBeDefined: () => {
        if (value === undefined) {
          throw new Error(`Expected value to be defined`);
        }
      },
      toBeUndefined: () => {
        if (value !== undefined) {
          throw new Error(`Expected value to be undefined`);
        }
      },
      toBeNull: () => {
        if (value !== null) {
          throw new Error(`Expected value to be null`);
        }
      },
      toBeGreaterThan: (expected: number) => {
        if ((value as number) <= expected) {
          throw new Error(`Expected ${value} to be greater than ${expected}`);
        }
      },
      toBeGreaterThanOrEqual: (expected: number) => {
        if ((value as number) < expected) {
          throw new Error(
            `Expected ${value} to be greater than or equal to ${expected}`
          );
        }
      },
      toBeArray: () => {
        if (!Array.isArray(value)) {
          throw new Error(`Expected value to be an array`);
        }
      },
      hasLength: (expected: number) => {
        if ((value as unknown[]).length !== expected) {
          throw new Error(
            `Expected array length ${(value as unknown[]).length} to equal ${expected}`
          );
        }
      },
    };
  }

  report() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Test Results:`);
    console.log(`  ✅ Passed: ${this.passedTests}`);
    console.log(`  ❌ Failed: ${this.failedTests}`);
    console.log(`  📊 Total:  ${this.passedTests + this.failedTests}`);
    console.log(`${'='.repeat(60)}\n`);

    if (this.failedTests > 0) {
      process.exit(1);
    }
  }
}

// Export for use
export const testRunner = new TestRunner();
export const describe = testRunner.describe.bind(testRunner);
export const it = testRunner.it.bind(testRunner);
export const expect = testRunner.expect.bind(testRunner);
export const report = testRunner.report.bind(testRunner);
