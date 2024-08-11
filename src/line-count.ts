import * as Git from './git.js';
import rl from 'readline';
import fs from 'fs';
import { once } from 'events';

export async function countLines(unparsed: string[]): Promise<number> {
  function help() {
    console.error('Unknown arguments to linecount');
    console.error(' Pass a list of suffixes to count by starting them with .');
    console.error(
      ' Pass a list of substrings to exclude by starting them with -',
    );
    console.error('For example: line-count .ts -.test.');
    console.error(
      ' will count the lines in all the .ts files, unless the file',
    );
    console.error(' name contains ".test."');
  }
  const include = unparsed
    .filter((v) => v.startsWith('.'))
    .map((v) => v.substring(1));
  const exclude = unparsed
    .filter((v) => v.startsWith('-'))
    .map((v) => v.substring(1));
  if (include.length + exclude.length !== unparsed.length) {
    help();
    return -1;
  }
  const rgexp = '\\.(' + include.join('|') + ')$';
  const toCount = new RegExp(rgexp, 'i');
  const files = await Git.files({ groups: { toCount } });
  const types = files.groups.get('toCount');
  if (types === undefined) {
    console.error('No files counted');
    help();
    return 0;
  }
  // Remove any files that contain one of the excluded string patterns
  const filtered = types.filter((v) => !exclude.some((e) => v.indexOf(e) >= 0));
  // filtered should be the list of files to count lines in
  let total = 0;
  for (const pathname of filtered) {
    const rdln = rl.createInterface(fs.createReadStream(pathname, 'utf8'));
    let count = 0;
    rdln.on('line', (line) => {
      if (line.trim().length > 0) {
        count++;
      }
    });
    await once(rdln, 'close');
    console.log(pathname, ':', count);
    total += count;
  }
  console.log(`Total lines: ${total}`);
  return 0;
}
