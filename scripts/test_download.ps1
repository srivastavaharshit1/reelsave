$reelUrl = 'https://www.instagram.com/reel/Dey-qwUojgL/'
$backendFile = 'scratch_backend_reel.mp4'
$vercelFile = 'scratch_vercel_reel.mp4'

Write-Host "=== 1. Testing POST to Render Backend direct download ==="
$body = @{ url = $reelUrl }
Invoke-RestMethod -Uri "https://reelsave-backend-5zko.onrender.com/api/v1/reels/download" -Method Post -Body $body -OutFile $backendFile
$item1 = Get-Item $backendFile
Write-Host "Backend direct download size: $($item1.Length) bytes"

Write-Host "=== 2. Inspecting Backend MP4 tracks ==="
$check1 = java -cp "backend/target/classes" com.reelsave.provider.Mp4Inspector $backendFile
Write-Host "Backend MP4 Inspection: $check1"

Write-Host "=== 3. Testing POST to Vercel Frontend /api rewrite download ==="
Invoke-RestMethod -Uri "https://reelsave-five.vercel.app/api/v1/reels/download" -Method Post -Body $body -OutFile $vercelFile
$item2 = Get-Item $vercelFile
Write-Host "Vercel rewrite download size: $($item2.Length) bytes"

Write-Host "=== 4. Inspecting Vercel MP4 tracks ==="
$check2 = java -cp "backend/target/classes" com.reelsave.provider.Mp4Inspector $vercelFile
Write-Host "Vercel MP4 Inspection: $check2"

