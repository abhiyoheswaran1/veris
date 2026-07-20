// Programmatic API for VerisKit. The CLI (bin/veris) and the veriskit-mcp
// server are both adapters over this surface.

export { detectProject } from "./config/detect.js";
export type {
  CapabilityId,
  Project,
  Verdict,
  VerificationRun,
} from "./core/model.js";
export type { AffectedOutcome } from "./core/orchestrate.js";
export { affectedProject, verifyProject } from "./core/orchestrate.js";
export type { Attestation, Statement } from "./evidence/attestation.js";
export type {
  AttestationV2,
  DsseEnvelope,
  DsseSignature,
} from "./evidence/dsse.js";
export type { AttestOutcome } from "./evidence/attestation-project.js";
export { attestProject } from "./evidence/attestation-project.js";
export type { EvidenceRecord } from "./evidence/record.js";
export type { VerifyResult } from "./evidence/verify-evidence.js";
export { verifyEvidenceFile } from "./evidence/verify-evidence.js";
export type { FlakyCheck } from "./history/flaky.js";
export { detectFlaky } from "./history/flaky.js";
export { loadRuns } from "./history/read.js";
export type { GateOutcome } from "./policy/gate-project.js";
export { gateProject } from "./policy/gate-project.js";
export type { GateCheck, GateResult, Policy } from "./policy/policy.js";
export type { Analysis } from "./project-graph/analyze.js";
export { analyze } from "./project-graph/analyze.js";
export { buildGraph } from "./project-graph/graph.js";
export type { ProjectGraph } from "./project-graph/model.js";
export { getEnvironmentInfo } from "./util/env.js";
