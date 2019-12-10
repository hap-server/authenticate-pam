declare module 'authenticate-pam' {
    export type AuthenticateCallback = (err: string | undefined, value: undefined) => void;

    export interface AuthenticateOptions {
        serviceName?: string;
        remoteHost?: string;
    }

    export function authenticate(username: string, password: string, callback: AuthenticateCallback, options?: AuthenticateOptions): void;
}
