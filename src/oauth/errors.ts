/**
 * OAuth 2.0 Error Responses
 * RFC 6749 compliant error handling
 */

import { Response } from 'express';

export type OAuth2ErrorCode =
    | 'invalid_request'
    | 'unauthorized_client'
    | 'access_denied'
    | 'unsupported_response_type'
    | 'invalid_scope'
    | 'server_error'
    | 'temporarily_unavailable'
    | 'invalid_client'
    | 'invalid_grant'
    | 'unsupported_grant_type'
    | 'invalid_client_metadata';

export interface OAuth2Error {
    error: OAuth2ErrorCode;
    error_description?: string;
    error_uri?: string;
}

/**
 * Send OAuth 2.0 compliant error response
 */
export function sendOAuthError(
    res: Response,
    statusCode: number,
    error: OAuth2ErrorCode,
    description?: string
): void {
    const errorResponse: OAuth2Error = {
        error,
        error_description: description,
    };

    res.status(statusCode).json(errorResponse);
}