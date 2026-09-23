#!/usr/bin/env node
import { config as loadEnv } from "dotenv";
import { Command } from "commander";
import { loadDatabaseUrl } from "./config.ts";
import { connectImap, loadImapConfig } from "./inbox.ts";
import { ingestProcessed } from "./pipeline.ts";
import { openStore, STORE_TABLES } from "./store.ts";

loadEnv({ quiet: true });

const program = new Command();
program
  .name("conference-tools")
  .description("Read processed conference form mail and store submissions in MySQL.")
  .showHelpAfterError();

program
  .command("ingest")
  .description("Fetch Squarespace form mail from the Processed IMAP folder and upsert into MySQL")
  .option("--database <url>", "mysql:// URL (default DATABASE_URL)")
  .option("--prod", "Write to submissions (NixOS / GitHub Actions). Default is submissions_test.")
  .action(async (opts: Record<string, unknown>) => {
    const dbUrl = opts.database !== undefined ? String(opts.database) : loadDatabaseUrl();
    const table = opts.prod === true ? STORE_TABLES.live : STORE_TABLES.test;
    const store = await openStore(dbUrl, { table });
    try {
      const mailbox = await connectImap(loadImapConfig());
      try {
        const summary = await ingestProcessed({ inbox: mailbox, store });
        console.log(
          `${store.table}: ingested ${summary.ingested}, skipped ${summary.skipped}, failed ${summary.failed}`,
        );
      } finally {
        await mailbox.close();
      }
    } finally {
      await store.close();
    }
  });

await program.parseAsync();
