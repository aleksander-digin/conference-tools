import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDatabaseUrl, loadTestDatabaseUrl } from "./config.ts";

test("loadDatabaseUrl requires hosted DATABASE_URL", () => {
  const prev = process.env.DATABASE_URL;
  delete process.env.DATABASE_URL;
  try {
    assert.throws(() => loadDatabaseUrl(), /DATABASE_URL is not set \(hosted MySQL\)/);
  } finally {
    if (prev === undefined) delete process.env.DATABASE_URL;
    else process.env.DATABASE_URL = prev;
  }
});

test("loadTestDatabaseUrl defaults to the devenv test database", () => {
  const prev = process.env.TEST_DATABASE_URL;
  delete process.env.TEST_DATABASE_URL;
  try {
    assert.equal(
      loadTestDatabaseUrl(),
      "mysql://conference_tools_test:conference_tools_test@127.0.0.1:3306/conference_tools_test",
    );
  } finally {
    if (prev === undefined) delete process.env.TEST_DATABASE_URL;
    else process.env.TEST_DATABASE_URL = prev;
  }
});
