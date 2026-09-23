import assert from "node:assert/strict";
import { test } from "node:test";
import { config as loadEnv } from "dotenv";
import mysql from "mysql2/promise";
import { loadDatabaseUrl } from "./config.ts";
import { openStore, STORE_TABLES } from "./store.ts";
import type { SquarespaceSubmission } from "./squarespace.ts";

loadEnv({ quiet: true });

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

function databaseUrl(): string | undefined {
  try {
    return loadDatabaseUrl();
  } catch {
    return undefined;
  }
}

async function withStore(run: (store: Awaited<ReturnType<typeof openStore>>) => Promise<void>) {
  const dbUrl = databaseUrl();
  if (!dbUrl) return;
  let store: Awaited<ReturnType<typeof openStore>>;
  try {
    store = await openStore(dbUrl, { table: STORE_TABLES.test });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (/ECONNREFUSED|ENOTFOUND|connect|Access denied/.test(message)) {
      return;
    }
    throw err;
  }
  assert.equal(store.table, STORE_TABLES.test);
  try {
    await run(store);
  } finally {
    const conn = await mysql.createConnection(dbUrl);
    try {
      await conn.query(`DELETE FROM ${STORE_TABLES.test} WHERE message_id LIKE ?`, ["<store-test-%"]);
    } finally {
      await conn.end();
      await store.close();
    }
  }
}

test("openStore rejects non-mysql URLs", async () => {
  await assert.rejects(() => openStore("sqlite:data/inbox.sqlite"), /mysql:\/\//);
});

test("store inserts a submission into submissions_test", async (t) => {
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
  if (!ran) t.skip("DATABASE_URL is not set or the hosted MySQL is unreachable");
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
  if (!ran) t.skip("DATABASE_URL is not set or the hosted MySQL is unreachable");
});
