import assert from "node:assert/strict";
import { test } from "node:test";
import type { Inbox, InboxMessage } from "./inbox.ts";
import { ingestProcessed } from "./pipeline.ts";
import type { SquarespaceSubmission } from "./squarespace.ts";
import { STORE_TABLES, type StoredSubmission, type SubmissionStore, type UpsertResult } from "./store.ts";
import { SQUARESPACE_SUBMISSION_SOURCE } from "./fixtures/squarespace-submission.ts";

const sample = SQUARESPACE_SUBMISSION_SOURCE;

function memoryInbox(messages: InboxMessage[]): Inbox {
  return {
    async fetchSquarespace() {
      return [...messages];
    },
  };
}

function memoryStore(): SubmissionStore & { rows: Map<string, StoredSubmission> } {
  const rows = new Map<string, StoredSubmission>();
  let nextId = 1;
  return {
    table: STORE_TABLES.test,
    rows,
    async upsert(sub: SquarespaceSubmission): Promise<UpsertResult> {
      const existing = rows.get(sub.messageId);
      if (existing) return { inserted: false, submission: existing };
      const submission: StoredSubmission = {
        id: nextId++,
        messageId: sub.messageId,
        formName: sub.formName,
        email: sub.email,
        name: sub.name,
        fields: sub.fields,
        receivedAt: sub.receivedAt,
        ingestedAt: new Date().toISOString(),
      };
      rows.set(sub.messageId, submission);
      return { inserted: true, submission };
    },
    async get(messageId) {
      return rows.get(messageId);
    },
    async close() {},
  };
}

test("ingestProcessed stores a Squarespace submission", async () => {
  const store = memoryStore();
  const summary = await ingestProcessed({
    inbox: memoryInbox([{ uid: "1", source: sample }]),
    store,
  });
  assert.equal(summary.ingested, 1);
  assert.equal(summary.skipped, 0);
  assert.equal(summary.failed, 0);
  const row = await store.get("<da1a022abbc546ebbef100debb0d074a@squarespace.info>");
  assert.equal(row?.email, "aleksander@dig-in.dk");
  assert.equal(row?.fields.organisation, "digin");
  assert.equal(row?.fields.dietary_requirements, "nej");
});

test("ingestProcessed skips a Message-ID that is already stored", async () => {
  const store = memoryStore();
  const inbox = memoryInbox([{ uid: "1", source: sample }]);
  await ingestProcessed({ inbox, store });
  const summary = await ingestProcessed({ inbox, store });
  assert.equal(summary.ingested, 0);
  assert.equal(summary.skipped, 1);
  assert.equal(summary.failed, 0);
  assert.equal(store.rows.size, 1);
});

test("ingestProcessed counts unreadable mail as failed and does not store it", async () => {
  const store = memoryStore();
  const summary = await ingestProcessed({
    inbox: memoryInbox([
      {
        uid: "9",
        source: Buffer.from("From: someone@example.com\r\nSubject: hi\r\n\r\nnope\r\n"),
      },
    ]),
    store,
  });
  assert.equal(summary.ingested, 0);
  assert.equal(summary.skipped, 0);
  assert.equal(summary.failed, 1);
  assert.equal(store.rows.size, 0);
});
