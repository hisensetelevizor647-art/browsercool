/**
 * OleksandrAi Authentication & Usage Limit System (Safe Stub & Firebase Compat)
 */
class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.usageCount = 0;
        this.onUserChangeCallbacks = [];
    }

    onUserChange(callback) {
        if (typeof callback === 'function') this.onUserChangeCallbacks.push(callback);
    }

    init() {}

    check() {
        return true;
    }

    recordUsage() {
        this.usageCount++;
    }

    updateLimitUI() {}
}

window.Auth = new AuthSystem();
