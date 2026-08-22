declare function runCommand(command: any, args: any, options?: any): any;
declare function detectQmd(config: any, root?: string): {
    available: boolean;
    command: any;
    statusText: any;
    errors?: undefined;
} | {
    statusText?: undefined;
    available: boolean;
    command: any;
    errors: any[];
};
declare function parseQmdSearchOutput(output: any, root: any): any[];
declare function qmdSearch(query: any, maxResults: any, config: any, root?: string, options?: any): {
    detected: {
        available: boolean;
        command: any;
        statusText: any;
        errors?: undefined;
    } | {
        statusText?: undefined;
        available: boolean;
        command: any;
        errors: any[];
    };
    results: any[];
    error: string;
    raw?: undefined;
    method?: undefined;
} | {
    detected: {
        available: boolean;
        command: any;
        statusText: any;
        errors?: undefined;
    } | {
        statusText?: undefined;
        available: boolean;
        command: any;
        errors: any[];
    };
    results: any[];
    error: any;
    method: string;
    raw?: undefined;
} | {
    detected: {
        available: boolean;
        command: any;
        statusText: any;
        errors?: undefined;
    } | {
        statusText?: undefined;
        available: boolean;
        command: any;
        errors: any[];
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
        statusText?: undefined;
        available: boolean;
        command: any;
        errors: any[];
    };
    results: any[];
    error: any;
    raw: any;
    method: string;
};
declare function installInstructions(): string;
export { detectQmd, qmdSearch, parseQmdSearchOutput, installInstructions, runCommand };
