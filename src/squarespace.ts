import { simpleParser } from "mailparser";

export const SQUARESPACE_FROM = "form-submission@squarespace.info";
export const SUBJECT_PREFIX = "Form Submission - ";
const EMAIL_MARKETING = /,\s*accepts marketing:\s*(true|false)\s*$/i;
const FIELD_PAIR = /<b>([^<]+):<\/b>\s*<span>(.*?)<\/span>/gi;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type SquarespaceSubmission = {
  messageId: string;
  formName: string;
  receivedAt: string;
  email: string;
  name: string;
  fields: Record<string, string>;
};

export type TestIngestOptions = {
  allowOtherSenders?: boolean;
  allowForwardedSubject?: boolean;
};

export async function parseSquarespaceSubmission(
  source: Buffer,
  options: TestIngestOptions = {},
): Promise<SquarespaceSubmission> {
  const mail = await simpleParser(source);
  const from = addressOf(mail.from);
  if (!options.allowOtherSenders && from !== SQUARESPACE_FROM) {
    throw new Error("not a Squarespace form submission");
  }

  const subject = (mail.subject ?? "").trim();
  const formSubject = options.allowForwardedSubject
    ? subject.replace(/^(?:(?:fwd|fw):\s*)+/i, "")
    : subject;
  if (!formSubject.startsWith(SUBJECT_PREFIX)) {
    throw new Error("not a Squarespace form submission");
  }
  const formName = formSubject.slice(SUBJECT_PREFIX.length).trim();
  if (!formName) throw new Error("squarespace: missing form name in subject");

  const messageId = mail.messageId?.trim();
  if (!messageId) throw new Error("squarespace: missing Message-ID");

  const html = mail.html === false ? "" : mail.html;
  if (!html) throw new Error("squarespace: missing HTML body");

  const fields = extractFields(html);
  const email = recipientEmail(mail.replyTo, fields);
  const name = recipientName(fields);
  fields.email = email;
  fields.name = name;

  const date = mail.date ?? new Date(0);
  return {
    messageId,
    formName,
    receivedAt: date.toISOString(),
    email,
    name,
    fields,
  };
}

function addressOf(value: { value?: Array<{ address?: string }> } | undefined): string {
  const address = value?.value?.[0]?.address;
  return address ? address.trim().toLowerCase() : "";
}

function extractFields(html: string): Record<string, string> {
  const visible = html.split(/Sent via form submission from/i)[1] ?? html;
  const fields: Record<string, string> = {};
  for (const match of visible.matchAll(FIELD_PAIR)) {
    const label = decodeEntities(match[1] ?? "").trim();
    const raw = decodeEntities(stripTags(match[2] ?? "")).trim();
    if (!label) continue;
    const key = slug(label);
    if (Object.hasOwn(fields, key)) continue;

    if (key === "email") {
      const marketing = raw.match(EMAIL_MARKETING);
      if (marketing) {
        fields.accepts_marketing = marketing[1]!.toLowerCase();
        fields.email = raw.slice(0, marketing.index).trim();
      } else {
        fields.email = raw;
      }
      continue;
    }
    fields[key] = raw;
  }
  return fields;
}

function recipientEmail(
  replyTo: { value?: Array<{ address?: string }> } | undefined,
  fields: Record<string, string>,
): string {
  const reply = addressOf(replyTo);
  const fromField = (fields.email ?? "").toLowerCase();
  const email = reply || fromField;
  if (!EMAIL_RE.test(email)) {
    throw new Error("squarespace: missing or invalid visitor email");
  }
  return email;
}

function recipientName(fields: Record<string, string>): string {
  const combined = [fields.first_name, fields.last_name].filter(Boolean).join(" ").trim();
  const name = combined || (fields.name ?? "").trim();
  if (!name) throw new Error("squarespace: missing visitor name");
  return name;
}

function slug(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
}

function stripTags(value: string): string {
  return value.replace(/<[^>]+>/g, "");
}

function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&aelig;/gi, "æ")
    .replace(/&oslash;/gi, "ø")
    .replace(/&aring;/gi, "å")
    .replace(/&nbsp;/g, " ");
}
