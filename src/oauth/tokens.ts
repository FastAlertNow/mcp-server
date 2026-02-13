/**
 * Token Generation and Validation
 * Cryptographically secure token generation
 */

import crypto from 'crypto';

/**
 * Generate cryptographically secure random token
 * @param bytes - Number of random bytes (default: 32)
 * @returns Base64URL encoded token
 */
export function generateSecureToken(bytes: number = 32): string {
    return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Generate client secret (longer for better security)
 */
export function generateClientSecret(): string {
    return crypto.randomBytes(48).toString('base64url'); // 64 chars
}

/**
 * Generate authorization code (short-lived)
 */
export function generateAuthorizationCode(): string {
    return crypto.randomBytes(32).toString('base64url'); // 43 chars
}

/**
 * Generate access token
 */
export function generateAccessToken(): string {
    return crypto.randomBytes(32).toString('base64url');
}

/**
 * Calculate token expiration timestamp
 * @param ttlSeconds - Time to live in seconds
 * @returns Unix timestamp in milliseconds
 */
export function calculateExpiration(ttlSeconds: number): number {
    return Date.now() + (ttlSeconds * 1000);
}
