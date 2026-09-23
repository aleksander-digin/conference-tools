import { ImapFlow } from "imapflow";
import { SQUARESPACE_FROM } from "./squarespace.ts";

export type InboxMessage = {
  uid: string;
  source: Buffer;
};

export type Inbox = {
  fetchSquarespace(): Promise<InboxMessage[]>;
};

export type ImapConfig = {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  folder: string;
};

export function inboxSearchQuery() {
  return { from: SQUARESPACE_FROM };
}

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

export type ConnectedInbox = Inbox & { close(): Promise<void> };

export async function connectImap(config: ImapConfig): Promise<ConnectedInbox> {
  const client = new ImapFlow({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: { user: config.user, pass: config.pass },
    logger: false,
  });
  await client.connect();
  await client.mailboxOpen(config.folder);

  return {
    async fetchSquarespace() {
      const uids = await client.search(inboxSearchQuery(), { uid: true });
      if (!uids || uids.length === 0) return [];
      const fetched = await client.fetchAll(
        uids,
        { uid: true, source: true, envelope: true },
        { uid: true },
      );
      const messages: InboxMessage[] = [];
      for (const msg of fetched) {
        const from = msg.envelope?.from?.[0]?.address?.toLowerCase() ?? "";
        if (from !== SQUARESPACE_FROM) continue;
        if (!msg.source) continue;
        messages.push({ uid: String(msg.uid), source: Buffer.from(msg.source) });
      }
      return messages;
    },
    async close() {
      await client.logout();
    },
  };
}

export function loadImapConfig(): ImapConfig {
  const host = env("IMAP_HOST");
  const user = env("IMAP_USER");
  const pass = env("IMAP_PASS");
  if (!host) throw new Error("IMAP_HOST is not set");
  if (!user) throw new Error("IMAP_USER is not set");
  if (!pass) throw new Error("IMAP_PASS is not set");
  const port = env("IMAP_PORT") ? Number(env("IMAP_PORT")) : 993;
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("IMAP_PORT must be an integer 1–65535");
  }
  const secure = (env("IMAP_SECURE") ?? "true").toLowerCase() !== "false";
  return {
    host,
    port,
    secure,
    user,
    pass,
    folder: env("IMAP_FOLDER") ?? "Processed",
  };
}
