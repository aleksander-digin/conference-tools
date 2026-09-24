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
    assert.equal(row.submission.firstName, "Aleksander");
    assert.equal(row.submission.lastName, "Bang-Larsen");
    assert.equal(row.submission.organisation, "digin");
    assert.equal(row.submission.dietaryRequirements, "nej");
    assert.equal(row.submission.acceptsMarketing, "false");
    assert.equal(row.submission.fields.organisation, "digin");
    assert.equal(row.submission.receivedAt, sample.receivedAt);
    const got = await store.get(sample.messageId);
    assert.equal(got?.name, "Aleksander Bang-Larsen");
    const conn = await mysql.createConnection(databaseUrl()!);
    try {
      const [rows] = await conn.query<mysql.RowDataPacket[]>(
        `SELECT first_name, last_name, organisation, dietary_requirements, accepts_marketing, fields FROM ${STORE_TABLES.test} WHERE message_id = ?`,
        [sample.messageId],
      );
      assert.equal(rows[0]?.first_name, "Aleksander");
      assert.equal(rows[0]?.last_name, "Bang-Larsen");
      assert.equal(rows[0]?.organisation, "digin");
      assert.equal(rows[0]?.dietary_requirements, "nej");
      assert.equal(rows[0]?.accepts_marketing, "false");
      const fields = typeof rows[0]?.fields === "string" ? JSON.parse(rows[0].fields) : rows[0]?.fields;
      assert.deepEqual(fields, sample.fields);
    } finally {
      await conn.end();
    }
  });
  if (!ran) t.skip("DATABASE_URL is not set or the hosted MySQL is unreachable");
});

test("store backfills field columns from JSON for existing submissions", async (t) => {
  let ran = false;
  await withStore(async (store) => {
    ran = true;
    await store.upsert(sample);
    const conn = await mysql.createConnection(databaseUrl()!);
    try {
      await conn.query(
        `UPDATE ${STORE_TABLES.test} SET first_name = NULL, last_name = NULL, organisation = NULL, dietary_requirements = NULL, accepts_marketing = NULL WHERE message_id = ?`,
        [sample.messageId],
      );
    } finally {
      await conn.end();
    }
    const reopened = await openStore(databaseUrl()!, { table: STORE_TABLES.test });
    try {
      const row = await reopened.get(sample.messageId);
      assert.equal(row?.firstName, "Aleksander");
      assert.equal(row?.lastName, "Bang-Larsen");
      assert.equal(row?.organisation, "digin");
      assert.equal(row?.dietaryRequirements, "nej");
      assert.equal(row?.acceptsMarketing, "false");
      assert.deepEqual(row?.fields, sample.fields);
    } finally {
      await reopened.close();
    }
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
