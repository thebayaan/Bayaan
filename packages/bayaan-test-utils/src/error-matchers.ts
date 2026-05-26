import type {ErrorCode} from '@bayaan/types';
import {BayaanError} from '@bayaan/types';

/**
 * Jest custom matchers for the `BayaanError` hierarchy.
 *
 * Use `registerBayaanMatchers()` to install them, or pass `bayaanErrorMatchers`
 * directly to `expect.extend(...)`.
 */
export const bayaanErrorMatchers = {
  toBeBayaanError(
    this: jest.MatcherContext,
    received: unknown,
    code?: ErrorCode,
  ): jest.CustomMatcherResult {
    if (!(received instanceof BayaanError)) {
      return {
        pass: false,
        message: () =>
          `expected value to be a BayaanError, got ${this.utils.printReceived(
            received,
          )}`,
      };
    }

    if (code !== undefined && received.code !== code) {
      return {
        pass: false,
        message: () =>
          `expected BayaanError with code ${this.utils.printExpected(
            code,
          )}, got code ${this.utils.printReceived(received.code)}`,
      };
    }

    return {
      pass: true,
      message: () =>
        code !== undefined
          ? `expected value not to be a BayaanError with code ${this.utils.printExpected(
              code,
            )}`
          : `expected value not to be a BayaanError`,
    };
  },
};

/** Install the matchers on Jest's `expect`. Call once per test file or in a setup file. */
export function registerBayaanMatchers(): void {
  expect.extend(bayaanErrorMatchers);
}

// Augment Jest's matcher types so consumers get autocomplete + type-checking.
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace jest {
    interface Matchers<R> {
      toBeBayaanError(code?: ErrorCode): R;
    }
    interface Expect {
      toBeBayaanError(code?: ErrorCode): unknown;
    }
    interface InverseAsymmetricMatchers {
      toBeBayaanError(code?: ErrorCode): unknown;
    }
  }
}
