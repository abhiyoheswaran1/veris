import { makeExecRunner } from "./base.js";

export const pytestRunner = makeExecRunner("python", {
  runner: "pytest",
  capId: "unit",
  tool: "pytest",
  args: ["-q"],
  title: "Unit tests (Python)",
  pass: "pytest passed",
  fail: "pytest failed",
  timeoutMs: 10 * 60_000,
});

export const mypyRunner = makeExecRunner("python", {
  runner: "mypy",
  capId: "types",
  tool: "mypy",
  args: ["."],
  title: "Type check (mypy)",
  pass: "no type errors",
  fail: "type errors",
  timeoutMs: 5 * 60_000,
});

export const pyrightRunner = makeExecRunner("python", {
  runner: "pyright",
  capId: "types",
  tool: "pyright",
  args: [],
  title: "Type check (pyright)",
  pass: "no type errors",
  fail: "type errors",
  timeoutMs: 5 * 60_000,
});

export const ruffRunner = makeExecRunner("python", {
  runner: "ruff",
  capId: "lint",
  tool: "ruff",
  args: ["check", "."],
  title: "Lint (ruff)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const flake8Runner = makeExecRunner("python", {
  runner: "flake8",
  capId: "lint",
  tool: "flake8",
  args: ["."],
  title: "Lint (flake8)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});

export const pylintRunner = makeExecRunner("python", {
  runner: "pylint",
  capId: "lint",
  tool: "pylint",
  args: ["--recursive=y", "."],
  title: "Lint (pylint)",
  pass: "no lint errors",
  fail: "lint errors",
  timeoutMs: 5 * 60_000,
});
