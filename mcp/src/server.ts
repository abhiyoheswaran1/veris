import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import {
  affectedHandler,
  attestHandler,
  doctorHandler,
  evidenceVerifyHandler,
  gateHandler,
  logHandler,
  planHandler,
  scanHandler,
  verifyHandler,
} from "./tools.js";

const READ_ONLY = { readOnlyHint: true } as const;
const EXECUTES = { readOnlyHint: false } as const;
const pathArg = {
  path: z
    .string()
    .optional()
    .describe("Project root (defaults to the server's working directory)"),
};

export function createServer(): McpServer {
  const server = new McpServer({ name: "veriskit", version: "0.7.0" });

  server.registerTool(
    "veris_doctor",
    {
      description:
        "Report what checks VerisKit can run here and why (read-only).",
      inputSchema: pathArg,
      annotations: READ_ONLY,
    },
    (args) => doctorHandler(args),
  );
  server.registerTool(
    "veris_scan",
    {
      description:
        "Map the import graph and list untested high-impact files (read-only).",
      inputSchema: pathArg,
      annotations: READ_ONLY,
    },
    (args) => scanHandler(args),
  );
  server.registerTool(
    "veris_plan",
    {
      description: "Recommend what to test from the import graph (read-only).",
      inputSchema: {
        ...pathArg,
        base: z.string().optional().describe("Compare against a git ref"),
      },
      annotations: READ_ONLY,
    },
    (args) => planHandler(args),
  );
  server.registerTool(
    "veris_log",
    {
      description:
        "List past verification runs, or flaky checks, from local history (read-only).",
      inputSchema: {
        ...pathArg,
        limit: z.number().optional(),
        flaky: z.boolean().optional(),
      },
      annotations: READ_ONLY,
    },
    (args) => logHandler(args),
  );
  server.registerTool(
    "veris_evidence_verify",
    {
      description:
        "Recompute and check a VerisKit evidence.json or bundle (read-only).",
      inputSchema: {
        file: z.string().describe("Path to evidence.json or a bundle"),
      },
      annotations: READ_ONLY,
    },
    (args) => evidenceVerifyHandler(args),
  );
  server.registerTool(
    "veris_verify",
    {
      description:
        "Run the configured checks and return an honest verdict. Executes the project's test tooling and writes evidence under .veris/.",
      inputSchema: {
        ...pathArg,
        partialOk: z.boolean().optional(),
        browser: z.boolean().optional(),
      },
      annotations: EXECUTES,
    },
    (args) => verifyHandler(args),
  );
  server.registerTool(
    "veris_affected",
    {
      description:
        "Run only the checks affected by changed files. Executes the project's test tooling and writes evidence under .veris/.",
      inputSchema: { ...pathArg, base: z.string().optional() },
      annotations: EXECUTES,
    },
    (args) => affectedHandler(args),
  );
  server.registerTool(
    "veris_attest",
    {
      description:
        "Sign the latest verification into a portable attestation of the exact commit (refuses a dirty/stale tree).",
      inputSchema: pathArg,
      annotations: EXECUTES,
    },
    (args) => attestHandler(args),
  );
  server.registerTool(
    "veris_gate",
    {
      description:
        "Check the latest attestation against .veris/policy.json — pass/fail with per-check reasons.",
      inputSchema: {
        ...pathArg,
        policy: z.string().optional().describe("Path to a policy file"),
        attestation: z
          .string()
          .optional()
          .describe("Path to an attestation file"),
      },
      annotations: READ_ONLY,
    },
    (args) => gateHandler(args),
  );

  return server;
}

export async function main(): Promise<void> {
  const server = createServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  // Never write to stdout here; it is the protocol channel.
  process.stderr.write("veriskit-mcp: ready on stdio\n");
}
