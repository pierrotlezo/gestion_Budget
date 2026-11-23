/**
 * Certificats HTTPS locaux (nécessaires pour installer l'appli sur l'iPhone et recevoir les notifications).
 * - Une « autorité » locale (CA), créée une seule fois : c'est elle que tu installes sur l'iPhone.
 * - Un certificat pour le serveur, signé par cette autorité, refait automatiquement si l'adresse du PC change.
 * Durée du certificat serveur : 800 jours (iOS refuse au-delà de 825).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { DATA_DIR } from './store';

const DIR = path.join(DATA_DIR, 'certificats');

export function ensureCerts(hosts: string[], ips: string[]): { key: Buffer; cert: Buffer; caPath: string } {
  mkdirSync(DIR, { recursive: true, mode: 0o700 });
  const f = (n: string) => path.join(DIR, n);
  const openssl = (...args: string[]) => execFileSync('openssl', args, { stdio: 'pipe' });

  if (!existsSync(f('ca.key'))) {
    openssl('req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('ca.key'), '-out', f('ca.crt'), '-days', '3650', '-sha256',
      '-subj', '/CN=Gestion Budget - autorite locale/O=Gestion Budget',
      '-addext', 'basicConstraints=critical,CA:TRUE', '-addext', 'keyUsage=critical,keyCertSign,cRLSign');
  }

  const san = [...hosts.map((h) => `DNS:${h}`), ...ips.map((i) => `IP:${i}`)].join(',');
  const current = existsSync(f('server.san')) ? readFileSync(f('server.san'), 'utf-8') : '';
  if (!existsSync(f('server.crt')) || current !== san) {
    writeFileSync(f('server.ext'), `basicConstraints=CA:FALSE\nkeyUsage=critical,digitalSignature,keyEncipherment\nextendedKeyUsage=serverAuth\nsubjectAltName=${san}\n`);
    openssl('req', '-newkey', 'rsa:2048', '-nodes', '-keyout', f('server.key'), '-out', f('server.csr'), '-subj', `/CN=${hosts[0]}`);
    openssl('x509', '-req', '-in', f('server.csr'), '-CA', f('ca.crt'), '-CAkey', f('ca.key'), '-CAcreateserial', '-out', f('server.crt'), '-days', '800', '-sha256', '-extfile', f('server.ext'));
    writeFileSync(f('server.san'), san);
  }
  return { key: readFileSync(f('server.key')), cert: readFileSync(f('server.crt')), caPath: f('ca.crt') };
}
