{ pkgs }:

let
  locate = ''
    ROOT="''${MYSQL_DATADIR:-$PWD/.mysql-data}"
    DATADIR="$ROOT"
    SOCKET="$DATADIR/mysql.sock"
  '';
in
{
  start-mysql = pkgs.writeShellApplication {
    name = "start-mysql";
    runtimeInputs = [ pkgs.mariadb ];
    text = ''
      ${locate}
      mkdir -p "$DATADIR"
      if [[ ! -d "$DATADIR/mysql" ]]; then
        mariadb-install-db --datadir="$DATADIR" --basedir="${pkgs.mariadb}"
      fi
      exec mariadbd \
        --datadir="$DATADIR" \
        --socket="$SOCKET" \
        --pid-file="$DATADIR/mysql.pid" \
        --port=3306 \
        --bind-address=127.0.0.1
    '';
  };

  setup-db = pkgs.writeShellApplication {
    name = "setup-db";
    runtimeInputs = [ pkgs.mariadb ];
    text = ''
      ${locate}
      mysql --socket="$SOCKET" -u root -e "
        CREATE DATABASE IF NOT EXISTS conference_tools_test;
        CREATE USER IF NOT EXISTS 'conference_tools_test'@'localhost' IDENTIFIED BY 'conference_tools_test';
        CREATE USER IF NOT EXISTS 'conference_tools_test'@'127.0.0.1' IDENTIFIED BY 'conference_tools_test';
        GRANT ALL PRIVILEGES ON conference_tools_test.* TO 'conference_tools_test'@'localhost';
        GRANT ALL PRIVILEGES ON conference_tools_test.* TO 'conference_tools_test'@'127.0.0.1';
        FLUSH PRIVILEGES;
      "
    '';
  };
}
