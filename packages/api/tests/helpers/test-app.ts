import { createApp } from '../../src/index';

// Creates a fresh Express app instance for integration testing
// This avoids port conflicts and state leaking between test suites
export function createTestApp() {
  return createApp();
}
