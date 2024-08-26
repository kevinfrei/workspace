import { describe, test, expect } from 'bun:test';
import { workspaceTool } from '../workspace';
import { beforeAll } from 'bun:test';
import { LoadModules } from '../PackageTools';

beforeAll(() => {
  process.chdir('src/__tests__/test-packages');
});

test('Module Loader', async () => {
  const modules = await LoadModules();
  expect(modules.length).toBe(10);
});

describe('Workspace Scheduling', async () => {
  test('No args', async () => {
    expect(await workspaceTool(['-h'])).toBe(0);
  });
  test('serial', async () => {
    expect(await workspaceTool(['-s', 'bun', 'run', 'test'])).toBe(0);
  });
  test('parallel', async () => {
    expect(await workspaceTool(['-p', 'bun', 'run', 'test'])).toBe(0);
  });
  test('dep-based', async () => {
    expect(await workspaceTool(['bun', 'run', 'test'])).toBe(0);
  });
});
