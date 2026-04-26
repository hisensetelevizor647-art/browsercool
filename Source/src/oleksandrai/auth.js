/**
 * OleksandrAi Authentication & Usage Limit System (Firebase Compat Version)
 * Supporting file:// protocol via global firebase namespace
 */

const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "oleksandrai-f5565.firebaseapp.com",
    projectId: "oleksandrai-f5565",
    storageBucket: "oleksandrai-f5565.firebasestorage.app",
    messagingSenderId: "1034187669203",
    appId: "1:1034187669203:web:dfff76fe755ccf9cb15e26",
    measurementId: "G-1F5YQDYNK5"
};

// Initialize Firebase (Global Namespace)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = (typeof firebase.firestore === 'function') ? firebase.firestore() : null;
const analytics = (typeof firebase.analytics === 'function') ? firebase.analytics() : null;
const googleProvider = new firebase.auth.GoogleAuthProvider();

/* Limit Configuration */
const FREE_LIMIT = Infinity;
const SHOW_AUTH_CONTROLS = false;
const STORAGE_KEYS = {
    USAGE: "oa_usage_counter",
};

/* Turnstile Configuration */
const TURNSTILE_SITE_KEY = "0x4AAAAAACaReZTJLCrvUSWB";

class AuthSystem {
    constructor() {
        this.currentUser = null;
        this.usageCount = parseInt(localStorage.getItem(STORAGE_KEYS.USAGE) || '0', 10);
        this.turnstileWidgetId = null;
        this.onUserChangeCallbacks = [];
        this.authApiDisabled = false;
        this.init();
    }

    onUserChange(callback) {
        this.onUserChangeCallbacks.push(callback);
    }

    getTranslationsObject() {
        if (typeof translations !== 'undefined' && translations) return translations;
        if (typeof window !== 'undefined' && window.translations) return window.translations;
        return null;
    }

    getTextBundle() {
        const lang = localStorage.getItem('language') || 'sk';
        const dict = this.getTranslationsObject();
        if (!dict) return {};
        return dict[lang] || dict['sk'] || dict['en'] || {};
    }

    init() {
        // Enforce Protocol Check (Firebase requires http/https)
        if (location.protocol === 'file:') {
            console.warn("OA Auth: Firebase Auth does not support file:// protocol. Please use a local server (e.g. Live Server in VS Code, or 'npx serve').");
            // We'll show a non-intrusive warning on the login modal if opened
        }

        // Handle Redirect Result
        auth.getRedirectResult().then((result) => {
            if (result.user) {
                console.log("OA Auth: User signed in via redirect");
            }
        }).catch((error) => {
            console.error("OA Auth Redirect Error:", error);
        });

        // Listen for auth state changes
        auth.onAuthStateChanged((user) => {
            this.currentUser = user;
            this.updateUI(user);
            this.onUserChangeCallbacks.forEach(cb => cb(user));
        }, (error) => {
            const msg = this.normalizeErrorMessage(error);
            if (this.isIdentityToolkitDisabledError(msg)) {
                this.authApiDisabled = true;
                console.warn("OA Auth: Identity Toolkit API is disabled or not enabled for this Firebase project.");
            } else {
                console.error("OA Auth state listener error:", error);
            }
            this.currentUser = null;
            this.updateUI(null);
            this.onUserChangeCallbacks.forEach(cb => cb(null));
        });

        if (SHOW_AUTH_CONTROLS) {
            // Inject Styles, Turnstile Script & Modal immediately
            this.injectStyles();
            this.injectTurnstileScript();
            this.injectModal();

            // Polling to inject Header Controls (Robustness for all loading states)
            this.pollForHeader();
        }
    }

    injectTurnstileScript() {
        if (document.getElementById('turnstile-script')) return;
        const script = document.createElement('script');
        script.id = 'turnstile-script';
        script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
    }

    pollForHeader() {
        const check = setInterval(() => {
            // We purposely don't return early if found, because navigating between "pages" (tabs)
            // in some SPA frameworks might remove it. But here we have separate HTMLs.
            // However, aggressive checking ensures we catch it if it renders late.
            this.injectHeaderControls();
        }, 500);

        // Stop polling after 10 seconds to save resources
        setTimeout(() => clearInterval(check), 10000);
    }

