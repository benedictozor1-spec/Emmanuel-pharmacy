$pdfPath = "c:\Users\OZOR CHIDIEBERE\Desktop\Emmanuel Pharmacy\admin-dashboard-design-prompt.pdf"
$outPath = "c:\Users\OZOR CHIDIEBERE\Desktop\Emmanuel Pharmacy\admin-design-prompt-extracted.txt"

$bytes = Get-Content -Path $pdfPath -Encoding Byte -Raw
$raw = [System.Text.Encoding]::GetEncoding(28591).GetString($bytes)

$allText = New-Object System.Collections.ArrayList

$pattern = '\(([^\)]+)\)'
$regexMatches = [regex]::Matches($raw, $pattern)

foreach ($m in $regexMatches) {
    $txt = $m.Groups[1].Value
    if ($txt.Length -gt 2 -and $txt -match '[a-zA-Z]{2}') {
        [void]$allText.Add($txt)
    }
}

$result = $allText -join "`n"
Set-Content -Path $outPath -Value $result -Encoding UTF8
Write-Host "Done. Extracted segments: $($allText.Count)"
Write-Host "=== CONTENT ==="
Write-Host $result
