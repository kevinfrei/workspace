import { LoadModules } from './PackageTools';
import type {
  Module,
  DependencyGraph,
  ModuleResolutionNode,
  PromiseWaiter,
} from './types';
import { RunTask } from './TaskRunner';

function calcDependencyGraph(modules: Module[]): DependencyGraph {
  const providesTo = new Map<string, Set<string>>(
    modules.map((d) => [d.name, new Set<string>()]),
  );
  // This set of modules that are ready will decrease as we iterate modules.
  const ready = new Set<string>(modules.map((d) => d.name));
  // This is the set of modules that have dependencies.
  const unresolved = new Map<string, Set<string>>();

  for (const mod of modules) {
    for (const reqMod of mod.requires) {
      // For each dependency, add it to the "providesTo" set.
      if (!providesTo.has(reqMod)) {
        throw new Error(`Dependency ${reqMod} not found`);
      }
      providesTo.get(reqMod)!.add(mod.name);
      // Remove it from the 'ready' set, because this module has a dependency.
      ready.delete(mod.name);
      // Add this item to the unresolved map.
      if (!unresolved.has(mod.name)) {
        unresolved.set(mod.name, new Set<string>());
      }
      // Add this dependency to the items being waited on.
      unresolved.get(mod.name)!.add(reqMod);
    }
  }
  // Assert that none of the ready tasks should be in unresolved, right?
  if (ready.size + unresolved.size !== modules.length) {
    throw new Error('Dependency graph calculation failed');
    // Could go into something more detailed here, but I'm lazy.
  }
  const moduleMap: Map<string, ModuleResolutionNode> = new Map(
    modules
      .filter((m) => !ready.has(m.name))
      .map((m) => [
        m.name,
        {
          ...m,
          unresolvedRequirements: new Set<string>(m.requires),
          dependedOnBy: unresolved.get(m.name)!,
        },
      ]),
  );
  return { ready: [...ready], providesTo, unresolved: moduleMap };
}
// This has an issue with peer dependencies.
// It should probably schedule them at the same time, but if there's a circular
// dependency, it get's stuck. I think to handle them properly, I'd need to add
// a peer kind of dependency. I think I'll just punt on that for now.
export async function scheduler(
  waiter: PromiseWaiter,
  args: string[],
): Promise<void> {
  const modules = await LoadModules();
  const moduleMap = new Map<string, Module>(modules.map((m) => [m.name, m]));
  const { ready, providesTo, unresolved } = calcDependencyGraph(modules);

  function runTask(name: string): Promise<void> {
    console.log('Running task', name);
    const mod = moduleMap.get(name);
    if (!mod) {
      throw new Error(`Module ${name} not found!`);
    }
    return resolveTask(RunTask(mod.name, mod.location, args));
  }

  // When a task (promise) completes, it needs to update the ready set, and if
  // there are newly ready tasks, it should then wait on their tasks to complete,
  // otherwise, it should just return.
  // So, a task-resolver:
  async function resolveTask(waitOn: Promise<string>): Promise<void> {
    const name = await waitOn;
    console.log('Finished task', name);
    // The task is done, so check to see if any tasks that depend on it are now ready.
    const maybeReadyDeps = providesTo.get(name);
    // maybeReadyDeps are all the modules that depend on the item we just resolved.
    if (maybeReadyDeps) {
      const newlyReady: string[] = [];
      for (const depToResolve of maybeReadyDeps) {
        // For each task that depends on this one, remove this task from its dependencies.
        // If the pending set is empty, add it to the ready set
        const unresolvedModule = unresolved.get(depToResolve);
        if (unresolvedModule) {
          unresolvedModule.unresolvedRequirements.delete(name);
          if (unresolvedModule.unresolvedRequirements.size == 0) {
            newlyReady.push(unresolvedModule.name);
          }
        } else {
          throw new Error('Invalid dependency graph detected');
        }
      }
      // Now wait on all of the remaining resolve tasks (recursion is fun!)
      if (newlyReady.length) {
        await waiter(newlyReady.map(runTask));
      }
    }
  }
  // TODO: Allow multi-phase tasks. This is basically a 'second dimension'
  // for the dependency graph. It would allow lots of stuff to get done
  // sooner (once an root has finished task 1, it can do task 2, while
  // scheduling task 1 for it's dependents)
  // Seed the recursion with the initially ready tasks.
  console.log('Waiting on', ready);
  console.log('Task runner', runTask);
  await waiter(ready.map(runTask));
}
