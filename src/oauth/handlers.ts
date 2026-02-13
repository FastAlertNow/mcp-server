/**
 * Simplified OAuth 2.0 Handlers
 * Only includes handlers actually used in proxy mode
 */

import { Request, Response } from 'express';
import { oauthStorage } from './storage.js';
import { sendOAuthError } from './errors.js';
import { generateClientSecret, generateAuthorizationCode, calculateExpiration } from './tokens.js';
import { CodeChallengeMethod } from './pkce.js';
import { logger } from '../utils/logger.js';

/**
 * Client Registration Endpoint
 * RFC 7591 - OAuth 2.0 Dynamic Client Registration
 */
export function handleClientRegistration(req: Request, res: Response): void {
    const { redirect_uris, client_name, grant_types, response_types, token_endpoint_auth_method } = req.body;

    // Validate redirect_uris
    if (!redirect_uris || !Array.isArray(redirect_uris) || redirect_uris.length === 0) {
        sendOAuthError(
            res,
            400,
            'invalid_client_metadata',
            'redirect_uris is required and must be a non-empty array'
        );
        return;
    }

    // Validate each redirect_uri format
    for (const uri of redirect_uris) {
        try {
            new URL(uri);
        } catch {
            sendOAuthError(
                res,
                400,
                'invalid_client_metadata',
                `Invalid redirect_uri format: ${uri}`
            );
            return;
        }
    }

    // Generate secure client credentials
    const client_id = `client_${generateClientSecret()}`;
    const client_secret = generateClientSecret();

    const client = {
        client_id,
        client_secret,
        redirect_uris,
        client_name: client_name || 'Unnamed Client',
        grant_types: grant_types || ['authorization_code'],
        response_types: response_types || ['code'],
        token_endpoint_auth_method: token_endpoint_auth_method || 'client_secret_basic',
        client_id_issued_at: Math.floor(Date.now() / 1000),
        client_secret_expires_at: 0, // Never expires
    };

    oauthStorage.registerClient(client);

    logger.info('[/register] Registered client', { client_id, client_name });
    res.status(201).json(client);
}

/**
 * Authorization Callback - Generate Authorization Code
 * Called by frontend after user authenticates
 */
export function handleAuthorizationCallback(req: Request, res: Response): void {
    const { client_id, redirect_uri, scope, state, code_challenge, code_challenge_method } = req.body;

    // Validate required parameters
    if (!client_id || !redirect_uri) {
        sendOAuthError(res, 400, 'invalid_request', 'Missing required parameters');
        return;
    }

    // Validate client
    const client = oauthStorage.getClient(client_id);
    if (!client) {
        sendOAuthError(res, 400, 'unauthorized_client', 'Invalid client_id');
        return;
    }

    if (!client.redirect_uris.includes(redirect_uri)) {
        sendOAuthError(res, 400, 'invalid_request', 'Invalid redirect_uri');
        return;
    }

    // Generate authorization code
    const code = generateAuthorizationCode();
    
    oauthStorage.storeAuthCode({
        code,
        client_id,
        redirect_uri,
        scope,
        code_challenge,
        code_challenge_method: code_challenge_method as CodeChallengeMethod,
        expires_at: calculateExpiration(600), // 10 minutes
        used: false,
    });

    // Build redirect URL with code
    const callbackUrl = new URL(redirect_uri);
    callbackUrl.searchParams.set('code', code);
    if (state) {
        callbackUrl.searchParams.set('state', state);
    }

    logger.info('[/authorize/callback] Generated code for client', { client_id, redirect_uri });
    
    res.json({
        redirect_uri: callbackUrl.toString()
    });
}

/**
 * Token Validation Middleware
 * Validates token from Authorization header
 * Supports both "Bearer <token>" and plain token formats
 * Supports both local and external tokens
 */
export function validateAccessToken(req: Request, res: Response, next: any): void {

    const authHeader = req.headers.authorization;

    logger.warn('[validateAccessToken] Authorization header', { 
            authHeader: authHeader,
            authorization: req.headers.authorization 
        });
    
    if (!authHeader) {
        logger.warn('[validateAccessToken] Missing Authorization header', { 
            ip: req.ip,
            path: req.path 
        });
        sendOAuthError(res, 401, 'invalid_request', 'Missing Authorization header');
        return;
    }

    // Extract token - support both "Bearer <token>" and plain token
    let token: string;
    const bearerMatch = authHeader.match(/^Bearer\s+(.+)$/i);
    
    if (bearerMatch) {
        // Has "Bearer" prefix
        token = bearerMatch[1];
    } else {
        // No "Bearer" prefix - use the header value as-is
        token = authHeader.trim();
    }

    if (!token) {
        logger.warn('[validateAccessToken] Invalid Authorization header format');
        sendOAuthError(res, 401, 'invalid_request', 'Invalid Authorization header format');
        return;
    }
    
    // Check if token is in local storage (issued by this server)
    const accessToken = oauthStorage.getAccessToken(token);

    if (accessToken) {
        // Token found locally - validate expiration
        if (accessToken.expires_at < Date.now()) {
            logger.warn('[validateAccessToken] Access token expired', { 
                client_id: accessToken.client_id 
            });
            sendOAuthError(res, 401, 'invalid_grant', 'Access token expired');
            return;
        }
        
        logger.debug('[validateAccessToken] Token validated (local)', { 
            client_id: accessToken.client_id 
        });
        
        req.fastalertAuth = {
            token,
            clientId: accessToken.client_id,
            scopes: accessToken.scope ? accessToken.scope.split(' ') : [],
            expiresAt: accessToken.expires_at,
        };
        next();
    } else {
        // Token not in local storage - assume it's an external token
        // Pass it through to the FastAlert API for validation
        logger.debug('[validateAccessToken] Token passed through (external)');
        
        req.fastalertAuth = {
            token,
            clientId: '',
            scopes: [],
            expiresAt: 0,
        };
        next();
    }
}
