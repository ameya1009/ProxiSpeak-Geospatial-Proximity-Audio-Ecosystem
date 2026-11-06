$certDir = Join-Path $PSScriptRoot "..\certs"
if (-not (Test-Path $certDir)) {
    New-Item -ItemType Directory -Path $certDir -Force | Out-Null
}

$cert = New-SelfSignedCertificate `
    -DnsName "localhost", "127.0.0.1" `
    -CertStoreLocation "Cert:\CurrentUser\My" `
    -KeyExportPolicy Exportable `
    -KeySpec Signature `
    -KeyLength 2048 `
    -KeyAlgorithm RSA `
    -HashAlgorithm SHA256 `
    -NotAfter (Get-Date).AddYears(5)

$pfxPath = Join-Path $certDir "server.pfx"
$keyPath = Join-Path $certDir "server.key"
$crtPath = Join-Path $certDir "server.crt"
$password = ConvertTo-SecureString -String "proxisepeak" -Force -AsPlainText

Export-PfxCertificate -Cert $cert -FilePath $pfxPath -Password $password | Out-Null

# Export CRT PEM
$certBytes = $cert.Export([System.Security.Cryptography.X509Certificates.X509ContentType]::Cert)
$certB64 = [System.Convert]::ToBase64String($certBytes, [System.Base64FormattingOptions]::InsertLineBreaks)
$crtPem = "-----BEGIN CERTIFICATE-----`r`n$certB64`r`n-----END CERTIFICATE-----`r`n"
[System.IO.File]::WriteAllText($crtPath, $crtPem)

Write-Host "Certificates generated successfully:"
Write-Host "  PFX: $pfxPath"
Write-Host "  CRT: $crtPath"
