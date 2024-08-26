import type { SimpleObject } from '@freik/typechk';

export type JsonType = { [key: string]: SimpleObject };

// This is used to do workspace-wide things, because Bun (and yarn+lerna+nx) don't bother to consider dev/peer deps as actual dependencies :(
export type Module = {
  name: string;
  location: string;
  requires: string[];
  packageJson: JsonType;
  version: string;
  dev?: Set<string>;
  peer?: Set<string>;
  direct?: Set<string>;
};

export type ModuleResolutionNode = Module & {
  dependedOnBy: Set<string>;
  unresolvedRequirements: Set<string>;
};

export type DependencyGraph = {
  ready: string[];
  providesTo: Map<string, Set<string>>;
  unresolved: Map<string, ModuleResolutionNode>;
};
