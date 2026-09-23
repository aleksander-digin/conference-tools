{
  pkgs,
  lib,
  config,
  inputs,
  ...
}:

{
  cachix.enable = false;

  languages = {
    javascript = {
      enable = true;
      package = pkgs.nodejs;
      pnpm.enable = true;
    };
    typescript.enable = true;
  };

  services.mysql = {
    enable = true;
    package = pkgs.mariadb;
    settings.mysqld = {
      port = 3306;
      bind-address = "127.0.0.1";
    };
    initialDatabases = [ { name = "conference_tools_test"; } ];
    ensureUsers = [
      {
        name = "conference_tools_test";
        password = "conference_tools_test";
        ensurePermissions = {
          "conference_tools_test.*" = "ALL PRIVILEGES";
        };
      }
    ];
  };

  # Local test DB only. Hosted MySQL is DATABASE_URL in .env.
  env.TEST_DATABASE_URL = "mysql://conference_tools_test:conference_tools_test@127.0.0.1:3306/conference_tools_test";

  # devenv's mysql-configure task is downstream of mysql, so `devenv up`
  # (mode: before) starts the server only. Use `devenv up --mode all` or
  # `setup-db` once so the test user and database exist.
  scripts.setup-db.exec = ''
    mysql -u root -e "
      CREATE DATABASE IF NOT EXISTS conference_tools_test;
      CREATE USER IF NOT EXISTS 'conference_tools_test'@'localhost' IDENTIFIED BY 'conference_tools_test';
      CREATE USER IF NOT EXISTS 'conference_tools_test'@'127.0.0.1' IDENTIFIED BY 'conference_tools_test';
      GRANT ALL PRIVILEGES ON conference_tools_test.* TO 'conference_tools_test'@'localhost';
      GRANT ALL PRIVILEGES ON conference_tools_test.* TO 'conference_tools_test'@'127.0.0.1';
      FLUSH PRIVILEGES;
    "
  '';

  scripts.ingest.exec = "pnpm ingest";

  enterTest = ''
    pnpm test
  '';
}
