/**
 * Rendering security boundary. This module is server-only.
 * Browser request interception is defense-in-depth, NOT a DNS-rebinding defense.
 * Public deployments MUST additionally enforce egress restrictions at the network layer.
 */
import path from 'node:path';
import fs from 'node:fs/promises';
import { lookup } from 'node:dns/promises';
import { BlockList, isIP } from 'node:net';

export type RenderProfile = 'local-bundle' | 'public-web' | 'trusted-local';
export type RenderSource = { html?: string; url?: string; filePath?: string };
export type BlockedResource = { url: string; reason: string };
export type PreparedSource = {
  profile: RenderProfile;
  entryUrl: string;
  html?: string;
  root?: string;
  entryRelativePath?: string;
};
export const BUNDLE_ORIGIN = 'http://studio-bundle.invalid';
export const UPLOADS_DIR = path.resolve(process.cwd(), 'uploads');

export class RenderPolicyError extends Error {
  constructor(message: string, public readonly url?: string) {
    super(message);
    this.name = 'RenderPolicyError';
  }
}

// Keep address families separate: Node's BlockList normalizes IPv4 to IPv4-mapped
// IPv6, so a mapped-range IPv6 rule in a shared blocklist would deny ALL IPv4.
const forbidden4 = new BlockList();
const forbidden6 = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10],
  ['127.0.0.0', 8], ['169.254.0.0', 16], ['172.16.0.0', 12],
  ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24],
  ['224.0.0.0', 4], ['240.0.0.0', 4],
] as const) forbidden4.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [
  ['::', 128], ['::1', 128], ['::ffff:0:0', 96], ['fc00::', 7],
  ['fe80::', 10], ['ff00::', 8], ['2001::', 23],
  ['2001:db8::', 32], ['2002::', 16],
] as const) forbidden6.addSubnet(address, prefix, 'ipv6');

export function isPublicAddress(ip: string): boolean {
  const version = isIP(ip);
  if (version === 4) return !forbidden4.check(ip, 'ipv4');
  if (version === 6) {
    // Only unicast global IPv6 is eligible, then remove special-use networks.
    return forbidden6.check(ip, 'ipv6') === false &&
      new BlockListWithGlobalIPv6().check(ip);
  }
  return false;
}

// Node's BlockList is used rather than fragile string-prefix matching.
class BlockListWithGlobalIPv6 {
  private readonly global = new BlockList();
  constructor() { this.global.addSubnet('2000::', 3, 'ipv6'); }
  check(ip: string): boolean { return this.global.check(ip, 'ipv6'); }
}

