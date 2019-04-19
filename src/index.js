/* eslint no-throw-literal: 'off' */

import path from 'path';

import hapserver, {AuthenticatedUser, AccessoryUI, log} from 'hap-server-api';
import storage from 'hap-server-api/storage';

import pam from 'authenticate-pam';

const authenticate = (username, password, options) => new Promise((rs, rj) => pam.authenticate(username, password, err => {
    err ? rj(err) : rs();
}, options));

const authenticated_users = new Set();

log.info('Loaded authenticate-pam');

hapserver.registerAuthenticationHandler('PAM', async (request, previous_user) => {
    // The first function receives any data sent from the UI
    // If a user is already authenticated the AuthenticatedUser object will be passed as the second object
    // It can return/throw anything to be sent back to the UI
    // When a user successfully authenticates it should return an AuthenticatedUser object

    log.info('Authentication request', Object.assign({}, request, {password: null}), previous_user);

    const validation_errors = {};

    if (!request.username) validation_errors.username = 'Enter your username.';
    if (!request.password) validation_errors.password = 'Enter your password.';

    if (Object.keys(validation_errors).length) {
        validation_errors.validation = true;
        throw validation_errors;
    }

    await authenticate(request.username, request.password);
    const user = await storage.getItem(request.username) || {};

    await storage.setItem(request.username, Object.assign(user, {
        last_login: Date.now(),
    }));

    if (!user.id) {
        throw new Error('This user is not allowed to access this home. Add an ID for this user in ' +
            'data/plugin-storage/authenticate-pam to allow this user to access this home.');
    }

    const authenticated_user = new AuthenticatedUser(user.id, user.name || request.username);

    if (request.remember) await authenticated_user.enableReauthentication();

    authenticated_users.add(authenticated_user);

    return authenticated_user;
}, (authenticated_user, disconnected) => {
    // The second function is called when an authenticated user disconnects or is reauthenticated
    // It doesn't need to return anything (it's return value is ignored)

    authenticated_users.delete(authenticated_user);

    log.info('User', authenticated_user, disconnected ? 'disconnected' : 'reauthenticated');
});

const authentication_handler_ui = new AccessoryUI();

authentication_handler_ui.loadScript('/index.js');
authentication_handler_ui.static('/', path.join(__dirname, 'ui'));

hapserver.registerAccessoryUI(authentication_handler_ui);
