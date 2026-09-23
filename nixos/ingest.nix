{
  config,
  lib,
  pkgs,
  ...
}:

# Import from a host flake:
#   imports = [ inputs.conference-tools.nixosModules.ingest ];
#   services.conference-tools.ingest = {
#     enable = true;
#     environmentFile = config.sops.secrets.conference-tools-env.path;
#     workingDirectory = "/var/lib/conference-tools";
#   };
#
# `environmentFile` uses the same keys as .env.example (DATABASE_URL, IMAP_*).
# Set `package` to a derivation that ships `bin/conference-tools`, or leave
# it unset and run `pnpm ingest --prod` from a checkout in `workingDirectory`.
# `--prod` writes to `submissions`. Flake/local ingest defaults to `submissions_test`.

let
  cfg = config.services.conference-tools.ingest;
in
{
  options.services.conference-tools.ingest = {
    enable = lib.mkEnableOption "periodic ingest of processed conference form mail";

    interval = lib.mkOption {
      type = lib.types.str;
      default = "*:0/10";
      example = "*:0/5";
      description = "systemd OnCalendar expression. Default is every 10 minutes.";
    };

    environmentFile = lib.mkOption {
      type = lib.types.path;
      description = "Environment file with DATABASE_URL and IMAP_* (same keys as .env.example).";
    };

    package = lib.mkOption {
      type = lib.types.nullOr lib.types.package;
      default = null;
      description = ''
        Package that provides bin/conference-tools. When set, the service
        runs `conference-tools ingest --prod`. Otherwise workingDirectory is
        required and the service runs `pnpm ingest --prod` there.
      '';
    };

    workingDirectory = lib.mkOption {
      type = lib.types.nullOr lib.types.str;
      default = null;
      description = "Checkout of this repo with dependencies installed. Used when package is unset.";
    };
  };

  config = lib.mkIf cfg.enable {
    assertions = [
      {
        assertion = cfg.package != null || cfg.workingDirectory != null;
        message = "services.conference-tools.ingest needs package or workingDirectory";
      }
    ];

    systemd.services.conference-tools-ingest = {
      description = "Ingest processed conference form mail into MySQL";
      after = [ "network-online.target" ];
      wants = [ "network-online.target" ];
      path = lib.optionals (cfg.package == null) [
        pkgs.nodejs
        pkgs.pnpm
      ];
      serviceConfig = {
        Type = "oneshot";
        EnvironmentFile = cfg.environmentFile;
        WorkingDirectory = lib.mkIf (cfg.workingDirectory != null) cfg.workingDirectory;
        ExecStart =
          if cfg.package != null then
            "${cfg.package}/bin/conference-tools ingest --prod"
          else
            "${lib.getExe pkgs.pnpm} ingest --prod";
      };
    };

    systemd.timers.conference-tools-ingest = {
      description = "Periodically ingest processed conference form mail";
      wantedBy = [ "timers.target" ];
      timerConfig = {
        OnCalendar = cfg.interval;
        Persistent = true;
        RandomizedDelaySec = "1m";
      };
    };
  };
}
