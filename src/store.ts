import mysql from "mysql2/promise";
import type { SquarespaceSubmission } from "./squarespace.ts";

export type StoredSubmission = {
  id: number;
  messageId: string;
  formName: string;
  email: string;
  name: string;
  fields: Record<string, string>;
  receivedAt: string;
  ingestedAt: string;
};

export type UpsertResult = {
  inserted: boolean;
  submission: StoredSubmission;
};

export type SubmissionStore = {
  upsert(sub: SquarespaceSubmission): Promise<UpsertResult>;
  get(messageId: string): Promise<StoredSubmission | undefined>;
  close(): Promise<void>;
};

type Row = {
  id: number;
  message_id: string;
  form_name: string;
  email: string;
  name: string;
  fields: string | Record<string, string>;
  received_at: string;
  ingested_at: string;
};

const SCHEMA = `
CREATE TABLE IF NOT EXISTS submissions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  message_id VARCHAR(255) NOT NULL,
  form_name VARCHAR(255) NOT NULL,
  email VARCHAR(255) NOT NULL,
  name VARCHAR(255) NOT NULL,
  fields JSON NOT NULL,
  received_at VARCHAR(32) NOT NULL,
  ingested_at VARCHAR(32) NOT NULL,
  UNIQUE KEY uq_submissions_message_id (message_id), -- RFC 5322 Message-ID; ingest never moves mail
  KEY idx_submissions_email (email)
)
`;

export async function openStore(url: string): Promise<SubmissionStore> {
  if (!url.startsWith("mysql://") && !url.startsWith("mysql2://")) {
    throw new Error("store: DATABASE_URL must be a mysql:// URL");
  }
  const pool = mysql.createPool(url);
  await pool.query(SCHEMA);
  return mysqlStore(pool);
}

function mysqlStore(pool: mysql.Pool): SubmissionStore {
  return {
    async upsert(sub) {
      const ingestedAt = new Date().toISOString();
      const [result] = await pool.query<mysql.ResultSetHeader>(
        `
        INSERT IGNORE INTO submissions
          (message_id, form_name, email, name, fields, received_at, ingested_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        [
          sub.messageId,
          sub.formName,
          sub.email,
          sub.name,
          JSON.stringify(sub.fields),
          sub.receivedAt,
          ingestedAt,
        ],
      );
      const submission = await getByMessageId(pool, sub.messageId);
      if (!submission) throw new Error(`store: missing row after upsert ${sub.messageId}`);
      return { inserted: result.affectedRows === 1, submission };
    },
    async get(messageId) {
      return getByMessageId(pool, messageId);
    },
    async close() {
      await pool.end();
    },
  };
}

async function getByMessageId(pool: mysql.Pool, messageId: string): Promise<StoredSubmission | undefined> {
  const [rows] = await pool.query<mysql.RowDataPacket[]>(
    "SELECT * FROM submissions WHERE message_id = ?",
    [messageId],
  );
  const row = rows[0] as Row | undefined;
  return row ? mapRow(row) : undefined;
}

function mapRow(row: Row): StoredSubmission {
  return {
    id: Number(row.id),
    messageId: row.message_id,
    formName: row.form_name,
    email: row.email,
    name: row.name,
    fields: parseFields(row.fields),
    receivedAt: row.received_at,
    ingestedAt: row.ingested_at,
  };
}

function parseFields(value: string | Record<string, string>): Record<string, string> {
  if (typeof value === "string") return JSON.parse(value) as Record<string, string>;
  return value;
}
