import { hasField, hasFieldType, isObjectOfString, isUndefined } from '@freik/typechk';
import { LoadCatalogs, LoadModules, SavePackage } from './PackageTools';
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
      const obj:Record<string, string> = pkg[key];
      const deps = { ...obj };
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

function CatalogLookup(key: string, ver: string, catalogs: Record<string, Record<string, string>>) :string{
  if (ver.startsWith("catalog:")) {
    if (ver === "catalog:") {
      return catalogs['_default_'][key] || "MISSING";
    } 
    const elem = ver.substring(8);
    return catalogs[elem][key] || "MISSING";
  } else { 
    return ver;
  }
}

function ReverseCatalogLookup(key: string, ver: string, catalogs: Record<string, Record<string, string>>) :string{
  // If the version string is a specific value, go get it from the catalogs
  let res = ver;
  Object.keys(catalogs).forEach((val)=> {
    if (hasField(catalogs[val], key)) {
      if (catalogs[val][key] === ver) {
        res = "catalog:"
        if (val !== '_default_') {
          res += val;
        }
      }
    }
  });
  return res;
}

export async function ChangeCatalogs(setToVersion: boolean): Promise<void> {
  const modules = await LoadModules();
  const catalogs = await LoadCatalogs();

  function UpdatedCatalogFields(pkg: JsonType, key: string): void {
    if (hasFieldType(pkg, key, isObjectOfString)) {
      const obj:Record<string, string> = pkg[key];
      const deps = { ...obj };
      Object.keys(obj).forEach((k) => {
        if (setToVersion) {
          deps[k] = CatalogLookup(k, deps[k], catalogs);
        } else {
          deps[k] = ReverseCatalogLookup(k, deps[k], catalogs);
        }
      });
      pkg[key] = deps;
    }
  }

  await Promise.all(
    modules.map(async (mod) => {
      const pkg = mod.packageJson;
      // Set (or clear) the 'dependencies' entries.
      UpdatedCatalogFields(pkg, 'dependencies');
      UpdatedCatalogFields(pkg, 'devDependencies');
      UpdatedCatalogFields(pkg, 'peerDependencies');
      mod.packageJson = pkg;
      await SavePackage(mod);
    }),
  );
}
