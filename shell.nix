
{pkgs}:
with pkgs;
mkShell {
    buildInputs = [
        nodejs-14_x
        zip
    ];
}
