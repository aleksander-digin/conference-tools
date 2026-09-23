const LOCAL_TEST_URL =
  "mysql://conference_tools_test:conference_tools_test@127.0.0.1:3306/conference_tools_test";

function env(name: string): string | undefined {
  const value = process.env[name];
  return value && value.length > 0 ? value : undefined;
}

/** Hosted MySQL. Ingest writes here unless --local or --database is used. */
export function loadDatabaseUrl(): string {
  const url = env("DATABASE_URL");
  if (!url) throw new Error("DATABASE_URL is not set (hosted MySQL)");
  return url;
}

/** devenv MariaDB. Tests and `ingest --local` use this, never the hosted URL. */
export function loadTestDatabaseUrl(): string {
  return env("TEST_DATABASE_URL") ?? LOCAL_TEST_URL;
}
