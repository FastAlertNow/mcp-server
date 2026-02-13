#!/usr/bin/env node
import express from "express";
import FormData from "form-data";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import {
    CallToolRequestSchema,
    ErrorCode,
    ListToolsRequestSchema,
    McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
    mcpAuthMetadataRouter,
} from "@modelcontextprotocol/sdk/server/auth/router.js";
import { OAuthMetadata } from "@modelcontextprotocol/sdk/shared/auth.js";
import { FastalertClient } from "./FastalertClient.js";
import { respond, respondError } from "./utils/apiResponse.js";
import { logger } from "./utils/logger.js";
import "dotenv/config";
import { Request, Response } from "express";
import cors from 'cors';
import {
    handleClientRegistration,
    handleAuthorizationCallback,
    validateAccessToken,
} from "./oauth/handlers.js";

declare global {
    namespace Express {
        interface Request {
            fastalertAuth?: {
                token: string;
                clientId: string;
                scopes: string[];
                expiresAt: number;
            };
        }
    }
}

const CONFIG = {
    host: process.env.HOST || "localhost",
    port: Number(process.env.PORT) || 3000,
    baseUrl: process.env.BASE_URL || "http://localhost:3000",
    frontUrl: process.env.FRONT_URL || "http://localhost:5173",
    apiUrl: process.env.API_URL || "http://alert_api_new.test/api",
};

class FastalertServer {
    public readonly server: Server;
    public readonly fastalertClient: FastalertClient;

    constructor(fastalertClient: FastalertClient) {
        this.fastalertClient = fastalertClient;
        this.server = new Server(
            {
                name: "fastalert",
                version: "1.0.0",
            },
            {
                capabilities: {
                    tools: {},
                },
                instructions: `You are a helpful Fastalert service assistant. You have access to channel management through MCP tools.

You can help users:
- List their own channels with details
- Find specific channels by filtering by name
- Send messages to one or more channels

When users ask to send messages to a channel by name (not UUID), first use list_channels to find the channel UUID, then use send_message with that UUID.

Be conversational and helpful. Confirm actions after completing them.`,
            }
        );

        this.server.onerror = (err) => logger.error("[MCP Error]", err);
        this.setupHandlers();
    }

    public async close() {
        await this.server.close();
    }

    private setupHandlers() {
        this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
            tools: [
                {
                    name: "list_channels",
                    description: "List all channels accessible to the user. Can optionally filter by channel name to find specific channels. Returns channel details including UUID, name, and subscriber count. Use this to find channel UUIDs when users refer to channels by name.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            name: {
                                type: "string",
                                description: "Optional channel name to filter results. Partial matches are supported."
                            },
                        },
                    },
                    approval: {
                        required: false,
                    },
                },
                {
                    name: "send_message",
                    description: "Send a message/alert to one or more channels. Requires channel UUIDs (use list_channels first if you only have channel names). Supports optional actions like call buttons, email links, website links, or images.",
                    inputSchema: {
                        type: "object",
                        properties: {
                            "channel-uuid": {
                                type: "array",
                                items: { type: "string" },
                                minItems: 1,
                                description: "Array of channel UUIDs to send the message to. Must be valid UUIDs from list_channels.",
                            },
                            title: {
                                type: "string",
                                description: "Title/subject of the message. Keep it concise and descriptive."
                            },
                            content: {
                                type: "string",
                                description: "Main content/body of the message."
                            },
                            action: {
                                type: "string",
                                enum: ["call", "email", "website", "image"],
                                description: "Optional action button type: 'call' for phone calls, 'email' for email links, 'website' for URLs, 'image' for image attachments.",
                            },
                            action_value: {
                                type: "string",
                                description: "Value for the action: phone number for 'call', email address for 'email', URL for 'website' or 'image'."
                            },
                            image: {
                                type: "string",
                                description: "Optional image URL to include in the message."
                            },
                        },
                        required: ["channel-uuid", "title", "content"],
                    },
                    approval: {
                        required: false,
                    },
                },
            ],
        }));

        this.server.setRequestHandler(CallToolRequestSchema, async (req) => {
            const { name, arguments: args } = req.params;
            try {
                switch (name) {
                    case "list_channels": {
                        const query = { name: args?.name as string | undefined };
                        const results = await this.fastalertClient.searchChannelEvents(
                            query
                        );
                        return respond(results);
                    }

                    case "send_message": {
                        const payload = args as any;
                        const formData = new FormData();
                        formData.append("channel-uuid", JSON.stringify(payload["channel-uuid"]));
                        formData.append("title", payload.title);
                        formData.append("content", payload.content);
                        if (payload.action) formData.append("action", payload.action);
                        if (payload.action_value)
                            formData.append("action_value", payload.action_value);
                        if (payload.image) formData.append("image", payload.image);

                        const headers = formData.getHeaders?.() ?? {};
                        const results = await this.fastalertClient.sendMessageEvents(
                            payload,
                            headers
                        );
                        return respond(results);
                    }

                    default:
                        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
                }
            } catch (err) {
                return respondError(err);
            }
        });
    }
}

// Create a single shared MCP server instance
const sharedFastalertServer = new FastalertServer(new FastalertClient());

function createOAuthUrls() {
    return {
        issuer: CONFIG.baseUrl,
        authorization_endpoint: CONFIG.baseUrl + '/authorize',
        token_endpoint: CONFIG.baseUrl + '/token',
        registration_endpoint: CONFIG.baseUrl + '/register',
    };
}

