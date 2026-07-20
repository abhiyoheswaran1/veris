import { attestProject } from "../../evidence/attestation-project.js";

export async function runAttest(
  root: string,
  opts: { key?: string; out?: string } = {},
): Promise<number> {
  const outcome = await attestProject(root, opts);
  if (!outcome.ok) {
    process.stderr.write(`veris: ${outcome.error}\n`);
    return 1;
  }

  const signer = outcome.signerKeyId
    ? `signed by ${outcome.signerKeyId}`
    : "unsigned (set VERISKIT_SIGNING_KEY or pass --key to sign)";
  process.stdout.write(
    [
      `Attestation ${outcome.path}`,
      `Subject     ${outcome.subjectCommit?.slice(0, 7)} · verdict ${outcome.verdict}`,
      `Signature   ${signer}`,
      "",
    ].join("\n"),
  );
  return 0;
}
