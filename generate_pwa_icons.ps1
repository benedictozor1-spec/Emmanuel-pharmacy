Add-Type -AssemblyName System.Drawing

$sourcePath = "c:\Users\OZOR CHIDIEBERE\Desktop\Emmanuel Pharmacy\logo.jpg"
$publicDir = "c:\Users\OZOR CHIDIEBERE\Desktop\Emmanuel Pharmacy\public"

if (-not (Test-Path $publicDir)) {
    New-Item -ItemType Directory -Path $publicDir -Force
}

$sourceImg = [System.Drawing.Image]::FromFile($sourcePath)

function Save-ResizedImage {
    param(
        [int]$width,
        [int]$height,
        [string]$outputPath,
        [double]$scaleFactor = 1.0
    )

    $targetBmp = New-Object System.Drawing.Bitmap($width, $height)
    $g = [System.Drawing.Graphics]::FromImage($targetBmp)
    
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    # Fill white background
    $whiteBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
    $g.FillRectangle($whiteBrush, 0, 0, $width, $height)

    # Calculate scaled dimensions maintaining aspect ratio or centered fitting
    $destWidth = [int]($width * $scaleFactor)
    $destHeight = [int]($height * $scaleFactor)
    $destX = [int](($width - $destWidth) / 2)
    $destY = [int](($height - $destHeight) / 2)

    $g.DrawImage($sourceImg, $destX, $destY, $destWidth, $destHeight)

    $targetBmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $targetBmp.Dispose()
    Write-Host "Generated: $outputPath ($width x $height)"
}

# 1. Standard PWA 192x192
Save-ResizedImage -width 192 -height 192 -outputPath "$publicDir\pwa-192x192.png"

# 2. Standard PWA 512x512
Save-ResizedImage -width 512 -height 512 -outputPath "$publicDir\pwa-512x512.png"

# 3. Maskable PWA 512x512 (80% safe area padding)
Save-ResizedImage -width 512 -height 512 -outputPath "$publicDir\pwa-maskable-512x512.png" -scaleFactor 0.80

# 4. Apple Touch Icon 180x180
Save-ResizedImage -width 180 -height 180 -outputPath "$publicDir\apple-touch-icon.png"

# 5. Favicon 32x32
Save-ResizedImage -width 32 -height 32 -outputPath "$publicDir\favicon-32x32.png"
Save-ResizedImage -width 32 -height 32 -outputPath "$publicDir\favicon.ico"

$sourceImg.Dispose()
Write-Host "All PWA Icons Generated Successfully!"
