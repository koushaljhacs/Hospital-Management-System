# HMS Hospital Management System - CSS/JS Minification Script
# Purpose: Minify CSS and JavaScript files for production deployment

$srcDir = "."
$distDir = "./dist"

# Create dist directories if they don't exist
New-Item -ItemType Directory -Path "$distDir/css" -Force | Out-Null
New-Item -ItemType Directory -Path "$distDir/js" -Force | Out-Null
New-Item -ItemType Directory -Path "$distDir/architecture" -Force | Out-Null

# Function to minify CSS
function Minify-CSS {
    param([string]$inputFile, [string]$outputFile)

    $css = [string]::Join("`n", (Get-Content $inputFile))

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

# Function to update HTML for production
function Update-HTML {
    param([string]$inputFile, [string]$outputFile)

    $html = [string]::Join("`n", (Get-Content $inputFile))

    # Update CSS links
    $html = $html -replace 'href="animations\.css"', 'href="css/animations.min.css"'
    $html = $html -replace 'href="style\.css"', 'href="css/style.min.css"'

    # Update JS links
    $html = $html -replace 'src="script\.js"', 'src="js/script.min.js"'

    # Update asset paths (for GitHub Pages deployment, assets are in same level)
    $html = $html -replace 'src="assets/', 'src="assets/'

    # Update security script paths
    $html = $html -replace 'src="\./security/', 'src="security/'

    # For architecture.html, update its specific links
    if ($inputFile -like "*architecture.html") {
        $html = $html -replace 'href="\./css/architecture\.css"', 'href="./css/architecture.css"'
        $html = $html -replace 'src="\./js/architecture\.js"', 'src="./js/architecture.js"'
        $html = $html -replace 'src="\.\./security/', 'src="../security/'
    }

    Set-Content -Path $outputFile -Value $html -NoNewline
    Write-Host "Updated: $inputFile -> $outputFile"
}

# Minify CSS files
Write-Host "=== Minifying CSS Files ===" -ForegroundColor Cyan
Minify-CSS "$srcDir/style.css" "$distDir/css/style.min.css"
Minify-CSS "$srcDir/animations.css" "$distDir/css/animations.min.css"

# Minify JavaScript files
Write-Host "=== Minifying JavaScript Files ===" -ForegroundColor Cyan
Minify-JS "$srcDir/script.js" "$distDir/js/script.min.js"

# Copy and update HTML files to dist
Write-Host "=== Processing HTML Files ===" -ForegroundColor Cyan
Update-HTML "$srcDir/index.html" "$distDir/index.html"
Update-HTML "$srcDir/architecture/architecture.html" "$distDir/architecture/architecture.html"

# Copy additional assets if needed (e.g., architecture CSS/JS)
Copy-Item "$srcDir/architecture/css/architecture.css" "$distDir/architecture/css/architecture.css" -Force
Copy-Item "$srcDir/architecture/js/architecture.js" "$distDir/architecture/js/architecture.js" -Force

# Copy assets and security folders to dist
Copy-Item "$srcDir/assets" "$distDir/assets" -Recurse -Force
Copy-Item "$srcDir/security" "$distDir/security" -Recurse -Force

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
