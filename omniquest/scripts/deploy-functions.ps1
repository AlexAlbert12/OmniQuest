$ErrorActionPreference = "Stop"
node scripts/deploy-edge-functions.mjs @args
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
