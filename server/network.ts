import os from 'node:os';

export const HTTPS_PORT = Number(process.env.GB_HTTPS_PORT ?? 8443);
export const HTTP_PORT = Number(process.env.GB_HTTP_PORT ?? 8080);

/** Nom du PC sur le réseau local (mDNS / Bonjour), ex. « pierrot-laptop.local ». */
export const localHostname = () => `${os.hostname()}.local`;

/** Adresses IPv4 du PC sur le réseau local. */
export function lanIps(): string[] {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((a): a is os.NetworkInterfaceInfo => !!a && a.family === 'IPv4' && !a.internal)
    .map((a) => a.address);
}

export function serverUrls() {
  return {
    app: [`https://${localHostname()}:${HTTPS_PORT}`, ...lanIps().map((ip) => `https://${ip}:${HTTPS_PORT}`)],
    setup: `http://${localHostname()}:${HTTP_PORT}`,
  };
}
