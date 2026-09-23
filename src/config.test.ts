import assert from "node:assert/strict";
import { test } from "node:test";
import { loadDatabaseUrl } from "./config.ts";

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
