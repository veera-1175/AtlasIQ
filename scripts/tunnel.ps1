# Expose local AtlasIQ on a free public URL (no domain) via Cloudflare Quick Tunnel
# 1. Install cloudflared: winget install Cloudflare.cloudflared
# 2. Run AtlasIQ locally: .\run.ps1
# 3. In another terminal: .\scripts\tunnel.ps1

Write-Host "Starting tunnel to http://localhost:5173 ..."
Write-Host "Share the https://*.trycloudflare.com URL with your audience."
cloudflared tunnel --url http://localhost:5173
