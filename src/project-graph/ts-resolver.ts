import { scannerImports } from "./scanner-resolver.js";

export interface ResolverChoice {
  resolver: "typescript" | "scanner";
  importsOf: (file: string) => string[];
}

export function selectResolver(root: string): ResolverChoice {
  // Task 3 replaces this with: try the project's TypeScript, else scanner.
  return {
    resolver: "scanner",
    importsOf: (file) => scannerImports(root, file),
  };
}
