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
  $edgeXSum = 0.0
  $edgeYSum = 0.0
  $absEdgeXSum = 0.0
  $absEdgeYSum = 0.0
  $brightSum = 0.0
  $darkSum = 0.0
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
      if ($gray -ge 0.64) { $brightSum += 1.0 }
      if ($gray -le 0.28) { $darkSum += 1.0 }
      if ($x + 1 -lt $x1 -and $y + 1 -lt $y1) {
        $right = $bitmap.GetPixel($x + 1, $y)
        $down = $bitmap.GetPixel($x, $y + 1)
        $rightGray = (((Convert-ToDoubleScalar $right.R) * 0.299) + ((Convert-ToDoubleScalar $right.G) * 0.587) + ((Convert-ToDoubleScalar $right.B) * 0.114)) / 255.0
        $downGray = (((Convert-ToDoubleScalar $down.R) * 0.299) + ((Convert-ToDoubleScalar $down.G) * 0.587) + ((Convert-ToDoubleScalar $down.B) * 0.114)) / 255.0
        $edgeX = $rightGray - $gray
        $edgeY = $downGray - $gray
        $gradientSum += [Math]::Abs($edgeX) + [Math]::Abs($edgeY)
        $edgeXSum += $edgeX
        $edgeYSum += $edgeY
        $absEdgeXSum += [Math]::Abs($edgeX)
        $absEdgeYSum += [Math]::Abs($edgeY)
      }
      $count += 1
    }
  }
  if ($count -le 0) { return @(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0) }
  return @(
    (Divide-Scalar $graySum $count),
    (Divide-Scalar $redSum $count),
    (Divide-Scalar $greenSum $count),
    (Divide-Scalar $blueSum $count),
    (Divide-Scalar $gradientSum $count),
    (Divide-Scalar $edgeXSum $count),
    (Divide-Scalar $edgeYSum $count),
    (Divide-Scalar $absEdgeXSum $count),
    (Divide-Scalar $absEdgeYSum $count),
    (Divide-Scalar $brightSum $count),
    (Divide-Scalar $darkSum $count)
  )
}

function Add-CenteredVectorSeries($target, $values, [double]$scale) {
  if ($null -eq $values -or $values.Count -le 0) { return }
  $mean = ($values | Measure-Object -Average).Average
  foreach ($value in $values) {
    $target.Add([double](((Convert-ToDoubleScalar $value) - (Convert-ToDoubleScalar $mean)) * $scale))
  }
}

function Resolve-FaceRegion([System.Drawing.Bitmap]$bitmap, [int]$x, [int]$y, [int]$width, [int]$height) {
  $padX = [Math]::Max(2.0, $width * 0.10)
  $padTop = [Math]::Max(2.0, $height * 0.16)
  $padBottom = [Math]::Max(2.0, $height * 0.08)
  $rawLeft = $x - $padX
  $rawTop = $y - $padTop
  $rawRight = $x + $width + $padX
  $rawBottom = $y + $height + $padBottom
  $centerX = ($rawLeft + $rawRight) / 2.0
  $centerY = ($rawTop + $rawBottom) / 2.0
  $side = [Math]::Max(($rawRight - $rawLeft), ($rawBottom - $rawTop))
  $left = [int][Math]::Max(0, [Math]::Floor($centerX - ($side / 2.0)))
  $top = [int][Math]::Max(0, [Math]::Floor($centerY - ($side / 2.0)))
  $right = [int][Math]::Min($bitmap.Width, [Math]::Ceiling($centerX + ($side / 2.0)))
  $bottom = [int][Math]::Min($bitmap.Height, [Math]::Ceiling($centerY + ($side / 2.0)))
  if ($right -le $left -or $bottom -le $top) {
    $left = [int][Math]::Max(0, $x)
    $top = [int][Math]::Max(0, $y)
    $right = [int][Math]::Min($bitmap.Width, $x + $width)
    $bottom = [int][Math]::Min($bitmap.Height, $y + $height)
  }
  return @{
    left = $left
    top = $top
    right = $right
    bottom = $bottom
    padX = [Math]::Round($padX, 4)
    padTop = [Math]::Round($padTop, 4)
    padBottom = [Math]::Round($padBottom, 4)
  }
}

