// Serves the fixture "shop" pages used by the e2e run (development only).
//
// Over TLS, because the run borrows real store hostnames and browsers refuse plain HTTP on any
// domain in the HSTS preload list (target.com is one). The certificate is self-signed and generated
// per run; the browser is launched with ignoreHTTPSErrors.
import { execFileSync } from 'node:child_process';
import { createServer } from 'node:https';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), 'fixtures');
// The DOM-only page sits on a WooCommerce confirmation URL on purpose: page text alone is not
// trusted on a generic path, so a bare /order-received is ignored by design (see score-trust tests).
const routes = { '/checkout/thank-you': 'thank-you.html', '/checkout/order-received/7788/': 'dom-only.html', '/order-received': 'dom-only.html', '/cart': 'cart.html', '/plain': 'plain.html' };

/** The hostnames the run maps to 127.0.0.1; the certificate has to name them. */
export const FIXTURE_HOSTS = ['www.target.com', 'www.etsy.com'];

const selfSignedCert = () => {
  const dir = mkdtempSync(join(tmpdir(), 'era-cert-'));
  const keyPath = join(dir, 'key.pem');
  const certPath = join(dir, 'cert.pem');
  const alt = FIXTURE_HOSTS.map((h) => `DNS:${h}`).join(',');
  execFileSync(
    'openssl',
    ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '1', '-nodes', '-subj', '/CN=equitreat-e2e', '-addext', `subjectAltName=${alt}`],
    { stdio: 'ignore' },
  );
  return { dir, key: readFileSync(keyPath), cert: readFileSync(certPath) };
};

export const startFixtureServer = (port) =>
  new Promise((resolve) => {
    const { dir, key, cert } = selfSignedCert();
    const server = createServer({ key, cert }, async (req, res) => {
      const file = routes[new URL(req.url ?? '/', 'https://x').pathname];
      if (!file) {
        res.writeHead(404);
        res.end('not found');
        return;
      }
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
      res.end(await readFile(join(root, file)));
    });
    const close = server.close.bind(server);
    server.close = (cb) => close(() => { rmSync(dir, { recursive: true, force: true }); cb?.(); });
    server.listen(port, () => resolve(server));
  });
