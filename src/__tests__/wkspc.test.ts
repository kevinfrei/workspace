import { describe, test, expect } from 'bun:test';
import { workspaceTool } from '../workspace';
import { BumpVersion } from '../BumpVersion';

describe('Version Bump Testing', async () => {
  test.each(['files', 'bar.1', '0.1.1.1', 'pitch'])(
    'Fail test %p',
    async (fail) => {
      expect(await workspaceTool(['-v', fail])).toBe(-1);
    },
  );
  const input = [
    ['major', '2.0.0'],
    ['minor', '1.3.0'],
    ['patch', '1.2.4'],
    ['3', '3.0.0'],
    ['2.5', '2.5.0'],
    ['5.4.3', '5.4.3'],
  ];
  test.each(input)(
    'Bump version("1.2.3", %p) should be %p',
    (input, expected) => {
      expect(BumpVersion('1.2.3', input)).toBe(expected);
    },
  );
});
