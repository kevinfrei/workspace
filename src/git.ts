// This is stolen from @freik/node-utils, because I want no dependencies...

import {
  chkFieldType,
  chkObjectOf,
  chkOneOf,
  isFunction,
  isRegex,
  type typecheck,
} from '@freik/typechk';
import { exec as execOld } from 'node:child_process';
import { promisify } from 'node:util';

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
