{
  description = "Conference form ingest";

  inputs.nixpkgs.url = "github:NixOS/nixpkgs/nixos-unstable";

  outputs =
    { self, nixpkgs }:
    let
      systems = [
        "aarch64-darwin"
        "x86_64-darwin"
        "aarch64-linux"
        "x86_64-linux"
      ];
      forEachSystem = f: nixpkgs.lib.genAttrs systems (system: f nixpkgs.legacyPackages.${system});
    in
    {
      nixosModules.ingest = import ./nixos/ingest.nix;
      nixosModules.default = self.nixosModules.ingest;

      devShells = forEachSystem (
        pkgs:
        let
          mysql = pkgs.callPackage ./nix/mysql.nix { };
        in
        {
          default = pkgs.mkShell {
            packages = [
              pkgs.nodejs
              pkgs.pnpm
              pkgs.typescript
              pkgs.mariadb
              mysql.start-mysql
              mysql.setup-db
            ];
            TEST_DATABASE_URL = "mysql://conference_tools_test:conference_tools_test@127.0.0.1:3306/conference_tools_test";
          };
        }
      );
    };
}
