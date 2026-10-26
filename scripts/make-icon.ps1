Add-Type -AssemblyName System.Drawing

$size = 1024
$bitmap = New-Object System.Drawing.Bitmap($size, $size)
$graphics = [System.Drawing.Graphics]::FromImage($bitmap)
$graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$graphics.Clear([System.Drawing.Color]::Transparent)

function New-RoundedPath {
    param([float]$x, [float]$y, [float]$width, [float]$height, [float]$radius)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $diameter = $radius * 2
    $path.AddArc($x, $y, $diameter, $diameter, 180, 90)
    $path.AddArc($x + $width - $diameter, $y, $diameter, $diameter, 270, 90)
    $path.AddArc($x + $width - $diameter, $y + $height - $diameter, $diameter, $diameter, 0, 90)
    $path.AddArc($x, $y + $height - $diameter, $diameter, $diameter, 90, 90)
    $path.CloseFigure()
    return $path
}

$outer = New-RoundedPath 0 0 $size $size 230
$gradient = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
    (New-Object System.Drawing.Rectangle(0, 0, $size, $size)),
    [System.Drawing.Color]::FromArgb(255, 124, 58, 237),
    [System.Drawing.Color]::FromArgb(255, 34, 211, 238),
    45
)
$graphics.FillPath($gradient, $outer)

$highlight = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(38, 255, 255, 255))
$graphics.FillEllipse($highlight, -260, -360, 1180, 900)

$heights = @(200, 330, 480, 610, 470, 330, 190)
$barWidth = 48
$gap = 33
$totalWidth = ($heights.Count * $barWidth) + (($heights.Count - 1) * $gap)
$startX = ($size - $totalWidth) / 2
$centerY = 512
$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(248, 255, 255, 255))

for ($i = 0; $i -lt $heights.Count; $i++) {
    $height = $heights[$i]
    $x = $startX + ($i * ($barWidth + $gap))
    $y = $centerY - ($height / 2)
    $bar = New-RoundedPath $x $y $barWidth $height ($barWidth / 2)
    $graphics.FillPath($white, $bar)
    $bar.Dispose()
}

$output = Join-Path $PSScriptRoot "..\app-icon.png"
$bitmap.Save($output, [System.Drawing.Imaging.ImageFormat]::Png)

$white.Dispose()
$highlight.Dispose()
$gradient.Dispose()
$outer.Dispose()
$graphics.Dispose()
$bitmap.Dispose()

Write-Output "Icon written to $output"
