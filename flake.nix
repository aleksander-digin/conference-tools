{
  description = "Conference form ingest";

  outputs =
    { self }:
    {
      nixosModules.ingest = import ./nixos/ingest.nix;
      nixosModules.default = self.nixosModules.ingest;
    };
}
