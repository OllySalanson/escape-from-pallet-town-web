export const TEST_LAB_QUERY = 'test-lab';

export function isTestLabRequested(
  isDevelopment = import.meta.env.DEV,
  search = typeof window === 'undefined' ? '' : window.location.search,
): boolean {
  return isDevelopment && new URLSearchParams(search).get(TEST_LAB_QUERY) === '1';
}
