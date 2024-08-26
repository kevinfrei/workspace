import minimist from 'minimist';
import { hasField, hasStrField } from '@freik/typechk';
import { BumpVersion, ChangeInternalDeps, verPattern } from './VersioningTools';
import { LoadModules, SavePackage } from './PackageTools';
import { scheduler } from './TaskScheduler';
import { RunTask } from './TaskRunner';

async function ChangeVersions(bumpVersions: string): Promise<void> {
  const modules = await LoadModules();
  await Promise.all(
    modules.map(async (mod): Promise<void> => {
      mod.packageJson.version = BumpVersion(mod.version, bumpVersions);
      await SavePackage(mod);
    }),
  );
}

// TODO: Handle filtering
export async function workspaceTool(args: string[]): Promise<number> {
  const parse = minimist(args, {
    boolean: ['p', 'f', 'c', 'h', 's'],
    string: ['v'],
    alias: {
      p: ['parallel', 'noDeps'],
      s: ['serial', 'linear'],
      f: 'fixWorkspaceDeps',
      c: 'cutWorkspaceDeps',
      v: 'version',
      h: 'help',
    },
  });
  if (hasField(parse, 'h') && parse.h !== false) {
    console.log(
      'Usage: bun run tools workspace [options] [command] [args...]\n' +
        '  -h, --help                Show this help message.\n' +
        '  -p, --parallel, --noDeps  Run in parallel instead of dependency order.\n' +
        '  -s, --serial, --linear    Run tasks one at a time, respecting dependencies.\n' +
        '  -f, --fixWorkspaceDeps    Set all workspace dependencies to numeric.\n' +
        '  -c, --cutWorkspaceDeps    Set workspace dependencies to generic.\n' +
        '  -v, --version <value>     Bump version of all the packages.\n' +
        '                <value>: "patch", "minor", "major", or a spepcific version.\n',
    );
    return 0;
  }
  const setToVersion = hasField(parse, 'f') && parse.f !== false;
  const clearVersion = hasField(parse, 'c') && parse.c !== false;
  if (setToVersion || clearVersion) {
    await ChangeInternalDeps(setToVersion);
    return 0;
  }
  const bumpVersions = hasStrField(parse, 'v') ? parse.v : '';
  if (bumpVersions.length) {
    if (!verPattern.test(bumpVersions)) {
      console.error('Invalid version value.');
      console.error(
        'Valid patterns are: "major", "minor", "patch", or a specific version number.',
      );
      console.error('For example: "1.2.3", "2.1", or "4".');
      return -1;
    }
    await ChangeVersions(bumpVersions);
    return 0;
  }

  if (hasField(parse, 'p') && parse.p !== false) {
    const modules = await LoadModules();
    await Promise.all(
      modules.map((mod) => RunTask(mod.name, mod.location, parse._)),
    );
  } else {
    await scheduler(hasField(parse, 's') && parse.s !== false, parse._);
  }
  return 0;
}
