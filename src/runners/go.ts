import { makeExecRunner } from "./base.js";

export const goTestRunner = makeExecRunner("go", {
  runner: "go-test",
  capId: "unit",
  tool: "go",
  args: ["test", "./..."],
  title: "Unit tests (Go)",
  pass: "go test passed",
  fail: "go test failed",
  timeoutMs: 10 * 60_000,
});

export const goBuildRunner = makeExecRunner("go", {
  runner: "go-build",
  capId: "types",
  tool: "go",
  args: ["build", "./..."],
  title: "Compile (go build)",
  pass: "compiles",
  fail: "compile errors",
  timeoutMs: 5 * 60_000,
});

export const golangciLintRunner = makeExecRunner("go", {
  runner: "golangci-lint",
  capId: "lint",
  tool: "golangci-lint",
  args: ["run"],
  title: "Lint (golangci-lint)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const goVetRunner = makeExecRunner("go", {
  runner: "go-vet",
  capId: "lint",
  tool: "go",
  args: ["vet", "./..."],
  title: "Lint (go vet)",
  pass: "no vet issues",
  fail: "vet issues",
  timeoutMs: 5 * 60_000,
});
