import assert from "node:assert/strict";
import { test } from "node:test";
import { inboxSearchQuery, loadImapConfig } from "./inbox.ts";
import { SQUARESPACE_FROM } from "./squarespace.ts";

test("loadImapConfig reads IMAP env vars and defaults to Processed", () => {
  const prev = {
    IMAP_HOST: process.env.IMAP_HOST,
    IMAP_PORT: process.env.IMAP_PORT,
    IMAP_USER: process.env.IMAP_USER,
    IMAP_PASS: process.env.IMAP_PASS,
    IMAP_FOLDER: process.env.IMAP_FOLDER,
  };
  process.env.IMAP_HOST = "imap.zoho.eu";
  process.env.IMAP_USER = "nckonferencetilmelding@dig-in.dk";
  process.env.IMAP_PASS = "secret";
  delete process.env.IMAP_PORT;
  delete process.env.IMAP_FOLDER;
  try {
    const config = loadImapConfig();
    assert.equal(config.host, "imap.zoho.eu");
    assert.equal(config.port, 993);
    assert.equal(config.secure, true);
    assert.equal(config.user, "nckonferencetilmelding@dig-in.dk");
    assert.equal(config.folder, "Processed");
  } finally {
    restore(prev);
  }
});

test("loadImapConfig requires host, user, and pass", () => {
  const prev = {
    IMAP_HOST: process.env.IMAP_HOST,
    IMAP_USER: process.env.IMAP_USER,
    IMAP_PASS: process.env.IMAP_PASS,
  };
  delete process.env.IMAP_HOST;
  delete process.env.IMAP_USER;
  delete process.env.IMAP_PASS;
  try {
    assert.throws(() => loadImapConfig(), /IMAP_HOST is not set/);
  } finally {
    restore(prev);
  }
});

test("inboxSearchQuery finds Squarespace mail without requiring unseen", () => {
  assert.deepEqual(inboxSearchQuery(), { from: SQUARESPACE_FROM });
});

test("inboxSearchQuery can find form mail from another sender for test ingest", () => {
  assert.deepEqual(inboxSearchQuery({ allowOtherSenders: true }), {
    subject: "Form Submission - ",
  });
});

function restore(prev: Record<string, string | undefined>): void {
  for (const [key, value] of Object.entries(prev)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}