function New-FaceVector([System.Drawing.Bitmap]$bitmap, [int]$x, [int]$y, [int]$width, [int]$height) {
  $region = Resolve-FaceRegion $bitmap $x $y $width $height
  $left = [int]$region.left
  $top = [int]$region.top
  $right = [int]$region.right
  $bottom = [int]$region.bottom
  if ($right -le $left -or $bottom -le $top) { return @() }

  $cells = 6
  $grayCells = New-Object System.Collections.Generic.List[double]
  $redCells = New-Object System.Collections.Generic.List[double]
  $greenCells = New-Object System.Collections.Generic.List[double]
  $blueCells = New-Object System.Collections.Generic.List[double]
  $gradientCells = New-Object System.Collections.Generic.List[double]
  $edgeXCells = New-Object System.Collections.Generic.List[double]
  $edgeYCells = New-Object System.Collections.Generic.List[double]
  $absEdgeXCells = New-Object System.Collections.Generic.List[double]
  $absEdgeYCells = New-Object System.Collections.Generic.List[double]
  $brightCells = New-Object System.Collections.Generic.List[double]
  $darkCells = New-Object System.Collections.Generic.List[double]
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
      $edgeXCells.Add((Convert-ToDoubleScalar $features[5]))
      $edgeYCells.Add((Convert-ToDoubleScalar $features[6]))
      $absEdgeXCells.Add((Convert-ToDoubleScalar $features[7]))
      $absEdgeYCells.Add((Convert-ToDoubleScalar $features[8]))
      $brightCells.Add((Convert-ToDoubleScalar $features[9]))
      $darkCells.Add((Convert-ToDoubleScalar $features[10]))
    }
  }

  $vector = New-Object System.Collections.Generic.List[double]
  Add-CenteredVectorSeries $vector $grayCells 1.35
  Add-CenteredVectorSeries $vector $redCells 0.32
  Add-CenteredVectorSeries $vector $greenCells 0.32
  Add-CenteredVectorSeries $vector $blueCells 0.32
  Add-CenteredVectorSeries $vector $gradientCells 1.15
  Add-CenteredVectorSeries $vector $edgeXCells 0.82
  Add-CenteredVectorSeries $vector $edgeYCells 0.82
  Add-CenteredVectorSeries $vector $absEdgeXCells 0.72
  Add-CenteredVectorSeries $vector $absEdgeYCells 0.72
  Add-CenteredVectorSeries $vector $brightCells 0.48
  Add-CenteredVectorSeries $vector $darkCells 0.48

  $grayMean = ($grayCells | Measure-Object -Average).Average
  $gradientMean = ($gradientCells | Measure-Object -Average).Average
  for ($row = 0; $row -lt $cells; $row++) {
    $rowGray = 0.0
    $rowGradient = 0.0
    for ($col = 0; $col -lt $cells; $col++) {
      $cellIndex = ($row * $cells) + $col
      $rowGray += (Convert-ToDoubleScalar $grayCells[$cellIndex])
      $rowGradient += (Convert-ToDoubleScalar $gradientCells[$cellIndex])
    }
    $vector.Add([double](((Divide-Scalar $rowGray $cells) - $grayMean) * 0.9))
    $vector.Add([double](((Divide-Scalar $rowGradient $cells) - $gradientMean) * 0.75))
  }
  for ($col = 0; $col -lt $cells; $col++) {
    $colGray = 0.0
    $colGradient = 0.0
    for ($row = 0; $row -lt $cells; $row++) {
      $cellIndex = ($row * $cells) + $col
      $colGray += (Convert-ToDoubleScalar $grayCells[$cellIndex])
      $colGradient += (Convert-ToDoubleScalar $gradientCells[$cellIndex])
    }
    $vector.Add([double](((Divide-Scalar $colGray $cells) - $grayMean) * 0.9))
    $vector.Add([double](((Divide-Scalar $colGradient $cells) - $gradientMean) * 0.75))
  }
  for ($row = 0; $row -lt $cells; $row++) {
    for ($col = 0; $col -lt ([int]($cells / 2)); $col++) {
      $leftIndex = ($row * $cells) + $col
      $rightIndex = ($row * $cells) + (($cells - 1) - $col)
      $vector.Add([double](((Convert-ToDoubleScalar $grayCells[$leftIndex]) - (Convert-ToDoubleScalar $grayCells[$rightIndex])) * 0.68))
      $vector.Add([double](((Convert-ToDoubleScalar $gradientCells[$leftIndex]) - (Convert-ToDoubleScalar $gradientCells[$rightIndex])) * 0.48))
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
  $region = Resolve-FaceRegion $bitmap $x $y $width $height
  $left = [int]$region.left
  $top = [int]$region.top
  $right = [int]$region.right
  $bottom = [int]$region.bottom
  if ($right -le $left -or $bottom -le $top) {
    return @{
      contrast = 0.0
      sharpness = 0.0
      textureEnergy = 0.0
      areaRatio = 0.0
      brightness = 0.0
      brightnessSpread = 0.0
      symmetry = 0.0
    }
  }

  $grayValues = New-Object System.Collections.Generic.List[double]
  $gradientValues = New-Object System.Collections.Generic.List[double]
  $brightnessSum = 0.0
  $symmetryDelta = 0.0
  $symmetryCount = 0
  $cells = 6
  $grayGrid = New-Object 'double[,]' $cells,$cells
  for ($row = 0; $row -lt $cells; $row++) {
    for ($col = 0; $col -lt $cells; $col++) {
      $cx0 = [int][Math]::Floor($left + (($right - $left) * $col / $cells))
      $cx1 = [int][Math]::Floor($left + (($right - $left) * ($col + 1) / $cells))
      $cy0 = [int][Math]::Floor($top + (($bottom - $top) * $row / $cells))
      $cy1 = [int][Math]::Floor($top + (($bottom - $top) * ($row + 1) / $cells))
      $features = @(Read-CellFeatures $bitmap $cx0 $cy0 ([int][Math]::Max($cx0 + 1, $cx1)) ([int][Math]::Max($cy0 + 1, $cy1)))
      $gray = Convert-ToDoubleScalar $features[0]
      $grayGrid[$row,$col] = $gray
      $grayValues.Add($gray)
      $gradientValues.Add((Convert-ToDoubleScalar $features[4]))
      $brightnessSum += $gray
    }
  }
  for ($row = 0; $row -lt $cells; $row++) {
    for ($col = 0; $col -lt ([int]($cells / 2)); $col++) {
      $leftGray = Convert-ToDoubleScalar $grayGrid[$row,$col]
      $rightGray = Convert-ToDoubleScalar $grayGrid[$row,(($cells - 1) - $col)]
      $symmetryDelta += [Math]::Abs($leftGray - $rightGray)
      $symmetryCount += 1
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
  $brightness = Divide-Scalar $brightnessSum $count
  $symmetry = 1.0 - (Divide-Scalar $symmetryDelta ([Math]::Max(1, $symmetryCount)))
  return @{
    contrast = [Math]::Round((Clamp-Double $contrast 0.0 1.0), 6)
    sharpness = [Math]::Round((Clamp-Double $gradientMean 0.0 1.0), 6)
    textureEnergy = [Math]::Round((Clamp-Double $texture 0.0 1.0), 6)
    areaRatio = [Math]::Round((Clamp-Double $areaRatio 0.0 1.0), 8)
    brightness = [Math]::Round((Clamp-Double $brightness 0.0 1.0), 6)
    brightnessSpread = [Math]::Round((Clamp-Double ($contrast + $texture) 0.0 1.0), 6)
    symmetry = [Math]::Round((Clamp-Double $symmetry 0.0 1.0), 6)
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
              vectorType = 'local-face-region-v4'
              cells = 6
              descriptor = 'expanded-square-luminance-gradient-symmetry-profile'
              descriptorDimensions = $vector.Count
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
