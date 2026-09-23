function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Hosted MySQL. Live ingest and tests share this URL; tests use submissions_test. */
export function loadDatabaseUrl(): string {
  const url = env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is not set (hosted MySQL)");
  return url;
}
