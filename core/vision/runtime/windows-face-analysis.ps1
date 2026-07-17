param(
  [Parameter(Mandatory = $true)]
  [string]$ImagePath,
  [int]$MinFaceSize = 32,
  [int]$MaxFaceSize = 0
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Runtime.WindowsRuntime
Add-Type -AssemblyName System.Drawing

$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType=WindowsRuntime]
$null = [Windows.Storage.Streams.IRandomAccessStreamWithContentType, Windows.Storage.Streams, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.SoftwareBitmap, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapSize, Windows.Graphics.Imaging, ContentType=WindowsRuntime]
$null = [Windows.Media.FaceAnalysis.FaceDetector, Windows.Media.FaceAnalysis, ContentType=WindowsRuntime]

function Wait-WinRtAsyncOperation($operation, [Type]$resultType) {
  $methods = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.IsGenericMethodDefinition -and $_.GetParameters().Count -eq 1 -and $_.GetGenericArguments().Count -eq 1
  }
  foreach ($method in $methods) {
    try {
      $task = $method.MakeGenericMethod($resultType).Invoke($null, @($operation))
      return $task.GetAwaiter().GetResult()
    } catch {}
  }
  throw 'Unable to await WinRT operation.'
}

function Convert-ToDoubleScalar($value) {
  while ($value -is [array]) {
    if ($value.Count -le 0) { return 0.0 }
    $value = $value[0]
  }
  if ($null -eq $value) { return 0.0 }
  return [double]$value
}

function Divide-Scalar($left, $right) {
  $denominator = Convert-ToDoubleScalar $right
  if ([Math]::Abs($denominator) -lt 0.000001) { return 0.0 }
  return (Convert-ToDoubleScalar $left) / $denominator
}

function Clamp-Double([double]$value, [double]$min, [double]$max) {
  return [Math]::Max($min, [Math]::Min($max, $value))
}

function New-BitmapSize([int]$size) {
  $safeSize = [Math]::Max(1, $size)
  $bitmapSize = New-Object Windows.Graphics.Imaging.BitmapSize
  $bitmapSize.Width = [uint32]$safeSize
  $bitmapSize.Height = [uint32]$safeSize
  return $bitmapSize
}

function Read-CellFeatures([System.Drawing.Bitmap]$bitmap, [int]$x0, [int]$y0, [int]$x1, [int]$y1) {
  $graySum = 0.0
  $redSum = 0.0
  $greenSum = 0.0
  $blueSum = 0.0
  $gradientSum = 0.0
  $count = 0
  $strideX = [Math]::Max(1, [int][Math]::Ceiling(([Math]::Max(1, $x1 - $x0)) / 5.0))
  $strideY = [Math]::Max(1, [int][Math]::Ceiling(([Math]::Max(1, $y1 - $y0)) / 5.0))
  for ($y = $y0; $y -lt $y1; $y += $strideY) {
    for ($x = $x0; $x -lt $x1; $x += $strideX) {
      $pixel = $bitmap.GetPixel($x, $y)
      $red = Convert-ToDoubleScalar $pixel.R
      $green = Convert-ToDoubleScalar $pixel.G
      $blue = Convert-ToDoubleScalar $pixel.B
      $gray = (($red * 0.299) + ($green * 0.587) + ($blue * 0.114)) / 255.0
      $graySum += $gray
      $redSum += $red / 255.0
      $greenSum += $green / 255.0
      $blueSum += $blue / 255.0
      if ($x + 1 -lt $x1 -and $y + 1 -lt $y1) {
        $right = $bitmap.GetPixel($x + 1, $y)
        $down = $bitmap.GetPixel($x, $y + 1)
        $rightGray = (((Convert-ToDoubleScalar $right.R) * 0.299) + ((Convert-ToDoubleScalar $right.G) * 0.587) + ((Convert-ToDoubleScalar $right.B) * 0.114)) / 255.0
        $downGray = (((Convert-ToDoubleScalar $down.R) * 0.299) + ((Convert-ToDoubleScalar $down.G) * 0.587) + ((Convert-ToDoubleScalar $down.B) * 0.114)) / 255.0
        $gradientSum += [Math]::Abs($gray - $rightGray) + [Math]::Abs($gray - $downGray)
      }
      $count += 1
    }
  }
  if ($count -le 0) { return @(0.0, 0.0, 0.0, 0.0, 0.0) }
  return @(
    (Divide-Scalar $graySum $count),
    (Divide-Scalar $redSum $count),
    (Divide-Scalar $greenSum $count),
    (Divide-Scalar $blueSum $count),
    (Divide-Scalar $gradientSum $count)
  )
}

