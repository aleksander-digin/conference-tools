import assert from "node:assert/strict";
import { test } from "node:test";
import { parseSquarespaceSubmission } from "./squarespace.ts";
import { SQUARESPACE_SUBMISSION_SOURCE } from "./fixtures/squarespace-submission.ts";

const sample = SQUARESPACE_SUBMISSION_SOURCE;

test("parseSquarespaceSubmission reads the Northern Clouds sample", async () => {
  const sub = await parseSquarespaceSubmission(sample);
  assert.equal(sub.messageId, "<da1a022abbc546ebbef100debb0d074a@squarespace.info>");
  assert.equal(sub.formName, "Tilmelding Northern Clouds konference Form");
  assert.equal(sub.email, "aleksander@dig-in.dk");
  assert.equal(sub.name, "Aleksander Bang-Larsen");
  assert.equal(sub.fields.first_name, "Aleksander");
  assert.equal(sub.fields.last_name, "Bang-Larsen");
  assert.equal(sub.fields.organisation, "digin");
  assert.equal(sub.fields.dietary_requirements, "nej");
  assert.equal(sub.fields.accepts_marketing, "false");
  assert.equal(sub.fields.email, "aleksander@dig-in.dk");
  assert.equal(sub.receivedAt, "2026-04-23T09:13:31.000Z");
});

test("parseSquarespaceSubmission does not duplicate preheader fields", async () => {
  const sub = await parseSquarespaceSubmission(sample);
  assert.equal(sub.fields.organisation, "digin");
  assert.equal(Object.keys(sub.fields).filter((k) => k === "organisation").length, 1);
});

test("parseSquarespaceSubmission rejects mail that is not from Squarespace", async () => {
  const source = [
    "From: someone@example.com",
    "To: forms@dig-in.dk",
    "Subject: Form Submission - Fake",
    "Message-ID: <x@example.com>",
    "Date: Thu, 23 Apr 2026 09:13:31 +0000",
    "Content-Type: text/plain; charset=utf-8",
    "",
    "First name: Nope",
    "",
  ].join("\r\n");
  await assert.rejects(() => parseSquarespaceSubmission(Buffer.from(source)), /not a Squarespace form submission/);
});
