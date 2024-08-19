import { hasFieldType, isObjectOfString, isUndefined } from '@freik/typechk';
import { LoadModules, SavePackage } from './PackageTools';
import type { Module, JsonType } from './types';

export const verPattern = /^(major|minor|patch|\d+(\.\d+(\.\d+)?)?)$/;

export function BumpVersion(version: string, bump: string): string {
  const parts = version.split('.');
  if (bump == 'major') {
    return `${parseInt(parts[0]) + 1}.0.0`;
  }
  if (bump == 'minor') {
    return `${parts[0]}.${parseInt(parts[1]) + 1}.0`;
  }
  if (bump == 'patch') {
    return `${parts[0]}.${parts[1]}.${parseInt(parts[2]) + 1}`;
  }
  const split = bump.split('.');
  if (split.length == 1) {
    return `${bump}.0.0`;
  }
  if (split.length == 2) {
    return `${bump}.0`;
  }
  return bump;
}

export async function ChangeInternalDeps(setToVersion: boolean): Promise<void> {
  const modules = await LoadModules();
  const moduleMap = new Map<string, Module>(modules.map((m) => [m.name, m]));

  function UpdatedDepField(pkg: JsonType, key: string): void {
    if (hasFieldType(pkg, key, isObjectOfString)) {
      const deps = { ...pkg[key] };
      Object.keys(pkg[key]).forEach((k) => {
        const dep = moduleMap.get(k);
        if (!isUndefined(dep)) {
          deps[k] = setToVersion ? dep.version : 'workspace:*';
        }
      });
      pkg[key] = deps;
    }
  }

  await Promise.all(
    modules.map(async (mod) => {
      const pkg = mod.packageJson;
      // Set (or clear) the 'dependencies' entries.
      UpdatedDepField(pkg, 'dependencies');
      UpdatedDepField(pkg, 'devDependencies');
      UpdatedDepField(pkg, 'peerDependencies');
      mod.packageJson = pkg;
      await SavePackage(mod);
    }),
  );
}
