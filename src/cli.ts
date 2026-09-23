#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import { loadDatabaseUrl, loadTestDatabaseUrl } from "./config.ts";
import { connectImap, loadImapConfig } from "./inbox.ts";
import { ingestProcessed } from "./pipeline.ts";
import { openStore } from "./store.ts";

loadEnv({ quiet: true });

const program = new Command();
program
  .name("conference-tools")
  .description("Read processed conference form mail and store submissions in MySQL.")
  .showHelpAfterError();

program
  .command("ingest")
  .description("Fetch Squarespace form mail from the Processed IMAP folder and upsert into MySQL")
  .option("--database <url>", "mysql:// URL (default DATABASE_URL, the hosted database)")
  .option("--local", "Write to the devenv test database (TEST_DATABASE_URL)")
  .action(async (opts: Record<string, unknown>) => {
    const dbUrl =
      opts.database !== undefined
        ? String(opts.database)
        : opts.local === true
          ? loadTestDatabaseUrl()
          : loadDatabaseUrl();
    const store = await openStore(dbUrl);
    try {
      const mailbox = await connectImap(loadImapConfig());
      try {
        const summary = await ingestProcessed({ inbox: mailbox, store });
        console.log(`ingested ${summary.ingested}, skipped ${summary.skipped}, failed ${summary.failed}`);
      } finally {
        await mailbox.close();
      }
    } finally {
      await store.close();
    }
  });

await program.parseAsync();
