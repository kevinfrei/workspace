import { promises as fs } from 'node:fs';
import path from 'node:path';
import { $, Glob } from 'bun';
import {
  hasField,
  hasFieldType,
  hasStrField,
  isArrayOfString,
  isObjectOfString,
} from '@freik/typechk';

import type { JsonType, Module } from './types';

// Just read a JSON text file, and return the JSON object.
async function readJson(filename: string): Promise<JsonType> {
  const pkg = (await fs.readFile(filename)).toString();
  return JSON.parse(pkg);
}

// Get the list of workspaces, and returns the list of matching directories that contain package.json files.
async function getProjects(): Promise<string[]> {
  const topLevelPkg = await readJson('package.json');
  if (!hasFieldType(topLevelPkg, 'workspaces', isArrayOfString)) {
    throw new Error('workspaces field must be an array of strings');
  }
  const workspaces = topLevelPkg.workspaces;
  const res: string[] = [];
  for (const ws of workspaces) {
    const glob = new Glob(ws);
    const files = glob.scan({ onlyFiles: false });
    for await (const file of files) {
      if ((await fs.stat(file)).isDirectory()) {
        const pkgFile = path.join(file, 'package.json');
        if (await fs.exists(pkgFile)) {
          res.push(pkgFile);
        }
      }
    }
  }
  return res;
}

// Given a list of dependencies, return just ones that are workspaces.
function workspaceDeps(deps: { [key: string]: string }): string[] {
  return Object.keys(deps).filter((dep) => deps[dep].startsWith('workspace:'));
}

const depKeys: { name: string; key: 'direct' | 'dev' | 'peer' }[] = [
  { name: 'dependencies', key: 'direct' },
  { name: 'devDependencies', key: 'dev' },
  { name: 'peerDependencies', key: 'peer' },
];

// Given a package.json file, return the name, location, and list of workspace dependencies.
async function readModule(pkgFile: string): Promise<Module> {
  const pkg = await readJson(pkgFile);
  const requires = new Set<string>();
  if (!hasStrField(pkg, 'name')) {
    throw new Error('name field must be a string');
  }
  const version = hasStrField(pkg, 'version') ? pkg.version : '0.0.1';
  const module: Module = {
    name: pkg.name,
    location: path.dirname(pkgFile),
    packageJson: pkg,
    version,
    requires: [],
  };
  const deps = {
    direct: new Set<string>(),
    dev: new Set<string>(),
    peer: new Set<string>(),
  };

  for (const depId of depKeys) {
    if (!hasField(pkg, depId.name)) {
      continue;
    }
    if (!hasFieldType(pkg, depId.name, isObjectOfString)) {
      throw new Error(`${depId.name} field must be an object of strings`);
    }
    workspaceDeps(pkg[depId.name]).forEach((k) => {
      deps[depId.key].add(k);
      // TODO: What to do with peer dependencies?
      // They're not really dependencies in the "I can't work if I don't have
      // this already built" kind of dependency, but they are still required to
      // be installed. Should I have barriers before and/or after peer
      // dependencies that exist in the same overall workspace?
      if (depId.key !== 'peer') {
        requires.add(k);
      }
    });
  }
  const direct = deps.direct.size ? deps.direct : undefined;
  const dev = deps.dev.size ? deps.dev : undefined;
  const peer = deps.peer.size ? deps.peer : undefined;
  return { ...module, requires: [...requires], direct, dev, peer };
}

export async function LoadModules(): Promise<Module[]> {
  // First, load the package.json's from the workspaces
  const pkgFiles = await getProjects();
  return await Promise.all(pkgFiles.map(readModule));
}

export async function SavePackage(mod: Module): Promise<void> {
  await fs.writeFile(
    path.join(mod.location, 'package.json'),
    JSON.stringify(mod.packageJson, null, 2) + '\n',
  );
}
