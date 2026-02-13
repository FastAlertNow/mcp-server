import axios, { AxiosError, AxiosInstance } from 'axios';
import {
    Channels,
    FastalertError,
    FastalertmasterApiError,
    FastalertResponse,
    Messages,
} from './types.js';
import 'dotenv/config';

export class FastalertClient {
    private readonly baseUrl: string;
    private readonly client: AxiosInstance;
    private apiKey?: string;


    public setToken(token: string) {
        this.apiKey = token;
        this.client.defaults.headers.common["X-API-KEY"] = token;
    }

    constructor() {
        const apiUrl = process.env.API_URL + '/v1';
        if (!apiUrl) throw new Error('API_URL environment variable is required');
        this.baseUrl = apiUrl;

        this.client = axios.create({
            baseURL: this.baseUrl,
            headers: {
                'Content-Type': 'application/json',
                'IS-MCP-API': true,
            },
        });
    }

    /**
     * Generic request handler
     */
    private async request<T>(method: 'get' | 'post', url: string, data?: any, params?: any,
        header: Record<string, string> = {}
    ): Promise<T> {
        try {
            const response = await this.client.request<FastalertResponse<T>>({
                method,
                url,
                data,
                params,
                headers: {
                    ...this.client.defaults.headers.common,
                    ...header,
                    'X-API-KEY': this.apiKey,
                },
            });

            const apiResp: FastalertResponse<T> = {
                status: response.data?.status ?? true,
                message: response.data?.message ?? 'No message provided',
                data: response.data?.data,
            };

            return apiResp as T;

        } catch (error) {
            if (axios.isAxiosError(error)) {

                const axiosError = error as AxiosError<FastalertError>;
                const status = axiosError.response?.status;
                const data = axiosError.response?.data;

                if (status === 422) {
                    const validationErrors =
                        (data as any)?.errors ||
                        (data as any)?.fault?.detail ||
                        (data as any)?.message ||
                        'Validation error occurred';

                    let messageText = 'Validation Error: ';
                    if (typeof validationErrors === 'object') {
                        messageText += JSON.stringify(validationErrors, null, 2);
                    } else {
                        messageText += validationErrors;
                    }

                    throw new FastalertmasterApiError(
                        messageText,
                        'VALIDATION_ERROR',
                        422
                    );
                }

                const apiError = axiosError.response?.data?.fault;
                throw new FastalertmasterApiError(
                    apiError?.faultstring || 'API request failed',
                    apiError?.detail?.errorcode,
                    status
                );
            }
            throw error;
        }

    }

    /**
    * Search for channels optiona search by name
    * @param query Search query parameters
    * @returns Array of matching channels
    */
    async searchChannelEvents<T extends Channels = Channels>(query: { name?: string } = {}): Promise<T[]> {
        return this.request<T[]>('get', '/organization/channels', undefined, query);
    }

    /**
     * Send a message to channels
     * @param message Message payload
     * @returns Array of sent messages
     */
    async sendMessageEvents(
        message: Messages, headers?: Record<string, string>
    ): Promise<Messages[]> {
        return this.request<Messages[]>( 'post',  '/send-message', message, undefined, headers );
    }
}
