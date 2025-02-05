export const performance = {
  now: (): number => Date.now(),
};

export const measureOperation = async <T>(
  operationName: string,
  operation: () => Promise<T>,
): Promise<T> => {
  const start = performance.now();
  try {
    const result = await operation();
    return result;
  } finally {
    const duration = performance.now() - start;
    console.log(`[Performance] ${operationName}: ${duration}ms`);
  }
};
