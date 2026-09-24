import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

test("CLI hides unexpected error details from logs", () => {
  const sensitiveValue = "attendee@example.com";
  const result = spawnSync(
    process.execPath,
    ["--import", "tsx", "src/cli.ts", "ingest", "--database", `sqlite:${sensitiveValue}`],
    { encoding: "utf8" },
  );

  assert.equal(result.status, 1);
  assert.equal(result.stdout, "");
  assert.match(result.stderr, /ingest failed; check mailbox and database connectivity/);
  assert.doesNotMatch(result.stderr, /attendee@example\.com|stack|at .*src\/store\.ts/i);
});
