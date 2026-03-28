import axios from 'axios';
import crypto from 'crypto';
import { getSetting } from '../db';

interface OIDCDiscovery {
  authorization_endpoint: string;
  token_endpoint: string;
  userinfo_endpoint: string;
  issuer: string;
}

// Cache discovery doc for 5 minutes
let discoveryCache: { doc: OIDCDiscovery; fetchedAt: number } | null = null;

async function fetchDiscovery(issuerUrl: string): Promise<OIDCDiscovery> {
  const issuer = issuerUrl.replace(/\/$/, '');
  const discoveryUrl = `${issuer}/.well-known/openid-configuration`;
  try {
    const { data } = await axios.get(discoveryUrl);
    return data;
  } catch (err: any) {
    const status = err.response?.status;
    throw new Error(`Discovery failed (${status ?? err.code ?? 'network error'}): ${discoveryUrl}`);
  }
}

export async function getDiscovery(): Promise<OIDCDiscovery> {
  if (discoveryCache && Date.now() - discoveryCache.fetchedAt < 5 * 60 * 1000) {
    return discoveryCache.doc;
  }
  const issuer = getSetting('oauthIssuerUrl', '');
  if (!issuer) throw new Error('OAuth issuer URL not configured');
  const doc = await fetchDiscovery(issuer);
  discoveryCache = { doc, fetchedAt: Date.now() };
  return doc;
}

export async function testDiscovery(issuerUrl: string): Promise<OIDCDiscovery> {
  return fetchDiscovery(issuerUrl);
}

export function invalidateDiscoveryCache() {
  discoveryCache = null;
}

// PKCE helpers
export function generateCodeVerifier(): string {
  return crypto.randomBytes(32).toString('base64url');
}

export function generateCodeChallenge(verifier: string): string {
  return crypto.createHash('sha256').update(verifier).digest('base64url');
}

// Short-lived in-memory state store (TTL: 10 min)
const stateStore = new Map<string, { codeVerifier: string; expiresAt: number }>();

export function createState(codeVerifier: string): string {
  // Purge expired entries
  const now = Date.now();
  for (const [k, v] of stateStore) {
    if (now > v.expiresAt) stateStore.delete(k);
  }
  const state = crypto.randomBytes(16).toString('hex');
  stateStore.set(state, { codeVerifier, expiresAt: now + 10 * 60 * 1000 });
  return state;
}

export function consumeState(state: string): string | null {
  const entry = stateStore.get(state);
  stateStore.delete(state);
  if (!entry || Date.now() > entry.expiresAt) return null;
  return entry.codeVerifier;
}

export function isOAuthEnabled(): boolean {
  return !!(getSetting('oauthIssuerUrl', '') && getSetting('oauthClientId', ''));
}

export function extractUsername(claims: Record<string, any>): string {
  return claims.preferred_username || claims.email || claims.name || claims.sub || 'oauth-user';
}
