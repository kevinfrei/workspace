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
  let branch: string | undefined = undefined;
  while (unparsed.length > 0) {
    const arg = unparsed.shift();
    if ((arg === '--branch' || arg === '-b') && unparsed.length > 0) {
      branch = unparsed.shift();
    } else if (
      arg === 'npm' ||
      arg === 'yarn' ||
      arg === 'pnpm' ||
      arg === 'bun'
    ) {
      pkgmgr = arg;
    } else {
      console.error('Unknown package or missing branch: ' + arg);
      return -1;
    }
  }
  const options: Git.GroupedOptions = {
    groups: {
      prettier: (filename: string) => {
        if (filename === '.prettierrc') {
          return true;
        }
        return /\.(ts|tsx|java|js|jsx|md|html|css|json|ejs|mjs|cjs|yml|yaml)$/i.test(
          filename,
        );
      },
      clang: /\.(cpp|c|cc|ino|h|hh|hpp)$/i,
    },
  };
  if (branch) {
    options.baseBranch = branch;
  }
  const files = await Git.files(options);
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
