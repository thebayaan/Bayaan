# Testing Patterns

**Analysis Date:** 2026-01-26

## Test Framework

**Runner:**
- Jest v29.2.1
- Preset: `jest-expo` (configured in `package.json`)
- Config: `"jest": {"preset": "jest-expo"}` in `package.json`

**Assertion Library:**
- Jest built-in assertions (expect API)
- `@types/jest` v29.5.12 for TypeScript support

**Run Commands:**
```bash
npm test                    # Run all tests in watch mode
npm test -- --coverage      # Run tests with coverage report
npm test -- --no-coverage   # Run tests without coverage
npm test -- path/to/test    # Run specific test file
```

## Test File Organization

**Location:**
- Tests are co-located with source code in `__tests__` subdirectories
- Identified test file: `utils/__tests__/storageAnalytics.test.ts`
- Pattern: `[feature]/__tests__/[feature].test.ts` or `[feature].spec.ts`

**Naming:**
- Test files use `.test.ts` or `.test.tsx` suffix
- Spec files use `.spec.ts` or `.spec.tsx` suffix
- Matches the name of the code being tested (e.g., test for `utils/storage.ts` goes in `utils/__tests__/storage.test.ts`)

**Structure:**
```
utils/
├── storage.ts
├── validation.ts
├── debounce.ts
└── __tests__/
    ├── storageAnalytics.test.ts
    └── [other tests]

services/
├── AppInitializer.ts
└── database/
    ├── DatabaseService.ts
    └── __tests__/
        └── DatabaseService.test.ts
```

## Test Structure

**Suite Organization:**
Standard Jest describe/test pattern (not yet observed in codebase tests):
```typescript
describe('UtilityName', () => {
  describe('functionName', () => {
    test('should perform expected behavior', () => {
      // Arrange
      const input = value;

      // Act
      const result = functionUnderTest(input);

      // Assert
      expect(result).toBe(expectedValue);
    });

    test('should handle edge case', () => {
      // Test implementation
    });
  });
});
```

**Patterns:**
- Each test focuses on a single behavior (unit testing)
- Use `beforeEach` for setup shared across tests
- Use `afterEach` for cleanup (resetting mocks, clearing state)
- Group related tests with nested `describe` blocks
- Descriptive test names: `should [expected behavior] when [condition]`

## Mocking

**Framework:**
- Jest's built-in mocking (jest.mock, jest.fn, jest.spyOn)
- No additional mocking libraries currently in use

**Patterns:**
Typical mocking pattern for modules and functions:
```typescript
// Mock a module
jest.mock('@/services/something');

// Mock a function
const mockFunction = jest.fn();

// Mock implementation
jest.mock('module-name', () => ({
  functionName: jest.fn(() => expectedValue),
}));

// Spy on method
jest.spyOn(object, 'method').mockImplementation(() => value);

// Reset mocks
beforeEach(() => {
  jest.clearAllMocks();
});

afterEach(() => {
  jest.restoreAllMocks();
});
```

**What to Mock:**
- External API calls and HTTP requests
- File system operations
- Device APIs (AsyncStorage, SQLite)
- Service dependencies
- Zustand store actions
- Navigation functions
- Timers (setTimeout, setInterval)

**What NOT to Mock:**
- Utility functions (especially pure functions)
- Type definitions and interfaces
- Helper functions within the same module
- Constants and configuration
- React hooks (unless they have complex side effects)
- DOM/Native rendering (use React Testing Library for that)

## Fixtures and Factories

**Test Data:**
Pattern for creating mock Track objects:
```typescript
const mockTrack: Track = {
  id: 'test-track-1',
  url: 'https://example.com/audio.mp3',
  title: 'Surah Al-Fatiha',
  artist: 'Mohammed Jibreel',
  reciterId: 'reciter-1',
  reciterName: 'Mohammed Jibreel',
  duration: 300,
};

// Factory function for creating test tracks
function createMockTrack(overrides: Partial<Track> = {}): Track {
  return {
    ...mockTrack,
    ...overrides,
  };
}
```

**Location:**
- Test fixtures typically defined at the top of test files
- Factories for complex objects to support multiple test scenarios
- Consider extracting shared fixtures to `__tests__/fixtures/` if used across multiple test files
- Mock data should closely match real application data structure

## Coverage

**Requirements:**
- Not enforced currently (no coverage threshold configuration)
- Minimal test coverage in codebase (single test file observed)

**View Coverage:**
```bash
npm test -- --coverage
# Generates coverage report in terminal and creates coverage/ directory
# Open coverage/lcov-report/index.html for detailed HTML report
```

**Coverage Types:**
- Statement coverage: % of statements executed
- Branch coverage: % of conditional branches executed
- Function coverage: % of functions called
- Line coverage: % of lines executed

## Test Types

**Unit Tests:**
- Scope: Individual functions and utilities
- Approach: Test function in isolation with various inputs
- Example test for `timeUtils.ts`:
  ```typescript
  describe('formatDuration', () => {
    test('should format 65 seconds as 1:05', () => {
      expect(formatDuration(65)).toBe('1:05');
    });

    test('should pad seconds with zero', () => {
      expect(formatDuration(5)).toBe('0:05');
    });
  });
  ```
- Focus on: Input validation, edge cases, return values
- No external dependencies (all mocked or stubbed)

**Integration Tests:**
- Scope: Multiple components/services working together
- Approach: Test interaction between store actions and database calls
- Example: Test playlist creation, retrieval, and update in sequence
- Focus on: State changes, data persistence, service interactions
- May use real databases in test environment

