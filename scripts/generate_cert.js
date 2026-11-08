/**
 * scripts/generate_cert.js
 * SSL/TLS Certificate Manager & HTTPS Options Provider
 * Task A11: Deploy over HTTPS, load test, assemble report and PPT
 *
 * Provides valid localhost SSL/TLS credentials for secure WebRTC microphone access.
 * Pure Node.js standard library - zero external dependencies.
 */

const fs = require('fs');
const path = require('path');
const tls = require('tls');

const CERTS_DIR = path.resolve(__dirname, '..', 'certs');
const PFX_FILE = path.join(CERTS_DIR, 'server.pfx');
const CRT_FILE = path.join(CERTS_DIR, 'server.crt');
const KEY_FILE = path.join(CERTS_DIR, 'server.key');
const PFX_PASSWORD = 'proxisepeak';

function ensureCertificates() {
  if (!fs.existsSync(CERTS_DIR)) {
    fs.mkdirSync(CERTS_DIR, { recursive: true });
  }

  // 1. Check if valid PFX bundle exists
  if (fs.existsSync(PFX_FILE)) {
    try {
      const pfx = fs.readFileSync(PFX_FILE);
      tls.createSecureContext({ pfx, passphrase: PFX_PASSWORD });
      return { pfxFile: PFX_FILE, crtFile: CRT_FILE, password: PFX_PASSWORD };
    } catch (e) {
      console.warn('Existing PFX certificate invalid:', e.message);
    }
  }

  // 2. Check if PEM Key & CRT pair exists
  if (fs.existsSync(KEY_FILE) && fs.existsSync(CRT_FILE)) {
    try {
      const key = fs.readFileSync(KEY_FILE);
      const cert = fs.readFileSync(CRT_FILE);
      tls.createSecureContext({ key, cert });
      return { keyFile: KEY_FILE, crtFile: CRT_FILE };
    } catch (e) {
      console.warn('Existing PEM certificate invalid:', e.message);
    }
  }

  throw new Error('Valid SSL/TLS certificate bundle (certs/server.pfx or certs/server.crt) not found.');
}

function getHttpsOptions() {
  ensureCertificates();

  if (fs.existsSync(PFX_FILE)) {
    return {
      pfx: fs.readFileSync(PFX_FILE),
      passphrase: PFX_PASSWORD,
      minVersion: 'TLSv1.2'
    };
  }

  return {
    key: fs.readFileSync(KEY_FILE),
    cert: fs.readFileSync(CRT_FILE),
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
  KEY_FILE,
  PFX_PASSWORD
};
