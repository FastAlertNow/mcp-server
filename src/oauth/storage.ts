/**
 * OAuth 2.0 Storage Layer
 * In production, replace with Redis/Database
 */

export interface OAuthClient {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
    client_name: string;
    grant_types: string[];
    response_types: string[];
    token_endpoint_auth_method: string;
    client_id_issued_at: number;
    client_secret_expires_at: number;
}

export interface AuthorizationCode {
    code: string;
    client_id: string;
    redirect_uri: string;
    scope?: string;
    code_challenge?: string;
    code_challenge_method?: string;
    expires_at: number;
    used: boolean;
}

export interface AccessToken {
    token: string;
    client_id: string;
    scope?: string;
    expires_at: number;
}

class OAuthStorage {
    private clients: Map<string, OAuthClient> = new Map();
    private authCodes: Map<string, AuthorizationCode> = new Map();
    private accessTokens: Map<string, AccessToken> = new Map();

    // Client Management
    registerClient(client: OAuthClient): void {
        this.clients.set(client.client_id, client);
    }

    getClient(client_id: string): OAuthClient | undefined {
        return this.clients.get(client_id);
    }

    // Authorization Code Management
    storeAuthCode(authCode: AuthorizationCode): void {
        this.authCodes.set(authCode.code, authCode);
        
        // Auto-cleanup after expiration
        setTimeout(() => {
            this.authCodes.delete(authCode.code);
        }, 10 * 60 * 1000); // 10 minutes
    }

    // Access Token Management
    getAccessToken(token: string): AccessToken | undefined {
        const accessToken = this.accessTokens.get(token);
        if (!accessToken) return undefined;
        
        // Check expiration
        if (accessToken.expires_at < Date.now()) {
            this.accessTokens.delete(token);
            return undefined;
        }
        
        return accessToken;
    }
}

export const oauthStorage = new OAuthStorage();
