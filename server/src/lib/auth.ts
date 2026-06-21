import { SignJWT, jwtVerify } from 'jose';
import type { JWTPayload } from '../types';

const ACCESS_TOKEN_TTL  = 60 * 15;          // 15 minutes
const REFRESH_TOKEN_TTL = 60 * 60 * 24 * 30; // 30 days

function secretKey(secret: string) {
  return new TextEncoder().encode(secret);
}

export async function signAccessToken(payload: Omit<JWTPayload, 'iat' | 'exp'>, secret: string) {
  return new SignJWT({ email: payload.email, username: payload.username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_TTL}s`)
    .sign(secretKey(secret));
}

export async function signRefreshToken(userId: string, secret: string) {
  return new SignJWT({})
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_TTL}s`)
    .sign(secretKey(secret));
}

export async function verifyAccessToken(token: string, secret: string): Promise<JWTPayload> {
  const { payload } = await jwtVerify(token, secretKey(secret));
  return payload as unknown as JWTPayload;
}

export async function verifyRefreshToken(token: string, secret: string): Promise<{ sub: string }> {
  const { payload } = await jwtVerify(token, secretKey(secret));
  return { sub: payload.sub as string };
}

export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const computed = await hashPassword(password);
  return computed === hash;
}

export async function hashToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export function refreshTokenExpiresAt(): number {
  return Math.floor(Date.now() / 1000) + REFRESH_TOKEN_TTL;
}