export async function assertNetworkUrl(raw: string, profile: RenderProfile): Promise<URL> {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { throw new RenderPolicyError('Malformed URL', raw); }
  if (!['http:', 'https:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new RenderPolicyError('Only HTTP(S) URLs are supported', raw);
  }
  if (parsed.username || parsed.password) {
    throw new RenderPolicyError('URL credentials are not accepted', raw);
  }
  if (profile === 'trusted-local') return parsed;
  if (profile !== 'public-web') {
    throw new RenderPolicyError('External network requests are disabled for Local bundle', raw);
  }
  const host = parsed.hostname.replace(/^\[|\]$/g, '').toLowerCase().replace(/\.$/, '');
  if (!host || host === 'localhost' || host.endsWith('.localhost') ||
      host.endsWith('.local') || host.endsWith('.internal') ||
      host.endsWith('.test') || host.endsWith('.invalid') ||
      host.endsWith('.home.arpa')) {
    throw new RenderPolicyError('Local or internal hostname denied', raw);
  }
  const literal = isIP(host);
  if (literal) {
    if (!isPublicAddress(host)) throw new RenderPolicyError('Private, loopback, link-local or reserved address denied', raw);
    return parsed;
  }
  let answers: Array<{ address: string }>;
  try {
    answers = await lookup(host, { all: true, verbatim: true });
  } catch {
    throw new RenderPolicyError('DNS resolution failed', raw);
  }
  if (!answers.length || answers.some(answer => !isPublicAddress(answer.address))) {
    throw new RenderPolicyError('DNS resolved to a non-public address', raw);
  }
  return parsed;
}

export function cleanBundleRelative(raw: string): string {
  if (!raw || raw.includes('\0') || raw.includes('\\') || raw.startsWith('/')) {
    throw new RenderPolicyError('Invalid local asset path', raw);
  }
  if (/%2f|%5c/i.test(raw)) throw new RenderPolicyError('Encoded path separators forbidden', raw);
  let decoded: string;
  try { decoded = decodeURIComponent(raw); } catch { throw new RenderPolicyError('Malformed local asset path', raw); }
  if (decoded.includes('%') || decoded.includes('\\') || decoded.includes('\0') || decoded.startsWith('/') ||
      /^[a-z]:/i.test(decoded) || decoded.split('/').some(x => x === '.' || x === '..' || x === '')) {
    throw new RenderPolicyError('Local path traversal or unsupported path syntax denied', raw);
  }
  return decoded;
}

export async function withinRoot(root: string, relative: string): Promise<string> {
  const safe = cleanBundleRelative(relative);
  const realRoot = await fs.realpath(root);
  const absolute = path.resolve(realRoot, safe);
  if (!isInside(realRoot, absolute)) throw new RenderPolicyError('Local path escapes configured root', relative);
  const resolved = await fs.realpath(absolute);
  if (!isInside(realRoot, resolved)) throw new RenderPolicyError('Local symlink escapes configured root', relative);
  const stat = await fs.stat(resolved);
  if (!stat.isFile()) throw new RenderPolicyError('Local asset is not a regular file', relative);
  return resolved;
}

export function isInside(root: string, candidate: string): boolean {
  const rel = path.relative(root, candidate);
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}

function configuredRoots(): string[] {
  return [
    UPLOADS_DIR,
    ...(process.env.RENDER_LOCAL_ROOTS || '').split(path.delimiter).filter(Boolean).map(x => path.resolve(x)),
  ];
}

async function resolveLocalFile(input: string): Promise<{ root: string; relative: string }> {
  if (input.includes('\0') || input.includes('\\') || /^[a-z][a-z0-9+.-]*:/i.test(input) || input.split('/').includes('..') ||
      input.startsWith('file:') || input.includes('?') || input.includes('#')) {
    throw new RenderPolicyError('Local path traversal or unsupported scheme denied', input);
  }
  for (const root of configuredRoots()) {
    const candidate = path.isAbsolute(input) ? input : path.resolve(root, input);
    const relative = path.relative(root, candidate).split(path.sep).join('/');
    if (!relative || relative.startsWith('../') || relative === '..') continue;
    try {
      const resolved = await withinRoot(root, relative);
      if (!/\.html?$/i.test(resolved)) throw new RenderPolicyError('Entry must be HTML', input);
      return { root: await fs.realpath(root), relative };
    } catch (error) {
      if (error instanceof RenderPolicyError && /symlink escapes/.test(error.message)) throw error;
    }
  }
  throw new RenderPolicyError('Local file not found inside configured roots', input);
}

export async function prepareSource(source: RenderSource, trustedStdio = false): Promise<PreparedSource> {
  const requested = [typeof source.html === 'string', Boolean(source.url), Boolean(source.filePath)].filter(Boolean);
  if (requested.length !== 1) throw new RenderPolicyError('Exactly one source must be supplied');
  const trusted = trustedStdio && process.env.RENDER_TRUSTED_STDIO === 'true';
  if (typeof source.html === 'string') {
    return { profile: trusted ? 'trusted-local' : 'local-bundle',
      entryUrl: BUNDLE_ORIGIN + '/index.html', html: source.html };
  }
  if (source.filePath) {
    const local = await resolveLocalFile(source.filePath);
    return { profile: trusted ? 'trusted-local' : 'local-bundle',
      entryUrl: BUNDLE_ORIGIN + '/' + local.relative.split('/').map(encodeURIComponent).join('/'),
      root: local.root, entryRelativePath: local.relative };
  }
  const url = source.url!;
  if (url.startsWith('/api/preview/')) {
    const match = /^\/api\/preview\/([a-f0-9-]{36})\/(.+)$/.exec(url);
    if (!match) throw new RenderPolicyError('Invalid uploaded bundle reference', url);
    const root = path.resolve(UPLOADS_DIR, match[1]);
    const relative = cleanBundleRelative(match[2]);
    await withinRoot(root, relative);
    return { profile: 'local-bundle',
      entryUrl: BUNDLE_ORIGIN + '/' + relative.split('/').map(encodeURIComponent).join('/'),
      root: await fs.realpath(root), entryRelativePath: relative };
  }
  const profile: RenderProfile = trusted ? 'trusted-local' : 'public-web';
  if (profile === 'public-web' && process.env.NODE_ENV === 'production' && process.env.STUDIO_PUBLIC_EGRESS_READY !== 'true') {
    throw new RenderPolicyError('Public web rendering requires operator-configured network egress isolation', url);
  }
  const parsed = await assertNetworkUrl(url, profile);
  return { profile, entryUrl: parsed.href };
}