const app = express();

const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : [
        'http://localhost:6274',
        'http://localhost:5173',
        'http://localhost:3000',
    ];

app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, etc.)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            return callback(null, true);
        } else {
            logger.warn('[CORS] Rejected origin', { origin });
            return callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'mcp-protocol-version'],
    credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
const oauthUrls = createOAuthUrls();

const oauthMetadata: OAuthMetadata = {
    ...oauthUrls,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code"],
    code_challenge_methods_supported: ["S256", "plain"],
    token_endpoint_auth_methods_supported: ["client_secret_basic", "client_secret_post"],
};

// OAuth 2.0 Endpoints
app.post("/register", handleClientRegistration);

app.get('/.well-known/oauth-protected-resource', (req, res) => {
    res.json({
        resource: CONFIG.baseUrl,
        authorization_servers: [CONFIG.baseUrl]
    });
});

app.get('/.well-known/oauth-authorization-server', (req, res) => {
    res.json(oauthMetadata);
});

// Authorization endpoint - redirects to frontend login page
app.get("/authorize", (req, res) => {
    const query = new URLSearchParams(req.query as Record<string, string>).toString();
    const loginUrl = `${CONFIG.frontUrl}/login?${query}`;

    logger.info('[/authorize] Redirecting to frontend login', { loginUrl, query: req.query });
    res.redirect(loginUrl);
});

// Callback endpoint for frontend to generate authorization code after user login
app.post("/authorize/callback", handleAuthorizationCallback);

app.post("/token", async (req, res) => {
    try {
        logger.info('[/token] Proxying token request', {
            endpoint: CONFIG.apiUrl + '/token',
            body: req.body
        });

        const axios = (await import('axios')).default;
        const response = await axios.post(
            CONFIG.apiUrl + '/token',
            req.body,
            {
                headers: {
                    'Content-Type': 'application/json',
                },
                validateStatus: () => true,
            }
        );

        logger.info('[/token] Response received', {
            status: response.status,
            data: response.data
        });

        res.status(response.status).json(response.data);
    } catch (error) {
        logger.error('[/token] Error proxying token request', error);
        res.status(500).json({
            error: 'server_error',
            error_description: 'Failed to proxy token request',
        });
    }
});

app.get("/debug/status", (_req, res) => {
    res.json({
        status: "running",
        config: {
            baseUrl: CONFIG.baseUrl,
            frontUrl: CONFIG.frontUrl,
            apiUrl: CONFIG.apiUrl,
            allowedOrigins: process.env.ALLOWED_ORIGINS?.split(',') || [],
        },
        oauth: {
            issuer: oauthUrls.issuer,
            authorization_endpoint: oauthUrls.authorization_endpoint,
            token_endpoint: oauthUrls.token_endpoint,
            registration_endpoint: oauthUrls.registration_endpoint,
        },
        timestamp: new Date().toISOString(),
    });
});

// Mount OAuth metadata at /mcp path for MCP clients
app.use(
    '/mcp',
    mcpAuthMetadataRouter({
        oauthMetadata,
        resourceServerUrl: new URL(CONFIG.baseUrl),
    })
);

app.post("/mcp", validateAccessToken, async (req: Request, res: Response) => {
    try {
        logger.debug('[/mcp] MCP request', {
            clientId: req.fastalertAuth?.clientId,
            token: req.fastalertAuth?.token,
            scopes: req.fastalertAuth?.scopes,
            method: req.body?.method
        });
        const token = req.fastalertAuth?.token;
        if (!token) {
            logger.warn('[/mcp] Token missing after middleware');
            res.status(401).json({
                error: {
                    code: "unauthorized",
                    message: "Token missing after middleware",
                },
            });
            return;
        }

        logger.debug('[/mcp] Processing MCP request', {
            clientId: req.fastalertAuth?.clientId,
            method: req.body?.method
        });

        sharedFastalertServer.fastalertClient.setToken(token);

        const transport = new StreamableHTTPServerTransport({
            sessionIdGenerator: undefined,
            enableJsonResponse: true,
        });

        await sharedFastalertServer.server.connect(transport);

        try {
            await transport.handleRequest(req, res, req.body);
        } finally {
            if (res.writableFinished) {
                await transport.close();
            } else {
                res.on('finish', async () => {
                    try {
                        await transport.close();
                    } catch (e) {
                        logger.error('[/mcp] Error closing transport after finish', e);
                    }
                });
            }
        }
    } catch (err) {
        logger.error('[/mcp] Error handling request', err);
        if (!res.headersSent) {
            res.status(400).json({
                jsonrpc: "2.0",
                error: {
                    code: -32602,
                    message: err instanceof Error ? err.message : "Invalid Request",
                },
                id: null,
            });
        }
    }
});


app.get("/mcp", (req: Request, res: Response) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    logger.info("[/mcp GET] SSE client connected", { ip: req.ip });

    res.write(": sse connection established\n\n");

    const interval = setInterval(() => {
        try {
            res.write(": ping\n\n");
        } catch (_e) {
            // Ignore write errors
        }
    }, 15000);

    req.on("close", () => {
        clearInterval(interval);
        logger.info("[/mcp GET] SSE client disconnected");
    });
});

app.listen(CONFIG.port, CONFIG.host, () => {
    logger.info(`✅ MCP Server started`, {
        host: CONFIG.host,
        port: CONFIG.port,
        baseUrl: CONFIG.baseUrl,
        environment: process.env.NODE_ENV
    });
});
