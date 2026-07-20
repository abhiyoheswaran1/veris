import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { describe, expect, it } from "vitest";
import { createServer } from "./server.js";

describe("veriskit-mcp server", () => {
  it("connects and lists tools (none yet)", async () => {
    const server = createServer();
    const [clientTransport, serverTransport] =
      InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "0.0.0" });
    await Promise.all([
      server.connect(serverTransport),
      client.connect(clientTransport),
    ]);
    const tools = await client.listTools();
    expect(Array.isArray(tools.tools)).toBe(true);
    await client.close();
  });

  it("lists the nine tools with correct read-only annotations", async () => {
    const server = createServer();
    const [ct, st] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "t", version: "0.0.0" });
    await Promise.all([server.connect(st), client.connect(ct)]);
    const { tools } = await client.listTools();
    const names = tools.map((t) => t.name).sort();
    expect(names).toEqual(
      [
        "veris_affected",
        "veris_attest",
        "veris_doctor",
        "veris_evidence_verify",
        "veris_gate",
        "veris_log",
        "veris_plan",
        "veris_scan",
        "veris_verify",
      ].sort(),
    );
    const doctor = tools.find((t) => t.name === "veris_doctor");
    expect(doctor?.annotations?.readOnlyHint).toBe(true);
    const verify = tools.find((t) => t.name === "veris_verify");
    expect(verify?.annotations?.readOnlyHint).toBe(false);
    const attest = tools.find((t) => t.name === "veris_attest");
    expect(attest?.annotations?.readOnlyHint).toBe(false);
    const gate = tools.find((t) => t.name === "veris_gate");
    expect(gate?.annotations?.readOnlyHint).toBe(true);
    await client.close();
  });
});
