export type NodeKind = "source" | "test" | "config" | "other";

export interface ModuleNode {
  file: string; // repo-relative, POSIX
  kind: NodeKind;
  imports: string[]; // resolved repo-relative intra-project files
  importedBy: string[]; // reverse edges
}

export interface ProjectGraph {
  root: string;
  resolver: "typescript" | "scanner";
  nodes: Record<string, ModuleNode>;
  sourceFiles: string[];
  testFiles: string[];
}
