export interface Channels {
    uuid?: string;
    name: string;
    subscriber?: string;
}

export interface FastalertResponse<T = any> {
    data?: {
        data?: T[];
    };
    message?: string;
    status: boolean;
}


export interface FastalertError {
    fault: {
        faultstring: string;
        detail: {
            errorcode: string;
        };
    };
}

export class FastalertmasterApiError extends Error {
    constructor(
        message: string,
        public readonly code?: string,
        public readonly status?: number
    ) {
        super(message);
        this.name = 'FastalertmasterApiError';
    }
}

export interface Messages {
    id?: string;
    'channel-uuid': string[];
    title: string;
    content: string;
    action?: string;
    action_value?: string;
    image?: string;

}
