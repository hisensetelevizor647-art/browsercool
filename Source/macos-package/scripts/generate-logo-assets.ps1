Add-Type -AssemblyName System.Drawing

$ErrorActionPreference = 'Stop'

$sourceLogo = 'C:\Users\sasun\Downloads\Gemini_Generated_Image___1_-removebg-preview.png'
$outDir = 'C:\Users\sasun\Downloads\MAUZER_Release\MAUZER_Release\Source\Olewser LOGO'
$pixelFormat = [System.Drawing.Imaging.PixelFormat]::Format32bppArgb

function Get-AlphaBounds([System.Drawing.Bitmap]$bmp) {
  $minX = $bmp.Width; $minY = $bmp.Height; $maxX = -1; $maxY = -1
  for ($y = 0; $y -lt $bmp.Height; $y++) {
    for ($x = 0; $x -lt $bmp.Width; $x++) {
      if ($bmp.GetPixel($x, $y).A -gt 0) {
        if ($x -lt $minX) { $minX = $x }
        if ($y -lt $minY) { $minY = $y }
        if ($x -gt $maxX) { $maxX = $x }
        if ($y -gt $maxY) { $maxY = $y }
      }
    }
  }
  if ($maxX -lt $minX -or $maxY -lt $minY) {
    return [System.Drawing.Rectangle]::new(0, 0, $bmp.Width, $bmp.Height)
  }
  return [System.Drawing.Rectangle]::new($minX, $minY, $maxX - $minX + 1, $maxY - $minY + 1)
}

function New-RoundedRectPath([float]$x, [float]$y, [float]$w, [float]$h, [float]$r) {
  $path = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [Math]::Max(1.0, $r * 2)
  $path.AddArc($x, $y, $d, $d, 180, 90)
  $path.AddArc($x + $w - $d, $y, $d, $d, 270, 90)
  $path.AddArc($x + $w - $d, $y + $h - $d, $d, $d, 0, 90)
  $path.AddArc($x, $y + $h - $d, $d, $d, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-CenteredCanvas([System.Drawing.Bitmap]$mark, [int]$size, [double]$widthFill, [double]$heightFill) {
  $canvas = New-Object System.Drawing.Bitmap($size, $size, $pixelFormat)
  $g = [System.Drawing.Graphics]::FromImage($canvas)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
  $g.Clear([System.Drawing.Color]::Transparent)

  $maxW = $size * $widthFill
  $maxH = $size * $heightFill
  $scale = [Math]::Min($maxW / $mark.Width, $maxH / $mark.Height)
  $dw = [int][Math]::Round($mark.Width * $scale)
  $dh = [int][Math]::Round($mark.Height * $scale)
  $dx = [int](($size - $dw) / 2)
  $dy = [int](($size - $dh) / 2)

  $g.DrawImage($mark, [System.Drawing.Rectangle]::new($dx, $dy, $dw, $dh), [System.Drawing.Rectangle]::new(0, 0, $mark.Width, $mark.Height), [System.Drawing.GraphicsUnit]::Pixel)
  $g.Dispose()
  return $canvas
}

$raw = [System.Drawing.Bitmap]::FromFile($sourceLogo)
$bounds = Get-AlphaBounds $raw
$pad = 16
$cx = [Math]::Max(0, $bounds.X - $pad)
$cy = [Math]::Max(0, $bounds.Y - $pad)
$cw = [Math]::Min($raw.Width - $cx, $bounds.Width + ($pad * 2))
$ch = [Math]::Min($raw.Height - $cy, $bounds.Height + ($pad * 2))
$cropRect = [System.Drawing.Rectangle]::new($cx, $cy, $cw, $ch)

$mark = New-Object System.Drawing.Bitmap($cropRect.Width, $cropRect.Height, $pixelFormat)
$gm = [System.Drawing.Graphics]::FromImage($mark)
$gm.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$gm.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$gm.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$gm.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$gm.Clear([System.Drawing.Color]::Transparent)
$gm.DrawImage($raw, [System.Drawing.Rectangle]::new(0, 0, $cropRect.Width, $cropRect.Height), $cropRect, [System.Drawing.GraphicsUnit]::Pixel)
$gm.Dispose()
$raw.Dispose()

$mark.Save((Join-Path $outDir 'brand-mark-source.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$logo7 = New-CenteredCanvas -mark $mark -size 1024 -widthFill 0.78 -heightFill 0.56
$logo7.Save((Join-Path $outDir '7.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$logo7.Dispose()

$logo20 = New-CenteredCanvas -mark $mark -size 512 -widthFill 0.78 -heightFill 0.56
$logo20.Save((Join-Path $outDir '20.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$logo20.Dispose()

$icon = New-Object System.Drawing.Bitmap(1024, 1024, $pixelFormat)
$g = [System.Drawing.Graphics]::FromImage($icon)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g.Clear([System.Drawing.Color]::Transparent)

$outer = [System.Drawing.RectangleF]::new(56, 56, 912, 912)
$outerPath = New-RoundedRectPath -x $outer.X -y $outer.Y -w $outer.Width -h $outer.Height -r 214

$bgSolid = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 26, 61, 132))
$g.FillPath($bgSolid, $outerPath)
$bgSolid.Dispose()

$shineBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(40, 255, 255, 255))
$g.FillEllipse($shineBrush, [System.Drawing.Rectangle]::new(90, 90, 850, 390))
$shineBrush.Dispose()

$depthBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(52, 8, 19, 54))
$g.FillEllipse($depthBrush, [System.Drawing.Rectangle]::new(120, 690, 780, 250))
$depthBrush.Dispose()

$borderPen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(78, 255, 255, 255), 7)
$g.DrawPath($borderPen, $outerPath)
$borderPen.Dispose()

$lwMax = 620
$lhMax = 420
$logoScale = [Math]::Min($lwMax / $mark.Width, $lhMax / $mark.Height)
$lw = [int][Math]::Round($mark.Width * $logoScale)
$lh = [int][Math]::Round($mark.Height * $logoScale)
$lx = [int]((1024 - $lw) / 2)
$ly = [int]((1024 - $lh) / 2 + 14)

$shadowBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(78, 0, 0, 0))
$g.FillEllipse($shadowBrush, [System.Drawing.Rectangle]::new($lx + 70, $ly + $lh - 20, [int]($lw * 0.62), 66))
$shadowBrush.Dispose()

$g.DrawImage($mark, [System.Drawing.Rectangle]::new($lx, $ly, $lw, $lh), [System.Drawing.Rectangle]::new(0, 0, $mark.Width, $mark.Height), [System.Drawing.GraphicsUnit]::Pixel)

$outerPath.Dispose()
$g.Dispose()

$icon.Save((Join-Path $outDir 'main-1024.png'), [System.Drawing.Imaging.ImageFormat]::Png)

$icon512 = New-Object System.Drawing.Bitmap(512, 512, $pixelFormat)
$g512 = [System.Drawing.Graphics]::FromImage($icon512)
$g512.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g512.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
$g512.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g512.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
$g512.Clear([System.Drawing.Color]::Transparent)
$g512.DrawImage($icon, [System.Drawing.Rectangle]::new(0, 0, 512, 512), [System.Drawing.Rectangle]::new(0, 0, 1024, 1024), [System.Drawing.GraphicsUnit]::Pixel)
$g512.Dispose()
$icon512.Save((Join-Path $outDir 'main.png'), [System.Drawing.Imaging.ImageFormat]::Png)
$icon512.Dispose()

$icon.Dispose()
$mark.Dispose()

Write-Output 'Regenerated logos and icon assets.'
