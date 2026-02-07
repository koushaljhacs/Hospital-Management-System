# HMS Hospital Management System - CSS/JS Minification Script
# Purpose: Minify CSS and JavaScript files for production deployment

$srcDir = "./planning"
$distDir = "./dist"

# Create dist directories if they don't exist
New-Item -ItemType Directory -Path "$distDir/css" -Force | Out-Null
New-Item -ItemType Directory -Path "$distDir/js" -Force | Out-Null

# Function to minify CSS
function Minify-CSS {
    param([string]$inputFile, [string]$outputFile)
    
    $css = Get-Content $inputFile -Raw
    
    # Remove comments
    $css = $css -replace '/\*[\s\S]*?\*/', ''
    
    # Remove excess whitespace
    $css = $css -replace '\s+', ' '
    $css = $css -replace ';\s+', ';'
    $css = $css -replace ':\s+', ':'
    $css = $css -replace ',\s+', ','
    $css = $css -replace '\s*\{\s*', '{'
    $css = $css -replace '\s*\}\s*', '}'
    $css = $css -replace '>\s+', '>'
    
    # Trim leading/trailing spaces
    $css = $css.Trim()
    
    Set-Content -Path $outputFile -Value $css -NoNewline
    Write-Host "Minified: $inputFile -> $outputFile"
}

# Function to minify JavaScript
function Minify-JS {
    param([string]$inputFile, [string]$outputFile)
    
    $js = Get-Content $inputFile -Raw
    
    # Remove comments (single-line and multi-line)
    $js = $js -replace '//.*?(?=\n)', ''
    $js = $js -replace '/\*[\s\S]*?\*/', ''
    
    # Remove excess whitespace
    $js = $js -replace '\s+', ' '
    $js = $js -replace ';\s+', ';'
    $js = $js -replace ':\s+', ':'
    $js = $js -replace ',\s+', ','
    $js = $js -replace '\s*\{\s*', '{'
    $js = $js -replace '\s*\}\s*', '}'
    
    # Trim
    $js = $js.Trim()
    
    Set-Content -Path $outputFile -Value $js -NoNewline
    Write-Host "Minified: $inputFile -> $outputFile"
}

# Minify CSS files
Write-Host "=== Minifying CSS Files ===" -ForegroundColor Cyan
Minify-CSS "$srcDir/style.css" "$distDir/css/style.min.css"
Minify-CSS "$srcDir/animations.css" "$distDir/css/animations.min.css"

# Minify JavaScript files
Write-Host "=== Minifying JavaScript Files ===" -ForegroundColor Cyan
Minify-JS "$srcDir/script.js" "$distDir/js/script.min.js"

# Display file sizes
Write-Host "=== File Size Comparison ===" -ForegroundColor Green
$style1 = (Get-Item "$srcDir/style.css").Length
$style2 = (Get-Item "$distDir/css/style.min.css").Length
$anim1 = (Get-Item "$srcDir/animations.css").Length
$anim2 = (Get-Item "$distDir/css/animations.min.css").Length
$script1 = (Get-Item "$srcDir/script.js").Length
$script2 = (Get-Item "$distDir/js/script.min.js").Length

Write-Host "style.css: $style1 bytes -> $style2 bytes"
Write-Host "animations.css: $anim1 bytes -> $anim2 bytes"
Write-Host "script.js: $script1 bytes -> $script2 bytes"

Write-Host "Build complete! Production files ready in ./dist/" -ForegroundColor Green