function New-FaceVector([System.Drawing.Bitmap]$bitmap, [int]$x, [int]$y, [int]$width, [int]$height) {
  $left = [int][Math]::Max(0, $x)
  $top = [int][Math]::Max(0, $y)
  $right = [int][Math]::Min($bitmap.Width, $x + $width)
  $bottom = [int][Math]::Min($bitmap.Height, $y + $height)
  if ($right -le $left -or $bottom -le $top) { return @() }

  $cells = 6
  $grayCells = New-Object System.Collections.Generic.List[double]
  $redCells = New-Object System.Collections.Generic.List[double]
  $greenCells = New-Object System.Collections.Generic.List[double]
  $blueCells = New-Object System.Collections.Generic.List[double]
  $gradientCells = New-Object System.Collections.Generic.List[double]
  for ($row = 0; $row -lt $cells; $row++) {
    for ($col = 0; $col -lt $cells; $col++) {
      $cx0 = [int][Math]::Floor($left + (($right - $left) * $col / $cells))
      $cx1 = [int][Math]::Floor($left + (($right - $left) * ($col + 1) / $cells))
      $cy0 = [int][Math]::Floor($top + (($bottom - $top) * $row / $cells))
      $cy1 = [int][Math]::Floor($top + (($bottom - $top) * ($row + 1) / $cells))
      $features = @(Read-CellFeatures $bitmap $cx0 $cy0 ([int][Math]::Max($cx0 + 1, $cx1)) ([int][Math]::Max($cy0 + 1, $cy1)))
      $grayCells.Add((Convert-ToDoubleScalar $features[0]))
      $redCells.Add((Convert-ToDoubleScalar $features[1]))
      $greenCells.Add((Convert-ToDoubleScalar $features[2]))
      $blueCells.Add((Convert-ToDoubleScalar $features[3]))
      $gradientCells.Add((Convert-ToDoubleScalar $features[4]))
    }
  }

  $vector = New-Object System.Collections.Generic.List[double]
  foreach ($cellsToCenter in @($grayCells, $redCells, $greenCells, $blueCells, $gradientCells)) {
    $mean = ($cellsToCenter | Measure-Object -Average).Average
    foreach ($value in $cellsToCenter) {
      $vector.Add([double]($value - $mean))
    }
  }

  $aspect = Divide-Scalar ($right - $left) ([Math]::Max(1.0, ($bottom - $top)))
  $area = Divide-Scalar (($right - $left) * ($bottom - $top)) ([Math]::Max(1.0, ($bitmap.Width * $bitmap.Height)))
  $vector.Add([double]($aspect - 1.0))
  $vector.Add([double]([Math]::Sqrt($area)))

  $samples = @(
    @($left, $top),
    @([Math]::Max($left, $right - 1), $top),
    @($left, [Math]::Max($top, $bottom - 1)),
    @([Math]::Max($left, $right - 1), [Math]::Max($top, $bottom - 1)),
    @([Math]::Floor(($left + $right) / 2), [Math]::Floor(($top + $bottom) / 2))
  )
  foreach ($sample in $samples) {
    $pixel = $bitmap.GetPixel([int]$sample[0], [int]$sample[1])
    $vector.Add((Divide-Scalar $pixel.R 255.0))
    $vector.Add((Divide-Scalar $pixel.G 255.0))
    $vector.Add((Divide-Scalar $pixel.B 255.0))
  }

  return $vector.ToArray()
}

function Get-FaceQualitySignals([System.Drawing.Bitmap]$bitmap, [int]$x, [int]$y, [int]$width, [int]$height) {
  $left = [int][Math]::Max(0, $x)
  $top = [int][Math]::Max(0, $y)
  $right = [int][Math]::Min($bitmap.Width, $x + $width)
  $bottom = [int][Math]::Min($bitmap.Height, $y + $height)
  if ($right -le $left -or $bottom -le $top) {
    return @{
      contrast = 0.0
      sharpness = 0.0
      textureEnergy = 0.0
      areaRatio = 0.0
    }
  }

  $grayValues = New-Object System.Collections.Generic.List[double]
  $gradientValues = New-Object System.Collections.Generic.List[double]
  $cells = 6
  for ($row = 0; $row -lt $cells; $row++) {
    for ($col = 0; $col -lt $cells; $col++) {
      $cx0 = [int][Math]::Floor($left + (($right - $left) * $col / $cells))
      $cx1 = [int][Math]::Floor($left + (($right - $left) * ($col + 1) / $cells))
      $cy0 = [int][Math]::Floor($top + (($bottom - $top) * $row / $cells))
      $cy1 = [int][Math]::Floor($top + (($bottom - $top) * ($row + 1) / $cells))
      $features = @(Read-CellFeatures $bitmap $cx0 $cy0 ([int][Math]::Max($cx0 + 1, $cx1)) ([int][Math]::Max($cy0 + 1, $cy1)))
      $grayValues.Add((Convert-ToDoubleScalar $features[0]))
      $gradientValues.Add((Convert-ToDoubleScalar $features[4]))
    }
  }

  $grayMean = ($grayValues | Measure-Object -Average).Average
  $gradientMean = ($gradientValues | Measure-Object -Average).Average
  $variance = 0.0
  $textureEnergy = 0.0
  foreach ($value in $grayValues) {
    $delta = (Convert-ToDoubleScalar $value) - (Convert-ToDoubleScalar $grayMean)
    $variance += $delta * $delta
    $textureEnergy += [Math]::Abs($delta)
  }
  $count = [Math]::Max(1, $grayValues.Count)
  $contrast = [Math]::Sqrt((Divide-Scalar $variance $count))
  $texture = Divide-Scalar $textureEnergy $count
  $areaRatio = Divide-Scalar (($right - $left) * ($bottom - $top)) ([Math]::Max(1.0, ($bitmap.Width * $bitmap.Height)))
  return @{
    contrast = [Math]::Round((Clamp-Double $contrast 0.0 1.0), 6)
    sharpness = [Math]::Round((Clamp-Double $gradientMean 0.0 1.0), 6)
    textureEnergy = [Math]::Round((Clamp-Double $texture 0.0 1.0), 6)
    areaRatio = [Math]::Round((Clamp-Double $areaRatio 0.0 1.0), 8)
  }
}

