// This is stolen from @freik/node-utils, because I want no dependencies...

import { exec as execOld } from 'node:child_process';
import { promisify } from 'node:util';

type typecheck<T> = (val: unknown) => val is T;
function isRegex(obj: unknown): obj is RegExp {
  return obj instanceof RegExp;
}

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
function isFunction(obj: unknown): obj is Function {
  return typeof obj === 'function';
}

function isObjectOf<T>(
  obj: unknown,
  chk: typecheck<T>,
): obj is NonNullable<{ [key: string | number | symbol]: T }> {
  if (!isObjectNonNull(obj)) {
    return false;
  }
  for (const k of [...Object.keys(obj), ...Object.getOwnPropertySymbols(obj)]) {
    if (!hasFieldType(obj, k, chk)) {
      return false;
    }
  }
  return true;
}

function chkObjectOf<T>(
  chk: typecheck<T>,
): typecheck<{ [key: string | number | symbol]: T }> {
  return (obj: unknown): obj is { [key: string | number | symbol]: T } =>
    isObjectOf(obj, chk);
}

function isOneOf<T, U>(
  obj: unknown,
  chk1: typecheck<T>,
  chk2: typecheck<U>,
): obj is T | U {
  return chk1(obj) || chk2(obj);
}

function chkOneOf<T, U>(
  chk1: typecheck<T>,
  chk2: typecheck<U>,
): typecheck<T | U> {
  return (obj: unknown): obj is T | U => isOneOf(obj, chk1, chk2);
}

function isEmpty(obj: unknown): obj is null | undefined {
  return obj === undefined || obj === null;
}

function isObjectNonNull(obj: unknown): obj is NonNullable<object> {
  return typeof obj === 'object' && !isEmpty(obj);
}

function hasField<K extends string | number | symbol>(
  obj: unknown,
  key: K,
): obj is NonNullable<{ [key in K]: unknown }> {
  return isObjectNonNull(obj) && key in obj;
}

function hasFieldType<T, K extends string | number | symbol>(
  obj: unknown,
  key: K,
  checker: typecheck<T>,
): obj is NonNullable<{ [key in K]: T }> {
  return hasField(obj, key) && checker(obj[key]);
}

function chkFieldType<T, K extends string | number | symbol>(
  key: K,
  checker: typecheck<T>,
): typecheck<NonNullable<{ [key in K]: T }>> {
  return (obj: unknown): obj is { [key in K]: T } =>
    hasFieldType(obj, key, checker);
}

const exec = promisify(execOld);
type FilterFn = (name: string) => boolean;
export type GroupEntry = RegExp | FilterFn;
export type Groups = { [keys: string | symbol]: GroupEntry };
export interface NormalOptions {
  staged?: boolean;
  cwd?: string;
  all?: boolean;
}
export interface GroupedOptions extends NormalOptions {
  groups: Groups;
}
export type GroupedResult = {
  groups: Map<string, string[]>;
  remaining: string[];
};
const chkGroupedOptions: typecheck<GroupedOptions> = chkFieldType(
  'groups',
  chkObjectOf<FilterFn | RegExp>(
    chkOneOf<FilterFn, RegExp>(isFunction as typecheck<FilterFn>, isRegex),
  ),
);
export async function files(options: GroupedOptions): Promise<GroupedResult>;
export async function files(options?: NormalOptions): Promise<string[]>;

export async function files(
  ops?: GroupedOptions | NormalOptions,
): Promise<GroupedResult | string[]> {
  const options: GroupedOptions | NormalOptions = ops || {};
  const cmd = options.staged
    ? 'git diff --diff-filter=ACMR --cached --name-only'
    : options.all
      ? 'git ls-files'
      : 'git diff HEAD --diff-filter=d --name-only';
  const opts = options.cwd
    ? { encoding: 'utf8', cwd: options.cwd }
    : { encoding: 'utf8' };
  const { stdout } = await exec(cmd, opts);
  const theFiles = stdout.toString().split('\n').slice(0, -1);
  if (chkGroupedOptions(options)) {
    const groups = options.groups;
    const keys = Object.keys(groups);
    const tests = new Map<string, GroupEntry>([
      ...keys.map((k): [string, GroupEntry] => [k, groups[k]]),
    ]);
    const result: GroupedResult = {
      groups: new Map<string, string[]>(keys.map((k) => [k, []])),
      remaining: [],
    };
    theFiles.forEach((file) => {
      let gotIt = '';
      tests.forEach((val, key) => {
        if (
          gotIt === '' &&
          ((isRegex(val) && val.test(file)) || (isFunction(val) && val(file)))
        ) {
          gotIt = key;
        }
      });
      if (gotIt === '') {
        result.remaining.push(file);
      } else {
        const i = result.groups.get(gotIt);
        if (i) {
          i.push(file);
        }
      }
    });
    const empties = [...result.groups.keys()].filter((k) => {
      const g = result.groups.get(k);
      return !g || g.length === 0;
    });
    empties.forEach((e) => result.groups.delete(e));
    return result;
  } else {
    return theFiles;
  }
}
