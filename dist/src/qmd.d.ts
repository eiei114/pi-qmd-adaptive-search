declare function detectQmd(config: any, root?: string): {
    available: boolean;
    command: any;
    statusText: any;
    errors?: undefined;
} | {
    available: boolean;
    command: any;
    errors: any[];
    statusText?: undefined;
};
declare function parseQmdSearchOutput(output: any, root: any): any[];
declare function qmdSearch(query: any, maxResults: any, config: any, root?: string, options?: any): {
    detected: {
        available: boolean;
        command: any;
        statusText: any;
        errors?: undefined;
    } | {
        available: boolean;
        command: any;
        errors: any[];
        statusText?: undefined;
    };
    results: any[];
    error: any;
    raw?: undefined;
    method?: undefined;
} | {
    detected: {
        available: boolean;
        command: any;
        statusText: any;
        errors?: undefined;
    } | {
        available: boolean;
        command: any;
        errors: any[];
        statusText?: undefined;
    };
    results: any[];
    raw: any;
    method: string;
    error?: undefined;
} | {
    detected: {
        available: boolean;
        command: any;
        statusText: any;
        errors?: undefined;
    } | {
        available: boolean;
        command: any;
        errors: any[];
        statusText?: undefined;
    };
    results: any[];
    error: any;
    raw: any;
    method?: undefined;
};
declare function installInstructions(): string;
export { detectQmd, qmdSearch, parseQmdSearchOutput, installInstructions };