if (-not [Windows.Media.FaceAnalysis.FaceDetector]::IsSupported) {
  @{ success = $false; reason = 'windows-face-detector-unsupported'; faces = @(); embeddings = @() } | ConvertTo-Json -Depth 6 -Compress
  exit 0
}

$file = Wait-WinRtAsyncOperation ([Windows.Storage.StorageFile]::GetFileFromPathAsync($ImagePath)) ([Windows.Storage.StorageFile])
$stream = Wait-WinRtAsyncOperation ($file.OpenReadAsync()) ([Windows.Storage.Streams.IRandomAccessStreamWithContentType])
$decoder = Wait-WinRtAsyncOperation ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($stream)) ([Windows.Graphics.Imaging.BitmapDecoder])
$bitmap = Wait-WinRtAsyncOperation ($decoder.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
$detector = Wait-WinRtAsyncOperation ([Windows.Media.FaceAnalysis.FaceDetector]::CreateAsync()) ([Windows.Media.FaceAnalysis.FaceDetector])
$warnings = New-Object System.Collections.Generic.List[object]
try {
  if ($MinFaceSize -gt 0) {
    $detector.MinDetectableFaceSize = New-BitmapSize $MinFaceSize
  }
  if ($MaxFaceSize -gt 0) {
    $detector.MaxDetectableFaceSize = New-BitmapSize $MaxFaceSize
  }
} catch {
  $warnings.Add(@{
    code = 'face-detector-size-bounds-unavailable'
    message = $_.Exception.Message
  })
}
$detectedFaces = Wait-WinRtAsyncOperation ($detector.DetectFacesAsync($bitmap)) ([System.Collections.Generic.IList[Windows.Media.FaceAnalysis.DetectedFace]])

$drawingBitmap = $null
$faces = New-Object System.Collections.Generic.List[object]
$embeddings = New-Object System.Collections.Generic.List[object]
try {
  if ($detectedFaces.Count -gt 0) {
    try {
      $drawingBitmap = New-Object System.Drawing.Bitmap($ImagePath)
    } catch {
      $warnings.Add(@{
        code = 'face-region-vector-unavailable'
        message = $_.Exception.Message
      })
    }
  }

  $index = 0
  foreach ($face in $detectedFaces) {
    $box = $face.FaceBox
    $index += 1
    $faceId = "winface:$index"
    $faces.Add(@{
      id = $faceId
      confidence = 0.93
      imageWidth = [int]$decoder.PixelWidth
      imageHeight = [int]$decoder.PixelHeight
      box = @{
        x = [int]$box.X
        y = [int]$box.Y
        width = [int]$box.Width
        height = [int]$box.Height
      }
      source = 'windows-face-analysis'
    })
    if ($null -ne $drawingBitmap) {
      try {
        $vector = @(New-FaceVector $drawingBitmap ([int]$box.X) ([int]$box.Y) ([int]$box.Width) ([int]$box.Height))
        $qualitySignals = Get-FaceQualitySignals $drawingBitmap ([int]$box.X) ([int]$box.Y) ([int]$box.Width) ([int]$box.Height)
        if ($vector.Count -gt 0) {
          $embeddings.Add(@{
            faceId = $faceId
            confidence = 0.9
            vector = $vector
            source = 'windows-face-region-vector'
            metadata = @{
              vectorType = 'local-face-region-v2'
              cells = 6
              qualitySignals = $qualitySignals
              minDetectableFaceSize = [int]$MinFaceSize
              maxDetectableFaceSize = [int]$MaxFaceSize
            }
          })
        }
      } catch {
        $warnings.Add(@{
          code = 'face-region-vector-failed'
          faceId = $faceId
          message = $_.Exception.Message
        })
      }
    }
  }
} finally {
  if ($null -ne $drawingBitmap) { $drawingBitmap.Dispose() }
  if ($null -ne $stream) { $stream.Dispose() }
}

@{
  success = $true
  imagePath = $ImagePath
  width = [int]$decoder.PixelWidth
  height = [int]$decoder.PixelHeight
  faces = $faces
  embeddings = $embeddings
  warnings = $warnings
} | ConvertTo-Json -Depth 8 -Compress
