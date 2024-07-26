# workspace

A tool for running tasks across multi-module workspaces

## WORK IN PROGRES!

This started out as a helper script because [bun's](https://bun.sh) `--filter`
syntax was lacking, and yarn/lerna/nx's support for multiple modules in a single
workspace is a poorly documented mess. My solution? Create a new, poorly
documented mess that I understand, because I wrote it! Brilliant!

Seriously: I should make sure this is documented. Currently, I'm just copying
the workspace.ts file into my [packages](https://github.com/kevinfrei/packages)
repo and using it there. I'll eventually promote to a real, executable NPM
module.

## Why in a new repo?

Well, this thing is probably going to grow, so I want to be able to use lots of
my build tools for it. I'm using bun as a runtime, but it really needs to work
with node, electron, and npm/yarn/pnpm as well, so I wanted it to be free of
"public" dependencies.

## How to use it?

In `package.json`:

```json
{
  "scripts": {
    "test": "bun runall test",
    "format": "bun flatall format",
    "runall": "workspace bun run",
    "flatall": "workspace --no-deps bun run"
  }
}
```

By default, the command(s) you provide are run against all modules in your
workspace in "dependency" order, including `devDepencies`, which is a problem
with the `--filter` bun command. In addition, it can be used with `--no-deps` to
_ignore_ the dependency graph and just run the command on all the modules.

## Future work

There's one particular bug that treats peer depencies as "full" dependencies,
resulting in a potential deadlock. This should be easy to fix.

In addition I should:

1. Add the ability to wait until all peers are ready before proceeding with task
   running. (on or off by default? Not sure...)

2. Add a "multi-task" command scheduler, so that you can format, lint, then test
   everything, and if formatting finishes on some "root" modules, linting can be
   run, while the dependent modules are still formatting.

3. If building the dependency graph is complicated/slow, I should try caching
   it, and only updating it as needed/on demand? Maybe automatically if the
   graph gets to a certain size?

4. Failure handling control. Keep going? Fail fast? Finish current phase? Return
   failure?

Anything else urgently important?
