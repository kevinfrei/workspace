#!/usr/bin/env bun

/**
 * This is the entry point for scripts invoked by your package manager
 */

import * as process from 'node:process';
import { formatFiles } from './format.js';
import { countLines } from './line-count.js';
import { makeModule } from './make-module.js';
import { workspaceTool } from './workspace.js';

const err = console.error;

function isNumber(obj: unknown): obj is number {
  return typeof obj === 'number' && !isNaN(obj - 0);
}

function invoke(command: (args: string[]) => Promise<number> | number): void {
  const res = command(process.argv.slice(3));
  if (!isNumber(res)) {
    res
      .then((val) => process.exit(val))
      .catch((rsn) => {
        err(rsn);
        process.exit(-1);
      });
  } else {
    process.exit(res);
  }
}

switch (process.argv[2].toLocaleLowerCase()) {
  case 'format':
    invoke(formatFiles);
    break;

  case 'linecount':
  case 'line-count':
    invoke(countLines);
    break;

  case 'make-module':
  case 'makemodule':
    invoke(makeModule);
    break;

  case 'bunws':
  case 'bun-ws':
  case 'bun-workspace':
  case 'workspace':
    invoke(workspaceTool);
    break;

  default:
    err('Sorry, unrecognized ftool command!');
    err('Supported commands:');
    err('format, linecount, makemodule');
    process.exit(-1);
}