    injectStyles() {
        if (document.getElementById('oa-auth-styles')) return;
        const style = document.createElement('style');
        style.id = 'oa-auth-styles';
        style.textContent = `
            #oa-auth-modal {
                position: fixed;
                top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.6);
                backdrop-filter: blur(8px);
                z-index: 99999;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s ease;
            }
            #oa-auth-modal.active {
                opacity: 1;
                pointer-events: auto;
            }
            .oa-auth-card {
                background: #fff;
                border-radius: 24px;
                padding: 32px;
                width: 90%;
                max-width: 400px;
                text-align: center;
                box-shadow: 0 20px 60px rgba(0,0,0,0.2);
                font-family: 'Inter', sans-serif;
                color: #1f1f1f;
                position: relative;
            }
            .oa-close-btn {
                position: absolute;
                top: 16px;
                right: 16px;
                background: none;
                border: none;
                font-size: 20px;
                cursor: pointer;
                color: #999;
            }
            .oa-auth-title {
                font-size: 24px;
                font-weight: 700;
                margin-bottom: 8px;
            }
            .oa-auth-subtitle {
                font-size: 14px;
                color: #666;
                margin-bottom: 24px;
            }
            .oa-auth-input {
                width: 100%;
                padding: 12px 16px;
                border: 1px solid #e0e0e0;
                border-radius: 12px;
                font-size: 16px;
                margin-bottom: 12px;
                outline: none;
            }
            .oa-auth-btn {
                width: 100%;
                padding: 14px;
                background: #000;
                color: #fff;
                border: none;
                border-radius: 12px;
                font-size: 16px;
                font-weight: 600;
                cursor: pointer;
                margin-top: 8px;
            }
            .oa-social-btn {
                width: 100%;
                padding: 12px;
                background: #fff;
                border: 1px solid #e0e0e0;
                border-radius: 12px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 10px;
                margin-bottom: 12px;
            }
            .oa-social-btn:hover { background: #f9f9f9; }
            .oa-auth-divider {
                display: flex; align-items: center; margin: 20px 0; color: #999; font-size: 12px;
            }
            .oa-auth-divider::before, .oa-auth-divider::after {
                content: ''; flex: 1; height: 1px; background: #eee;
            }
            .oa-auth-divider span { padding: 0 10px; }
            
            /* Header Button */
            #oa-header-login-btn {
                padding: 8px 16px;
                background: #000;
                color: #fff;
                border-radius: 20px;
                font-size: 13px;
                font-weight: 600;
                border: none;
                cursor: pointer;
                transition: transform 0.2s;
                white-space: nowrap;
            }
            #oa-header-login-btn:hover { transform: scale(1.05); }
            @media (max-width: 768px) {
                #oa-auth-control-container {
                    min-width: 0;
                }
                #oa-header-login-btn {
                    padding: 6px 10px;
                    font-size: 12px;
                    max-width: 88px;
                    overflow: hidden;
                    text-overflow: ellipsis;
                }
            }

            /* User Profile in Header */
            #oa-user-profile-wrapper {
                position: relative;
                display: flex;
                align-items: center;
            }
            #oa-user-profile {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
                padding: 4px;
                border-radius: 20px;
                border: 1px solid #eee;
                background: #fff;
                transition: background 0.2s;
            }
            #oa-user-profile:hover {
                background: #f5f5f5;
            }
            #oa-user-profile img {
                width: 28px; height: 28px; border-radius: 50%; object-fit: cover;
            }
            
            /* Profile Dropdown */
            #oa-profile-dropdown {
                position: absolute;
                top: calc(100% + 10px);
                right: 0;
                width: 200px;
                background: #fff;
                border-radius: 16px;
                box-shadow: 0 10px 25px rgba(0,0,0,0.1);
                border: 1px solid #eee;
                padding: 8px;
                display: none;
                flex-direction: column;
                z-index: 10000;
                animation: oa-fade-in 0.2s ease;
            }
            #oa-profile-dropdown.active {
                display: flex;
            }
            @keyframes oa-fade-in {
                from { opacity: 0; transform: translateY(-10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            .oa-dropdown-item {
                padding: 10px 14px;
                border-radius: 10px;
                font-size: 14px;
                color: #333;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 10px;
                transition: background 0.2s;
            }
            .oa-dropdown-item:hover {
                background: #f5f5f5;
            }
            .oa-dropdown-item.logout {
                color: #ef4444;
                font-weight: 600;
            }
            .oa-dropdown-item.logout:hover {
                background: rgba(239, 68, 68, 0.1);
            }
            .oa-dropdown-info {
                padding: 10px 14px;
                border-bottom: 1px solid #eee;
                margin-bottom: 5px;
            }
            .oa-dropdown-email {
                font-size: 12px;
                color: #666;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            /* Turnstile Container */
            #oa-turnstile-container {
                margin: 10px 0;
                display: flex;
                justify-content: center;
                min-height: 65px;
            }

            /* Dark Mode */
            @media (prefers-color-scheme: dark) {
                .oa-auth-card { background: #1a1a1a; color: #fff; }
                .oa-auth-subtitle { color: #aaa; }
                .oa-auth-input { background: #2a2a2a; border-color: #333; color: #fff; }
                .oa-auth-btn { background: #fff; color: #000; }
                .oa-social-btn { background: #2a2a2a; border-color: #333; color: #fff; }
                .oa-social-btn:hover { background: #333; }
                #oa-user-profile { background: #2a2a2a; border-color: #333; color: #fff; }
            }
            /* Explicit Dark Mode Overrides for when class='dark' is present */
            body.dark #oa-user-profile, body.dark .oa-social-btn {
                 background: #2a2a2a; border-color: #333; color: white;
            }
            body.dark .oa-auth-card { background: #1a1a1a; color: white; }
            body.dark .oa-auth-input { background: #333; color: white; border-color: #444; }
            body.dark .oa-auth-btn { background: white; color: black; }

            body.dark #oa-profile-dropdown {
                background: #1a1a1a;
                border-color: #333;
                color: white;
            }
            body.dark .oa-dropdown-item { color: #eee; }
            body.dark .oa-dropdown-item:hover { background: #333; }
            body.dark .oa-dropdown-info { border-color: #333; }
            body.dark .oa-dropdown-email { color: #aaa; }

            /* Limit Reached Banner */
            #oa-limit-banner {
                background: #fef2f2;
                border-top: 1px solid #fee2e2;
                padding: 12px 16px;
                text-align: center;
                display: none;
                animation: oa-slide-up 0.3s ease;
            }
            #oa-limit-banner.active {
                display: block;
            }
            .oa-limit-text {
                font-size: 13px;
                color: #b91c1c;
                font-weight: 500;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 8px;
            }
            .oa-limit-link {
                color: #b91c1c;
                text-decoration: underline;
                font-weight: 700;
                cursor: pointer;
            }
            @keyframes oa-slide-up {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }
            body.dark #oa-limit-banner {
                background: #450a0a;
                border-color: #7f1d1d;
            }
            body.dark .oa-limit-text {
                color: #fecaca;
            }
            body.dark .oa-limit-link {
                color: #fca5a5;
            }
        `;
        document.head.appendChild(style);
    }

