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

      devShells = forEachSystem (pkgs: {
        default = pkgs.mkShell {
          # Local `pnpm ingest` writes to submissions_test. Prod is NixOS / GHA with --prod.
          packages = [
            pkgs.nodejs
            pkgs.pnpm
            pkgs.typescript
          ];
        };
      });
    };
}
