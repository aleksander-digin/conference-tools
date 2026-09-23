import assert from "node:assert/strict";
import { test } from "node:test";
import mysql from "mysql2/promise";
import { loadTestDatabaseUrl } from "./config.ts";
import { openStore } from "./store.ts";
import type { SquarespaceSubmission } from "./squarespace.ts";

const dbUrl = loadTestDatabaseUrl();

const sample: SquarespaceSubmission = {
  messageId: "<store-test-da1a022abbc546ebbef100debb0d074a@squarespace.info>",
  formName: "Tilmelding Northern Clouds konference Form",
  receivedAt: "2026-04-23T09:13:31.000Z",
  email: "aleksander@dig-in.dk",
  name: "Aleksander Bang-Larsen",
  fields: {
    first_name: "Aleksander",
    last_name: "Bang-Larsen",
    organisation: "digin",
    dietary_requirements: "nej",
    accepts_marketing: "false",
    email: "aleksander@dig-in.dk",
    name: "Aleksander Bang-Larsen",
  },
};

async function withStore(run: (store: Awaited<ReturnType<typeof openStore>>) => Promise<void>) {
  let store: Awaited<ReturnType<typeof openStore>>;
  try {
    store = await openStore(dbUrl);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect/.test(message)) {
      return;
    }
    throw err;
  }
  try {
    await run(store);
  } finally {
    const conn = await mysql.createConnection(dbUrl);
    try {
      await conn.query("DELETE FROM submissions WHERE message_id LIKE ?", ["<store-test-%"]);
    } finally {
      await conn.end();
      await store.close();
    }
  }
}

test("openStore rejects non-mysql URLs", async () => {
  await assert.rejects(() => openStore("sqlite:data/inbox.sqlite"), /mysql:\/\//);
});

test("store inserts a submission so it can be retrieved", async (t) => {
  let ran = false;
  await withStore(async (store) => {
    ran = true;
    const row = await store.upsert(sample);
    assert.equal(row.inserted, true);
    assert.equal(row.submission.email, "aleksander@dig-in.dk");
    assert.equal(row.submission.fields.organisation, "digin");
    assert.equal(row.submission.receivedAt, sample.receivedAt);
    const got = await store.get(sample.messageId);
    assert.equal(got?.name, "Aleksander Bang-Larsen");
  });
  if (!ran) t.skip("MySQL is not running (start with devenv up)");
});

test("store does not insert the same Message-ID twice", async (t) => {
  let ran = false;
  await withStore(async (store) => {
    ran = true;
    await store.upsert(sample);
    const again = await store.upsert({ ...sample, name: "Someone Else" });
    assert.equal(again.inserted, false);
    assert.equal(again.submission.name, "Aleksander Bang-Larsen");
  });
  if (!ran) t.skip("MySQL is not running (start with devenv up)");
});