    injectModal() {
        if (document.getElementById('oa-auth-modal')) return;
        const t = this.getTextBundle();

        const modal = document.createElement('div');
        modal.id = 'oa-auth-modal';
        modal.innerHTML = `
            <div class="oa-auth-card">
                <button class="oa-close-btn" onclick="Auth.hideModal()">&times;</button>
                <div class="oa-auth-title" id="oa-auth-title">${t['auth-welcome-title'] || 'Welcome'}</div>
                <div class="oa-auth-subtitle" id="oa-auth-desc">${t['auth-welcome-subtitle'] || 'Sign in enabled for OleksandrAi'}</div>

                <div id="oa-error-msg" style="color:#ef4444;font-size:12px;margin-bottom:10px;display:none;"></div>

                <button class="oa-social-btn" onclick="Auth.loginGoogle()">
                    <svg width="20" height="20" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.21.81-.63z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                    ${t['auth-google-btn'] || 'Continue with Google'}
                </button>

                <div class="oa-auth-divider"><span>${t['auth-email-divider'] || 'OR EMAIL'}</span></div>

                <input type="email" id="oa-email" class="oa-auth-input" placeholder="${t['auth-email-placeholder'] || 'Email'}" />
                <input type="password" id="oa-password" class="oa-auth-input" placeholder="${t['auth-password-placeholder'] || 'Password'}" />
                
                <div id="oa-turnstile-container"></div>

                <button class="oa-auth-btn" id="oa-submit-btn" onclick="Auth.loginEmail()">${t['auth-sign-in-btn'] || 'Sign In'}</button>
                
                <div style="margin-top:16px;font-size:12px;color:#666;" id="oa-toggle-text">
                    
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }

    injectHeaderControls() {
        if (!SHOW_AUTH_CONTROLS) return;

        let container = document.getElementById('oa-auth-control-container');
        if (container) return; // Already injected

        container = document.createElement('div');
        container.id = 'oa-auth-control-container';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.gap = '10px';
        container.style.zIndex = '9999';

        let injected = false;

        // 1. Index.html (Main Chat) -> #header-actions
        const indexHeader = document.getElementById('header-actions');
        if (indexHeader) {
            if (indexHeader.firstChild) indexHeader.insertBefore(container, indexHeader.firstChild);
            else indexHeader.appendChild(container);
            injected = true;
        }

        // 2. Alexander.html (Test Mode) -> .header-right
        const alexanderHeader = document.querySelector('.header-right');
        if (!injected && alexanderHeader) {
            alexanderHeader.insertBefore(container, alexanderHeader.firstChild);
            injected = true;
        }

        // 3. Code.html (Code Editor) -> .sidebar-header or .new-chat-btn wrapper
        const codeSidebarHeader = document.querySelector('.sidebar-header');
        if (!injected && codeSidebarHeader) {
            container.style.marginLeft = 'auto';
            codeSidebarHeader.appendChild(container);
            injected = true;
        }

        // 5. Widgets.html -> .top-nav
        const widgetsHeader = document.querySelector('.top-nav');
        if (!injected && widgetsHeader) {
            container.style.pointerEvents = 'auto';
            widgetsHeader.appendChild(container);
            injected = true;
        }

        // 6. Voice.html or General Fallback (Top Right Fixed)
        if (!injected) {
            container.style.position = 'fixed';
            container.style.top = '24px';
            container.style.right = '90px';
            container.style.background = 'rgba(255,255,255,0.2)';
            container.style.backdropFilter = 'blur(10px)';
            container.style.padding = '6px 12px';
            container.style.borderRadius = '30px';
            container.style.border = '1px solid rgba(255,255,255,0.1)';
            container.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';

            if (document.body.classList.contains('dark') ||
                getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)' ||
                document.title.includes('Voice')) {
                container.style.background = 'rgba(0,0,0,0.4)';
                container.style.color = 'white';
                container.style.borderColor = 'rgba(255,255,255,0.15)';
            }
            document.body.appendChild(container);
            injected = true;
        }

        // Render current state
        this.updateUI(this.currentUser);
    }

    updateUI(user) {
        if (!SHOW_AUTH_CONTROLS) {
            const existing = document.getElementById('oa-auth-control-container');
            if (existing) existing.remove();
            return;
        }

        const container = document.getElementById('oa-auth-control-container');
        if (!container) return;

        if (user) {
            const photoURL = user.photoURL || 'https://cdn-icons-png.flaticon.com/512/1144/1144760.png';
            container.innerHTML = `
                <div id="oa-user-profile-wrapper">
                    <div id="oa-user-profile" title="${user.email}" onclick="Auth.toggleProfileMenu(event)">
                        <img src="${photoURL}" alt="User">
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-right:4px;"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                    <div id="oa-profile-dropdown">
                        <div class="oa-dropdown-info">
                            <div style="font-weight:600;font-size:14px;overflow:hidden;text-overflow:ellipsis;">${user.displayName || 'User'}</div>
                            <div class="oa-dropdown-email">${user.email}</div>
                        </div>
                        <div class="oa-dropdown-item" onclick="Auth.hideProfileMenu()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            Profile Settings
                        </div>
                        <div class="oa-dropdown-item logout" onclick="Auth.logout()">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                            Logout
                        </div>
                    </div>
                </div>
            `;
            if (!this._globalClickAdded) {
                document.addEventListener('click', () => this.hideProfileMenu());
                this._globalClickAdded = true;
            }
            setTimeout(() => this.injectLogoutInSettings(), 1000);
        } else {
            const t = this.getTextBundle();
            container.innerHTML = `
                <button id="oa-header-login-btn" onclick="Auth.showModal()">${t['auth-login-link'] || t['auth-sign-in-btn'] || 'Login'}</button>
            `;
        }
        this.updateLimitUI();
    }

    toggleProfileMenu(event) {
        if (event) event.stopPropagation();
        const dropdown = document.getElementById('oa-profile-dropdown');
        if (dropdown) dropdown.classList.toggle('active');
    }

    hideProfileMenu() {
        const dropdown = document.getElementById('oa-profile-dropdown');
        if (dropdown) dropdown.classList.remove('active');
    }

    injectLogoutInSettings() {
        const existing = document.getElementById('oa-settings-logout');
        if (existing) return;

        const voiceSettings = document.querySelector('#avatar-modal .space-y-4');
        const modalSettings = document.querySelector('#settings-modal .modal-content');

        const btn = document.createElement('button');
        btn.id = 'oa-settings-logout';
        btn.textContent = "Logout Account";
        btn.style.width = "100%";
        btn.style.padding = "14px";
        btn.style.marginTop = "20px";
        btn.style.borderRadius = "20px";
        btn.style.border = "1px solid rgba(239, 68, 68, 0.2)";
        btn.style.background = "rgba(239, 68, 68, 0.1)";
        btn.style.color = "#ef4444";
        btn.style.fontWeight = "600";
        btn.style.cursor = "pointer";
        btn.style.transition = "all 0.2s";
        btn.onmouseover = () => btn.style.background = "rgba(239, 68, 68, 0.2)";
        btn.onmouseout = () => btn.style.background = "rgba(239, 68, 68, 0.1)";
        btn.onclick = () => this.logout();

        if (voiceSettings) {
            voiceSettings.appendChild(btn);
        } else if (modalSettings) {
            modalSettings.appendChild(btn);
        }
    }

    toggleMode() {
        // Registration mode is intentionally disabled.
        this.isRegister = false;
        this.showModal();
    }

    showModal() {
        if (!SHOW_AUTH_CONTROLS) return;
        const modal = document.getElementById('oa-auth-modal');
        if (!modal) return;
        modal.classList.add('active');
        document.getElementById('oa-error-msg').style.display = 'none';

        const t = this.getTextBundle();

        if (location.protocol === 'file:') {
            this.showError("Firebase Auth requires a local server (http/https). It will not work if you open the HTML file directly (file://).");
        }

        this.isRegister = false;
        document.getElementById('oa-auth-title').textContent = t['auth-welcome-title'] || 'Welcome';
        document.getElementById('oa-submit-btn').textContent = t['auth-sign-in-btn'] || 'Sign In';
        document.getElementById('oa-submit-btn').onclick = () => this.loginEmail();
        document.getElementById('oa-toggle-text').innerHTML = '';

        if (this.authApiDisabled) {
            this.showError(this.getIdentityToolkitDisabledMessage());
        }
        this.setAuthButtonsDisabled(this.authApiDisabled);
        this.renderTurnstile();
    }

    hideModal() {
        const modal = document.getElementById('oa-auth-modal');
        if (modal) modal.classList.remove('active');
    }

    renderTurnstile(retryCount = 0) {
        const container = document.getElementById('oa-turnstile-container');
        if (!container) return;

        if (!window.turnstile) {
            if (retryCount < 10) {
                setTimeout(() => this.renderTurnstile(retryCount + 1), 500);
            }
            return;
        }

        container.innerHTML = '';
        try {
            this.turnstileWidgetId = window.turnstile.render('#oa-turnstile-container', {
                sitekey: TURNSTILE_SITE_KEY,
                theme: 'auto',
            });
        } catch (e) {
            console.error("Turnstile render error:", e);
        }
    }

    async loginGoogle() {
        if (this.authApiDisabled) {
            this.showError(this.getIdentityToolkitDisabledMessage());
            return;
        }
        try {
            await auth.signInWithPopup(googleProvider);
            this.hideModal();
        } catch (error) {
            console.warn("OA Auth: Popup failed, trying redirect...", error);
            try {
                await auth.signInWithRedirect(googleProvider);
            } catch (redirectError) {
                const msg = this.normalizeErrorMessage(redirectError);
                if (this.isIdentityToolkitDisabledError(msg)) {
                    this.authApiDisabled = true;
                    this.setAuthButtonsDisabled(true);
                }
                this.showError(redirectError.message);
            }
        }
    }

    async loginEmail() {
        if (this.authApiDisabled) {
            this.showError(this.getIdentityToolkitDisabledMessage());
            return;
        }
        if (!this.checkTurnstile()) return;

        const email = document.getElementById('oa-email').value;
        const pass = document.getElementById('oa-password').value;
        try {
            await auth.signInWithEmailAndPassword(email, pass);
            this.hideModal();
        } catch (error) {
            const msg = this.normalizeErrorMessage(error);
            if (this.isIdentityToolkitDisabledError(msg)) {
                this.authApiDisabled = true;
                this.setAuthButtonsDisabled(true);
            }
            this.showError(error.message);
        }
    }

    async registerEmail() {
        if (this.authApiDisabled) {
            this.showError(this.getIdentityToolkitDisabledMessage());
            return;
        }
        if (!this.checkTurnstile()) return;

        const email = document.getElementById('oa-email').value;
        const pass = document.getElementById('oa-password').value;
        try {
            await auth.createUserWithEmailAndPassword(email, pass);
            this.hideModal();
        } catch (error) {
            const msg = this.normalizeErrorMessage(error);
            if (this.isIdentityToolkitDisabledError(msg)) {
                this.authApiDisabled = true;
                this.setAuthButtonsDisabled(true);
            }
            this.showError(error.message);
        }
    }

    normalizeErrorMessage(error) {
        if (!error) return '';
        if (typeof error === 'string') return error;
        return error.message || error.code || String(error);
    }

    isIdentityToolkitDisabledError(msg) {
        const text = (msg || '').toLowerCase();
        return text.includes('identitytoolkit.googleapis.com') ||
            text.includes('identity-toolkit-api-has-not-been-used') ||
            text.includes('api has not been used in project') ||
            text.includes('it is disabled');
    }

    getIdentityToolkitDisabledMessage() {
        const lang = localStorage.getItem('language') || 'sk';
        if (lang === 'uk') {
            return "У проекті Firebase вимкнено Identity Toolkit API. Увімкніть API в Google Cloud Console для проекту 353659292224, зачекайте 2-5 хвилин і повторіть вхід.";
        }
        if (lang === 'sk') {
            return "V projekte Firebase je vypnuté Identity Toolkit API. Zapnite API v Google Cloud Console pre projekt 353659292224, počkajte 2-5 minút a skúste prihlásenie znova.";
        }
        return "Identity Toolkit API is disabled for this Firebase project. Enable it in Google Cloud Console for project 353659292224, wait 2-5 minutes, then retry sign-in.";
    }

    setAuthButtonsDisabled(disabled) {
        const submitBtn = document.getElementById('oa-submit-btn');
        if (submitBtn) {
            submitBtn.disabled = !!disabled;
            submitBtn.style.opacity = disabled ? '0.55' : '';
            submitBtn.style.cursor = disabled ? 'not-allowed' : '';
        }

        document.querySelectorAll('#oa-auth-modal .oa-social-btn').forEach((btn) => {
            btn.disabled = !!disabled;
            btn.style.opacity = disabled ? '0.55' : '';
            btn.style.cursor = disabled ? 'not-allowed' : '';
        });
    }

    checkTurnstile() {
        const t = this.getTextBundle();

        if (!window.turnstile || this.turnstileWidgetId === null || typeof this.turnstileWidgetId === 'undefined') {
            this.showError(t['auth-security-unavailable'] || "Security check failed to load. Please refresh the page and try again.");
            return false;
        }

        let token = '';
        try {
            token = window.turnstile.getResponse(this.turnstileWidgetId);
        } catch (error) {
            this.showError(t['auth-security-unavailable'] || "Security check failed to load. Please refresh the page and try again.");
            return false;
        }

        if (!token) {
            this.showError(t['auth-security-check'] || "Please complete the security check.");
            return false;
        }
        return true;
    }

    async logout() {
        await auth.signOut();
        location.reload();
    }

    showError(msg) {
        const el = document.getElementById('oa-error-msg');
        const rawMessage = this.normalizeErrorMessage(msg);
        let displayMsg = rawMessage;

        // Specific handling for unauthorized domain error
        if (rawMessage && rawMessage.includes('auth/unauthorized-domain')) {
            const lang = localStorage.getItem('language') || 'uk';
            if (lang === 'uk') {
                displayMsg = "Цей домен не авторизовано у Firebase. Будь ласка, додайте 'oleksandrai.netlify.app' у консолі Firebase (Authentication -> Settings -> Authorized domains).";
            } else if (lang === 'sk') {
                displayMsg = "Táto doména nie je autorizovaná vo Firebase. Pridajte 'oleksandrai.netlify.app' v konzole Firebase (Authentication -> Settings -> Authorized domains).";
            } else {
                displayMsg = "This domain is not authorized in Firebase. Please add 'oleksandrai.netlify.app' in the Firebase Console (Authentication -> Settings -> Authorized domains).";
            }
        }

        if (this.isIdentityToolkitDisabledError(rawMessage)) {
            this.authApiDisabled = true;
            this.setAuthButtonsDisabled(true);
            displayMsg = this.getIdentityToolkitDisabledMessage();
        }

        if (!el) {
            console.error(displayMsg);
            return;
        }

        el.textContent = displayMsg;
        el.style.display = 'block';
    }

    isLimited() {
        if (this.currentUser) return false;
        return this.usageCount >= FREE_LIMIT;
    }

    getRemainingRequests() {
        if (this.currentUser) return Infinity;
        return Math.max(0, FREE_LIMIT - this.usageCount);
    }

    check() {
        if (!SHOW_AUTH_CONTROLS) return true;
        if (this.authApiDisabled) return true;
        if (this.currentUser) return true;

        if (this.usageCount >= FREE_LIMIT) {
            this.showModal();
            this.updateLimitUI();
            return false;
        }

        this.usageCount++;
        localStorage.setItem(STORAGE_KEYS.USAGE, this.usageCount.toString());

        if (this.usageCount >= FREE_LIMIT) {
            this.updateLimitUI();
        }

        return true;
    }

    injectLimitBanner() {
        const inputArea = document.querySelector('.input-panel') || document.body;
        if (!inputArea || document.getElementById('oa-limit-banner')) return;

        const t = this.getTextBundle();

        const banner = document.createElement('div');
        banner.id = 'oa-limit-banner';
        banner.innerHTML = `
            <div class="oa-limit-text">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
                ${t['limit-banner-message'] || 'You reached the free message limit.'}
            </div>
        `;

        const inputContainer = document.querySelector('.prompt-input-container');
        if (inputContainer) {
            inputContainer.parentElement.insertBefore(banner, inputContainer);
        } else {
            document.body.appendChild(banner);
        }
    }

    updateLimitUI() {
        if (!SHOW_AUTH_CONTROLS) return;
        this.injectLimitBanner();
        const limited = this.authApiDisabled ? false : this.isLimited();
        const banner = document.getElementById('oa-limit-banner');

        if (banner) {
            if (limited) banner.classList.add('active');
            else banner.classList.remove('active');
        }

        const chatInput = document.getElementById('chat-input') || document.querySelector('textarea');
        const sendBtn = document.getElementById('send-button') || document.querySelector('.send-btn');

        if (chatInput) {
            chatInput.disabled = limited;
            if (limited) {
                const t = this.getTextBundle();
                chatInput.placeholder = t['limit-placeholder'] || "Please sign in to continue...";
            }
        }
        if (sendBtn) sendBtn.disabled = limited;

        if (window.state) {
            window.state.isUsageLimited = limited;
        }
    }

    /* --- Firestore History Sync --- */

    async saveChat(chatId, chatData) {
        if (!this.currentUser || !db) return;
        try {
            await db.collection('users').doc(this.currentUser.uid)
                .collection('chats').doc(chatId).set(chatData);
        } catch (e) {
            console.error("Error saving chat:", e);
        }
    }

    async deleteChat(chatId) {
        if (!this.currentUser || !db) return;
        try {
            await db.collection('users').doc(this.currentUser.uid)
                .collection('chats').doc(chatId).delete();
        } catch (e) {
            console.error("Error deleting chat:", e);
        }
    }

    async getChats() {
        if (!this.currentUser || !db) return [];
        try {
            const snapshot = await db.collection('users').doc(this.currentUser.uid)
                .collection('chats').orderBy('timestamp', 'desc').get();
            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error("Error fetching chats:", e);
            return [];
        }
    }

    async saveImage(imageData) {
        if (!this.currentUser || !db) return;
        try {
            await db.collection('users').doc(this.currentUser.uid)
                .collection('images').doc(imageData.id).set(imageData);
        } catch (e) {
            console.error("Error saving image:", e);
        }
    }

    async deleteImage(imageId) {
        if (!this.currentUser || !db) return;
        try {
            await db.collection('users').doc(this.currentUser.uid)
                .collection('images').doc(imageId).delete();
        } catch (e) {
            console.error("Error deleting image:", e);
        }
    }

    async getImages() {
        if (!this.currentUser || !db) return [];
        try {
            const snapshot = await db.collection('users').doc(this.currentUser.uid)
                .collection('images').orderBy('timestamp', 'desc').get();
            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error("Error fetching images:", e);
            return [];
        }
    }

    async saveProject(projectId, projectData) {
        if (!this.currentUser || !db) return;
        try {
            await db.collection('users').doc(this.currentUser.uid)
                .collection('projects').doc(projectId).set(projectData);
        } catch (e) {
            console.error("Error saving project:", e);
        }
    }

    async deleteProject(projectId) {
        if (!this.currentUser || !db) return;
        try {
            await db.collection('users').doc(this.currentUser.uid)
                .collection('projects').doc(projectId).delete();
        } catch (e) {
            console.error("Error deleting project:", e);
        }
    }

    async getProjects() {
        if (!this.currentUser || !db) return [];
        try {
            const snapshot = await db.collection('users').doc(this.currentUser.uid)
                .collection('projects').orderBy('id', 'desc').get();
            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error("Error fetching projects:", e);
            return [];
        }
    }

    async saveTest(testId, testData) {
        if (!this.currentUser || !db) return;
        try {
            await db.collection('users').doc(this.currentUser.uid)
                .collection('tests').doc(testId).set(testData);
        } catch (e) {
            console.error("Error saving test:", e);
        }
    }

    async deleteTest(testId) {
        if (!this.currentUser || !db) return;
        try {
            await db.collection('users').doc(this.currentUser.uid)
                .collection('tests').doc(testId).delete();
        } catch (e) {
            console.error("Error deleting test:", e);
        }
    }

    async getTests() {
        if (!this.currentUser || !db) return [];
        try {
            const snapshot = await db.collection('users').doc(this.currentUser.uid)
                .collection('tests').orderBy('timestamp', 'desc').get();
            return snapshot.docs.map(doc => doc.data());
        } catch (e) {
            console.error("Error fetching tests:", e);
            return [];
        }
    }
}

// Instantiate Global Auth
const initAuthSystem = () => {
    if (!window.Auth) {
        window.Auth = new AuthSystem();
    }
};

if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', initAuthSystem);
} else {
    initAuthSystem();
}
