/**
 * scripts/generate_cert.js
 * SSL/TLS Certificate Manager & HTTPS Options Provider
 * Task A11: Deploy over HTTPS, load test, assemble report and PPT
 */

const fs = require('fs');
const path = require('path');
const tls = require('tls');
const { execSync } = require('child_process');

const CERTS_DIR = path.resolve(__dirname, '..', 'certs');
const PFX_FILE = path.join(CERTS_DIR, 'server.pfx');
const CRT_FILE = path.join(CERTS_DIR, 'server.crt');
const KEY_FILE = path.join(CERTS_DIR, 'server.key');
const PFX_PASSWORD = 'proxisepeak';

function ensureCertificates() {
  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }

  // 1. Check if valid PFX exists
  if (fs.existsSync(PFX_FILE)) {
    try {
      const pfx = fs.readFileSync(PFX_FILE);
      tls.createSecureContext({ pfx, passphrase: PFX_PASSWORD });
      return { pfxFile: PFX_FILE, crtFile: CRT_FILE, password: PFX_PASSWORD };
    } catch (e) {
      console.warn('Existing PFX certificate invalid, regenerating...', e.message);
    }
  }

  // 2. Generate certificate using PowerShell on Windows if needed
  const psScript = path.join(__dirname, 'generate_cert_win.ps1');
  if (fs.existsSync(psScript)) {
    try {
      execSync(`powershell -ExecutionPolicy Bypass -File "${psScript}"`, { stdio: 'inherit' });
      if (fs.existsSync(PFX_FILE)) {
        return { pfxFile: PFX_FILE, crtFile: CRT_FILE, password: PFX_PASSWORD };
      }
    } catch (err) {
      console.error('PowerShell cert generation failed:', err.message);
    }
  }

  throw new Error('Unable to acquire or generate valid SSL/TLS certificate for HTTPS deployment.');
}

function getHttpsOptions() {
  ensureCertificates();
  const pfx = fs.readFileSync(PFX_FILE);
  return {
    pfx,
    passphrase: PFX_PASSWORD,
    minVersion: 'TLSv1.2'
  };
}

if (require.main === module) {
  const result = ensureCertificates();
  console.log('SSL/TLS Certificate verified successfully:', result);
}

module.exports = {
  ensureCertificates,
  getHttpsOptions,
  PFX_FILE,
  CRT_FILE,
  PFX_PASSWORD
};
