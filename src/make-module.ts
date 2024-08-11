import * as esbuild from 'esbuild';
import { promises as fs } from 'fs';
import minimist from 'minimist';
import * as ts from 'typescript';

import type { Opts as MinimistOpts } from 'minimist';

type ModuleArgs = {
  moduleType: 'esm' | 'cjs' | 'dual';
  map: boolean;
  bundle: boolean;
  tsconfig?: string;
  minify: boolean;
  outputDir: string;
  platform?: 'node' | 'browser';
  entryPoints: string[];
  external: string[];
};

function getArgs(unparsed: string[]): ModuleArgs {
  const mo: MinimistOpts = {
    boolean: ['esm', 'cjs', 'dual', 'map', 'bundle', 'help', 'minify'],
    string: ['tsconfig', 'outdir', 'platform', 'external'],
    alias: {
      esm: ['e', 'esmodule'],
      cjs: ['c', 'commonjs'],
      bundle: 'b',
      dual: ['d', 'dualmode', 'dual-mode'],
      map: ['m', 'sourcemap', 'source-map', 'linemap', 'line-map', 'lines'],
      minify: 'min',
      tsconfig: ['t', 'ts'],
      outdir: ['o', 'output-dir', 'out-dir'],
      platform: ['p', 'target'],
      help: ['h', 'usage', '?'],
      external: 'x',
    },
    default: {
      dual: true,
      map: false,
      minify: false,
      bundle: false,
      outdir: 'lib',
    },
  };
  const pa = minimist(unparsed, mo);
  if (!pa.bundle && pa.external) {
    console.error('The --external option is only valid when bundling');
    process.exit(-1);
  }
  if (pa.bundle) {
    pa.minify = true;
  }
  if (pa.help) {
    console.log(
      'Usage: ftool make-module [options] <entrypoint> [entrypoint2] [entrypoint3] ...',
    );
    console.log('Options:');
    console.log('  -e, --esm            Generate ESM output');
    console.log('  -c, --cjs            Generate CJS output');
    console.log(
      '  -d, --dual           Generate both ESM and CJS output (default)',
    );
    console.log('  -m, --map            Generate sourcemaps');
    console.log('  -b, --bundle         Bundle the output (implies --minify)');
    console.log('  -t, --ts [path]      Path to the tsconfig.json file');
    console.log(
      '                       For dual-mode, the path *may* include a "{}" element,',
    );
    console.log(
      '                       e.g. "tsconfig.{}.json" which will be replaced with',
    );
    console.log('                       "esm" or "cjs" as appropriate.');
    console.log('  --min, --minify      Minify the output');
    console.log(
      '  -o, --outdir [path]  Output directory (default: "lib"). Can include a "{}"',
    );
    console.log(
      '                       element, e.g. "lib-{}-out" which will be replaced with',
    );
    console.log(
      '                       esm/cjs. If no "{}" is present and dual mode is selected',
    );
    console.log(
      '                       an additional subfolder named esm or cjs will be created',
    );
    console.log('                       for the output of dual.');
    console.log('  -p, --platform (node | browser)');
    console.log('                       Target platform. Defaults to neutral.');
    console.log(
      '  -x, --external [m,]  A comma separated list of external items (when bundling)',
    );
    console.log('  -h, --help           Show this help message');
    process.exit(0);
  }
  return {
    moduleType: pa.esm ? 'esm' : pa.cjs ? 'cjs' : 'dual',
    map: pa.map,
    bundle: pa.bundle,
    tsconfig: pa.tsconfig,
    outputDir: pa.outdir,
    entryPoints: pa._,
    minify: pa.minify,
    platform: pa.platform,
    external: pa.external ? pa.external.split(',') : [],
  };
}

async function invokeEsbuild(
  opts: ModuleArgs,
  outdir: string,
  format: 'esm' | 'cjs',
  tsconfig?: string,
): Promise<void> {
  await esbuild.build({
    entryPoints: opts.entryPoints,
    bundle: opts.bundle,
    outdir,
    format,
    jsx: 'transform',
    target: 'esnext',
    platform: opts.platform,
    minify: opts.minify,
    sourcemap: opts.map,
    tsconfig: tsconfig,
    external: opts.external,
  });
}

function getOutputDir(
  format: 'd.ts' | 'cjs' | 'esm',
  opts: ModuleArgs,
): string {
  let outDir = opts.outputDir;
  const targetType = format === 'd.ts' ? 'esm' : format;
  if (opts.moduleType === 'dual' && outDir.indexOf('{}') === -1) {
    outDir += '/{}';
  }
  return outDir.replace('{}', targetType);
}

async function genBundle(opts: ModuleArgs): Promise<void> {
  const esmOut = getOutputDir('esm', opts);
  if (opts.moduleType === 'dual' || opts.moduleType === 'esm') {
    const tsconfig = opts.tsconfig
      ? opts.tsconfig.replace('{}', 'esm')
      : undefined;
    await invokeEsbuild(opts, esmOut, 'esm', tsconfig);
  }
  const cjsOut = getOutputDir('cjs', opts);
  if (opts.moduleType === 'dual' || opts.moduleType === 'cjs') {
    const tsconfig = opts.tsconfig
      ? opts.tsconfig.replace('{}', 'cjs')
      : undefined;
    await invokeEsbuild(opts, cjsOut, 'cjs', tsconfig);
  }
  if (opts.moduleType === 'dual') {
    await Promise.all([
      fs.writeFile(esmOut + '/package.json', '{"type":"module"}'),
      fs.writeFile(cjsOut + '/package.json', '{"type":"commonjs"}'),
    ]);
  }
}

// This does *not* work correctly yet
function compile(fileNames: string[], options: ts.CompilerOptions): void {
  const program = ts.createProgram(fileNames, options);
  const emitResult = program.emit();

  const allDiagnostics = ts
    .getPreEmitDiagnostics(program)
    .concat(emitResult.diagnostics);

  allDiagnostics.forEach((diagnostic) => {
    if (diagnostic.file) {
      const { line, character } = ts.getLineAndCharacterOfPosition(
        diagnostic.file,
        diagnostic.start!,
      );
      const message = ts.flattenDiagnosticMessageText(
        diagnostic.messageText,
        '\n',
      );
      console.log(
        `${diagnostic.file.fileName} (${line + 1},${character + 1}): ${message}`,
      );
    } else {
      console.log(
        ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n'),
      );
    }
  });
  /* const exitCode =  emitResult.emitSkipped ? 1 : 0;
  console.log(`Process exiting with code '${exitCode}'.`);
  process.exit(exitCode);
  */
}

function genTypes(entryPoints: string[], opts: ModuleArgs): void {
  compile(entryPoints, {
    declaration: true,
    noEmitOnError: true,
    noImplicitAny: true,
    emitDeclarationOnly: true,
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ES2020,
    allowJs: true,
    esModuleInterop: true,
    skipLibCheck: true,
    strict: true,
    jsx: ts.JsxEmit.ReactJSX,
    outDir: getOutputDir('d.ts', opts),
    moduleResolution: ts.ModuleResolutionKind.Bundler,
  });
}
// First, transpile the code for ESM and CJS, then use the typescript compiler
// to generate the .d.ts files as well.

export async function makeModule(unparsed: string[]): Promise<number> {
  const args = getArgs(unparsed);
  // Generate the CJS code
  // console.log(args);
  // do the esbuild step(s)
  await genBundle(args);
  // Generate the types
  console.log('Generating TypeScript .d.ts files');
  await genTypes(args.entryPoints, args);
  // console.log('Done');
  return 0;
}