**E2E Tests:**
- Framework: Not currently implemented in codebase
- Would test complete user workflows (if added)
- Examples: User login → Browse reciters → Play audio → Create playlist

## Common Patterns

**Async Testing:**
```typescript
// Using async/await in tests
test('should load and play track', async () => {
  const {getByText} = render(<PlayerComponent />);

  await act(async () => {
    await playTrack(mockTrack);
  });

  expect(getByText('Now Playing')).toBeInTheDocument();
});

// Using done callback (older pattern)
test('should handle async operation', (done) => {
  asyncFunction().then(result => {
    expect(result).toBeDefined();
    done();
  });
});

// Returning promises
test('should resolve with data', () => {
  return fetchData().then(result => {
    expect(result).toHaveProperty('id');
  });
});
```

**Error Testing:**
```typescript
// Testing thrown errors
test('should throw error for invalid input', () => {
  expect(() => {
    processInput(null);
  }).toThrow('Input cannot be null');
});

// Testing Promise rejections
test('should reject with error message', () => {
  return expect(asyncFunctionThatFails()).rejects.toThrow('Error message');
});

// Testing error handling
test('should handle errors gracefully', async () => {
  jest.spyOn(api, 'fetch').mockRejectedValue(new Error('Network error'));

  const result = await safeAsyncFunction();

  expect(result).toEqual({error: 'Network error'});
  expect(console.error).toHaveBeenCalled();
});
```

## Store Testing

**Zustand Store Pattern:**
Testing store actions and state updates:
```typescript
// Import store
import {usePlayerStore} from '@/store/playerStore';

describe('PlayerStore', () => {
  beforeEach(() => {
    // Reset store to initial state
    usePlayerStore.setState({
      isPlaying: false,
      activeTrack: null,
    });
  });

  test('should set active track', () => {
    const {setActiveTrack} = usePlayerStore.getState();
    const mockTrack = createMockTrack();

    setActiveTrack(mockTrack);

    const {activeTrack} = usePlayerStore.getState();
    expect(activeTrack).toEqual(mockTrack);
  });

  test('should toggle playback', async () => {
    const {togglePlayback} = usePlayerStore.getState();
    const initialState = usePlayerStore.getState().isPlaying;

    await togglePlayback();

    const newState = usePlayerStore.getState().isPlaying;
    expect(newState).toBe(!initialState);
  });
});
```

## Service Testing

**Database Service Pattern:**
Testing async service initialization and operations:
```typescript
import {databaseService} from '@/services/database/DatabaseService';

describe('DatabaseService', () => {
  afterEach(async () => {
    // Cleanup after each test
    await databaseService.cleanup();
  });

  test('should initialize database', async () => {
    await databaseService.initialize();

    expect(databaseService.isInitialized()).toBe(true);
  });

  test('should create playlist', async () => {
    await databaseService.initialize();

    const playlist = await databaseService.createPlaylist({
      name: 'Test Playlist',
      color: '#FF0000',
    });

    expect(playlist.id).toBeDefined();
    expect(playlist.name).toBe('Test Playlist');
  });
});
```

## React Component Testing

**Setup Pattern:**
```typescript
import {render, screen, waitFor, act} from '@testing-library/react-native';
import userEvent from '@testing-library/user-event';
import {ComponentName} from '@/components/ComponentName';

describe('ComponentName', () => {
  test('should render component', () => {
    render(<ComponentName prop="value" />);

    expect(screen.getByText('Expected Text')).toBeTruthy();
  });

  test('should handle user interaction', async () => {
    const handlePress = jest.fn();
    render(<ComponentName onPress={handlePress} />);

    const button = screen.getByRole('button');
    await userEvent.press(button);

    expect(handlePress).toHaveBeenCalled();
  });

  test('should update when prop changes', () => {
    const {rerender} = render(<ComponentName count={1} />);

    expect(screen.getByText('1')).toBeTruthy();

    rerender(<ComponentName count={2} />);

    expect(screen.getByText('2')).toBeTruthy();
  });
});
```

## Testing Best Practices

**Do:**
- Test behavior, not implementation details
- Use descriptive test names that explain what is being tested
- Keep tests focused and independent
- Use fixtures/factories for common test data
- Mock external dependencies
- Test error cases and edge cases
- Use `beforeEach`/`afterEach` for setup/teardown
- Verify both success and failure paths
- Use `act()` wrapper for state changes in component tests

**Don't:**
- Test private implementation details
- Create interdependent tests that rely on execution order
- Over-mock (mock too many things and lose integration coverage)
- Use time-based assertions (avoid testing exact delays)
- Test third-party library behavior
- Mock everything without testing real integration
- Write tests that are more complex than the code being tested
- Use ambiguous test names like "test 1" or "should work"

## Current Test Coverage

**Existing Tests:**
- Single identified test file: `utils/__tests__/storageAnalytics.test.ts` (currently empty)
- Most of codebase lacks automated tests
- Focus areas lacking tests: stores, services, components, hooks

**Priority for Test Coverage:**
1. Store actions (playerStore, playlistsStore, queueStore) - critical state management
2. Service initialization (AppInitializer, DatabaseService) - core app functionality
3. Database operations (CRUD operations on playlists)
4. Queue management logic
5. Component rendering and interactions
6. Error handling paths

---

*Testing analysis: 2026-01-26*
