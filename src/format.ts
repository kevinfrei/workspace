import { promisify } from 'node:util';
import { exec } from 'node:child_process';
import * as Git from './git.js';

const execp = promisify(exec);

function makeFileLists(files: string[]): string[] {
  const res: string[] = [''];
  for (const file of files) {
    const cleaned = file.startsWith('"') ? file : `"${file}"`;
    // If we're still less than 2048 characters, add it to the current list
    // TODO: Make this use .gitattributes instead of just hard coding it
    if (
      cleaned.startsWith('".pnp.') ||
      cleaned.startsWith('".yarn/') ||
      cleaned.startsWith('".yarn\\')
    ) {
      continue;
    }
    if (
      res[res.length - 1].length === 0 ||
      res[res.length - 1].length + cleaned.length < 2048
    ) {
      res[res.length - 1] += ` ${cleaned}`;
    } else {
      // Add a new string to the file chunk list
      res.push(cleaned);
    }
  }
  return res;
}

export async function formatFiles(unparsed: string[]): Promise<number> {
  let pkgmgr = 'yarn';
  if (unparsed.length === 1) {
    if (
      unparsed[0] === 'npm' ||
      unparsed[0] === 'yarn' ||
      unparsed[0] === 'pnpm' ||
      unparsed[0] === 'bun'
    ) {
      pkgmgr = unparsed[0];
    } else {
      console.error('Unknown package manager: ' + unparsed[0]);
      return -1;
    }
  } else if (unparsed.length !== 0) {
    console.error('Unknown arguments to format');
    return -1;
  }
  const files = await Git.files({
    groups: {
      prettier: (filename: string) => {
        if (filename === '.prettierrc') {
          return true;
        }
        return /\.(ts|tsx|js|jsx|md|html|css|json|ejs|mjs|cjs|yml|yaml)$/i.test(
          filename,
        );
      },
      clang: /\.(cpp|c|cc|ino|h|hh|hpp)$/i,
    },
  });
  await Promise.all([
    formatGroup(
      files.groups.get('prettier'),
      `${pkgmgr} run prettier --write `,
    ),
    formatGroup(files.groups.get('clang'), 'clang-format -i '),
  ]);
  return 0;
}

async function formatGroup(grp: string[] | undefined, fmtCommand: string) {
  if (grp !== undefined) {
    // Have to batch files: truly delightful... Thanks, windows shell...
    const fileLists = makeFileLists(grp);
    for (const file of fileLists) {
      let grpRes;
      try {
        grpRes = await execp(`${fmtCommand}${file}`);
      } catch (e) {
        console.error(e);

        console.error(file);

        console.error(fileLists);
      }
      if (grpRes !== undefined) {
        console.log(grpRes.stdout);

        console.error(grpRes.stderr);
      }
    }
  }
}
