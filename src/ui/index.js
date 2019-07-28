
import accessoryui, {
    AuthenticationHandlerConnection, AuthenticatedUser,
    UserManagementHandler as BaseUserManagementHandler, UserManagementUser,
} from '@hap-server/accessory-ui-api';

const AuthenticationHandlerComponent = {
    template: `<div class="authentication-handler authentication-handler-pam">
        <form @submit.prevent="authenticate">
            <div class="form-group row">
                <label class="col-sm-3 col-form-label col-form-label-sm" :for="_uid + '-username'">Username</label>
                <div class="col-sm-9">
                    <input type="text" class="form-control form-control-sm" :id="_uid + '-username'"
                        v-model="username" :class="{'is-invalid': error && error.validation && error.username}"
                        :disabled="authenticating" @input="error && error.validation ? error.username = null : undefined" />
                    <div v-if="error && error.validation && error.username" class="invalid-feedback">{{ error.username }}</div>
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-3 col-form-label col-form-label-sm" :for="_uid + '-password'">Password</label>
                <div class="col-sm-9">
                    <input type="password" class="form-control form-control-sm" :id="_uid + '-password'"
                        v-model="password" :class="{'is-invalid': error && error.validation && error.password}"
                        :disabled="authenticating" @input="error && error.validation ? error.password = null : undefined" />
                    <div v-if="error && error.validation && error.password" class="invalid-feedback">{{ error.password }}</div>
                </div>
            </div>

            <div class="form-group row">
                <label class="col-sm-3 col-form-label col-form-label-sm" :for="_uid + '-remember'"></label>
                <div class="col-sm-9">
                    <div class="custom-control custom-checkbox">
                        <input :id="_uid + '-remember'" v-model="remember" type="checkbox" class="custom-control-input" />
                        <label class="custom-control-label" :for="_uid + '-remember'">Remember me</label>
                    </div>
                </div>
            </div>

            <p v-if="error && !error.validation" class="form-text text-danger">{{ error.message || error }}</p>

            <div class="d-flex">
                <slot name="left-buttons" />
                <div class="flex-fill"></div>
                <slot name="right-buttons" />
                <button class="btn btn-primary btn-sm" type="submit" :disabled="authenticating">Login</button>
            </div>
        </form>
    </div>`,
    props: {
        connection: AuthenticationHandlerConnection,
    },
    data() {
        return {
            authenticating: false,
            error: null,

            username: '',
            password: '',
            remember: true,
        };
    },
    watch: {
        authenticating(authenticating) {
            this.$emit('authenticating', authenticating);
        },
    },
    methods: {
        async authenticate() {
            if (this.authenticating) throw new Error('Already authenticating');
            this.authenticating = true;
            this.error = null;

            try {
                const user = await this.connection.send({
                    username: this.username,
                    password: this.password,
                    remember: this.remember,
                });

                if (!(user instanceof AuthenticatedUser)) {
                    throw new Error('user was not an AuthenticatedUser object');
                }

                this.$emit('user', user);
                this.$emit('close');
            } catch (err) {
                this.error = err;
            } finally {
                this.authenticating = false;
            }
        },
    },
};

accessoryui.registerAuthenticationHandlerComponent('PAM', AuthenticationHandlerComponent, 'Host users');

const UserManagementComponent = {
    template: `<div class="user-management user-management-pam">
        <slot name="info" :id="user.username" />

        <div class="form-group row">
            <label class="col-sm-3 col-form-label col-form-label-sm" :for="_uid + '-id'">ID</label>
            <div class="col-sm-9">
                <input type="text" class="form-control form-control-sm" :id="_uid + '-id'" :value="user.id"
                    disabled readonly />
            </div>
        </div>

        <div class="form-group row">
            <label class="col-sm-3 col-form-label col-form-label-sm" :for="_uid + '-username'">Username</label>
            <div class="col-sm-9">
                <input type="text" class="form-control form-control-sm" :id="_uid + '-username'" :value="user.username"
                    disabled readonly />
            </div>
        </div>

        <div class="form-group row">
            <label class="col-sm-3 col-form-label col-form-label-sm" :for="_uid + '-name'">Name</label>
            <div class="col-sm-9">
                <input type="text" class="form-control form-control-sm" :id="_uid + '-name'"
                    v-model="name" :class="{'is-invalid': error && error.validation && error.name}"
                    :disabled="saving" @input="error && error.validation ? error.name = null : undefined" />
                <div v-if="error && error.validation && error.name" class="invalid-feedback">{{ error.name }}</div>
            </div>
        </div>

        <div class="form-group row">
            <label class="col-sm-3 col-form-label col-form-label-sm" :for="_uid + '-last-login'">Last login</label>
            <div class="col-sm-9">
                <input type="text" class="form-control form-control-sm" :id="_uid + '-last-login'" :value="last_login"
                    disabled readonly />
            </div>
        </div>

        <div class="form-group row">
            <label class="col-sm-3 col-form-label col-form-label-sm" :for="_uid + '-enabled'"></label>
            <div class="col-sm-9">
                <div class="custom-control custom-checkbox">
                    <input :id="_uid + '-enabled'" v-model="enabled" type="checkbox" class="custom-control-input" />
                    <label class="custom-control-label" :for="_uid + '-enabled'">Enabled</label>
                </div>
            </div>
        </div>

        <slot name="location" />
        <slot name="permissions" />

        <pre class="selectable" style="font-size: 10px;"><code>{{ JSON.stringify(user, null, 4) }}</code></pre>
    </div>`,
    props: {
        userManagementHandler: BaseUserManagementHandler,
        user: UserManagementUser,
    },
    data() {
        return {
            saving: false,
            error: null,

            name: this.user.name,
            enabled: this.user.data.enabled,
        };
    },
    computed: {
        changed() {
            if (this.name !== this.user.name) return true;
            if (this.enabled !== this.user.data.enabled) return true;

            return false;
        },
        last_login() {
            return new Date(this.user.data.last_login);
        },
    },
    watch: {
        changed(changed) {
            this.$emit('changed', changed);
        },
        saving(saving) {
            this.$emit('saving', saving);
        },
    },
    methods: {
        async save() {
            if (this.saving) throw new Error('Already saving');
            this.saving = true;
            this.error = null;

            try {
                const data = Object.assign({}, this.user.data, {
                    name: this.name,
                    enabled: this.enabled,
                });

                await this.userManagementHandler.connection.send({
                    type: 'save-user',
                    username: this.user.username,
                    data,
                });

                this.user.data = data;
                this.user.name = data.name;
            } catch (err) {
                this.error = err;
            } finally {
                this.saving = false;
            }
        },
    },
};

class UserManagementHandler extends BaseUserManagementHandler {
    async getUsers() {
        const usernames = await this.connection.send({type: 'list-users'});
        const users = await this.connection.send({type: 'get-users', usernames});

        return users.map((data, index) => {
            const username = usernames[index];

            const user = new UserManagementUser(this, data.id);
            user.username = username;
            user.name = data.name;
            user.data = data;
            return user;
        });
    }
}

UserManagementHandler.component = UserManagementComponent;

accessoryui.registerUserManagementHandler('PAM', UserManagementHandler, 'Host users');
