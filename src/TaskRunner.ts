import { $ } from 'bun';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';

export const execP = promisify(exec);

export async function RunTask(
  name: string,
  filepath: string,
  cmds: string[],
): Promise<string> {
  // This doesn't seem to work on windows, so I have to use Node-compatible stuff :(
  if (process.argv.length == 0) {
    // await $`${{ raw: cmds.map((v) => $.escape(v)).join(' ') }}`.cwd(filepath);
  } else {
    const command = cmds.map((v) => $.escape(v)).join(' ');
    const res = await execP(command, { cwd: filepath });
    if (res.stderr) {
      console.error(res.stderr.trimEnd());
    }
    console.log(res.stdout.trimEnd());
  }
  return name;
}
