/* eslint no-throw-literal: 'off' */

import path from 'path';

import hapserver, {
    AuthenticationHandler, AuthenticatedUser, UserManagementHandler, WebInterfacePlugin, log,
    Connection,
} from '@hap-server/api';
import storage from '@hap-server/api/storage';

import pam, {AuthenticateOptions} from 'authenticate-pam';
import {v4 as genuuid} from 'uuid';

const authenticate = (username: string, password: string, options?: AuthenticateOptions) => {
    return new Promise((rs, rj) => pam.authenticate(username, password, err => err ? rj(err) : rs(), options));
};

const authentication_handler = new AuthenticationHandler('PAM', () => null);
const authenticated_users = new Set();

authentication_handler.handler = async (request: any, connection: Connection) => {
    // The first function receives any data sent from the UI
    // If a user is already authenticated the AuthenticatedUser object will be passed as the second object
    // It can return/throw anything to be sent back to the UI
    // When a user successfully authenticates it should return an AuthenticatedUser object

    log.info('Authentication request', Object.assign({}, request, {password: null}), connection.authenticated_user);

    const validation_errors: {
        username?: string;
        password?: string;
        validation?: true;
    } = {};

    if (!request.username) validation_errors.username = 'Enter your username.';
    if (!request.password) validation_errors.password = 'Enter your password.';

    if (Object.keys(validation_errors).length) {
        validation_errors.validation = true;
        throw validation_errors;
    }

    await authenticate(request.username, request.password);
    const user = await storage.getItem(request.username) || {};

    if (!user.id) user.id = genuuid();
    user.last_login = Date.now();

    await storage.setItem(request.username, user);

    if (!user.enabled) {
        throw new Error('This user is not allowed to access this home.');
    }

    const authenticated_user = new AuthenticatedUser(user.id, user.name || request.username);

    authenticated_user.username = request.username;

    if (request.remember) await authenticated_user.enableReauthentication();

    authenticated_users.add(authenticated_user);

    return authenticated_user;
};

// Set a reconnect handler to add the restored AuthenticatedUser to the authenticated_users set
authentication_handler.reconnect_handler = async data => {
    const user = await storage.getItem(data.username) || {};

    if (!user.enabled) {
        throw new Error('This user is not allowed to access this home.');
    }

    if (!user.id) {
        user.id = genuuid();

        await storage.setItem(data.username, user);
    }

    const authenticated_user = new AuthenticatedUser(data.id, user.name || data.username);

    authenticated_user.username = data.username;

    authenticated_users.add(authenticated_user);

    log.info('User', authenticated_user, 'reconnected');

    return authenticated_user;
};

authentication_handler.disconnect_handler = (authenticated_user, disconnected) => {
    // The second function is called when an authenticated user disconnects or is reauthenticated
    // It doesn't need to return anything (it's return value is ignored)

    authenticated_users.delete(authenticated_user);

    log.info('User', authenticated_user, disconnected ? 'disconnected' : 'reauthenticated');
};

hapserver.registerAuthenticationHandler(authentication_handler);

const user_management_handler = new UserManagementHandler('PAM', () => null);

user_management_handler.handler = async (request: any, connection: Connection) => {
    if (request.type === 'list-users') {
        return storage.keys();
    }

    if (request.type === 'get-users') {
        return Promise.all(request.usernames.map(async (username: string) => {
            const user = await storage.getItem(username);

            if (!user.id) {
                user.id = genuuid();

                await storage.setItem(username, user);
            }

            return user;
        }));
    }

    if (request.type === 'save-user') {
        const existing = await storage.getItem(request.username);
        if (!existing) {
            throw new Error('Unknown user.');
        }
        if (existing.id !== request.data.id) {
            throw new Error('Cannot change user ID.');
        }
        if (request.data.last_login && existing.last_login !== request.data.last_login) {
            throw new Error('Cannot change last login timestamp.');
        }
        if (existing.id === connection.authenticated_user!.id && !request.data.enabled) {
            throw new Error('You cannot disable the authenticated user.');
        }

        await storage.setItem(request.username, request.data);
        return;
    }

    throw new Error('Invalid message.');
};

hapserver.registerUserManagementHandler(user_management_handler);

const authentication_handler_ui = new WebInterfacePlugin();

authentication_handler_ui.loadScript('/index.js');
authentication_handler_ui.static('/', path.join(__dirname, 'ui'));

hapserver.registerWebInterfacePlugin(authentication_handler_ui);
