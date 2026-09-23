import type { Inbox } from "./inbox.ts";
import { parseSquarespaceSubmission } from "./squarespace.ts";
import type { SubmissionStore } from "./store.ts";

export type PipelineDeps = {
  inbox: Inbox;
  store: SubmissionStore;
};

export type PipelineSummary = {
  ingested: number;
  skipped: number;
  failed: number;
};

export async function ingestProcessed(deps: PipelineDeps): Promise<PipelineSummary> {
  const summary: PipelineSummary = { ingested: 0, skipped: 0, failed: 0 };
  const messages = await deps.inbox.fetchSquarespace();

  for (const message of messages) {
    try {
      const sub = await parseSquarespaceSubmission(message.source);
      const result = await deps.store.upsert(sub);
      if (result.inserted) summary.ingested += 1;
      else summary.skipped += 1;
    } catch (err) {
      summary.failed += 1;
      console.error(`imap uid ${message.uid}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return summary;
}
