; (function () {
    'use strict';

    // ============================================================
    // STATE
    // ============================================================
    const state = {
        tabs: [],
        activeTabId: null,
        closedTabs: [],
        tabIdCounter: 0,
        runtimePlatform: '',
        isIncognito: false,
        sidebarOpen: false,
        sidebarPanel: 'bookmarks',
        settings: {},
        zoomLevels: {},
        frostTimers: {},
        frozenTabs: new Set(),
        introShown: false,
        loadTimers: {},
        commandPaletteOpen: false,
        menuOpen: false,
        downloadsList: [],
        quickAccess: [],
        automationRules: [],
        automationLastRun: {},
        appUpdate: {},
    };

    const $ = (s) => document.querySelector(s);
    const $$ = (s) => document.querySelectorAll(s);
    const bootSearchParams = new URLSearchParams(window.location.search || '');
    state.isIncognito = bootSearchParams.get('incognito') === '1';

    function syncWindowIncognitoUi() {
        const enabled = !!state.isIncognito;
        document.documentElement.classList.toggle('window-incognito', enabled);
        if (document.body) document.body.classList.toggle('window-incognito', enabled);
    }

    syncWindowIncognitoUi();

    // ============================================================
    // i18n TRANSLATIONS
    // ============================================================
    const I18N = {
        ru: {
            newTab: 'Novaya vkladka', urlPlaceholder: 'Vvedite adres ili poiskovyy zapros',
            skip: 'Propustit', minimize: 'Svernut', maximize: 'Razvernut',
            restore: 'Vosstanovit', close: 'Zakryt', back: 'Nazad',
            forward: 'Vpered', reload: 'Perezagruzit', home: 'Domoy',
            sidebar: 'Bokovaya panel', copyUrl: 'Kopirovat URL', qrCode: 'QR-kod stranitsy',
            bookmark: 'Dobavit v zakladki', clear: 'Ochistit',
            frostMode: 'Frost Mode - Freeze Tabs', tabCount: 'Open tabs',
            settingsApplied: 'Nastroyki primeneny', toggleMenu: 'Skryt/pokazat menu',
            cmNewTab: 'Novaya vkladka', cmDuplicate: 'Dublirovat', cmPin: 'Zakrepit',
            cmMute: 'Vyklyuchit zvuk', cmCloseOthers: 'Zakryt drugie',
            cmCloseRight: 'Zakryt sprava', cmCloseTab: 'Zakryt vkladku',
            menuNewTab: 'Novaya vkladka', menuNewWindow: 'Novoe okno', menuIncognito: 'Privatnoe okno',
            menuHistory: 'Istoriya', menuBookmarks: 'Zakladki', menuDownloads: 'Zagruzki',
            menuSettings: 'Nastroyki', menuFullscreen: 'Polnyy ekran', menuPrint: 'Pechat',
            menuScreenshot: 'Skrinshot', menuAlwaysOnTop: 'Poverh vseh okon', installApp: 'Ustanovit kak app',
        },
        en: {
            newTab: 'New Tab', urlPlaceholder: 'Enter address or search query',
            skip: 'Skip', minimize: 'Minimize', maximize: 'Maximize',
            restore: 'Restore', close: 'Close', back: 'Back',
            forward: 'Forward', reload: 'Reload', home: 'Home',
            sidebar: 'Sidebar', copyUrl: 'Copy URL', qrCode: 'Page QR Code',
            bookmark: 'Add Bookmark', clear: 'Clear',
            frostMode: 'Frost Mode - Freeze Tabs', tabCount: 'Open tabs',
            settingsApplied: 'Settings Applied', toggleMenu: 'Hide/show menu',
            cmNewTab: 'New Tab', cmDuplicate: 'Duplicate', cmPin: 'Pin',
            cmMute: 'Mute', cmCloseOthers: 'Close others',
            cmCloseRight: 'Close to the right', cmCloseTab: 'Close tab',
            menuNewTab: 'New Tab', menuNewWindow: 'New Window', menuIncognito: 'Incognito Window',
            menuHistory: 'History', menuBookmarks: 'Bookmarks', menuDownloads: 'Downloads',
            menuSettings: 'Settings', menuFullscreen: 'Fullscreen', menuPrint: 'Print',
            menuScreenshot: 'Screenshot', menuAlwaysOnTop: 'Always on Top', installApp: 'Install App',
        },
        uk: {
            newTab: 'Nova vkladka', urlPlaceholder: 'Vvedit adresu abo poshukovyi zapyt',
            skip: 'Propustyty', minimize: 'Zgornuty', maximize: 'Rozgornuty',
            restore: 'Vidnovyty', close: 'Zakryty', back: 'Nazad',
            forward: 'Vpered', reload: 'Perezavantazhyty', home: 'Dodomu',
            sidebar: 'Bichna panel', copyUrl: 'Kopiyuvaty URL', qrCode: 'QR-kod storinky',
            bookmark: 'Dodaty v zakladky', clear: 'Ochystyty',
            frostMode: 'Frost Mode - Freeze Tabs', tabCount: 'Open tabs',
            settingsApplied: 'Nalashtuvannya zastosovano', toggleMenu: 'Skhovaty/pokazaty menu',
            cmNewTab: 'Nova vkladka', cmDuplicate: 'Dublyuvaty', cmPin: 'Zakripyty',
            cmMute: 'Vymknuty zvuk', cmCloseOthers: 'Zakryty inshi',
            cmCloseRight: 'Zakryty pravoruch', cmCloseTab: 'Zakryty vkladku',
            menuNewTab: 'Nova vkladka', menuNewWindow: 'Nove vikno', menuIncognito: 'Pryvatne vikno',
            menuHistory: 'Istoriya', menuBookmarks: 'Zakladky', menuDownloads: 'Zavantazhennya',
            menuSettings: 'Nalashtuvannya', menuFullscreen: 'Povnyy ekran', menuPrint: 'Druk',
            menuScreenshot: 'Skrinshot', menuAlwaysOnTop: 'Poverh usih vikon', installApp: 'Vstanovyty yak app',
        },
        sk: {
            newTab: 'Nov\u00E1 karta', urlPlaceholder: 'Zadajte adresu alebo vyh\u013Ead\u00E1vac\u00ED dopyt',
            skip: 'Presko\u010Di\u0165', minimize: 'Minimalizova\u0165', maximize: 'Maximalizova\u0165',
            restore: 'Obnovi\u0165', close: 'Zatvori\u0165', back: 'Sp\u00E4\u0165',
            forward: 'Vpred', reload: 'Obnovi\u0165', home: 'Domov',
            sidebar: 'Bo\u010Dn\u00FD panel', copyUrl: 'Kop\u00EDrova\u0165 URL', qrCode: 'QR k\u00F3d str\u00E1nky',
            bookmark: 'Prida\u0165 do z\u00E1lo\u017Eiek', clear: 'Vymaza\u0165',
            frostMode: 'Frost Mode - Zmrazenie kariet', tabCount: 'Otvoren\u00FDch kariet',
            settingsApplied: 'Nastavenia boli pou\u017Eit\u00E9', toggleMenu: 'Skry\u0165/zobrazi\u0165 menu',
            cmNewTab: 'Nov\u00E1 karta', cmDuplicate: 'Duplikova\u0165', cmPin: 'Pripn\u00FA\u0165',
            cmMute: 'Stlmi\u0165 zvuk', cmCloseOthers: 'Zatvori\u0165 ostatn\u00E9',
            cmCloseRight: 'Zatvori\u0165 vpravo', cmCloseTab: 'Zatvori\u0165 kartu',
            menuNewTab: 'Nov\u00E1 karta', menuNewWindow: 'Nov\u00E9 okno', menuIncognito: 'Anonymn\u00E9 okno',
            menuHistory: 'Hist\u00F3ria', menuBookmarks: 'Z\u00E1lo\u017Eky', menuDownloads: 'Stiahnut\u00E9',
            menuSettings: 'Nastavenia', menuFullscreen: 'Cel\u00E1 obrazovka', menuPrint: 'Tla\u010Di\u0165',
            menuScreenshot: 'Sn\u00EDmka obrazovky', menuAlwaysOnTop: 'V\u017Edy navrchu', installApp: 'Nainstalovat ako app',
        }
    };
    Object.assign(I18N.ru, {
        notes: '\u0417\u0430\u043c\u0435\u0442\u043a\u0438',
        findOnPage: '\u041f\u043e\u0438\u0441\u043a \u043d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435',
        quit: '\u0412\u044b\u0445\u043e\u0434',
        unpin: '\u041e\u0442\u043a\u0440\u0435\u043f\u0438\u0442\u044c',
        unmute: '\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0437\u0432\u0443\u043a',
        restoreTab: '\u0412\u043e\u0441\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c \u0432\u043a\u043b\u0430\u0434\u043a\u0443',
        findPlaceholder: '\u041f\u043e\u0438\u0441\u043a \u043d\u0430 \u0441\u0442\u0440\u0430\u043d\u0438\u0446\u0435...',
        findPrev: '\u041f\u0440\u0435\u0434\u044b\u0434\u0443\u0449\u0438\u0439',
        findNext: '\u0421\u043b\u0435\u0434\u0443\u044e\u0449\u0438\u0439',
        findClose: '\u0417\u0430\u043a\u0440\u044b\u0442\u044c',
        updateAvailableTitle: '\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u043d\u043e\u0432\u0430\u044f \u0432\u0435\u0440\u0441\u0438\u044f {version}',
        updateDownloadingTitle: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f {version}',
        updateReadyTitle: '\u041e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0435 {version} \u0433\u043e\u0442\u043e\u0432\u043e',
        updateCheckingTitle: '\u041f\u0440\u043e\u0432\u0435\u0440\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u0439...',
        updateErrorTitle: '\u041e\u0448\u0438\u0431\u043a\u0430 \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u0438\u044f',
        updateDownloadAction: '\u041e\u0431\u043d\u043e\u0432\u0438\u0442\u044c',
        updateDownloadInProgress: '\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430...',
        updateRestartAction: '\u041f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c',
        updateRetryAction: '\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u044c',
        updateLaterAction: '\u041f\u043e\u0437\u0436\u0435',
        updateInstallingTitle: '\u0417\u0430\u043f\u0443\u0441\u043a \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0449\u0438\u043a\u0430...',
        updateMetaReady: '\u041d\u0430\u0436\u043c\u0438\u0442\u0435 \u00ab\u041f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u044c\u00bb, \u0447\u0442\u043e\u0431\u044b \u0443\u0441\u0442\u0430\u043d\u043e\u0432\u0438\u0442\u044c',
        updateMetaDownloading: '\u0417\u0430\u0433\u0440\u0443\u0436\u0435\u043d\u043e {percent}%',
        updateOpenInstallerAction: '\u041e\u0442\u043a\u0440\u044b\u0442\u044c \u043f\u0430\u043a\u0435\u0442',
        updateMetaReadyMac: '\u041e\u0442\u043a\u0440\u043e\u0439\u0442\u0435 \u043f\u0430\u043a\u0435\u0442 \u0438 \u043f\u0435\u0440\u0435\u0442\u044f\u043d\u0438\u0442\u0435 Olewser \u0432 Applications',
        updateManualInstallMac: 'macOS package opened. Move Olewser to Applications and restart.',
    });
    Object.assign(I18N.en, {
        notes: 'Notes',
        findOnPage: 'Find on Page',
        quit: 'Quit',
        unpin: 'Unpin',
        unmute: 'Unmute',
        restoreTab: 'Restore Tab',
        findPlaceholder: 'Find on page...',
        findPrev: 'Previous',
        findNext: 'Next',
        findClose: 'Close',
        updateAvailableTitle: 'New version {version} is available',
        updateDownloadingTitle: 'Downloading update {version}',
        updateReadyTitle: 'Update {version} is ready',
        updateCheckingTitle: 'Checking for updates...',
        updateErrorTitle: 'Update error',
        updateDownloadAction: 'Update',
        updateDownloadInProgress: 'Downloading...',
        updateRestartAction: 'Restart',
        updateRetryAction: 'Retry',
        updateLaterAction: 'Later',
        updateInstallingTitle: 'Launching installer...',
        updateMetaReady: 'Press Restart to install',
        updateMetaDownloading: 'Downloaded {percent}%',
        updateOpenInstallerAction: 'Open package',
        updateMetaReadyMac: 'Open the package and move Olewser to Applications',
        updateManualInstallMac: 'macOS package opened. Move Olewser to Applications and restart.',
    });
    Object.assign(I18N.uk, {
        notes: '\u041d\u043e\u0442\u0430\u0442\u043a\u0438',
        findOnPage: '\u041f\u043e\u0448\u0443\u043a \u043d\u0430 \u0441\u0442\u043e\u0440\u0456\u043d\u0446\u0456',
        quit: '\u0412\u0438\u0445\u0456\u0434',
        unpin: '\u0412\u0456\u0434\u043a\u0440\u0456\u043f\u0438\u0442\u0438',
        unmute: '\u0423\u0432\u0456\u043c\u043a\u043d\u0443\u0442\u0438 \u0437\u0432\u0443\u043a',
        restoreTab: '\u0412\u0456\u0434\u043d\u043e\u0432\u0438\u0442\u0438 \u0432\u043a\u043b\u0430\u0434\u043a\u0443',
        findPlaceholder: '\u041f\u043e\u0448\u0443\u043a \u043d\u0430 \u0441\u0442\u043e\u0440\u0456\u043d\u0446\u0456...',
        findPrev: '\u041f\u043e\u043f\u0435\u0440\u0435\u0434\u043d\u0456\u0439',
        findNext: '\u041d\u0430\u0441\u0442\u0443\u043f\u043d\u0438\u0439',
        findClose: '\u0417\u0430\u043a\u0440\u0438\u0442\u0438',
        updateAvailableTitle: '\u0414\u043e\u0441\u0442\u0443\u043f\u043d\u0430 \u043d\u043e\u0432\u0430 \u0432\u0435\u0440\u0441\u0456\u044f {version}',
        updateDownloadingTitle: '\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043d\u044f \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f {version}',
        updateReadyTitle: '\u041e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f {version} \u0433\u043e\u0442\u043e\u0432\u0435',
        updateCheckingTitle: '\u041f\u0435\u0440\u0435\u0432\u0456\u0440\u043a\u0430 \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u044c...',
        updateErrorTitle: '\u041f\u043e\u043c\u0438\u043b\u043a\u0430 \u043e\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f',
        updateDownloadAction: '\u041e\u043d\u043e\u0432\u0438\u0442\u0438',
        updateDownloadInProgress: '\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0443\u0454\u0442\u044c\u0441\u044f...',
        updateRestartAction: '\u041f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0438',
        updateRetryAction: '\u0421\u043f\u0440\u043e\u0431\u0443\u0432\u0430\u0442\u0438 \u0437\u043d\u043e\u0432\u0443',
        updateLaterAction: '\u041f\u0456\u0437\u043d\u0456\u0448\u0435',
        updateInstallingTitle: '\u0417\u0430\u043f\u0443\u0441\u043a \u0456\u043d\u0441\u0442\u0430\u043b\u044f\u0442\u043e\u0440\u0430...',
        updateMetaReady: '\u041d\u0430\u0442\u0438\u0441\u043d\u0456\u0442\u044c \u00ab\u041f\u0435\u0440\u0435\u0437\u0430\u043f\u0443\u0441\u0442\u0438\u0442\u0438\u00bb \u0434\u043b\u044f \u0432\u0441\u0442\u0430\u043d\u043e\u0432\u043b\u0435\u043d\u043d\u044f',
        updateMetaDownloading: '\u0417\u0430\u0432\u0430\u043d\u0442\u0430\u0436\u0435\u043d\u043e {percent}%',
        updateOpenInstallerAction: '\u0412\u0456\u0434\u043a\u0440\u0438\u0442\u0438 \u043f\u0430\u043a\u0435\u0442',
        updateMetaReadyMac: '\u0412\u0456\u0434\u043a\u0440\u0438\u0439\u0442\u0435 \u043f\u0430\u043a\u0435\u0442 \u0456 \u043f\u0435\u0440\u0435\u0442\u044f\u0433\u043d\u0456\u0442\u044c Olewser \u0432 Applications',
        updateManualInstallMac: 'macOS package opened. Move Olewser to Applications and restart.',
    });
    Object.assign(I18N.sk, {
        notes: '\u0050\u006f\u007a\u006e\u00e1\u006d\u006b\u0079',
        findOnPage: '\u004e\u00e1\u006a\u0073\u0165 \u006e\u0061 \u0073\u0074\u0072\u00e1\u006e\u006b\u0065',
        quit: '\u0055\u006b\u006f\u006e\u010d\u0069\u0165',
        unpin: '\u004f\u0064\u006f\u0070\u006e\u00fa\u0165',
        unmute: '\u005a\u0061\u0070\u006e\u00fa\u0165 \u007a\u0076\u0075\u006b',
        restoreTab: '\u004f\u0062\u006e\u006f\u0076\u0069\u0165 \u006b\u0061\u0072\u0074\u0075',
        findPlaceholder: '\u004e\u00e1\u006a\u0073\u0165 \u006e\u0061 \u0073\u0074\u0072\u00e1\u006e\u006b\u0065...',
        findPrev: '\u0050\u0072\u0065\u0064\u0063\u0068\u00e1\u0064\u007a\u0061\u006a\u00fa\u0063\u0069',
        findNext: '\u010e\u0061\u006c\u0161\u00ed',
        findClose: '\u005a\u0061\u0074\u0076\u006f\u0072\u0069\u0165',
        updateAvailableTitle: '\u004e\u006f\u0076\u00e1 \u0076\u0065\u0072\u007a\u0069\u0061 {version} \u006a\u0065 \u0064\u006f\u0073\u0074\u0075\u0070\u006e\u00e1',
        updateDownloadingTitle: '\u0053\u0165\u0061\u0068\u0075\u006a\u0065 \u0073\u0061 \u0061\u006b\u0074\u0075\u0061\u006c\u0069\u007a\u00e1\u0063\u0069\u0061 {version}',
        updateReadyTitle: '\u0041\u006b\u0074\u0075\u0061\u006c\u0069\u007a\u00e1\u0063\u0069\u0061 {version} \u006a\u0065 \u0070\u0072\u0069\u0070\u0072\u0061\u0076\u0065\u006e\u00e1',
        updateCheckingTitle: '\u004b\u006f\u006e\u0074\u0072\u006f\u006c\u0061 \u0061\u006b\u0074\u0075\u0061\u006c\u0069\u007a\u00e1\u0063\u0069\u00ed...',
        updateErrorTitle: '\u0043\u0068\u0079\u0062\u0061 \u0061\u006b\u0074\u0075\u0061\u006c\u0069\u007a\u00e1\u0063\u0069\u0065',
        updateDownloadAction: '\u0041\u006b\u0074\u0075\u0061\u006c\u0069\u007a\u006f\u0076\u0061\u0165',
        updateDownloadInProgress: '\u0053\u0165\u0061\u0068\u0075\u006a\u0065 \u0073\u0061...',
        updateRestartAction: '\u0052\u0065\u0161\u0074\u0061\u0072\u0074\u006f\u0076\u0061\u0165',
        updateRetryAction: '\u0053\u006b\u00fas\u0069\u0165 \u007a\u006e\u006f\u0076\u0075',
        updateLaterAction: '\u004e\u0065\u0073\u006b\u00f4\u0072',
        updateInstallingTitle: '\u0053\u0070\u00fa\u0161\u0165\u0061 \u0073\u0061 \u0069\u006e\u0161\u0074\u0061\u006c\u00e1\u0074\u006f\u0072...',
        updateMetaReady: '\u0053\u0074\u006c\u0061\u010d\u0074\u0065 \u00ab\u0052\u0065\u0161\u0074\u0061\u0072\u0074\u006f\u0076\u0061\u0165\u00bb \u006e\u0061 \u0069\u006e\u0161\u0074\u0061\u006c\u00e1\u0063\u0069\u0075',
        updateMetaDownloading: '\u0053\u0074\u0069\u0061\u0068\u006e\u0075\u0074\u00e9 {percent}%',
        updateOpenInstallerAction: '\u004f\u0074\u0076\u006f\u0072\u0069\u0165 \u0062\u0061\u006c\u00ed\u006b',
        updateMetaReadyMac: '\u004f\u0074\u0076\u006f\u0072\u0074\u0065 \u0062\u0061\u006c\u00ed\u006b \u0061 \u0070\u0072\u0065\u0073\u0075\u0148\u0074\u0065 Olewser \u0064\u006f Applications',
        updateManualInstallMac: 'macOS package opened. Move Olewser to Applications and restart.',
    });

    function normalizeLanguageCode(lang) {
        const raw = String(lang || '').trim().toLowerCase().replace('_', '-');
        const base = raw.split('-')[0];
        if (base === 'ua') return 'uk';
        if (base === 'uk' || base === 'ru' || base === 'en' || base === 'sk') return base;
        return 'sk';
    }

    function t(key) {
        const lang = normalizeLanguageCode(state.settings.language);
        return (I18N[lang] && I18N[lang][key]) || (I18N.sk && I18N.sk[key]) || (I18N.en && I18N.en[key]) || key;
    }

    function normalizeBrokenUtf8Text(value) {
        let out = String(value ?? '');
        if (!/[\u00C3\u00D0\u00D1]/.test(out)) return out;
        try {
            for (let i = 0; i < 3; i++) {
                if (!/[\u00C3\u00D0\u00D1]/.test(out)) break;
                const bytes = Uint8Array.from(Array.from(out).map(ch => ch.charCodeAt(0) & 0xff));
                out = new TextDecoder('utf-8').decode(bytes);
            }
            return out;
        } catch (_) {
            return String(value ?? '');
        }
    }

    function applyLanguage() {
        document.getElementById('url-input')?.setAttribute('placeholder', t('urlPlaceholder'));
        document.getElementById('intro-skip')?.setAttribute('title', t('skip'));
        const skip = document.getElementById('intro-skip');
        if (skip) skip.textContent = t('skip');
        document.getElementById('btn-minimize')?.setAttribute('title', t('minimize'));
        document.getElementById('btn-maximize')?.setAttribute('title', t('maximize'));
        document.getElementById('btn-close')?.setAttribute('title', t('close'));
        document.getElementById('btn-back')?.setAttribute('title', t('back'));
        document.getElementById('btn-forward')?.setAttribute('title', t('forward'));
        document.getElementById('btn-reload')?.setAttribute('title', t('reload'));
        document.getElementById('btn-home')?.setAttribute('title', t('home'));
        document.getElementById('btn-sidebar')?.setAttribute('title', t('sidebar'));
        document.getElementById('url-copy')?.setAttribute('title', t('copyUrl'));
        document.getElementById('url-qr')?.setAttribute('title', t('qrCode'));
        document.getElementById('url-bookmark')?.setAttribute('title', t('bookmark'));
        document.getElementById('btn-pwa')?.setAttribute('title', t('installApp'));
        document.getElementById('url-clear')?.setAttribute('title', t('clear'));
        document.getElementById('btn-new-tab')?.setAttribute('title', t('newTab') + ' (Ctrl+T)');
        document.getElementById('btn-fs-toggle')?.setAttribute('title', t('toggleMenu'));
        document.getElementById('tab-counter')?.setAttribute('title', t('tabCount'));
        const tabSwitcherTitleEl = document.querySelector('.tab-switcher-title');
        if (tabSwitcherTitleEl) tabSwitcherTitleEl.textContent = t('tabCount');
        if (dom.findInput) dom.findInput.placeholder = t('findPlaceholder');
        document.getElementById('find-prev')?.setAttribute('title', t('findPrev'));
        document.getElementById('find-next')?.setAttribute('title', t('findNext'));
        document.getElementById('find-close')?.setAttribute('title', t('findClose'));
        renderAppUpdateBanner();
    }

    const dom = {
        introOverlay: $('#intro-overlay'),
        introVideo: $('#intro-video'),
        introSkip: $('#intro-skip'),
        toastContainer: $('#toast-container'),
        shell: $('#browser-shell'),
        tabsContainer: $('#tabs-container'),
        tabStrip: $('#tab-strip'),
        tabCounter: $('#tab-counter'),
        tabSwitcherPanel: $('#tab-switcher-panel'),
        tabSwitcherList: $('#tab-switcher-list'),
        tabSwitcherCount: $('#tab-switcher-count'),
        btnNewTab: $('#btn-new-tab'),
        btnBack: $('#btn-back'),
        btnForward: $('#btn-forward'),
        btnReload: $('#btn-reload'),
        btnHome: $('#btn-home'),
        btnSidebar: $('#btn-sidebar'),
        urlInput: $('#url-input'),
        urlClear: $('#url-clear'),
        urlCopy: $('#url-copy'),
        urlQr: $('#url-qr'),
        urlBookmark: $('#url-bookmark'),
        urlAutocomplete: $('#url-autocomplete'),
        appUpdateBanner: $('#app-update-banner'),
        appUpdateBannerText: $('#app-update-banner-text'),
        appUpdateBannerMeta: $('#app-update-banner-meta'),
        appUpdateBannerAction: $('#app-update-banner-action'),
        appUpdateBannerDismiss: $('#app-update-banner-dismiss'),
        securityIcon: $('#security-icon'),
        pageLoadTime: $('#page-load-time'),
        loadingBar: $('#loading-bar'),
        findBar: $('#find-bar'),
        findInput: $('#find-input'),
        findCount: $('#find-count'),
        findPrev: $('#find-prev'),
        findNext: $('#find-next'),
        findClose: $('#find-close'),
        zoomIndicator: $('#zoom-indicator'),
        zoomLevel: $('#zoom-level'),
        zoomReset: $('#zoom-reset'),
        quickAccessBar: $('#quick-access-bar'),
        quickAccessAdd: $('#quick-access-add'),
        quickAccessList: $('#quick-access-list'),
        bookmarksBar: $('#bookmarks-bar'),
        bookmarksList: $('#bookmarks-list'),
        sidebar: $('#sidebar'),
        sidebarPanel: $('#sidebar-panel'),
        webviewContainer: $('#webview-container'),
        statusText: $('#status-text'),
        statusRam: $('#status-ram'),
        statusZoom: $('#status-zoom'),
        commandPalette: $('#command-palette'),
        commandInput: $('#command-input'),
        commandResults: $('#command-results'),
        pulsePanel: $('#pulse-panel'),
        pulseClose: $('#pulse-close'),
        pulseAdblockToggle: $('#pulse-adblock-toggle'),
        pulseAdblockMode: $('#pulse-adblock-mode'),
        oleksandraiPanel: $('#oleksandrai-panel'),
        oleksandraiPanelHeader: $('#oleksandrai-panel-header'),
        oleksandraiPanelClose: $('#oleksandrai-panel-close'),
        oleksandraiFrame: $('#oleksandrai-frame'),
        aiOrbContainer: $('#ai-orb-container'),
        aiOrbClose: $('#ai-orb-close'),
        aiOrbStatus: $('#ai-orb-status'),
        aiOrbVisualizer: $('#ai-orb-visualizer'),
        aiOrbSubtitle: $('#ai-orb-subtitle'),
        aiOrbEndCall: $('#ai-orb-end-call'),
        contextMenu: $('#context-menu'),
        downloadBar: $('#download-bar'),
        downloadBarName: $('#download-bar-name'),
        downloadBarStats: $('#download-bar-stats'),
        downloadBarFill: $('#download-bar-fill'),
        downloadBarClose: $('#download-bar-close'),
        btnFrost: $('#btn-frost'),
        frostBadge: $('#frost-badge'),
        btnPulse: $('#btn-pulse'),
        btnAi: $('#btn-ai'),
        btnScreenshot: $('#btn-screenshot'),
        btnPwa: $('#btn-pwa'),
        btnMenu: $('#btn-menu'),
        btnDownloads: $('#btn-downloads'),
        downloadsPanel: $('#downloads-panel'),
        downloadsPanelList: $('#downloads-panel-list'),
        downloadsOpenFolder: $('#downloads-open-folder'),
        downloadsShowAll: $('#downloads-show-all'),
        downloadsClear: $('#downloads-clear'),
        btnMinimize: $('#btn-minimize'),
        btnMaximize: $('#btn-maximize'),
        btnClose: $('#btn-close'),
    };

    // ============================================================
    // HELPERS
    // ============================================================
    function genId() { return 'tab-' + (++state.tabIdCounter); }
    function favicon(url) {
        try { return `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=32`; }
        catch { return ''; }
    }
    function isUrl(s) {
        return /^(https?:\/\/|file:\/\/|olewser:\/\/)/i.test(s) || /^[\w-]+(\.[\w-]+)+/.test(s) || /^localhost/.test(s);
    }
    function searchUrl(q) {
        const engines = { google: 'https://www.google.com/search?q=', yandex: 'https://yandex.ru/search/?text=', duckduckgo: 'https://duckduckgo.com/?q=' };
        return (engines[state.settings.searchEngine] || engines.google) + encodeURIComponent(q);
    }
    function normalizeUrl(input) {
        const s = input.trim();
        if (!s) return '';
        if (/^(olewser|https?|file):\/\//i.test(s)) return s;
        if (isUrl(s)) return 'https://' + s;
        return searchUrl(s);
    }
    function clamp(v, min, max) {
        return Math.max(min, Math.min(max, v));
    }
    function formatBytes(b) {
        if (b < 1024) return b + ' B';
        if (b < 1048576) return (b / 1024).toFixed(1) + ' KB';
        return (b / 1048576).toFixed(1) + ' MB';
    }
    function formatTime(ms) {
        const s = Math.floor(ms / 1000);
        if (s < 60) return s + 's';
        const m = Math.floor(s / 60);
        return m + 'm ' + (s % 60) + 's';
    }
    function newtabUrl() {
        const theme = state.settings.theme || 'dark';
        return `file://${window.location.pathname.replace(/[^/\\]*$/, '')}newtab.html?theme=${theme}`.replace(/\\/g, '/');
    }
    function settingsUrl() {
        return `file://${window.location.pathname.replace(/[^/\\]*$/, '')}settings.html`.replace(/\\/g, '/');
    }

    const QUICK_ACCESS_STORAGE_KEY = 'olewser.quickAccessSites';
    const QUICK_ACCESS_LIMIT = 12;

    function normalizeQuickAccessSiteUrl(raw) {
        if (!raw) return '';
        try {
            const u = new URL(raw);
            if (u.protocol !== 'http:' && u.protocol !== 'https:' && u.protocol !== 'file:') return '';
            return u.href;
        } catch {
            return '';
        }
    }

    function cleanQuickAccessTitle(title, url) {
        const text = (title || '').trim();
        if (text && !/^https?:\/\//i.test(text) && !text.includes('newtab.html')) {
            return text.slice(0, 40);
        }
        try {
            return new URL(url).hostname.replace(/^www\./, '');
        } catch {
            return 'Site';
        }
    }

    function loadQuickAccessSites() {
        try {
            const raw = localStorage.getItem(QUICK_ACCESS_STORAGE_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (!Array.isArray(parsed)) return [];
            return parsed
                .map(item => {
                    const url = normalizeQuickAccessSiteUrl(item?.url);
                    if (!url) return null;
                    return { url, title: cleanQuickAccessTitle(item?.title, url) };
                })
                .filter(Boolean)
                .slice(0, QUICK_ACCESS_LIMIT);
        } catch {
            return [];
        }
    }

    function saveQuickAccessSites() {
        localStorage.setItem(QUICK_ACCESS_STORAGE_KEY, JSON.stringify(state.quickAccess));
    }

    function getActiveTab() {
        return state.tabs.find(x => x.id === state.activeTabId) || null;
    }

    function getActiveTabCurrentUrl() {
        const tab = getActiveTab();
        if (!tab) return '';
        const wv = document.getElementById('wv-' + tab.id);

        let webviewUrl = '';
        try {
            if (wv && typeof wv.getURL === 'function') {
                webviewUrl = (wv.getURL() || '').trim();
            }
        } catch (_) {
            webviewUrl = '';
        }

        const candidate = webviewUrl || String(tab.url || '').trim();
        if (!candidate) return '';
        if (candidate.includes('newtab.html') || candidate.includes('incognito.html')) return '';
        return candidate;
    }

    function renderQuickAccess() {
        if (!dom.quickAccessList) return;
        dom.quickAccessList.innerHTML = '';
        const activeSite = normalizeQuickAccessSiteUrl(getActiveTabCurrentUrl());

        state.quickAccess.forEach((item, index) => {
            const el = document.createElement('div');
            el.className = 'quick-access-item';
            if (item.url === activeSite) el.classList.add('active');
            el.title = item.url;

            const icon = document.createElement('img');
            icon.className = 'quick-access-favicon';
            icon.src = favicon(item.url);
            icon.onerror = function () { this.style.display = 'none'; };

            const title = document.createElement('span');
            title.className = 'quick-access-title';
            title.textContent = item.title;

            const removeBtn = document.createElement('button');
            removeBtn.className = 'quick-access-remove';
            removeBtn.type = 'button';
            removeBtn.title = 'Remove';
            removeBtn.textContent = 'x';

            el.appendChild(icon);
            el.appendChild(title);
            el.appendChild(removeBtn);

            el.addEventListener('click', (e) => {
                if (e.target.closest('.quick-access-remove')) return;
                navigate(item.url);
            });

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                state.quickAccess.splice(index, 1);
                saveQuickAccessSites();
                renderQuickAccess();
            });

            dom.quickAccessList.appendChild(el);
        });
    }

    function addCurrentSiteToQuickAccess() {
        const tab = getActiveTab();
        if (!tab || tab.incognito) {
            toast('Open a normal website tab first');
            return;
        }

        const siteUrl = normalizeQuickAccessSiteUrl(getActiveTabCurrentUrl());
        if (!siteUrl) {
            toast('This page cannot be saved to quick access');
            return;
        }

        if (state.quickAccess.some(item => item.url === siteUrl)) {
            toast('Site already in quick access');
            return;
        }

        const item = { url: siteUrl, title: cleanQuickAccessTitle(tab.title, siteUrl) };
        state.quickAccess.unshift(item);
        if (state.quickAccess.length > QUICK_ACCESS_LIMIT) {
            state.quickAccess = state.quickAccess.slice(0, QUICK_ACCESS_LIMIT);
        }
        saveQuickAccessSites();
        renderQuickAccess();
        toast('Added to quick access', 'success');
    }

    function isPwaInstallableUrl(value) {
        try {
            const parsed = new URL(String(value || '').trim());
            return parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'file:';
        } catch (_) {
            return false;
        }
    }

    async function installCurrentSiteAsApp() {
        const tab = getActiveTab();
        if (!tab || tab.incognito) {
            toast('Open a normal website tab first', 'error');
            return;
        }

        const siteUrl = getActiveTabCurrentUrl();
        if (!siteUrl || !isPwaInstallableUrl(siteUrl)) {
            toast('This page cannot be installed as app', 'error');
            return;
        }

        if (!window.olewser?.actions?.installPwa) {
            toast('PWA installer is not available', 'error');
            return;
        }

        const appTitle = cleanQuickAccessTitle(tab.title || '', siteUrl);
        dom.btnPwa?.classList.add('active');
        try {
            const result = await window.olewser.actions.installPwa({ url: siteUrl, title: appTitle });
            if (result && result.success) {
                toast(`App shortcut created: ${result.path}`, 'success');
            } else {
                toast(result?.error || 'Failed to install app shortcut', 'error');
            }
        } catch (err) {
            toast(`Install failed: ${err.message || err}`, 'error');
        } finally {
            setTimeout(() => dom.btnPwa?.classList.remove('active'), 600);
        }
    }

    // ============================================================
    // TOAST
    // ============================================================
    function toast(msg, type = 'info') {
        const el = document.createElement('div');
        el.className = `toast ${type}`;
        el.textContent = msg;
        dom.toastContainer.appendChild(el);
        setTimeout(() => el.remove(), 3000);
    }

    const UPDATE_BANNER_DISMISS_KEY = 'olewser_update_banner_dismissed_version';

    function getDismissedUpdateVersion() {
        try {
            return String(localStorage.getItem(UPDATE_BANNER_DISMISS_KEY) || '');
        } catch (_) {
            return '';
        }
    }

    function setDismissedUpdateVersion(version) {
        try {
            localStorage.setItem(UPDATE_BANNER_DISMISS_KEY, String(version || ''));
        } catch (_) {
            // Ignore storage failures
        }
    }

    function fillTemplate(template, values) {
        return String(template || '').replace(/\{(\w+)\}/g, (_, key) => {
            return Object.prototype.hasOwnProperty.call(values || {}, key) ? String(values[key]) : '';
        });
    }

    function getUpdatePercent(update) {
        const total = Number(update.downloadTotalBytes || 0);
        const received = Number(update.downloadReceivedBytes || 0);
        if (!total || total <= 0) return 0;
        return Math.max(0, Math.min(100, Math.round((received / total) * 100)));
    }

    function isMacRuntime() {
        return state.runtimePlatform === 'darwin';
    }

    function getAppUpdateTitle(update) {
        const version = update.latestVersion || '';
        const status = String(update.status || '');
        if (status === 'available') return fillTemplate(t('updateAvailableTitle'), { version });
        if (status === 'downloading') return fillTemplate(t('updateDownloadingTitle'), { version });
        if (status === 'ready') return fillTemplate(t('updateReadyTitle'), { version });
        if (status === 'installing') return t('updateInstallingTitle');
        if (status === 'checking') return t('updateCheckingTitle');
        if (status === 'error') return t('updateErrorTitle');
        return '';
    }

    function getAppUpdateMeta(update) {
        const status = String(update.status || '');
        if (status === 'downloading') {
            return fillTemplate(t('updateMetaDownloading'), { percent: getUpdatePercent(update) });
        }
        if (status === 'ready') {
            if (isMacRuntime()) return t('updateMetaReadyMac');
            return t('updateMetaReady');
        }
        if (status === 'error') {
            return String(update.error || '');
        }
        return String(update.notes || '');
    }

    function getAppUpdatePrimaryLabel(update) {
        const status = String(update.status || '');
        if (status === 'available') return t('updateDownloadAction');
        if (status === 'downloading') return t('updateDownloadInProgress');
        if (status === 'ready') return isMacRuntime() ? t('updateOpenInstallerAction') : t('updateRestartAction');
        if (status === 'installing') return t('updateInstallingTitle');
        if (status === 'error') return t('updateRetryAction');
        return t('updateDownloadAction');
    }

    function renderAppUpdateBanner() {
        if (!dom.appUpdateBanner || !dom.appUpdateBannerText || !dom.appUpdateBannerMeta || !dom.appUpdateBannerAction || !dom.appUpdateBannerDismiss) return;
        const update = state.appUpdate || {};
        const status = String(update.status || '');
        const visibleStates = new Set(['available', 'downloading', 'ready', 'installing']);

        if (!visibleStates.has(status)) {
            dom.appUpdateBanner.style.display = 'none';
            dom.appUpdateBanner.removeAttribute('data-state');
            return;
        }

        const dismissedVersion = getDismissedUpdateVersion();
        if (status === 'available' && dismissedVersion && dismissedVersion === String(update.latestVersion || '')) {
            dom.appUpdateBanner.style.display = 'none';
            dom.appUpdateBanner.removeAttribute('data-state');
            return;
        }

        dom.appUpdateBanner.style.display = '';
        dom.appUpdateBanner.dataset.state = status;
        dom.appUpdateBannerText.textContent = getAppUpdateTitle(update);
        dom.appUpdateBannerMeta.textContent = getAppUpdateMeta(update);

        dom.appUpdateBannerAction.textContent = getAppUpdatePrimaryLabel(update);
        dom.appUpdateBannerAction.disabled = status === 'downloading' || status === 'installing';

        const canDismiss = status === 'available';
        dom.appUpdateBannerDismiss.style.display = canDismiss ? '' : 'none';
        dom.appUpdateBannerDismiss.textContent = t('updateLaterAction');
    }

    async function onAppUpdatePrimaryAction() {
        if (!window.olewser?.updates) return;
        const status = String((state.appUpdate && state.appUpdate.status) || '');
        try {
            if (status === 'available') {
                await window.olewser.updates.startDownload();
            } else if (status === 'ready') {
                const result = await window.olewser.updates.install();
                if (result && result.requiresManualInstall) {
                    toast(t('updateManualInstallMac'), 'info');
                }
            } else if (status === 'error') {
                await window.olewser.updates.check(true);
            } else if (status !== 'downloading' && status !== 'installing') {
                await window.olewser.updates.check(true);
            }
        } catch (err) {
            const message = (err && err.message) ? err.message : 'Update action failed';
            toast(message, 'error');
        }
    }

    function dismissAppUpdateBanner() {
        const latestVersion = String((state.appUpdate && state.appUpdate.latestVersion) || '');
        if (latestVersion) setDismissedUpdateVersion(latestVersion);
        renderAppUpdateBanner();
    }

    async function initAppUpdateBanner() {
        if (!window.olewser?.updates) return;

        dom.appUpdateBannerAction?.addEventListener('click', onAppUpdatePrimaryAction);
        dom.appUpdateBannerDismiss?.addEventListener('click', dismissAppUpdateBanner);

        window.olewser.updates.onState((nextState) => {
            state.appUpdate = nextState || {};
            const latest = String(state.appUpdate.latestVersion || '');
            if (latest && getDismissedUpdateVersion() !== latest && state.appUpdate.status === 'available') {
                setDismissedUpdateVersion('');
            }
            renderAppUpdateBanner();
        });

        try {
            state.appUpdate = await window.olewser.updates.getState();
            renderAppUpdateBanner();
        } catch (_) {
            // Keep silent if updater is unavailable
        }

        window.olewser.updates.check(false).catch(() => { });
    }

    const AUTOMATION_RULES_KEY = 'olewser_ai_automation_rules_v1';

    function safeJsonParse(raw, fallback) {
        try {
            const parsed = JSON.parse(raw);
            return parsed ?? fallback;
        } catch (_) {
            return fallback;
        }
    }

    function extractDomainFromUrl(rawUrl) {
        try {
            return new URL(String(rawUrl || '').trim()).hostname.toLowerCase();
        } catch (_) {
            return '';
        }
    }

    function loadAutomationRules() {
        const parsed = safeJsonParse(localStorage.getItem(AUTOMATION_RULES_KEY) || '[]', []);
        state.automationRules = Array.isArray(parsed) ? parsed : [];
    }

    function saveAutomationRules() {
        localStorage.setItem(AUTOMATION_RULES_KEY, JSON.stringify(state.automationRules || []));
    }

    function collectOpenTabsDigestPayload() {
        return state.tabs
            .map((tab) => ({
                id: tab.id,
                title: tab.title || '',
                url: tab.url || '',
                active: tab.id === state.activeTabId,
                pinned: !!tab.pinned,
                sleeping: !!tab.sleeping
            }))
            .filter((tab) => tab.url && !/newtab\.html|settings\.html|incognito\.html/i.test(tab.url));
    }

    function requestDailyDigestFromOpenTabs() {
        const tabs = collectOpenTabsDigestPayload();
        if (!tabs.length) {
            toast('No open tabs for digest');
            return;
        }
        openAiPanelAndRun('daily-digest', { tabs });
    }

    function createAutomationRuleForCurrentSite() {
        const active = getActiveTab();
        const currentUrl = getActiveTabCurrentUrl() || active?.url || '';
        const domain = extractDomainFromUrl(currentUrl);
        if (!domain) {
            toast('Open a website tab first');
            return;
        }

        const choice = prompt(
            'Automation action for this site:\n1. Reader Mode+\n2. AI Analyze page\n3. AI Extract prices\n4. AI Extract contacts\n5. Strict ad/tracker protection',
            '1'
        );
        const normalized = String(choice || '1').trim();
        const action = normalized === '2'
            ? 'analyze-open-page'
            : normalized === '3'
                ? 'page-agent-prices'
                : normalized === '4'
                    ? 'page-agent-contacts'
                    : normalized === '5'
                        ? 'strict-protection'
                        : 'reader-plus';

        const existing = state.automationRules.find((rule) => rule.domain === domain && rule.action === action);
        if (!existing) {
            state.automationRules.push({
                id: `rule_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
                domain,
                action,
                createdAt: Date.now()
            });
            saveAutomationRules();
            toast(`Automation saved for ${domain}`, 'success');
        } else {
            toast('Rule already exists');
        }
    }

    function listAutomationRules() {
        if (!state.automationRules.length) {
            toast('No automation rules yet');
            return;
        }
        const lines = state.automationRules
            .slice(0, 20)
            .map((rule, idx) => `${idx + 1}. ${rule.domain} -> ${rule.action}`);
        alert(`Automation rules:\n\n${lines.join('\n')}`);
    }

    function clearAutomationRules() {
        if (!state.automationRules.length) {
            toast('No rules to clear');
            return;
        }
        if (!confirm('Delete all automation rules?')) return;
        state.automationRules = [];
        saveAutomationRules();
        toast('Automation rules cleared', 'success');
    }

    function runAutomationForUrl(url) {
        const domain = extractDomainFromUrl(url);
        if (!domain) return;
        const now = Date.now();
        const matching = state.automationRules.filter((rule) => rule.domain === domain);
        if (!matching.length) return;

        matching.forEach((rule) => {
            const cooldownKey = `${domain}:${rule.action}`;
            const lastAt = Number(state.automationLastRun[cooldownKey] || 0);
            if (now - lastAt < 30000) return;
            state.automationLastRun[cooldownKey] = now;

            if (rule.action === 'reader-plus') {
                openAiPanelAndRun('reader-plus', { customInstruction: `Automation rule for ${domain}` });
            } else if (rule.action === 'analyze-open-page') {
                openAiPanelAndRun('analyze-open-page', { customInstruction: `Automation rule for ${domain}` });
            } else if (rule.action === 'page-agent-prices') {
                openAiPanelAndRun('page-agent', { task: 'prices', customInstruction: `Automation rule for ${domain}` });
            } else if (rule.action === 'page-agent-contacts') {
                openAiPanelAndRun('page-agent', { task: 'contacts', customInstruction: `Automation rule for ${domain}` });
            } else if (rule.action === 'strict-protection') {
                const nextSettings = {
                    ...(state.settings || {}),
                    popupBlocking: true,
                    trackingProtection: 'strict',
                    fingerprintProtection: true,
                    doNotTrack: true
                };
                state.settings = nextSettings;
                window.olewser.settings.save(nextSettings).catch(() => { });
                toast(`Strict protection applied for ${domain}`, 'success');
            }
        });
    }

    // ============================================================
    // TABS
    // ============================================================
    let _preloadPath = ''; // Cached preload path from main process

    function createTab(url = '', opts = {}) {
        const isIncog = !!opts.incognito || !!state.isIncognito;
        // Block creating duplicate OLEWSER home tabs (unless forced)
        const isHomeTab = !url && !isIncog;
        if (isHomeTab && !opts._force) {
            const existing = state.tabs.find(tab => !tab.url || tab.url.includes('newtab.html'));
            if (existing) { switchTab(existing.id); return existing.id; }
        }

        const id = genId();
        const tab = {
            id, url: url || '', title: isIncog ? t('menuIncognito') : (isHomeTab ? 'OLEWSER' : (opts.title || t('newTab'))),
            favicon: url ? favicon(url) : '', loading: false,
            canGoBack: false, canGoForward: false,
            pinned: opts.pinned || false, muted: false, audible: false, zoom: 1,
            incognito: isIncog,
            sleeping: false,
            sleepUrl: '',
            sleepTitle: '',
        };
        state.tabs.push(tab);

        const wv = document.createElement('webview');
        wv.id = 'wv-' + id;
        if (isIncog) wv.setAttribute('partition', 'incognito-' + id);
        wv.setAttribute('allowpopups', '');
        wv.setAttribute('webpreferences', 'contextIsolation=yes');
        // Prevent Windows passkey modal from hijacking Google sign-in flows.
        wv.setAttribute('disableblinkfeatures', 'WebAuthentication');
        // Add preload for local file:// URLs so they get window.olewser API
        const targetUrl = url || (isIncog ? incognitoUrl() : newtabUrl());
        if (targetUrl.startsWith('file://') && _preloadPath) {
            wv.setAttribute('preload', 'file:///' + _preloadPath.replace(/\\/g, '/'));
        }
        wv.src = targetUrl;
        dom.webviewContainer.appendChild(wv);
        setupWebview(id, wv);
        renderTabElement(tab);
        switchTab(id);
        updateTabCounter();
        if (state.tabs.length >= (state.settings.tabCountWarning || 50))
            toast(`${t('tabCount')}: ${state.tabs.length}`, 'error');
        return id;
    }

    function dismissPanelsForNewTab() {
        hideContextMenu();
        hideTabSwitcherPanel();
        if (dom.pulsePanel) dom.pulsePanel.style.display = 'none';
        if (dom.downloadsPanel) dom.downloadsPanel.style.display = 'none';
        if (dom.commandPalette && dom.commandPalette.style.display !== 'none') toggleCommandPalette();
        if (dom.findBar && dom.findBar.style.display !== 'none') toggleFindBar();
        if (dom.oleksandraiPanel && dom.oleksandraiPanel.classList.contains('open')) closeOleksandraiPanel();
        if (typeof aiState !== 'undefined' && aiState && aiState.isActive) closeAiVoiceAgent();
    }

    function openNewTabFromUser(url = '') {
        dismissPanelsForNewTab();
        if (url) return createTab(url);
        return createTab('', { _force: true, incognito: state.isIncognito });
    }

    function incognitoUrl() {
        return 'file:///' + __dirname.replace(/\\/g, '/') + '/incognito.html';
    }

    function createIncognitoTab() {
        dismissPanelsForNewTab();
        createTab('', { incognito: true });
    }

    function renderTabElement(tab) {
        const el = document.createElement('div');
        el.className = 'tab' + (tab.pinned ? ' pinned' : '') + (tab.incognito ? ' incognito' : '') + (tab.sleeping ? ' sleeping' : '');
        el.id = 'tab-el-' + tab.id;
        el.dataset.tabId = tab.id;
        el.draggable = true;
        el.innerHTML = `
      <div class="tab-loading" id="tab-load-${tab.id}"></div>
      <img class="tab-favicon" id="tab-fav-${tab.id}" src="${tab.favicon || ''}" onerror="this.style.display='none'" style="${tab.favicon ? '' : 'display:none'}">
      <span class="tab-title" id="tab-title-${tab.id}">${tab.title}</span>
      <span class="tab-audio" id="tab-audio-${tab.id}" title="${t('cmMute')}"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg></span>
      <span class="tab-close" id="tab-close-${tab.id}" title="${t('close')}"><svg width="10" height="10" viewBox="0 0 10 10"><path d="M2 2l6 6M8 2l-6 6" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg></span>
    `;
        el.addEventListener('click', (e) => {
            if (e.target.closest('.tab-close')) { closeTab(tab.id); return; }
            if (e.target.closest('.tab-audio')) { toggleMute(tab.id); return; }
            switchTab(tab.id);
        });
        el.addEventListener('auxclick', (e) => { if (e.button === 1) closeTab(tab.id); });
        el.addEventListener('contextmenu', (e) => { e.preventDefault(); showTabContextMenu(e, tab.id); });
        el.addEventListener('dragstart', (e) => { e.dataTransfer.setData('text/plain', tab.id); el.style.opacity = '0.5'; });
        el.addEventListener('dragend', () => { el.style.opacity = '1'; });
        el.addEventListener('dragover', (e) => { e.preventDefault(); el.style.borderLeft = '2px solid var(--accent)'; });
        el.addEventListener('dragleave', () => { el.style.borderLeft = ''; });
        el.addEventListener('drop', (e) => { e.preventDefault(); el.style.borderLeft = ''; reorderTab(e.dataTransfer.getData('text/plain'), tab.id); });
        dom.tabsContainer.appendChild(el);
    }

    function ensureTabVisible(id, behavior = 'smooth') {
        const strip = dom.tabStrip;
        const el = document.getElementById('tab-el-' + id);
        if (!strip || !el) return;

        const reserveRight = (dom.btnNewTab?.offsetWidth || 0) + 14;
        const currentLeft = strip.scrollLeft;
        const visibleLeft = currentLeft + 8;
        const visibleRight = currentLeft + strip.clientWidth - reserveRight - 8;
        const tabLeft = el.offsetLeft;
        const tabRight = tabLeft + el.offsetWidth;

        let nextLeft = null;
        if (tabLeft < visibleLeft) {
            nextLeft = tabLeft - 12;
        } else if (tabRight > visibleRight) {
            nextLeft = tabRight - (strip.clientWidth - reserveRight) + 12;
        }

        if (nextLeft !== null) {
            strip.scrollTo({ left: Math.max(0, nextLeft), behavior });
        }
    }

    function switchTab(id) {
        state.activeTabId = id;
        state.tabs.forEach(t => {
            const el = document.getElementById('tab-el-' + t.id);
            const wv = document.getElementById('wv-' + t.id);
            if (el) el.classList.toggle('active', t.id === id);
            if (wv) wv.classList.toggle('active', t.id === id);
        });
        const tab = state.tabs.find(t => t.id === id);
        if (tab) {
            if (tab.sleeping) {
                wakeTab(id);
            }
            dom.urlInput.value = tab.url && !tab.url.includes('newtab.html') ? tab.url : '';
            dom.btnBack.disabled = !tab.canGoBack;
            dom.btnForward.disabled = !tab.canGoForward;
            updateSecurityIcon(tab.url);
            dom.statusZoom.textContent = Math.round((state.zoomLevels[id] || 1) * 100) + '%';
        }
        if (state.frozenTabs.has(id)) { state.frozenTabs.delete(id); updateFrostBadge(); }
        renderQuickAccess();
        refreshTabSwitcherIfOpen();
        ensureTabVisible(id, 'smooth');
    }

    function closeTab(id) {
        const idx = state.tabs.findIndex(t => t.id === id);
        if (idx < 0) return;
        const tab = state.tabs[idx];
        state.closedTabs.push({ ...tab, closedAt: Date.now() });
        if (state.closedTabs.length > 20) state.closedTabs.shift();
        state.tabs.splice(idx, 1);
        document.getElementById('tab-el-' + id)?.remove();
        document.getElementById('wv-' + id)?.remove();
        clearTimeout(state.frostTimers[id]);
        state.frozenTabs.delete(id);
        state.activeTabId = null;

        if (state.tabs.length === 0) createTab('', { _force: true, incognito: state.isIncognito });
        else if (state.activeTabId === null || state.activeTabId === id) switchTab(state.tabs[Math.min(idx, state.tabs.length - 1)].id);
        updateTabCounter();
    }

    function restoreClosedTab() {
        const last = state.closedTabs.pop();
        if (last) createTab(last.url, { title: last.title });
    }
    function duplicateTab(id) { const t = state.tabs.find(x => x.id === id); if (t) createTab(t.url); }
    function pinTab(id) {
        const t = state.tabs.find(x => x.id === id);
        if (t) { t.pinned = !t.pinned; document.getElementById('tab-el-' + id)?.classList.toggle('pinned', t.pinned); }
    }
    function toggleMute(id) {
        const t = state.tabs.find(x => x.id === id);
        const wv = document.getElementById('wv-' + id);
        if (t && wv) {
            t.muted = !t.muted;
            wv.setAudioMuted(t.muted);
            // Update icon inline - no toast spam
            const el = document.getElementById('tab-audio-' + id);
            if (el) {
                el.innerHTML = t.muted
                    ? '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>'
                    : '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 5L6 9H2v6h4l5 4V5z"/><path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/></svg>';
            }
        }
    }

    function sleepTab(id) {
        const tab = state.tabs.find(x => x.id === id);
        const wv = document.getElementById('wv-' + id);
        if (!tab || !wv || tab.sleeping) return false;
        if (!tab.url || /newtab\.html|settings\.html|incognito\.html/i.test(tab.url)) return false;

        let currentUrl = '';
        try {
            currentUrl = (wv.getURL && wv.getURL()) || tab.url || '';
        } catch (_) {
            currentUrl = tab.url || '';
        }
        if (!currentUrl || /about:blank/i.test(currentUrl)) return false;

        tab.sleepUrl = currentUrl;
        tab.sleepTitle = tab.title || '';
        tab.sleeping = true;
        tab.url = currentUrl;
        tab.title = `[sleep] ${tab.sleepTitle || 'Sleeping tab'}`;

        const titleEl = document.getElementById('tab-title-' + id);
        if (titleEl) titleEl.textContent = tab.title;
        const tabEl = document.getElementById('tab-el-' + id);
        if (tabEl) tabEl.classList.add('sleeping');

        wv.src = 'about:blank';
        return true;
    }

    function wakeTab(id) {
        const tab = state.tabs.find(x => x.id === id);
        const wv = document.getElementById('wv-' + id);
        if (!tab || !wv || !tab.sleeping) return false;

        const restoreUrl = tab.sleepUrl || tab.url;
        tab.sleeping = false;
        tab.url = restoreUrl || tab.url;
        tab.title = tab.sleepTitle || tab.title || t('newTab');
        tab.sleepTitle = '';
        tab.sleepUrl = '';

        const titleEl = document.getElementById('tab-title-' + id);
        if (titleEl) titleEl.textContent = tab.title;
        const tabEl = document.getElementById('tab-el-' + id);
        if (tabEl) tabEl.classList.remove('sleeping');

        if (restoreUrl) {
            wv.src = restoreUrl;
        }
        return true;
    }

    function sleepInactiveTabs() {
        let count = 0;
        state.tabs.forEach((tab) => {
            if (tab.id !== state.activeTabId && !tab.pinned && sleepTab(tab.id)) {
                count += 1;
            }
        });
        toast(count ? `Put ${count} tabs to sleep` : 'No tabs to sleep', count ? 'success' : 'info');
    }

    function wakeAllSleepingTabs() {
        let count = 0;
        state.tabs.forEach((tab) => {
            if (tab.sleeping && wakeTab(tab.id)) {
                count += 1;
            }
        });
        toast(count ? `Woke ${count} tabs` : 'No sleeping tabs');
    }

    function reorderTab(fromId, toId) {
        const fi = state.tabs.findIndex(t => t.id === fromId), ti = state.tabs.findIndex(t => t.id === toId);
        if (fi < 0 || ti < 0) return;
        const [moved] = state.tabs.splice(fi, 1);
        state.tabs.splice(ti, 0, moved);
        state.tabs.forEach(t => { const el = document.getElementById('tab-el-' + t.id); if (el) dom.tabsContainer.appendChild(el); });
        if (state.activeTabId) ensureTabVisible(state.activeTabId, 'auto');
        refreshTabSwitcherIfOpen();
    }
    function updateTabCounter() {
        dom.tabCounter.textContent = state.tabs.length;
        refreshTabSwitcherIfOpen();
    }

    function switchRelativeTab(delta) {
        if (!state.tabs.length) return;
        const currentIndex = state.tabs.findIndex((tab) => tab.id === state.activeTabId);
        const startIndex = currentIndex >= 0 ? currentIndex : 0;
        const nextIndex = (startIndex + delta + state.tabs.length) % state.tabs.length;
        const nextTab = state.tabs[nextIndex];
        if (nextTab) switchTab(nextTab.id);
    }

    function isTabSwitcherVisible() {
        return !!dom.tabSwitcherPanel && dom.tabSwitcherPanel.style.display !== 'none';
    }

    function getTabSwitcherUrlLabel(tab) {
        const raw = String(tab.url || '');
        if (!raw || /newtab\.html|settings\.html|incognito\.html/i.test(raw)) {
            return tab.incognito ? (t('menuIncognito') || 'Incognito') : 'OLEWSER';
        }
        return raw;
    }

    function renderTabSwitcherList() {
        if (!dom.tabSwitcherList) return;
        dom.tabSwitcherList.innerHTML = '';
        if (dom.tabSwitcherCount) dom.tabSwitcherCount.textContent = String(state.tabs.length);

        if (!state.tabs.length) {
            const empty = document.createElement('div');
            empty.className = 'tab-switcher-empty';
            empty.textContent = 'No tabs';
            dom.tabSwitcherList.appendChild(empty);
            return;
        }

        state.tabs.forEach((tab) => {
            const item = document.createElement('div');
            item.className = 'tab-switcher-item' + (tab.id === state.activeTabId ? ' active' : '');
            item.dataset.tabId = tab.id;

            if (tab.favicon) {
                const favicon = document.createElement('img');
                favicon.className = 'tab-switcher-item-favicon';
                favicon.src = tab.favicon;
                favicon.alt = '';
                favicon.onerror = () => {
                    favicon.replaceWith(Object.assign(document.createElement('span'), { className: 'tab-switcher-item-fallback' }));
                };
                item.appendChild(favicon);
            } else {
                const fallback = document.createElement('span');
                fallback.className = 'tab-switcher-item-fallback';
                item.appendChild(fallback);
            }

            const textWrap = document.createElement('div');
            textWrap.className = 'tab-switcher-item-text';

            const title = document.createElement('div');
            title.className = 'tab-switcher-item-title';
            title.textContent = tab.title || t('newTab');

            const url = document.createElement('div');
            url.className = 'tab-switcher-item-url';
            url.textContent = getTabSwitcherUrlLabel(tab);

            textWrap.appendChild(title);
            textWrap.appendChild(url);
            item.appendChild(textWrap);

            item.addEventListener('click', () => {
                switchTab(tab.id);
                hideTabSwitcherPanel();
            });
            item.addEventListener('auxclick', (e) => {
                if (e.button !== 1) return;
                e.preventDefault();
                closeTab(tab.id);
            });

            dom.tabSwitcherList.appendChild(item);
        });
    }

    let _tabSwitcherOutsideHandler = null;
    let _tabSwitcherBlurHandler = null;

    function showTabSwitcherPanel() {
        if (!dom.tabSwitcherPanel || !dom.tabCounter) return;
        hideContextMenu();
        dom.pulsePanel.style.display = 'none';
        if (dom.downloadsPanel) dom.downloadsPanel.style.display = 'none';

        renderTabSwitcherList();
        dom.tabSwitcherPanel.style.display = '';

        const anchor = dom.tabCounter.getBoundingClientRect();
        const bw = document.body.clientWidth;
        const bh = document.body.clientHeight;
        const pw = dom.tabSwitcherPanel.offsetWidth || 340;
        const ph = dom.tabSwitcherPanel.offsetHeight || 360;
        let left = Math.min(Math.max(8, anchor.left), bw - pw - 8);
        let top = anchor.bottom + 8;
        if (top + ph > bh - 8) top = Math.max(8, anchor.top - ph - 8);
        dom.tabSwitcherPanel.style.left = `${left}px`;
        dom.tabSwitcherPanel.style.top = `${top}px`;

        if (_tabSwitcherOutsideHandler) {
            document.removeEventListener('mousedown', _tabSwitcherOutsideHandler, true);
            document.removeEventListener('click', _tabSwitcherOutsideHandler, true);
        }
        _tabSwitcherOutsideHandler = (e) => {
            if (!isTabSwitcherVisible()) return;
            if (!dom.tabSwitcherPanel.contains(e.target) && !dom.tabCounter.contains(e.target)) {
                hideTabSwitcherPanel();
            }
        };
        setTimeout(() => {
            document.addEventListener('mousedown', _tabSwitcherOutsideHandler, true);
            document.addEventListener('click', _tabSwitcherOutsideHandler, true);
        }, 0);

        if (_tabSwitcherBlurHandler) window.removeEventListener('blur', _tabSwitcherBlurHandler);
        _tabSwitcherBlurHandler = () => hideTabSwitcherPanel();
        window.addEventListener('blur', _tabSwitcherBlurHandler);
    }

    function hideTabSwitcherPanel() {
        if (!dom.tabSwitcherPanel) return;
        dom.tabSwitcherPanel.style.display = 'none';
        if (_tabSwitcherOutsideHandler) {
            document.removeEventListener('mousedown', _tabSwitcherOutsideHandler, true);
            document.removeEventListener('click', _tabSwitcherOutsideHandler, true);
            _tabSwitcherOutsideHandler = null;
        }
        if (_tabSwitcherBlurHandler) {
            window.removeEventListener('blur', _tabSwitcherBlurHandler);
            _tabSwitcherBlurHandler = null;
        }
    }

    function toggleTabSwitcherPanel() {
        if (isTabSwitcherVisible()) hideTabSwitcherPanel();
        else showTabSwitcherPanel();
    }

    function refreshTabSwitcherIfOpen() {
        if (!isTabSwitcherVisible()) return;
        renderTabSwitcherList();
    }

    function initTabStripDragScroll() {
        if (!dom.tabStrip) return;
        let dragging = false;
        let pointerId = null;
        let startX = 0;
        let startScrollLeft = 0;

        const stopDragging = () => {
            if (!dragging) return;
            dragging = false;
            pointerId = null;
            dom.tabStrip.classList.remove('dragging-scroll');
        };

        dom.tabStrip.addEventListener('pointerdown', (e) => {
            if (e.button !== 0) return;
            if (e.target.closest('.tab') || e.target.closest('.btn-new-tab')) return;
            dragging = true;
            pointerId = e.pointerId;
            startX = e.clientX;
            startScrollLeft = dom.tabStrip.scrollLeft;
            dom.tabStrip.classList.add('dragging-scroll');
            if (typeof dom.tabStrip.setPointerCapture === 'function') {
                try { dom.tabStrip.setPointerCapture(pointerId); } catch (_) { }
            }
        });

        dom.tabStrip.addEventListener('pointermove', (e) => {
            if (!dragging) return;
            if (pointerId !== null && e.pointerId !== pointerId) return;
            const delta = e.clientX - startX;
            dom.tabStrip.scrollLeft = startScrollLeft - delta;
        });

        dom.tabStrip.addEventListener('pointerup', stopDragging);
        dom.tabStrip.addEventListener('pointercancel', stopDragging);
        dom.tabStrip.addEventListener('lostpointercapture', stopDragging);
        window.addEventListener('blur', stopDragging);
    }

    // ============================================================
    // WEBVIEW SETUP
    // ============================================================
    function setupWebview(id, wv) {
        const updateNav = () => {
            const t = state.tabs.find(x => x.id === id);
            if (!t) return;
            t.canGoBack = wv.canGoBack(); t.canGoForward = wv.canGoForward();
            if (state.activeTabId === id) { dom.btnBack.disabled = !t.canGoBack; dom.btnForward.disabled = !t.canGoForward; }
        };

        wv.addEventListener('did-start-loading', () => {
            const t = state.tabs.find(x => x.id === id); if (t) t.loading = true;
            const ld = document.getElementById('tab-load-' + id); if (ld) ld.style.display = 'block';
            const fv = document.getElementById('tab-fav-' + id); if (fv) fv.style.display = 'none';
            if (state.activeTabId === id) dom.loadingBar.classList.add('active');
            state.loadTimers[id] = Date.now();
        });

        wv.addEventListener('did-stop-loading', () => {
            const t = state.tabs.find(x => x.id === id); if (t) t.loading = false;
            const ld = document.getElementById('tab-load-' + id); if (ld) ld.style.display = 'none';
            if (state.activeTabId === id) dom.loadingBar.classList.remove('active');
            updateNav();
            if (state.loadTimers[id] && state.activeTabId === id) {
                const ms = Date.now() - state.loadTimers[id];
                dom.pageLoadTime.textContent = ms + 'ms';
                dom.pageLoadTime.style.display = '';
                setTimeout(() => { dom.pageLoadTime.style.display = 'none'; }, 4000);
            }
            resetFrostTimer(id);
        });

        wv.addEventListener('did-navigate', (e) => {
            const t = state.tabs.find(x => x.id === id);
            if (t) { t.url = e.url; }
            if (t?.sleeping && /^about:blank/i.test(e.url || '')) {
                updateNav();
                return;
            }
            if (state.activeTabId === id) {
                dom.urlInput.value = e.url.includes('newtab.html') ? '' : e.url;
                updateSecurityIcon(e.url);
                renderQuickAccess();
            }
            updateNav();
            refreshTabSwitcherIfOpen();
            if (!t?.incognito && !e.url.includes('newtab.html') && !e.url.includes('incognito.html'))
                window.olewser.history.add({ url: e.url, title: t?.title, favicon: t?.favicon });
            if (!t?.incognito && !/^about:blank/i.test(e.url || '')) {
                runAutomationForUrl(e.url);
            }
        });

        wv.addEventListener('did-navigate-in-page', (e) => {
            const t = state.tabs.find(x => x.id === id);
            if (t?.sleeping) return;
            if (t) { t.url = e.url; updateNav(); }
            if (state.activeTabId === id) {
                dom.urlInput.value = e.url;
                renderQuickAccess();
            }
            refreshTabSwitcherIfOpen();
        });

        wv.addEventListener('page-title-updated', (e) => {
            const t = state.tabs.find(x => x.id === id);
            if (t?.sleeping) return;
            if (t) { t.title = e.title; const el = document.getElementById('tab-title-' + id); if (el) el.textContent = e.title; }
            refreshTabSwitcherIfOpen();
        });

        wv.addEventListener('page-favicon-updated', (e) => {
            const t = state.tabs.find(x => x.id === id);
            if (t?.sleeping) return;
            if (t && e.favicons?.length) { t.favicon = e.favicons[0]; const el = document.getElementById('tab-fav-' + id); if (el) { el.src = e.favicons[0]; el.style.display = ''; } }
            refreshTabSwitcherIfOpen();
        });

        wv.addEventListener('did-fail-load', (e) => {
            if (e.errorCode === -3) return;
            const t = state.tabs.find(x => x.id === id); if (t) t.loading = false;
            const ld = document.getElementById('tab-load-' + id); if (ld) ld.style.display = 'none';
            if (state.activeTabId === id) dom.loadingBar.classList.remove('active');
        });

        wv.addEventListener('update-target-url', (e) => { dom.statusText.textContent = e.url || ''; });

        wv.addEventListener('media-started-playing', () => {
            const t = state.tabs.find(x => x.id === id); if (t) t.audible = true;
            const el = document.getElementById('tab-audio-' + id); if (el) el.classList.add('playing');
        });
        wv.addEventListener('media-paused', () => {
            const t = state.tabs.find(x => x.id === id); if (t) t.audible = false;
            const el = document.getElementById('tab-audio-' + id); if (el) el.classList.remove('playing');
        });

        wv.addEventListener('new-window', (e) => { e.preventDefault(); createTab(e.url); });

        // Ctrl+Wheel Zoom: inject into webview, relay via console-message
        wv.addEventListener('dom-ready', () => {
            wv.executeJavaScript(`
                document.addEventListener('wheel', function(e) {
                    if (e.ctrlKey) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('__Olewser_ZOOM__:' + (e.deltaY < 0 ? 'in' : 'out'));
                    }
                }, { passive: false, capture: true });
            `).catch(() => { });
        });
        wv.addEventListener('console-message', (e) => {
            if (e.message && e.message.startsWith('__Olewser_ZOOM__:')) {
                const dir = e.message.split(':')[1];
                setZoom(dir === 'in' ? 0.1 : -0.1);
            }
        });
    }

    // ============================================================
    // NAVIGATION
    // ============================================================
    function navigate(input) {
        const url = normalizeUrl(input);
        if (!url) return;
        const wv = document.getElementById('wv-' + state.activeTabId);
        if (wv) wv.src = url;
        dom.urlInput.blur();
    }

    function updateSecurityIcon(url) {
        dom.securityIcon.classList.toggle('secure', url?.startsWith('https://'));
    }

    function getActiveWebviewElement() {
        return document.getElementById('wv-' + state.activeTabId);
    }

    function postCommandToAiFrame(command, payload = {}) {
        const frame = dom.oleksandraiFrame;
        if (!frame || !frame.contentWindow) return false;
        frame.contentWindow.postMessage({
            __olewserAiCommand: true,
            command,
            payload
        }, '*');
        return true;
    }

    function openAiPanelAndRun(command, payload = {}) {
        if (!dom.oleksandraiPanel.classList.contains('open')) {
            toggleOleksandraiPanel();
        }
        setTimeout(() => {
            if (!postCommandToAiFrame(command, payload)) {
                toast('AI panel is not available', 'error');
            }
        }, 120);
    }

    function askCurrentPage(question = '') {
        const tab = getActiveTab();
        openAiPanelAndRun('ask-this-page', { question, url: getActiveTabCurrentUrl() || tab?.url || '', title: tab?.title || '' });
    }

    function summarizeCurrentPageForReader() {
        const tab = getActiveTab();
        openAiPanelAndRun('reader-summary', { url: getActiveTabCurrentUrl() || tab?.url || '', title: tab?.title || '' });
    }

    async function runReaderModePlus() {
        const wv = getActiveWebviewElement();
        const tab = getActiveTab();
        if (!wv || !tab?.url) {
            toast('No active tab', 'error');
            return;
        }

        const text = await wv.executeJavaScript(`(function(){
            const sel = (window.getSelection && String(window.getSelection()).trim()) || '';
            if (sel) return sel.slice(0, 5000);
            const article = document.querySelector('article, main, [role="main"]');
            const source = article || document.body;
            return String((source && source.innerText) || '').replace(/\\s+/g, ' ').trim().slice(0, 5000);
        })();`).catch(() => '');

        openAiPanelAndRun('reader-plus', {
            customInstruction: 'Reader Mode+ request from browser',
            url: tab.url,
            title: tab.title || '',
            text: String(text || '').slice(0, 5000),
            targetLang: state.settings.language || 'en'
        });
    }

    function runPageAgentTask(task = 'prices') {
        const normalized = ['prices', 'contacts', 'compare'].includes(task) ? task : 'prices';
        const tab = getActiveTab();
        openAiPanelAndRun('page-agent', { task: normalized, url: getActiveTabCurrentUrl() || tab?.url || '', title: tab?.title || '' });
    }

    async function translateSelectionWithAi() {
        const wv = getActiveWebviewElement();
        if (!wv) {
            toast('No active tab', 'error');
            return;
        }
        const selectedText = await wv.executeJavaScript(`(function(){ return (window.getSelection && String(window.getSelection())) || ''; })();`).catch(() => '');
        const cleaned = String(selectedText || '').trim();
        if (!cleaned) {
            toast('Select text on the page first');
            return;
        }
        openAiPanelAndRun('translate-selection', { text: cleaned, targetLang: state.settings.language || 'en' });
    }

    function serializeTabsForSession() {
        return state.tabs
            .filter((tab) => !tab.incognito)
            .map((tab) => ({
                url: tab.url || '',
                title: tab.title || '',
                favicon: tab.favicon || '',
                pinned: !!tab.pinned
            }))
            .filter((tab) => !!tab.url && !tab.url.includes('newtab.html'));
    }

    async function saveCurrentSessionNow(label = 'Manual Session') {
        const tabs = serializeTabsForSession();
        if (!tabs.length) {
            toast('No tabs to save');
            return false;
        }
        await window.olewser.sessions.save(label, tabs);
        toast('Session saved', 'success');
        return true;
    }

    async function saveNamedSessionPrompt() {
        const label = prompt('Session name:', `Session ${new Date().toLocaleDateString()}`);
        if (!label) return false;
        return saveCurrentSessionNow(label.trim());
    }

    async function saveAutoSession() {
        if (!state.settings.restoreSession || state.isIncognito) return false;
        const tabs = serializeTabsForSession();
        if (!tabs.length) return false;
        const existing = await window.olewser.sessions.get();
        for (const s of existing) {
            if (s && s.name === '__AUTO__' && s.id) {
                await window.olewser.sessions.delete(s.id);
            }
        }
        await window.olewser.sessions.save('__AUTO__', tabs);
        return true;
    }

    async function restoreLastSavedSession(options = {}) {
        const silent = !!options.silent;
        const sessions = await window.olewser.sessions.get();
        if (!sessions || !sessions.length) {
            if (!silent) toast('No saved sessions found');
            return false;
        }
        const target = sessions.find((s) => s.name === '__AUTO__' && Array.isArray(s.tabs) && s.tabs.length) ||
            sessions.find((s) => Array.isArray(s.tabs) && s.tabs.length);
        if (!target) {
            if (!silent) toast('No tabs in saved sessions');
            return false;
        }
        if (state.tabs.length) {
            state.tabs.slice().forEach((t) => closeTab(t.id));
        }
        target.tabs.forEach((tabInfo, idx) => {
            createTab(tabInfo.url || '', {
                title: tabInfo.title || t('newTab'),
                pinned: !!tabInfo.pinned,
                _force: idx === 0
            });
        });
        if (!silent) toast('Session restored', 'success');
        return true;
    }

    async function restoreSessionByPicker() {
        const sessions = await window.olewser.sessions.get();
        const valid = (sessions || []).filter((s) => Array.isArray(s.tabs) && s.tabs.length);
        if (!valid.length) {
            toast('No saved sessions found');
            return false;
        }
        const menu = valid.slice(0, 10).map((s, i) => `${i + 1}. ${s.name || 'Session'} (${(s.tabs || []).length} tabs)`).join('\n');
        const picked = prompt(`Pick session number:\n${menu}`, '1');
        const index = Math.max(0, Number(picked || 1) - 1);
        const target = valid[index];
        if (!target) return false;
        if (state.tabs.length) state.tabs.slice().forEach((t) => closeTab(t.id));
        target.tabs.forEach((tabInfo, idx) => {
            createTab(tabInfo.url || '', {
                title: tabInfo.title || t('newTab'),
                pinned: !!tabInfo.pinned,
                _force: idx === 0
            });
        });
        toast('Session restored', 'success');
        return true;
    }

    // ============================================================
    // FROST MODE
    // ============================================================
    function resetFrostTimer(id) {
        clearTimeout(state.frostTimers[id]);
        if (!state.settings.frostEnabled) return;
        state.frostTimers[id] = setTimeout(() => {
            if (id !== state.activeTabId) { state.frozenTabs.add(id); updateFrostBadge(); }
        }, state.settings.frostTimeout || 30000);
    }
    function updateFrostBadge() {
        const c = state.frozenTabs.size;
        dom.frostBadge.textContent = c;
        dom.frostBadge.style.display = c > 0 ? '' : 'none';
    }

    // ============================================================
    // SIDEBAR
    // ============================================================
    function toggleSidebar() {
        state.sidebarOpen = !state.sidebarOpen;
        dom.sidebar.style.display = state.sidebarOpen ? '' : 'none';
        if (state.sidebarOpen) renderSidebarPanel(state.sidebarPanel);
    }

    async function renderSidebarPanel(panel) {
        state.sidebarPanel = panel;
        $$('.sidebar-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === panel));
        const c = dom.sidebarPanel;
        c.innerHTML = '';

        const lang = normalizeLanguageCode(state.settings.language);
        const locale = lang === 'sk' ? 'sk-SK' : lang === 'uk' ? 'uk-UA' : lang === 'ru' ? 'ru-RU' : 'en-US';
        const labels = {
            en: {
                bookmarks: 'Bookmarks',
                noBookmarks: 'No bookmarks yet',
                history: 'History',
                empty: 'Empty',
                clearAll: 'Clear All',
                clear: 'Clear',
                today: 'Today',
                yesterday: 'Yesterday',
                delete: 'Delete',
                clearHistoryConfirm: 'Clear all browsing history?',
                cleared: 'Cleared',
                historyCleared: 'History cleared',
                downloads: 'Downloads',
                noDownloads: 'No downloads yet',
                notes: 'Notes',
                notePlaceholder: 'Write a note...',
                saveNote: 'Save note',
                noteSaved: 'Note saved',
                readingList: 'Reading list',
                noReadingList: 'Reading list is empty'
            },
            sk: {
                bookmarks: 'Zalozky',
                noBookmarks: 'Ziadne zalozky',
                history: 'Historia',
                empty: 'Prazdne',
                clearAll: 'Vymazat vsetko',
                clear: 'Vymazat',
                today: 'Dnes',
                yesterday: 'Vcera',
                delete: 'Odstranit',
                clearHistoryConfirm: 'Vymazat celu historiu prehliadania?',
                cleared: 'Vymazane',
                historyCleared: 'Historia vymazana',
                downloads: 'Stiahnute',
                noDownloads: 'Ziadne stiahnute subory',
                notes: 'Poznamky',
                notePlaceholder: 'Napiste poznamku...',
                saveNote: 'Ulozit poznamku',
                noteSaved: 'Poznamka ulozena',
                readingList: 'Na neskor',
                noReadingList: 'Zoznam na citanie je prazdny'
            },
            uk: {
                bookmarks: 'Zakladky',
                noBookmarks: 'Nemaye zakladok',
                history: 'Istoriya',
                empty: 'Pusto',
                clearAll: 'Ochystyty vse',
                clear: 'Ochystyty',
                today: 'Sohodni',
                yesterday: 'Vchora',
                delete: 'Vydalyty',
                clearHistoryConfirm: 'Ochystyty vsyu istoriyu?',
                cleared: 'Ochyscheno',
                historyCleared: 'Istoriyu ochyscheno',
                downloads: 'Zavantazhennya',
                noDownloads: 'Nemae zavantazhen',
                notes: 'Notatky',
                notePlaceholder: 'Napyshit notatku...',
                saveNote: 'Zberehty notatku',
                noteSaved: 'Notatku zberezheno',
                readingList: 'Na potim',
                noReadingList: 'Spysok porozhniy'
            },
            ru: {
                bookmarks: 'Zakladki',
                noBookmarks: 'Net zakladok',
                history: 'Istoriya',
                empty: 'Pusto',
                clearAll: 'Ochistit vse',
                clear: 'Ochistit',
                today: 'Segodnya',
                yesterday: 'Vchera',
                delete: 'Udalit',
                clearHistoryConfirm: 'Ochistit vsyu istoriyu?',
                cleared: 'Ochishcheno',
                historyCleared: 'Istoriya ochishchena',
                downloads: 'Zagruzki',
                noDownloads: 'Net zagruzok',
                notes: 'Zametki',
                notePlaceholder: 'Napisat zametku...',
                saveNote: 'Sohranit zametku',
                noteSaved: 'Zametka sohranena',
                readingList: 'Otlozhennoe',
                noReadingList: 'Spisok pust'
            }
        };
        const tx = (key) => (labels[lang] && labels[lang][key]) || labels.en[key] || key;

        if (panel === 'bookmarks') {
            const bms = await window.olewser.bookmarks.get();
            c.innerHTML = `<div class="sidebar-panel-title">${tx('bookmarks')}</div>`;
            if (!bms.length) {
                c.innerHTML += `<div class="sidebar-empty">${tx('noBookmarks')}</div>`;
                return;
            }

            bms.forEach(b => {
                const it = document.createElement('div');
                it.className = 'sidebar-item';
                const safeTitle = normalizeBrokenUtf8Text(b.title || b.url);
                const noteBadge = b.note
                    ? `<span class="sidebar-item-meta" style="font-size:10px;color:var(--text-muted)" title="${tx('notes')}">N</span>`
                    : '';
                it.innerHTML = `<img src="${favicon(b.url)}" onerror="this.style.display='none'"><span class="sidebar-item-title">${safeTitle}</span>${noteBadge}<span class="sidebar-item-delete" data-id="${b.id}" title="${tx('delete')}">&#10005;</span>`;

                it.addEventListener('click', (e) => {
                    if (e.target.closest('.sidebar-item-delete')) return;
                    const newId = createTab(b.url);
                    if (Number.isFinite(Number(b.scrollY)) && Number(b.scrollY) > 0) {
                        const wv = document.getElementById('wv-' + newId);
                        if (wv) {
                            const y = Math.max(0, Math.floor(Number(b.scrollY)));
                            wv.addEventListener('did-stop-loading', () => {
                                wv.executeJavaScript(`window.scrollTo({ top: ${y}, behavior: 'auto' });`).catch(() => { });
                            }, { once: true });
                        }
                    }
                });

                it.querySelector('.sidebar-item-delete').addEventListener('click', async () => {
                    await window.olewser.bookmarks.remove(b.id);
                    renderSidebarPanel('bookmarks');
                });
                c.appendChild(it);
            });
            return;
        }

        if (panel === 'history') {
            const h = await window.olewser.history.get();
            c.innerHTML = `<div class="sidebar-panel-title" style="display:flex;align-items:center;justify-content:space-between;">${tx('history')}<button class="sidebar-clear-all-btn" id="history-clear-all" title="${tx('clearAll')}">${tx('clearAll')}</button></div>`;

            if (!h.length) {
                c.innerHTML += `<div class="sidebar-empty">${tx('empty')}</div>`;
                return;
            }

            const groups = {};
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const yesterday = new Date(today);
            yesterday.setDate(yesterday.getDate() - 1);

            h.forEach(entry => {
                const d = new Date(entry.timestamp);
                d.setHours(0, 0, 0, 0);
                let label;
                if (d.getTime() === today.getTime()) label = tx('today');
                else if (d.getTime() === yesterday.getTime()) label = tx('yesterday');
                else label = d.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' });
                if (!groups[label]) groups[label] = { dateMs: d.getTime(), items: [] };
                groups[label].items.push(entry);
            });

            const sortedKeys = Object.keys(groups).sort((a, b) => groups[b].dateMs - groups[a].dateMs);
            sortedKeys.forEach(label => {
                const group = groups[label];
                const header = document.createElement('div');
                header.className = 'sidebar-date-header';
                header.innerHTML = `<span>${label}</span><button class="sidebar-clear-day-btn" title="${tx('clear')} ${label}">${tx('clear')}</button>`;
                c.appendChild(header);

                header.querySelector('.sidebar-clear-day-btn').addEventListener('click', async () => {
                    for (const entry of group.items) {
                        if (entry.id) await window.olewser.history.remove(entry.id);
                    }
                    renderSidebarPanel('history');
                    toast(tx('cleared'), 'success');
                });

                group.items.sort((a, b) => b.timestamp - a.timestamp);
                group.items.forEach(entry => {
                    const it = document.createElement('div');
                    it.className = 'sidebar-item';
                    const time = new Date(entry.timestamp).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
                    const safeTitle = normalizeBrokenUtf8Text(entry.title || entry.url);
                    it.innerHTML = `<img src="${favicon(entry.url)}" onerror="this.style.display='none'"><span class="sidebar-item-title">${safeTitle}</span><span class="sidebar-item-meta">${time}</span><span class="sidebar-item-delete" title="${tx('delete')}">&#10005;</span>`;
                    it.addEventListener('click', (e) => {
                        if (!e.target.closest('.sidebar-item-delete')) createTab(entry.url);
                    });
                    it.querySelector('.sidebar-item-delete').addEventListener('click', async (e) => {
                        e.stopPropagation();
                        if (entry.id) await window.olewser.history.remove(entry.id);
                        it.remove();
                    });
                    c.appendChild(it);
                });
            });

            c.querySelector('#history-clear-all').addEventListener('click', async () => {
                if (!confirm(tx('clearHistoryConfirm'))) return;
                await window.olewser.history.clear();
                renderSidebarPanel('history');
                toast(tx('historyCleared'), 'success');
            });
            return;
        }

        if (panel === 'downloads') {
            const d = await window.olewser.downloads.get();
            c.innerHTML = `<div class="sidebar-panel-title">${tx('downloads')}</div>`;
            if (!d.length) {
                c.innerHTML += `<div class="sidebar-empty">${tx('noDownloads')}</div>`;
                return;
            }
            d.forEach(dl => {
                const it = document.createElement('div');
                it.className = 'sidebar-item';
                const safeFilename = normalizeBrokenUtf8Text(dl.filename);
                it.innerHTML = `<span style="font-size:16px">&#11015;</span><span class="sidebar-item-title">${safeFilename}</span><span class="sidebar-item-meta">${formatBytes(dl.totalBytes)}</span>`;
                it.addEventListener('click', () => window.olewser.downloads.showInFolder(dl.path));
                c.appendChild(it);
            });
            return;
        }

        if (panel === 'notes') {
            c.innerHTML = `<div class="sidebar-panel-title">${tx('notes')}</div><textarea class="note-input" id="new-note" placeholder="${tx('notePlaceholder')}"></textarea><button class="sidebar-action-btn" id="save-note-btn">${tx('saveNote')}</button><div id="notes-list" style="margin-top:8px"></div>`;
            const notes = await window.olewser.notes.get();
            const nl = c.querySelector('#notes-list');
            notes.forEach(n => {
                const it = document.createElement('div');
                it.className = 'sidebar-item';
                const preview = normalizeBrokenUtf8Text(n.text).slice(0, 50);
                it.innerHTML = `<span class="sidebar-item-title">${preview}</span><span class="sidebar-item-delete" title="${tx('delete')}">&#10005;</span>`;
                it.querySelector('.sidebar-item-delete').addEventListener('click', async () => {
                    await window.olewser.notes.delete(n.id);
                    renderSidebarPanel('notes');
                });
                nl.appendChild(it);
            });
            c.querySelector('#save-note-btn').addEventListener('click', async () => {
                const txt = c.querySelector('#new-note').value.trim();
                if (!txt) return;
                await window.olewser.notes.save({ text: txt });
                renderSidebarPanel('notes');
                toast(tx('noteSaved'), 'success');
            });
            return;
        }

        if (panel === 'readinglist') {
            const rl = await window.olewser.readinglist.get();
            c.innerHTML = `<div class="sidebar-panel-title">${tx('readingList')}</div>`;
            if (!rl.length) {
                c.innerHTML += `<div class="sidebar-empty">${tx('noReadingList')}</div>`;
                return;
            }
            rl.forEach(r => {
                const it = document.createElement('div');
                it.className = 'sidebar-item';
                const safeTitle = normalizeBrokenUtf8Text(r.title || r.url);
                it.innerHTML = `<img src="${favicon(r.url)}" onerror="this.style.display='none'"><span class="sidebar-item-title">${safeTitle}</span><span class="sidebar-item-delete" title="${tx('delete')}">&#10005;</span>`;
                it.addEventListener('click', (e) => {
                    if (!e.target.closest('.sidebar-item-delete')) createTab(r.url);
                });
                it.querySelector('.sidebar-item-delete').addEventListener('click', async () => {
                    await window.olewser.readinglist.remove(r.id);
                    renderSidebarPanel('readinglist');
                });
                c.appendChild(it);
            });
            return;
        }

        if (panel === 'settings') {
            createTab(settingsUrl(), { title: t('menuSettings') });
            toggleSidebar();
        }
    }
    // ============================================================
    // ICONS (SVG Helpers)
    // ============================================================
    const ICONS = {
        settings: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        history: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M3 3v5h5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M3.05 13A9 9 0 1 0 6 5.3L3 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 7v5l4 2" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        download: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M7 10l5 5 5-5" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M12 15V3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        bookmark: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        newTab: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        close: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M18 6L6 18M6 6l12 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        menu: '<svg viewBox="0 0 24 24" fill="none" class="icon"><circle cx="12" cy="12" r="1" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="5" r="1" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="19" r="1" stroke="currentColor" stroke-width="2"/></svg>',
        search: '<svg viewBox="0 0 24 24" fill="none" class="icon"><circle cx="11" cy="11" r="8" stroke="currentColor" stroke-width="2"/><path d="M21 21l-4.35-4.35" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        print: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M6 9V2h12v7" stroke="currentColor" stroke-width="2"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" stroke="currentColor" stroke-width="2"/><path d="M6 14h12v8H6z" stroke="currentColor" stroke-width="2"/></svg>',
        screenshot: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" stroke="currentColor" stroke-width="2"/><circle cx="12" cy="13" r="4" stroke="currentColor" stroke-width="2"/></svg>',
        pwa: '<svg viewBox="0 0 24 24" fill="none" class="icon"><rect x="5" y="3" width="14" height="18" rx="3" stroke="currentColor" stroke-width="2"/><path d="M9 7h6M12 11v6M9 14h6" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        incognito: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M3 7V5h18v2M5 11l4 9h6l4-9M12 11V7" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>', // simplified glasses
        fullscreen: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>',
        note: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" stroke="currentColor" stroke-width="2"/><path d="M14 2v6h6" stroke="currentColor" stroke-width="2"/><path d="M16 13H8M16 17H8M10 9H8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>',
        exit: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" stroke="currentColor" stroke-width="2"/><path d="M16 17l5-5-5-5" stroke="currentColor" stroke-width="2"/><path d="M21 12H9" stroke="currentColor" stroke-width="2"/></svg>',
        pin: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M12 17v5" stroke="currentColor" stroke-width="2"/><path d="M9 2v6l-2 2v2h12v-2l-2-2V2" stroke="currentColor" stroke-width="2"/></svg>',
        mute: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" stroke-width="2"/><path d="M23 9l-6 6M17 9l6 6" stroke="currentColor" stroke-width="2"/></svg>',
        sound: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M11 5L6 9H2v6h4l5 4V5z" stroke="currentColor" stroke-width="2"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" stroke="currentColor" stroke-width="2"/></svg>',
        copy: '<svg viewBox="0 0 24 24" fill="none" class="icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/></svg>',
        qr: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M3 3h7v7H3zM14 3h7v7h-7zM14 14h7v7h-7zM3 14h7v7H3z" stroke="currentColor" stroke-width="2"/></svg>',
        duplicate: '<svg viewBox="0 0 24 24" fill="none" class="icon"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="currentColor" stroke-width="2"/></svg>',
        window: '<svg viewBox="0 0 24 24" fill="none" class="icon"><rect x="3" y="3" width="18" height="18" rx="2" ry="2" stroke="currentColor" stroke-width="2"/><path d="M3 9h18" stroke="currentColor" stroke-width="2"/></svg>',
    };

    // ============================================================
    // DROPDOWN MENU (SVG Updates)
    // ============================================================
    function showDropdownMenu() {
        const items = [
            { label: t('menuNewTab'), icon: ICONS.newTab, kbd: 'Ctrl+T', action: () => openNewTabFromUser() },
            { label: t('menuNewWindow'), icon: ICONS.window, kbd: 'Ctrl+N', action: () => window.olewser.window.newWindow() },
            { label: t('menuIncognito'), icon: ICONS.incognito, kbd: 'Ctrl+Shift+N', action: () => window.olewser.window.newIncognito() },
            { separator: true },
            { label: t('menuBookmarks'), icon: ICONS.bookmark, action: () => { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('bookmarks'); } },
            { label: t('menuHistory'), icon: ICONS.history, kbd: 'Ctrl+H', action: () => { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('history'); } },
            { label: t('menuDownloads'), icon: ICONS.download, kbd: 'Ctrl+J', action: () => { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('downloads'); } },
            { label: t('notes'), icon: ICONS.note, action: () => { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('notes'); } },
            { separator: true },
            { label: t('findOnPage'), icon: ICONS.search, kbd: 'Ctrl+F', action: () => toggleFindBar() },
            { label: t('menuScreenshot'), icon: ICONS.screenshot, action: takeScreenshot },
            { label: t('installApp'), icon: ICONS.pwa, action: installCurrentSiteAsApp },
            { label: t('menuPrint'), icon: ICONS.print, kbd: 'Ctrl+P', action: printPage },
            { label: t('menuFullscreen'), icon: ICONS.fullscreen, kbd: 'F11', action: () => window.olewser.window.fullscreen() },
            { separator: true },
            { label: t('menuSettings'), icon: ICONS.settings, action: () => createTab(settingsUrl(), { title: t('menuSettings') }) },
            { separator: true },
            { label: t('quit'), icon: ICONS.exit, action: () => window.olewser.window.close(), danger: true },
        ];
        const rect = dom.btnMenu.getBoundingClientRect();
        showContextMenu(rect.right - 220, rect.bottom + 8, items);
    }

    // ============================================================
    // CONTEXT MENU (SVG Updates)
    // ============================================================
    function showTabContextMenu(e, tabId) {
        const tab = state.tabs.find(x => x.id === tabId);
        showContextMenu(e.clientX, e.clientY, [
            { label: t('cmNewTab'), icon: ICONS.newTab, action: () => openNewTabFromUser() },
            { label: t('cmDuplicate'), icon: ICONS.duplicate, action: () => duplicateTab(tabId) },
            { separator: true },
            { label: tab?.pinned ? t('unpin') : t('cmPin'), icon: ICONS.pin, action: () => pinTab(tabId) },
            { label: tab?.muted ? t('unmute') : t('cmMute'), icon: tab?.muted ? ICONS.sound : ICONS.mute, action: () => toggleMute(tabId) },
            { separator: true },
            { label: t('cmCloseOthers'), icon: ICONS.close, action: () => { state.tabs.filter(x => x.id !== tabId && !x.pinned).forEach(x => closeTab(x.id)); } },
            { label: t('cmCloseRight'), icon: '<svg viewBox="0 0 24 24" fill="none" class="icon"><path d="M13 5l7 7-7 7M5 12h14" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>', action: () => { const idx = state.tabs.findIndex(x => x.id === tabId); state.tabs.slice(idx + 1).filter(x => !x.pinned).forEach(x => closeTab(x.id)); } },
            { separator: true },
            { label: t('cmCloseTab'), icon: ICONS.close, action: () => closeTab(tabId), danger: true },
        ]);
    }

    // ============================================================
    // COMMAND PALETTE (Ctrl+K)
    // ============================================================
    function toggleCommandPalette() {
        const v = dom.commandPalette.style.display !== 'none';
        dom.commandPalette.style.display = v ? 'none' : '';
        if (!v) { dom.commandInput.value = ''; dom.commandInput.focus(); renderCommands(''); }
    }

    function renderCommands(query) {
        const cmds = [
            { title: t('menuNewTab'), kbd: 'Ctrl+T', action: () => openNewTabFromUser() },
            { title: t('menuIncognito'), kbd: 'Ctrl+Shift+N', action: () => window.olewser.window.newIncognito() },
            { title: t('menuSettings'), action: () => createTab(settingsUrl(), { title: t('menuSettings') }) },
            { title: t('menuHistory'), kbd: 'Ctrl+H', action: () => { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('history'); } },
            { title: t('menuDownloads'), kbd: 'Ctrl+J', action: () => { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('downloads'); } },
            { title: t('menuBookmarks'), action: () => { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('bookmarks'); } },
            { title: 'Reading List', action: () => { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('readinglist'); } },
            { title: 'Ask This Page (AI)', action: () => askCurrentPage('Summarize what is important on this page and answer clearly.') },
            { title: 'Reader Summary (AI)', action: () => summarizeCurrentPageForReader() },
            { title: 'Explain Page (Short)', action: () => openAiPanelAndRun('explain-open-page', { style: 'short' }) },
            { title: 'Explain Page (Detailed)', action: () => openAiPanelAndRun('explain-open-page', { style: 'detailed' }) },
            { title: 'Explain Page (For Child)', action: () => openAiPanelAndRun('explain-open-page', { style: 'kid' }) },
            { title: 'Reader Mode+ (AI)', action: () => runReaderModePlus() },
            { title: 'Translate Selection (AI)', action: () => translateSelectionWithAi() },
            { title: 'AI Page Agent: Extract Prices', action: () => runPageAgentTask('prices') },
            { title: 'AI Page Agent: Extract Contacts', action: () => runPageAgentTask('contacts') },
            { title: 'AI Page Agent: Compare Items', action: () => runPageAgentTask('compare') },
            { title: 'AI Daily Digest (Open Tabs)', action: () => requestDailyDigestFromOpenTabs() },
            { title: 'Save Session', action: () => saveCurrentSessionNow() },
            { title: 'Save Session (Named)', action: () => saveNamedSessionPrompt() },
            { title: 'Restore Last Session', action: () => restoreLastSavedSession() },
            { title: 'Restore Session (Pick)', action: () => restoreSessionByPicker() },
            { title: 'Sleep Inactive Tabs', action: () => sleepInactiveTabs() },
            { title: 'Wake Sleeping Tabs', action: () => wakeAllSleepingTabs() },
            { title: 'Automation: Add Rule For Site', action: () => createAutomationRuleForCurrentSite() },
            { title: 'Automation: Show Rules', action: () => listAutomationRules() },
            { title: 'Automation: Clear Rules', action: () => clearAutomationRules() },
            { title: 'Privacy: Clear Cache', action: async () => { await window.olewser.data.clearCache(); toast('Cache cleared', 'success'); } },
            { title: 'Privacy: Clear Cookies', action: async () => { await window.olewser.data.clearCookies(); toast('Cookies cleared', 'success'); } },
            { title: t('restoreTab'), kbd: 'Ctrl+Shift+T', action: restoreClosedTab },
            { title: t('menuFullscreen'), kbd: 'F11', action: () => window.olewser.window.fullscreen() },
            { title: t('findOnPage'), kbd: 'Ctrl+F', action: () => toggleFindBar() },
            { title: t('menuScreenshot'), action: takeScreenshot },
            { title: t('installApp'), action: installCurrentSiteAsApp },
            { title: 'DevTools', kbd: 'F12', action: openDevTools },
            { title: t('menuPrint'), kbd: 'Ctrl+P', action: printPage },
        ];
        state.tabs.forEach(t => cmds.push({ title: t.title, desc: t.url, icon: 'B', action: () => switchTab(t.id) }));
        const q = query.toLowerCase();
        const filtered = q ? cmds.filter(c => c.title.toLowerCase().includes(q) || (c.desc || '').toLowerCase().includes(q)) : cmds;
        dom.commandResults.innerHTML = '';
        filtered.slice(0, 18).forEach((cmd, i) => {
            const el = document.createElement('div');
            el.className = 'command-item' + (i === 0 ? ' selected' : '');
            el.innerHTML = `<div class="command-item-icon">${cmd.icon || '>'}</div><div class="command-item-text"><div class="command-item-title">${cmd.title}</div>${cmd.desc ? `<div class="command-item-desc">${cmd.desc}</div>` : ''}</div>${cmd.kbd ? `<span class="command-item-kbd">${cmd.kbd}</span>` : ''}`;
            el.addEventListener('click', () => { toggleCommandPalette(); cmd.action(); });
            dom.commandResults.appendChild(el);
        });
    }

    // (showTabContextMenu defined above with ICONS)

    let _outsideClickHandler = null;
    let _blurHandler = null;
    function showContextMenu(x, y, items) {
        hideTabSwitcherPanel();
        hideContextMenu(); // close any existing first
        dom.contextMenu.innerHTML = '';
        items.forEach(item => {
            if (item.separator) {
                const sep = document.createElement('div');
                sep.className = 'context-menu-separator';
                dom.contextMenu.appendChild(sep);
                return;
            }
            const el = document.createElement('div');
            el.className = 'context-menu-item' + (item.danger ? ' danger' : '');
            // Build icon span
            const iconSpan = document.createElement('span');
            iconSpan.className = 'context-menu-icon';
            iconSpan.innerHTML = item.icon || '';
            el.appendChild(iconSpan);
            // Label text
            const labelSpan = document.createElement('span');
            labelSpan.textContent = item.label;
            labelSpan.style.flex = '1';
            el.appendChild(labelSpan);
            // Keyboard shortcut
            if (item.kbd) {
                const kbdSpan = document.createElement('span');
                kbdSpan.className = 'context-menu-kbd';
                kbdSpan.textContent = item.kbd;
                el.appendChild(kbdSpan);
            }
            el.addEventListener('mousedown', (e) => {
                e.preventDefault();
                e.stopPropagation();
            });
            el.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                hideContextMenu();
                if (item.action) item.action();
            });
            dom.contextMenu.appendChild(el);
        });
        const bw = document.body.clientWidth, bh = document.body.clientHeight;
        dom.contextMenu.style.left = Math.min(x, bw - 230) + 'px';
        dom.contextMenu.style.top = Math.min(y, bh - 400) + 'px';
        dom.contextMenu.style.display = '';
        // Close on outside click (mousedown + click)
        setTimeout(() => {
            _outsideClickHandler = (e) => {
                if (!dom.contextMenu.contains(e.target)) {
                    hideContextMenu();
                }
            };
            document.addEventListener('mousedown', _outsideClickHandler, true);
            document.addEventListener('click', _outsideClickHandler, true);
        }, 100);
        // Close when webview or anything else steals focus
        _blurHandler = () => { hideContextMenu(); };
        window.addEventListener('blur', _blurHandler);
    }

    function hideContextMenu() {
        dom.contextMenu.style.display = 'none';
        if (_outsideClickHandler) {
            document.removeEventListener('mousedown', _outsideClickHandler, true);
            document.removeEventListener('click', _outsideClickHandler, true);
            _outsideClickHandler = null;
        }
        if (_blurHandler) {
            window.removeEventListener('blur', _blurHandler);
            _blurHandler = null;
        }
    }

    // ============================================================
    // FIND BAR
    // ============================================================
    function toggleFindBar() {
        const v = dom.findBar.style.display !== 'none';
        dom.findBar.style.display = v ? 'none' : '';
        if (!v) dom.findInput.focus();
        else { const wv = document.getElementById('wv-' + state.activeTabId); if (wv) wv.stopFindInPage('clearSelection'); dom.findCount.textContent = '0/0'; }
    }

    // ============================================================
    // ZOOM
    // ============================================================
    let zoomHideTimer;
    function setZoom(delta) {
        const id = state.activeTabId, wv = document.getElementById('wv-' + id);
        if (!wv) return;
        let level = Math.max(0.25, Math.min(3, (state.zoomLevels[id] || 1) + delta));
        state.zoomLevels[id] = level; wv.setZoomFactor(level);
        const pct = Math.round(level * 100) + '%';
        dom.zoomLevel.textContent = pct; dom.statusZoom.textContent = pct;
        dom.zoomIndicator.style.display = '';
        clearTimeout(zoomHideTimer);
        zoomHideTimer = setTimeout(() => { dom.zoomIndicator.style.display = 'none'; }, 2000);
    }
    function resetZoom() {
        state.zoomLevels[state.activeTabId] = 1;
        const wv = document.getElementById('wv-' + state.activeTabId); if (wv) wv.setZoomFactor(1);
        dom.zoomLevel.textContent = '100%'; dom.statusZoom.textContent = '100%'; dom.zoomIndicator.style.display = 'none';
    }

    // ============================================================
    // DOWNLOADS PANEL
    // ============================================================
    function formatBytes(bytes) {
        if (!bytes || bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }

    function getFileTypeClass(filename) {
        if (!filename) return '';
        const ext = filename.split('.').pop().toLowerCase();
        if (['exe', 'msi', 'dmg', 'deb', 'appimage'].includes(ext)) return 'exe';
        if (['zip', 'rar', '7z', 'tar', 'gz', 'bz2'].includes(ext)) return 'zip';
        if (['mp4', 'mp3', 'avi', 'mkv', 'mov', 'wav', 'flac', 'ogg', 'webm'].includes(ext)) return 'media';
        if (['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(ext)) return 'image';
        return '';
    }

    function getFileIcon(typeClass) {
        switch (typeClass) {
            case 'exe': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 10h8M8 14h4"/></svg>';
            case 'zip': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M20 22H4a2 2 0 01-2-2V4a2 2 0 012-2h16a2 2 0 012 2v16a2 2 0 01-2 2z"/><path d="M12 2v20M9 5h3M12 8h3M9 11h3M12 14h3"/></svg>';
            case 'media': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8" fill="currentColor" stroke="none"/></svg>';
            case 'image': return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5" fill="currentColor" stroke="none"/><path d="M21 15l-5-5L5 21"/></svg>';
            default: return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>';
        }
    }

    function renderDownloadsPanel() {
        const list = dom.downloadsPanelList;
        if (!state.downloadsList.length) {
            list.innerHTML = '<div class="downloads-empty">No downloads yet</div>';
            return;
        }
        list.innerHTML = '';
        state.downloadsList.forEach(dl => {
            const typeClass = getFileTypeClass(dl.filename);
            const el = document.createElement('div');
            el.className = 'dl-item';
            const isActive = dl.state === 'progressing';
            el.innerHTML = `
                <div class="dl-item-icon ${typeClass}">${getFileIcon(typeClass)}</div>
                <div class="dl-item-info">
                    <div class="dl-item-name">${dl.filename}</div>
                    <div class="dl-item-meta">${isActive ? formatBytes(dl.receivedBytes) + ' / ' + formatBytes(dl.totalBytes) : formatBytes(dl.totalBytes || dl.receivedBytes)}</div>
                    ${isActive ? `<div class="dl-item-progress"><div class="dl-item-progress-fill" style="width:${dl.totalBytes > 0 ? Math.round(dl.receivedBytes / dl.totalBytes * 100) : 0}%"></div></div>` : ''}
                </div>
            `;
            list.appendChild(el);
        });
    }

    // ============================================================
    // QR CODE
    // ============================================================
    function showQrCode() {
        const tab = state.tabs.find(t => t.id === state.activeTabId);
        if (!tab || !tab.url) { toast('No URL available for QR code', 'error'); return; }
        const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(tab.url)}`;
        const overlay = document.createElement('div');
        overlay.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.7);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);z-index:9000;display:flex;align-items:center;justify-content:center;animation:qr-overlay-in 0.25s ease-out;';
        overlay.innerHTML = `
      <style>
        @keyframes qr-overlay-in { from { opacity:0; } to { opacity:1; } }
        @keyframes qr-card-in { from { opacity:0; transform:scale(0.92); } to { opacity:1; transform:scale(1); } }
        .qr-card { background:#111; border:1px solid rgba(255,255,255,0.06); border-radius:20px; padding:28px 32px; text-align:center; box-shadow:0 24px 80px rgba(0,0,0,0.6); max-width:300px; animation:qr-card-in 0.3s cubic-bezier(0.25,0.8,0.25,1); }
        .qr-title { color:rgba(255,255,255,0.85); margin:0 0 16px 0; font-size:13px; font-weight:500; letter-spacing:0.5px; text-transform:uppercase; }
        .qr-img { width:200px; height:200px; border-radius:12px; background:#fff; padding:12px; box-shadow:0 0 30px rgba(255,255,255,0.04); }
        .qr-url { color:rgba(255,255,255,0.3); font-size:10px; margin-top:14px; word-break:break-all; max-width:260px; line-height:1.4; }
        .qr-close { margin-top:18px; padding:8px 28px; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); border-radius:10px; color:rgba(255,255,255,0.6); cursor:pointer; font-family:inherit; font-size:12px; transition:all 0.2s ease; }
        .qr-close:hover { background:rgba(255,255,255,0.1); color:#fff; }
      </style>
      <div class="qr-card">
        <h3 class="qr-title">${t('qrCode')}</h3>
        <img src="${qrUrl}" alt="QR" class="qr-img">
        <p class="qr-url">${tab.url}</p>
        <button id="qr-close-btn" class="qr-close">${t('close')}</button>
      </div>
    `;
        document.body.appendChild(overlay);
        overlay.addEventListener('click', (e) => { if (e.target === overlay || e.target.id === 'qr-close-btn') overlay.remove(); });
    }

    // ============================================================
    // FEATURES
    // ============================================================
    function openDevTools() {
        const wv = document.getElementById('wv-' + state.activeTabId);
        if (!wv) return;
        try {
            // Open DevTools docked to right
            wv.openDevTools({ mode: 'right' });
        } catch (e) {
            console.error('DevTools error:', e);
        }
    }
    function printPage() { document.getElementById('wv-' + state.activeTabId)?.print(); }
    async function takeScreenshot() {
        const r = await window.olewser.actions.screenshot();
        if (r.success) toast('Screenshot saved: ' + r.path, 'success');
        else toast('Screenshot failed', 'error');
    }

    // URL Autocomplete
    let acTimer;
    async function showAutocomplete(q) {
        if (!q || q.length < 2) { dom.urlAutocomplete.style.display = 'none'; return; }
        clearTimeout(acTimer);
        acTimer = setTimeout(async () => {
            const res = await window.olewser.history.search(q);
            if (!res.length) { dom.urlAutocomplete.style.display = 'none'; return; }
            dom.urlAutocomplete.innerHTML = '';
            res.slice(0, 8).forEach(r => {
                const el = document.createElement('div'); el.className = 'url-autocomplete-item';
                el.innerHTML = `<img src="${favicon(r.url)}" onerror="this.style.display='none'"><span class="url-autocomplete-title">${r.title}</span><span class="url-autocomplete-url">${r.url}</span>`;
                el.addEventListener('click', () => { dom.urlInput.value = r.url; navigate(r.url); dom.urlAutocomplete.style.display = 'none'; });
                dom.urlAutocomplete.appendChild(el);
            });
            dom.urlAutocomplete.style.display = '';
        }, 200);
    }

    // ============================================================
    // PULSE
    // ============================================================
    function isAggressiveAdblockEnabled() {
        return state.settings.adblockAggressive !== false;
    }

    function syncPulseAdblockControls() {
        const aggressive = isAggressiveAdblockEnabled();
        if (dom.pulseAdblockToggle) dom.pulseAdblockToggle.checked = aggressive;
        if (dom.pulseAdblockMode) dom.pulseAdblockMode.textContent = aggressive ? 'Aggressive' : 'Balanced';
    }

    async function setPulseAdblockMode(enabled) {
        const aggressive = !!enabled;
        const prev = isAggressiveAdblockEnabled();
        if (prev === aggressive) {
            syncPulseAdblockControls();
            return;
        }

        const nextSettings = { ...(state.settings || {}), adblockAggressive: aggressive };
        state.settings = nextSettings;
        syncPulseAdblockControls();
        if (dom.pulseAdblockToggle) dom.pulseAdblockToggle.disabled = true;
        try {
            await window.olewser.settings.save(nextSettings);
            await updatePulse();
            toast(aggressive ? 'Aggressive adblock enabled' : 'Balanced adblock enabled', 'success');
        } catch (err) {
            state.settings = { ...(state.settings || {}), adblockAggressive: prev };
            syncPulseAdblockControls();
            toast(`Failed to switch adblock mode: ${err && err.message ? err.message : err}`, 'error');
        } finally {
            if (dom.pulseAdblockToggle) dom.pulseAdblockToggle.disabled = false;
        }
    }

    async function updatePulse() {
        const s = await window.olewser.pulse.getStats();
        $('#pulse-ads').textContent = s.adsBlocked;
        $('#pulse-trackers').textContent = s.trackersBlocked;
        $('#pulse-data').textContent = formatBytes(s.dataSavedKB * 1024);
        $('#pulse-time').textContent = formatTime(Date.now() - s.sessionStart);
        $('#pulse-frost-count').textContent = state.frozenTabs.size;
        if (typeof s.adblockAggressive === 'boolean') {
            state.settings.adblockAggressive = s.adblockAggressive;
        }
        syncPulseAdblockControls();
    }

    // ============================================================
    // SETTINGS
    // ============================================================
    function applySettings() {
        const s = state.settings;
        // Theme
        const theme = s.theme || 'dark';
        document.documentElement.setAttribute('data-theme', theme);

        // Update theme on already-open internal pages (newtab, settings)
        state.tabs.forEach(tab => {
            const wv = document.getElementById('wv-' + tab.id);
            if (wv) {
                try {
                    const url = wv.getURL ? wv.getURL() : (wv.src || '');
                    if (url.includes('newtab.html') || url.includes('settings.html')) {
                        wv.executeJavaScript(`
                            document.documentElement.setAttribute('data-theme', '${theme}');
                        `).catch(() => { });
                    }
                } catch (e) { }
            }
        });

        // Accent color
        document.documentElement.style.setProperty('--accent', s.accentColor || '#808080');
        // Language
        s.language = normalizeLanguageCode(s.language);
        document.documentElement.lang = s.language;
        // Bookmarks bar
        dom.bookmarksBar.style.display = s.showBookmarksBar ? '' : 'none';
        // Density
        if (s.density === 'compact') {
            document.documentElement.style.setProperty('--titlebar-h', '34px');
            document.documentElement.style.setProperty('--navbar-h', '38px');
            document.documentElement.style.setProperty('--tab-h', '28px');
        } else {
            document.documentElement.style.setProperty('--titlebar-h', '40px');
            document.documentElement.style.setProperty('--navbar-h', '44px');
            document.documentElement.style.setProperty('--tab-h', '34px');
        }
        // Always on top
        if (typeof s.alwaysOnTop !== 'undefined') {
            window.olewser.window.alwaysOnTop(!!s.alwaysOnTop);
        }
        // Language
        applyLanguage();
        syncPulseAdblockControls();
    }

    // Listen for settings changes from settings page (via IPC)
    window.olewser.settings.onChanged((newSettings) => {
        state.settings = newSettings;
        applySettings();
        // Subtle hint instead of toast (settings page already shows its own)
        const hint = document.createElement('div');
        hint.textContent = t('settingsApplied');
        Object.assign(hint.style, {
            position: 'fixed', top: '96px', right: '16px',
            color: 'rgba(255,255,255,0.3)', fontSize: '12px',
            fontWeight: '400', letterSpacing: '0.3px',
            pointerEvents: 'none', zIndex: '9000',
            animation: 'toast-in 0.3s ease-out, toast-out 0.3s ease 1.5s forwards'
        });
        document.body.appendChild(hint);
        setTimeout(() => hint.remove(), 2200);
    });

    // ============================================================
    // KEYBOARD SHORTCUTS
    // ============================================================
    function handleShortcut(key, ctrl, shift) {
        if (ctrl && (key === 't' || key === 'T') && !shift) { openNewTabFromUser(); return true; }
        if (ctrl && (key === 'w' || key === 'W') && !shift) { closeTab(state.activeTabId); return true; }
        if (ctrl && !shift && (key === 'n' || key === 'N')) { window.olewser.window.newWindow(); return true; }
        if (ctrl && shift && (key === 'n' || key === 'N')) { window.olewser.window.newIncognito(); return true; }
        if (ctrl && shift && (key === 't' || key === 'T')) { restoreClosedTab(); return true; }
        if (ctrl && (key === 'k' || key === 'K') && !shift) { toggleCommandPalette(); return true; }
        if (ctrl && (key === 'f' || key === 'F') && !shift) { toggleFindBar(); return true; }
        if (ctrl && (key === 'h' || key === 'H') && !shift) {
            if (state.sidebarOpen && state.sidebarPanel === 'history') { state.sidebarOpen = false; dom.sidebar.style.display = 'none'; }
            else { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('history'); }
            return true;
        }
        if (ctrl && (key === 'j' || key === 'J') && !shift) {
            if (state.sidebarOpen && state.sidebarPanel === 'downloads') { state.sidebarOpen = false; dom.sidebar.style.display = 'none'; }
            else { state.sidebarOpen = true; dom.sidebar.style.display = ''; renderSidebarPanel('downloads'); }
            return true;
        }
        if (ctrl && (key === 'l' || key === 'L') && !shift) { dom.urlInput.focus(); dom.urlInput.select(); return true; }
        if (ctrl && (key === 'p' || key === 'P') && !shift) { printPage(); return true; }
        if (ctrl && (key === 'r' || key === 'R') && !shift) { document.getElementById('wv-' + state.activeTabId)?.reload(); return true; }
        if (ctrl && (key === '=' || key === '+')) { setZoom(0.1); return true; }
        if (ctrl && key === '-') { setZoom(-0.1); return true; }
        if (ctrl && key === '0') { resetZoom(); return true; }
        if (key === 'F5') { document.getElementById('wv-' + state.activeTabId)?.reload(); return true; }
        if (key === 'F11') { window.olewser.window.fullscreen(); return true; }
        if (key === 'F12') { openDevTools(); return true; }
        if (ctrl && key === 'Tab') {
            switchRelativeTab(shift ? -1 : 1);
            return true;
        }
        if (ctrl && key >= '1' && key <= '9') {
            const idx = parseInt(key) - 1;
            if (state.tabs[idx]) switchTab(state.tabs[idx].id);
            return true;
        }
        return false;
    }

    document.addEventListener('keydown', (e) => {
        const ctrl = e.ctrlKey || e.metaKey, shift = e.shiftKey;
        if (handleShortcut(e.key, ctrl, shift)) { e.preventDefault(); }
        if (e.key === 'Escape') {
            hideContextMenu();
            hideTabSwitcherPanel();
            if (dom.commandPalette.style.display !== 'none') toggleCommandPalette();
            if (dom.findBar.style.display !== 'none') toggleFindBar();
        }
        if (ctrl && e.key >= '1' && e.key <= '9') { e.preventDefault(); }
    });

    // Handle shortcuts forwarded from webview via main process IPC
    window.olewser.on.shortcut((data) => {
        handleShortcut(data.key, data.ctrl, data.shift);
    });

    // ============================================================
    // INTRO
    // ============================================================
    async function initIntro() {
        // No intro video - skip immediately
        hideIntro();
    }

    function hideIntro() {
        if (state.introShown) return;
        state.introShown = true;
        dom.introOverlay.style.transition = 'opacity 0.5s';
        dom.introOverlay.style.opacity = '0';
        setTimeout(() => { dom.introOverlay.style.display = 'none'; }, 500);
    }

    // ============================================================
    // EVENT BINDINGS
    // ============================================================
    function bindEvents() {
        dom.btnMinimize.addEventListener('click', () => window.olewser.window.minimize());
        dom.btnMaximize.addEventListener('click', () => window.olewser.window.maximize());
        dom.btnClose.addEventListener('click', () => window.olewser.window.close());

        dom.btnBack.addEventListener('click', () => document.getElementById('wv-' + state.activeTabId)?.goBack());
        dom.btnForward.addEventListener('click', () => document.getElementById('wv-' + state.activeTabId)?.goForward());
        dom.btnReload.addEventListener('click', () => document.getElementById('wv-' + state.activeTabId)?.reload());
        dom.btnHome.addEventListener('click', () => {
            const wv = document.getElementById('wv-' + state.activeTabId);
            if (wv) wv.src = state.isIncognito ? incognitoUrl() : newtabUrl();
        });

        dom.btnNewTab.addEventListener('click', () => openNewTabFromUser());
        dom.tabStrip.addEventListener('dblclick', (e) => { if (!e.target.closest('.tab') && !e.target.closest('.btn-new-tab')) openNewTabFromUser(); });
        dom.tabStrip.addEventListener('wheel', (e) => { e.preventDefault(); dom.tabStrip.scrollLeft += e.deltaY; }, { passive: false });
        initTabStripDragScroll();
        dom.tabCounter.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleTabSwitcherPanel();
        });
        dom.tabCounter.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            showTabSwitcherPanel();
        });
        dom.tabCounter.addEventListener('wheel', (e) => {
            if (!state.tabs.length) return;
            e.preventDefault();
            const direction = (e.deltaY || 0) > 0 ? 1 : -1;
            switchRelativeTab(direction);
            showTabSwitcherPanel();
        }, { passive: false });

        dom.urlInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') { navigate(dom.urlInput.value); dom.urlAutocomplete.style.display = 'none'; }
            if (e.key === 'Escape') { dom.urlInput.blur(); dom.urlAutocomplete.style.display = 'none'; }
        });
        dom.urlInput.addEventListener('input', () => {
            dom.urlClear.style.display = dom.urlInput.value ? 'flex' : 'none';
            showAutocomplete(dom.urlInput.value);
        });
        dom.urlInput.addEventListener('focus', () => dom.urlInput.select());
        dom.urlInput.addEventListener('blur', () => setTimeout(() => { dom.urlAutocomplete.style.display = 'none'; }, 200));
        dom.urlClear.addEventListener('click', () => { dom.urlInput.value = ''; dom.urlInput.focus(); });

        dom.urlCopy.addEventListener('click', () => { navigator.clipboard.writeText(dom.urlInput.value || ''); toast(`${t('copyUrl')}: OK`); });
        dom.urlQr.addEventListener('click', showQrCode);
        dom.quickAccessAdd.addEventListener('click', addCurrentSiteToQuickAccess);
        dom.urlBookmark.addEventListener('click', async () => {
            const t = state.tabs.find(x => x.id === state.activeTabId);
            if (!t) return;

            const currentUrl = getActiveTabCurrentUrl() || t.url;
            if (!currentUrl) {
                toast('Failed to detect page URL', 'error');
                return;
            }

            const wv = getActiveWebviewElement();
            const scrollY = await (wv ? wv.executeJavaScript('Math.max(0, Math.floor(window.scrollY || 0));').catch(() => 0) : Promise.resolve(0));
            await window.olewser.bookmarks.add({ url: currentUrl, title: t.title, favicon: t.favicon, scrollY });
            toast('Bookmark added', 'success');
            dom.urlBookmark.classList.add('bookmarked');
        });

        dom.btnSidebar.addEventListener('click', toggleSidebar);
        $$('.sidebar-tab').forEach(btn => btn.addEventListener('click', () => renderSidebarPanel(btn.dataset.panel)));

        dom.findInput.addEventListener('input', () => { const wv = document.getElementById('wv-' + state.activeTabId); if (wv && dom.findInput.value) wv.findInPage(dom.findInput.value); });
        dom.findNext.addEventListener('click', () => { const wv = document.getElementById('wv-' + state.activeTabId); if (wv) wv.findInPage(dom.findInput.value); });
        dom.findPrev.addEventListener('click', () => { const wv = document.getElementById('wv-' + state.activeTabId); if (wv) wv.findInPage(dom.findInput.value, { forward: false }); });
        dom.findClose.addEventListener('click', toggleFindBar);
        dom.zoomReset.addEventListener('click', resetZoom);

        // Feature buttons
        dom.btnPulse.addEventListener('click', () => {
            hideTabSwitcherPanel();
            dom.pulsePanel.style.display = dom.pulsePanel.style.display === 'none' ? '' : 'none';
            updatePulse();
        });
        dom.pulseClose.addEventListener('click', () => { dom.pulsePanel.style.display = 'none'; });
        if (dom.pulseAdblockToggle) {
            dom.pulseAdblockToggle.addEventListener('change', (e) => {
                setPulseAdblockMode(!!e.target.checked);
            });
        }

        initAIAgent();
        dom.btnScreenshot.addEventListener('click', takeScreenshot);
        dom.btnPwa?.addEventListener('click', installCurrentSiteAsApp);

        // Downloads button
        dom.btnDownloads.addEventListener('click', (e) => {
            e.stopPropagation();
            hideTabSwitcherPanel();
            const panel = dom.downloadsPanel;
            if (panel.style.display !== 'none') {
                panel.style.display = 'none';
            } else {
                dom.pulsePanel.style.display = 'none';
                hideContextMenu();
                panel.style.display = '';
                renderDownloadsPanel();
            }
        });
        dom.downloadsOpenFolder.addEventListener('click', () => {
            window.olewser.actions.openDownloadsFolder?.();
        });
        dom.downloadsClear.addEventListener('click', () => {
            state.downloadsList = [];
            renderDownloadsPanel();
        });
        dom.downloadsShowAll.addEventListener('click', () => {
            dom.downloadsPanel.style.display = 'none';
            renderSidebarPanel('downloads');
            if (!state.sidebarOpen) toggleSidebar();
        });

        // MENU BUTTON -> Dropdown menu (NOT command palette)
        dom.btnMenu.addEventListener('click', (e) => {
            e.stopPropagation();
            // Toggle: if menu is showing, close it
            if (dom.contextMenu.style.display !== 'none') {
                hideContextMenu();
            } else {
                showDropdownMenu();
            }
        });

        // Command palette input
        dom.commandInput.addEventListener('input', () => renderCommands(dom.commandInput.value));
        dom.commandPalette.addEventListener('click', (e) => { if (e.target === dom.commandPalette) toggleCommandPalette(); });

        // Close downloads panel on outside click
        document.addEventListener('mousedown', (e) => {
            if (dom.downloadsPanel.style.display !== 'none' && !dom.downloadsPanel.contains(e.target) && !dom.btnDownloads.contains(e.target)) {
                dom.downloadsPanel.style.display = 'none';
            }
            if (isTabSwitcherVisible() && !dom.tabSwitcherPanel.contains(e.target) && !dom.tabCounter.contains(e.target)) {
                hideTabSwitcherPanel();
            }
        });

        // Ripple
        document.addEventListener('click', (e) => {
            const btn = e.target.closest('.nav-btn, .feature-btn, .window-btn, .btn-new-tab');
            if (!btn) return;
            const ripple = document.createElement('span'); ripple.className = 'ripple';
            const rect = btn.getBoundingClientRect();
            ripple.style.left = (e.clientX - rect.left) + 'px'; ripple.style.top = (e.clientY - rect.top) + 'px';
            btn.appendChild(ripple); setTimeout(() => ripple.remove(), 500);
        });

        // Ctrl + Mouse Wheel Zoom
        dom.webviewContainer.addEventListener('wheel', (e) => {
            if (!e.ctrlKey) return;
            e.preventDefault();
            e.stopPropagation();
            setZoom(e.deltaY < 0 ? 0.1 : -0.1);
        }, { passive: false });

        // Download bar close
        dom.downloadBarClose.addEventListener('click', () => {
            dom.downloadBar.style.display = 'none';
        });

        // IPC listeners
        window.olewser.window.onStateChanged((d) => { dom.btnMaximize.title = d.maximized ? t('restore') : t('maximize'); });
        window.olewser.window.onFullscreenChanged((fs) => {
            dom.shell.classList.toggle('fullscreen', fs);
            if (!fs) dom.shell.classList.remove('fs-hidden'); // reset on exit fullscreen
        });
        window.olewser.on.incognito((enabled) => {
            if (!enabled) return;
            state.isIncognito = true;
            syncWindowIncognitoUi();
        });

        // Fullscreen menu toggle button
        const fsToggle = document.getElementById('btn-fs-toggle');
        fsToggle.addEventListener('click', () => {
            const hidden = dom.shell.classList.toggle('fs-hidden');
            // Flip chevron: up = hide, down = show
            fsToggle.innerHTML = hidden
                ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="6 9 12 15 18 9"></polyline></svg>'
                : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="18 15 12 9 6 15"></polyline></svg>';
        });
        window.olewser.on.openUrl((url) => openNewTabFromUser(url));
        window.olewser.on.toast((data) => toast(data.message, data.type));
        window.olewser.on.translateSelection((text) => {
            const value = String(text || '').trim();
            if (!value) return;
            openAiPanelAndRun('translate-selection', { text: value, targetLang: state.settings.language || 'en' });
        });
        window.addEventListener('message', (event) => {
            const data = event?.data;
            if (!data || !data.__olewserAiBridge) return;
            const action = String(data.action || '').trim();
            if (action === 'create-automation-rule') {
                createAutomationRuleForCurrentSite();
            } else if (action === 'request-daily-digest') {
                requestDailyDigestFromOpenTabs();
            }
        });

        // Download progress bar + panel
        window.olewser.downloads.onProgress((d) => {
            dom.downloadBar.style.display = '';
            dom.downloadBarName.textContent = d.filename;
            const pct = d.totalBytes > 0 ? Math.round((d.receivedBytes / d.totalBytes) * 100) : 0;
            dom.downloadBarFill.style.width = pct + '%';
            dom.downloadBarStats.textContent = `${formatBytes(d.receivedBytes)} / ${formatBytes(d.totalBytes)} - ${pct}%`;
            // Update downloads panel list
            const existing = state.downloadsList.find(x => x.filename === d.filename);
            if (existing) {
                existing.receivedBytes = d.receivedBytes;
                existing.totalBytes = d.totalBytes;
                existing.state = 'progressing';
            } else {
                state.downloadsList.unshift({ filename: d.filename, receivedBytes: d.receivedBytes, totalBytes: d.totalBytes, state: 'progressing' });
            }
            if (dom.downloadsPanel.style.display !== 'none') renderDownloadsPanel();
        });

        window.olewser.downloads.onComplete((d) => {
            dom.downloadBarName.textContent = d.filename;
            dom.downloadBarFill.style.width = '100%';
            dom.downloadBarStats.textContent = 'Done!';
            toast(`Downloaded: ${d.filename}`, 'success');
            // Auto-hide after 4 seconds
            setTimeout(() => { dom.downloadBar.style.display = 'none'; }, 4000);
            // Update panel list
            const existing = state.downloadsList.find(x => x.filename === d.filename);
            if (existing) {
                existing.state = 'completed';
                existing.totalBytes = d.totalBytes || existing.totalBytes || existing.receivedBytes;
            } else {
                state.downloadsList.unshift({ filename: d.filename, receivedBytes: d.totalBytes || 0, totalBytes: d.totalBytes || 0, state: 'completed' });
            }
            if (dom.downloadsPanel.style.display !== 'none') renderDownloadsPanel();
            if (state.sidebarPanel === 'downloads') renderSidebarPanel('downloads');
        });
    }

    // RAM monitor
    setInterval(() => { if (performance.memory) dom.statusRam.textContent = 'RAM: ' + formatBytes(performance.memory.usedJSHeapSize); }, 5000);

    // ============================================================
    // AI AGENT - Full Browser Control
    // ============================================================
    const aiState = {
        isActive: false,
        recognition: null,
        visualizerInterval: null,
        isProcessing: false,
        voicesInfo: []
    };

    function initAIAgent() {
        if (!dom.btnAi) return;
        dom.btnAi.addEventListener('click', toggleOleksandraiPanel);
        if (dom.oleksandraiPanelClose) dom.oleksandraiPanelClose.addEventListener('click', closeOleksandraiPanel);
        initOleksandraiPanelDrag();
    }

    function initOleksandraiPanelDrag() {
        if (!dom.oleksandraiPanel || !dom.oleksandraiPanelHeader) return;

        const panel = dom.oleksandraiPanel;
        const header = dom.oleksandraiPanelHeader;
        let dragging = false;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        let activePointerId = null;

        const onPointerMove = (e) => {
            if (!dragging) return;
            if (activePointerId !== null && e.pointerId !== activePointerId) return;
            const rect = panel.getBoundingClientRect();
            const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
            const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
            const left = clamp(e.clientX - dragOffsetX, 8, maxLeft);
            const top = clamp(e.clientY - dragOffsetY, 8, maxTop);
            panel.style.left = `${left}px`;
            panel.style.top = `${top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';
        };

        const stopDragging = () => {
            if (!dragging) return;
            dragging = false;
            panel.classList.remove('dragging');
            document.removeEventListener('pointermove', onPointerMove);
            document.removeEventListener('pointerup', stopDragging);
            document.removeEventListener('pointercancel', stopDragging);
            window.removeEventListener('blur', stopDragging);
            if (activePointerId !== null && typeof header.hasPointerCapture === 'function' && header.hasPointerCapture(activePointerId)) {
                try {
                    header.releasePointerCapture(activePointerId);
                } catch (_) { }
            }
            activePointerId = null;
        };

        header.addEventListener('lostpointercapture', stopDragging);
        header.addEventListener('pointerdown', (e) => {
            if (!panel.classList.contains('open')) return;
            if (e.button !== 0) return;
            if (e.target.closest('#oleksandrai-panel-close')) return;

            const rect = panel.getBoundingClientRect();
            dragging = true;
            activePointerId = e.pointerId;
            dragOffsetX = e.clientX - rect.left;
            dragOffsetY = e.clientY - rect.top;
            panel.classList.add('dragging');
            panel.style.left = `${rect.left}px`;
            panel.style.top = `${rect.top}px`;
            panel.style.right = 'auto';
            panel.style.bottom = 'auto';

            if (typeof header.setPointerCapture === 'function') {
                try {
                    header.setPointerCapture(activePointerId);
                } catch (_) { }
            }
            e.preventDefault();
            document.addEventListener('pointermove', onPointerMove);
            document.addEventListener('pointerup', stopDragging);
            document.addEventListener('pointercancel', stopDragging);
            window.addEventListener('blur', stopDragging);
        });

        panel.__stopOleksandraiPanelDrag = stopDragging;
        window.addEventListener('resize', () => {
            if (!panel.classList.contains('open')) return;
            if (!panel.style.left) return;
            const rect = panel.getBoundingClientRect();
            const maxLeft = Math.max(8, window.innerWidth - rect.width - 8);
            const maxTop = Math.max(8, window.innerHeight - rect.height - 8);
            panel.style.left = `${clamp(rect.left, 8, maxLeft)}px`;
            panel.style.top = `${clamp(rect.top, 8, maxTop)}px`;
        });
    }

    function toggleOleksandraiPanel() {
        if (!dom.oleksandraiPanel) return;
        const isOpen = dom.oleksandraiPanel.classList.contains('open');
        if (isOpen) {
            closeOleksandraiPanel();
            return;
        }
        hideTabSwitcherPanel();
        dom.pulsePanel.style.display = 'none';
        hideContextMenu();
        dom.oleksandraiPanel.classList.add('open');
        dom.btnAi.classList.add('active');
    }

    function closeOleksandraiPanel() {
        if (!dom.oleksandraiPanel) return;
        if (typeof dom.oleksandraiPanel.__stopOleksandraiPanelDrag === 'function') {
            dom.oleksandraiPanel.__stopOleksandraiPanelDrag();
        }
        const activeEl = document.activeElement;
        const hadPanelFocus = activeEl === dom.oleksandraiFrame || (activeEl && dom.oleksandraiPanel.contains(activeEl));
        dom.oleksandraiPanel.classList.remove('open');
        dom.btnAi.classList.remove('active');
        if (hadPanelFocus && dom.urlInput) {
            dom.urlInput.focus();
            dom.urlInput.select();
        }
    }

    function pushDebugLog(text, color = '#00ff00') {
        console.log(`[Olewser-AI] ${text}`);
    }

    async function toggleAiVoiceAgent() {
        if (aiState.isActive) {
            closeAiVoiceAgent();
            return;
        }

        aiState.isActive = true;
        aiState.isProcessing = false;

        // UI
        dom.pulsePanel.style.display = 'none';
        hideContextMenu();
        dom.aiOrbContainer.style.display = 'flex';
        dom.aiOrbStatus.textContent = "Connecting...";
        dom.aiOrbVisualizer.classList.add('active');

        // Visualizer pulse
        aiState.visualizerInterval = setInterval(() => {
            if (aiState.isActive && dom.aiOrbVisualizer.classList.contains('active')) {
                const rings = Array.from(dom.aiOrbVisualizer.querySelectorAll('.orb-ring'));
                rings.forEach((r) => {
                    r.style.transform = `scale(${1 + Math.random() * 0.15})`;
                });
            }
        }, 100);

        try {
            // Check which AI provider to use
            const provider = await window.olewser.ai.getProvider();
            aiState._provider = provider;
            pushDebugLog(`Provider: ${provider}`, '#00ffff');

            if (provider === 'gemini') {
                await connectGeminiVoice();
            } else {
                await connectOpenAIVoice();
            }
        } catch (e) {
            console.error(e);
            pushDebugLog(`Error: ${e.message}`, '#ff4444');
            dom.aiOrbStatus.textContent = "Error: " + e.message;
            setTimeout(closeAiVoiceAgent, 3000);
        }
    }

    // ============================================================
    // OpenAI Realtime Voice (WebRTC)
    // ============================================================
    async function connectOpenAIVoice() {
        // 1. Get ephemeral token from main process
        pushDebugLog('Getting Realtime token...', '#00ffff');
        const tokenResult = await window.olewser.ai.getRealtimeToken();
        if (tokenResult.error) {
            throw new Error(tokenResult.error);
        }
        const EPHEMERAL_KEY = tokenResult.token;
        pushDebugLog('Token received, connecting WebRTC...', '#00ffff');

        // 2. Create WebRTC PeerConnection
        const pc = new RTCPeerConnection();
        aiState._pc = pc;

        // 3. Set up audio element for AI voice output
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        pc.ontrack = (event) => {
            audioEl.srcObject = event.streams[0];
        };
        aiState._audioEl = audioEl;

        // 4. Capture microphone and add to peer connection
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        aiState._micStream = micStream;
        pc.addTrack(micStream.getTracks()[0]);

        // 5. Create data channel for events (tool calls, transcripts, etc.)
        const dc = pc.createDataChannel('oai-events');
        aiState._dc = dc;

        dc.onopen = () => {
            pushDebugLog('Realtime connected!', '#00ff00');
            dom.aiOrbStatus.textContent = "Listening...";

            // Configure the session with our tools and personality
            const sessionConfig = {
                type: 'session.update',
                session: {
                    instructions: `You are OleksandrAi, the built-in AI assistant in the Olewser browser, created by OleksandrCorp.

Identity rules:
- If the user asks who you are, your name, or who created you, answer clearly:
  "My name is OleksandrAi. I was created by OleksandrCorp."
- Do not claim any other name or creator.

Behavior rules:
- Reply in the same language as the user (SK, UK, RU, EN).
- Default to Slovak if language is unclear.
- Be polite, clear, and concise.
- Do not use profanity, insults, or aggressive slang.
- Do not narrate internal tool usage.

Browser-action rules:
- If an action is needed (open site, search, click, type, scroll, back/forward), execute the action and then report the result.
- Do not invent URLs; use search when exact URL is unknown.`,
                    tools: [
                        {
                            type: 'function',
                            name: 'open_website',
                            description: 'Open a website by exact URL',
                            parameters: { type: 'object', properties: { url: { type: 'string' } }, required: ['url'] }
                        },
                        {
                            type: 'function',
                            name: 'google_search',
                            description: 'Search in Google when exact URL is unknown',
                            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
                        },
                        {
                            type: 'function',
                            name: 'search_youtube',
                            description: 'Search video on YouTube',
                            parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] }
                        },
                        {
                            type: 'function',
                            name: 'click_text',
                            description: 'Click an element that contains the provided text',
                            parameters: { type: 'object', properties: { text: { type: 'string' } }, required: ['text'] }
                        },
                        {
                            type: 'function',
                            name: 'type_text',
                            description: 'Type text into an input field',
                            parameters: { type: 'object', properties: { target_text: { type: 'string' }, value: { type: 'string' } }, required: ['target_text', 'value'] }
                        },
                        {
                            type: 'function',
                            name: 'scroll',
                            description: 'Scroll the current page',
                            parameters: { type: 'object', properties: { direction: { type: 'string', enum: ['up', 'down'] } }, required: ['direction'] }
                        },
                        {
                            type: 'function',
                            name: 'go_back',
                            description: 'Go back in browser history',
                            parameters: { type: 'object', properties: {} }
                        },
                        {
                            type: 'function',
                            name: 'go_forward',
                            description: 'Go forward in browser history',
                            parameters: { type: 'object', properties: {} }
                        },
                        {
                            type: 'function',
                            name: 'describe_page',
                            description: 'Capture a screenshot and describe what is visible on the page in detail',
                            parameters: { type: 'object', properties: {} }
                        }
                    ],
                    input_audio_transcription: { model: 'whisper-1' },
                    turn_detection: { type: 'server_vad', threshold: 0.5, silence_duration_ms: 600 }
                }
            };
            dc.send(JSON.stringify(sessionConfig));
        };

        // Handle events from OpenAI Realtime
        let pendingToolCalls = {};

        dc.onmessage = async (event) => {
            try {
                const msg = JSON.parse(event.data);

                // User speech transcription
                if (msg.type === 'conversation.item.input_audio_transcription.completed') {
                    pushDebugLog(`USER: ${msg.transcript}`, '#0f0');
                }

                // AI is generating a response
                if (msg.type === 'response.audio_transcript.delta') {
                    dom.aiOrbStatus.textContent = "Speaking...";
                }

                // AI finished speaking
                if (msg.type === 'response.audio_transcript.done') {
                    pushDebugLog(`AI: ${msg.transcript}`, '#ffffff');
                    dom.aiOrbStatus.textContent = "Listening...";
                }

                // Tool call received
                if (msg.type === 'response.function_call_arguments.done') {
                    const toolName = msg.name;
                    const toolArgs = JSON.parse(msg.arguments);
                    const callId = msg.call_id;

                    pushDebugLog(`Tool: ${toolName}(${JSON.stringify(toolArgs)})`, '#00ccff');

                    let toolResult = "done";

                    if (toolName === 'open_website') {
                        dom.aiOrbStatus.textContent = "Opening...";
                        await window.olewser.ai.executeAction({ type: 'navigate', url: toolArgs.url });
                    }
                    else if (toolName === 'google_search') {
                        dom.aiOrbStatus.textContent = "Searching...";
                        const url = 'https://www.google.com/search?q=' + encodeURIComponent(toolArgs.query);
                        await window.olewser.ai.executeAction({ type: 'navigate', url: url });
                    }
                    else if (toolName === 'search_youtube') {
                        dom.aiOrbStatus.textContent = "Searching YouTube...";
                        const url = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(toolArgs.query);
                        await window.olewser.ai.executeAction({ type: 'navigate', url: url });
                    }
                    else if (toolName === 'click_text') {
                        dom.aiOrbStatus.textContent = "Clicking...";
                        const jsCode = `
                                (() => {
                                    const text = ${JSON.stringify(toolArgs.text)}.toLowerCase();
                                    const els = Array.from(document.querySelectorAll('a, button, yt-formatted-string, span, [role="button"], [role="link"]'))
                                        .filter(e => e.innerText && e.innerText.toLowerCase().includes(text));
                                    if (els.length > 0) {
                                        (els[0].closest('a, button, [role="button"]') || els[0]).click();
                                        return "Clicked: " + text;
                                    }
                                    return "Not found: " + text;
                                })();
                            `;
                        const r = await window.olewser.ai.executeAction({ type: 'executeJS', code: jsCode });
                        toolResult = r?.result || "clicked";
                    }
                    else if (toolName === 'type_text') {
                        dom.aiOrbStatus.textContent = "Typing...";
                        const jsCode = `
                                (() => {
                                    const hint = ${JSON.stringify(toolArgs.target_text)}.toLowerCase();
                                    const value = ${JSON.stringify(toolArgs.value)};
                                    const inputs = Array.from(document.querySelectorAll('input, textarea, [contenteditable]'));
                                    let target = inputs.find(el =>
                                        (el.placeholder && el.placeholder.toLowerCase().includes(hint)) ||
                                        (el.ariaLabel && el.ariaLabel.toLowerCase().includes(hint)) ||
                                        (el.name && el.name.toLowerCase().includes(hint)));
                                    if (!target && inputs.length > 0) target = inputs[0];
                                    if (target) {
                                        target.focus();
                                        if (target.isContentEditable) target.innerText = value;
                                        else target.value = value;
                                        target.dispatchEvent(new Event('input', {bubbles:true}));
                                        target.dispatchEvent(new Event('change', {bubbles:true}));
                                        const form = target.closest('form');
                                        if (form) form.submit();
                                        return "Typed: " + value;
                                    }
                                    return "No input found";
                                })();
                            `;
                        const r = await window.olewser.ai.executeAction({ type: 'executeJS', code: jsCode });
                        toolResult = r?.result || "typed";
                    }
                    else if (toolName === 'scroll') {
                        dom.aiOrbStatus.textContent = "Scrolling...";
                        const px = toolArgs.direction === 'up' ? -800 : 800;
                        await window.olewser.ai.executeAction({ type: 'executeJS', code: `window.scrollBy({top:${px},behavior:'smooth'})` });
                    }
                    else if (toolName === 'go_back') {
                        dom.aiOrbStatus.textContent = "Going back...";
                        await window.olewser.ai.executeAction({ type: 'executeJS', code: `history.back()` });
                    }
                    else if (toolName === 'go_forward') {
                        dom.aiOrbStatus.textContent = "Going forward...";
                        await window.olewser.ai.executeAction({ type: 'executeJS', code: `history.forward()` });
                    }
                    else if (toolName === 'describe_page') {
                        dom.aiOrbStatus.textContent = "Analyzing page...";
                        try {
                            const screenshot = await window.olewser.ai.captureTab();
                            if (screenshot && screenshot.base64) {
                                // Send screenshot to GPT-4o REST API for actual vision analysis
                                const visionResult = await window.olewser.ai.describeScreen(screenshot.base64);
                                if (visionResult.description) {
                                    toolResult = visionResult.description;
                                    pushDebugLog('Vision: ' + toolResult.substring(0, 80) + '...', '#ffff00');
                                } else {
                                    toolResult = "Vision error: " + (visionResult.error || 'unknown');
                                }
                            } else {
                                toolResult = "Could not capture screenshot";
                            }
                        } catch (e) {
                            toolResult = "Screenshot failed: " + e.message;
                        }
                    }

                    // Send tool result back to Realtime API
                    dc.send(JSON.stringify({
                        type: 'conversation.item.create',
                        item: {
                            type: 'function_call_output',
                            call_id: callId,
                            output: JSON.stringify({ result: toolResult })
                        }
                    }));
                    // Trigger AI to respond after tool execution
                    dc.send(JSON.stringify({ type: 'response.create' }));

                    dom.aiOrbStatus.textContent = "Listening...";
                }

                // Error handling
                if (msg.type === 'error') {
                    pushDebugLog(`Realtime Error: ${msg.error?.message || JSON.stringify(msg)}`, '#ff4444');
                }

            } catch (e) {
                pushDebugLog(`Event parse error: ${e.message}`, '#ff4444');
            }
        };

        // 6. Create and set local SDP offer
        console.log('[AI-WEBRTC] Creating SDP offer...');
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        console.log('[AI-WEBRTC] SDP offer created, sending via IPC...');

        // 7. Send SDP to OpenAI via main process (avoids CORS from file:// origin)
        const sdpResult = await window.olewser.ai.sendSDP(EPHEMERAL_KEY, offer.sdp);
        if (sdpResult.error) {
            throw new Error(sdpResult.error);
        }
        console.log('[AI-WEBRTC] Got SDP answer, setting remote description...');
        await pc.setRemoteDescription({ type: 'answer', sdp: sdpResult.sdp });

        pushDebugLog('WebRTC connected to OpenAI Realtime!', '#00ff00');
        console.log('[AI-WEBRTC] WebRTC fully connected!');
    }

    // ============================================================
    // Gemini Live Voice (WebSocket)
    // ============================================================
    async function connectGeminiVoice() {
        pushDebugLog('Connecting to Gemini Live...', '#00ffff');
        dom.aiOrbStatus.textContent = "Connecting to Gemini...";

        // 1. Connect WebSocket via main process
        const result = await window.olewser.ai.connectGemini();
        if (result.error) {
            throw new Error(result.error);
        }
        pushDebugLog('Gemini connected!', '#00ff00');
        dom.aiOrbStatus.textContent = "Listening... (Gemini)";

        // 2. Capture microphone
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: { sampleRate: 16000, channelCount: 1 } });
        aiState._micStream = micStream;

        // 3. Set up AudioContext for sending mic audio as PCM base64
        const audioCtx = new AudioContext({ sampleRate: 16000 });
        aiState._audioCtx = audioCtx;
        const source = audioCtx.createMediaStreamSource(micStream);
        const processor = audioCtx.createScriptProcessor(4096, 1, 1);

        processor.onaudioprocess = (e) => {
            if (!aiState.isActive) return;
            const float32 = e.inputBuffer.getChannelData(0);
            // Convert Float32 to Int16 PCM
            const int16 = new Int16Array(float32.length);
            for (let i = 0; i < float32.length; i++) {
                int16[i] = Math.max(-32768, Math.min(32767, Math.round(float32[i] * 32768)));
            }
            // Convert to base64
            const uint8 = new Uint8Array(int16.buffer);
            let binary = '';
            for (let i = 0; i < uint8.length; i++) {
                binary += String.fromCharCode(uint8[i]);
            }
            const base64 = btoa(binary);
            // Send to Gemini via IPC
            window.olewser.ai.sendGeminiAudio(base64);
        };

        source.connect(processor);
        processor.connect(audioCtx.destination);
        aiState._processor = processor;
        aiState._source = source;

        // 4. Set up AudioContext for playback (24kHz PCM from Gemini)
        const playCtx = new AudioContext({ sampleRate: 24000 });
        aiState._playCtx = playCtx;
        let nextStartTime = 0;

        function playPcmChunk(base64Data) {
            // Convert base64 to Float32 audio buffer
            const binaryStr = atob(base64Data);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
            }
            const int16 = new Int16Array(bytes.buffer);
            const float32 = new Float32Array(int16.length);
            for (let i = 0; i < int16.length; i++) {
                float32[i] = int16[i] / 32768;
            }

            const audioBuffer = playCtx.createBuffer(1, float32.length, 24000);
            audioBuffer.getChannelData(0).set(float32);

            const bufferSource = playCtx.createBufferSource();
            bufferSource.buffer = audioBuffer;
            bufferSource.connect(playCtx.destination);

            // Schedule seamlessly - no gaps between chunks
            const now = playCtx.currentTime;
            const startAt = Math.max(now, nextStartTime);
            bufferSource.start(startAt);
            nextStartTime = startAt + audioBuffer.duration;
        }

        // 5. Listen for Gemini events
        window.olewser.ai.onGeminiEvent(async (msg) => {
            if (!aiState.isActive) return;

            // Audio response
            if (msg.serverContent && msg.serverContent.modelTurn && msg.serverContent.modelTurn.parts) {
                for (const part of msg.serverContent.modelTurn.parts) {
                    if (part.inlineData && part.inlineData.data) {
                        playPcmChunk(part.inlineData.data);
                    }
                    if (part.text) {
                        pushDebugLog(`AI: ${part.text.substring(0, 100)}`, '#00ff88');
                    }
                }
            }

            // Interruption - reset scheduled playback
            if (msg.serverContent && msg.serverContent.interrupted) {
                nextStartTime = 0;
            }

            // Tool calls
            if (msg.toolCall && msg.toolCall.functionCalls) {
                for (const fc of msg.toolCall.functionCalls) {
                    const toolName = fc.name;
                    const toolArgs = fc.args || {};
                    const callId = fc.id;
                    pushDebugLog(`Tool: ${toolName}(${JSON.stringify(toolArgs).substring(0, 60)})`, '#ff8800');

                    let toolResult = 'done';

                    // Execute tools (same logic as OpenAI)
                    if (toolName === 'open_website') {
                        dom.aiOrbStatus.textContent = "Opening...";
                        await window.olewser.ai.executeAction({ type: 'navigate', url: toolArgs.url });
                    } else if (toolName === 'google_search') {
                        dom.aiOrbStatus.textContent = "Searching...";
                        await window.olewser.ai.executeAction({ type: 'navigate', url: `https://www.google.com/search?q=${encodeURIComponent(toolArgs.query)}` });
                    } else if (toolName === 'search_youtube') {
                        dom.aiOrbStatus.textContent = "YouTube...";
                        await window.olewser.ai.executeAction({ type: 'navigate', url: `https://www.youtube.com/results?search_query=${encodeURIComponent(toolArgs.query)}` });
                    } else if (toolName === 'click_text') {
                        dom.aiOrbStatus.textContent = "Clicking...";
                        await window.olewser.ai.executeAction({ type: 'executeJS', code: `(function(){const e=document.evaluate("//*[contains(text(),'${toolArgs.text.replace(/'/g, "\\'")}')]",document,null,XPathResult.FIRST_ORDERED_NODE_TYPE,null);if(e.singleNodeValue)e.singleNodeValue.click();})()` });
                    } else if (toolName === 'type_text') {
                        dom.aiOrbStatus.textContent = "Typing...";
                        await window.olewser.ai.executeAction({ type: 'executeJS', code: `(function(){const i=document.querySelector('input[placeholder*="${toolArgs.target_text}"],textarea[placeholder*="${toolArgs.target_text}"]');if(i){i.focus();i.value='${toolArgs.value.replace(/'/g, "\\'")}';i.dispatchEvent(new Event('input',{bubbles:true}))}})()` });
                    } else if (toolName === 'scroll') {
                        dom.aiOrbStatus.textContent = "Scrolling...";
                        await window.olewser.ai.executeAction({ type: 'executeJS', code: `window.scrollBy(0, ${toolArgs.direction === 'down' ? 500 : -500})` });
                    } else if (toolName === 'go_back') {
                        await window.olewser.ai.executeAction({ type: 'executeJS', code: `history.back()` });
                    } else if (toolName === 'go_forward') {
                        await window.olewser.ai.executeAction({ type: 'executeJS', code: `history.forward()` });
                    } else if (toolName === 'describe_page') {
                        try {
                            const screenshot = await window.olewser.ai.captureTab();
                            if (screenshot && screenshot.base64) {
                                // Send image inline to Gemini - it processes natively while talking
                                await window.olewser.ai.sendGeminiImage(screenshot.base64);
                                toolResult = "Page screenshot captured. Please describe what you see.";
                            } else {
                                toolResult = "Could not capture screenshot";
                            }
                        } catch (e) {
                            toolResult = "Screenshot error: " + e.message;
                        }
                    }

                    // Send tool response
                    await window.olewser.ai.sendGeminiToolResponse([{
                        response: { result: toolResult },
                        id: callId
                    }]);

                    dom.aiOrbStatus.textContent = "Listening... (Gemini)";
                }
            }

            // Connection closed
            if (msg.connectionClosed) {
                pushDebugLog('Gemini disconnected', '#ff4444');
                closeAiVoiceAgent();
            }

            // Errors
            if (msg.error) {
                pushDebugLog(`Gemini error: ${msg.error}`, '#ff4444');
            }
        });

        pushDebugLog('Gemini voice agent active!', '#00ff00');
    }

    // handleAiCommand is no longer needed - Realtime API handles everything via data channel

    function closeAiVoiceAgent() {
        aiState.isActive = false;
        aiState.isProcessing = false;
        dom.aiOrbContainer.style.display = 'none';



        clearInterval(aiState.visualizerInterval);

        // Reset rings
        const rings = Array.from(dom.aiOrbVisualizer?.querySelectorAll('.orb-ring') || []);
        rings.forEach((r) => { r.style.transform = 'scale(1)'; });

        // Close OpenAI WebRTC resources
        if (aiState._dc) {
            try { aiState._dc.close(); } catch (e) { }
            aiState._dc = null;
        }
        if (aiState._pc) {
            try { aiState._pc.close(); } catch (e) { }
            aiState._pc = null;
        }
        if (aiState._audioEl) {
            aiState._audioEl.srcObject = null;
            aiState._audioEl = null;
        }

        // Close Gemini resources
        if (aiState._provider === 'gemini') {
            window.olewser.ai.disconnectGemini();
            window.olewser.ai.removeGeminiListeners();
        }
        if (aiState._processor) {
            try { aiState._processor.disconnect(); } catch (e) { }
            aiState._processor = null;
        }
        if (aiState._source) {
            try { aiState._source.disconnect(); } catch (e) { }
            aiState._source = null;
        }
        if (aiState._audioCtx) {
            try { aiState._audioCtx.close(); } catch (e) { }
            aiState._audioCtx = null;
        }
        if (aiState._playCtx) {
            try { aiState._playCtx.close(); } catch (e) { }
            aiState._playCtx = null;
        }

        // Close mic stream (shared by both providers)
        if (aiState._micStream) {
            aiState._micStream.getTracks().forEach(t => t.stop());
            aiState._micStream = null;
        }

        // Legacy cleanup
        if (aiState.recognition) {
            try { aiState.recognition.stop(); } catch (e) { }
            aiState.recognition = null;
        }
        window.speechSynthesis.cancel();
    }

    async function detectRuntimePlatform() {
        let platform = '';
        try {
            const info = await window.olewser.app.getInfo();
            platform = String(info?.platform || '').toLowerCase();
        } catch (_) {
            platform = '';
        }
        state.runtimePlatform = platform;
        const isMac = platform === 'darwin';
        document.documentElement.classList.toggle('platform-macos', isMac);
        document.body.classList.toggle('platform-macos', isMac);
        document.body.classList.toggle('macos-liquid', isMac);
    }

    // ============================================================
    // INIT
    // ============================================================
    async function init() {
        state.settings = await window.olewser.settings.load();
        syncWindowIncognitoUi();
        await detectRuntimePlatform();
        loadAutomationRules();
        try { _preloadPath = await window.olewser.app.getPreloadPath(); } catch (e) { }
        applySettings();
        state.quickAccess = loadQuickAccessSites();
        renderQuickAccess();
        bindEvents();
        await initAppUpdateBanner();
        await initIntro();
        let restored = false;
        if (!state.isIncognito && state.settings.restoreSession) {
            try {
                restored = await restoreLastSavedSession({ silent: true });
            } catch (_) { }
        }
        if (!restored) {
            createTab('', { _force: true, incognito: state.isIncognito });
        }
        setInterval(() => {
            saveAutoSession().catch(() => { });
        }, 20000);
        window.addEventListener('beforeunload', () => {
            saveAutoSession().catch(() => { });
        });
        setInterval(updatePulse, 10000);
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();

// ============================================================
// MAUZER BROWSER CONTROL BRIDGE
// Routes postMessage calls from oleksandrai iframe to window.olewser.ai.*
// ============================================================
(function () {
    'use strict';

    const AI_FRAME_ID = 'oleksandrai-frame';

    function replyToFrame(msgId, result, targetWindow, targetOrigin = '*') {
        const frame = document.getElementById(AI_FRAME_ID);
        const replyWindow = targetWindow || (frame && frame.contentWindow);
        if (replyWindow) {
            replyWindow.postMessage({ __mauzerReply: true, msgId, result }, targetOrigin || '*');
        }
    }

    function isFromAiFrame(event) {
        const frame = document.getElementById(AI_FRAME_ID);
        return !!(frame && frame.contentWindow && event.source === frame.contentWindow);
    }

    function getActiveWebview() {
        const active = document.querySelector('webview.active');
        if (active) return active;

        const all = document.querySelectorAll('webview');
        for (const wv of all) {
            if (wv.offsetParent !== null) {
                return wv;
            }
        }
        return all[0] || null;
    }

    function navigateToUrl(url) {
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.startsWith('file://')) {
            url = 'https://' + url;
        }
        const wv = getActiveWebview();
        if (wv) { wv.src = url; return { success: true, url }; }
        const input = document.getElementById('url-input');
        if (input) {
            input.value = url;
            input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, keyCode: 13 }));
            return { success: true, url };
        }
        return { error: 'No active webview found' };
    }

    window.addEventListener('message', async (event) => {
        const msg = event.data;
        if (!msg || !msg.__mauzerBridge) return;
        if (!isFromAiFrame(event)) return;

        const { msgId, action, payload } = msg;
        const ai = window.olewser && window.olewser.ai;
        if (!ai) { replyToFrame(msgId, { error: 'olewser.ai not available' }, event.source, event.origin); return; }

        try {
            let result;
            switch (action) {
                case 'captureTab':
                    result = await ai.captureTab(); break;
                case 'captureWithInfo':
                    result = await ai.captureWithInfo(); break;
                case 'getPageInfo':
                    result = await ai.getPageInfo(); break;
                case 'navigate':
                    result = navigateToUrl(payload.url); break;
                case 'executeAction':
                    result = await ai.executeAction(payload); break;
                case 'scroll':
                    result = await ai.executeAction({ type: 'scroll', direction: payload.direction || 'down' }); break;
                case 'goBack':
                    result = await ai.executeAction({ type: 'goBack' }); break;
                case 'goForward': {
                    const wv = getActiveWebview();
                    if (wv && wv.canGoForward()) { wv.goForward(); result = { success: true }; }
                    else result = { error: 'Cannot go forward' };
                    break;
                }
                case 'clickText': {
                    const wv = getActiveWebview();
                    if (wv) {
                        const safe = (payload.text || '').replace(/\\/g, '').replace(/'/g, '');
                        result = await wv.executeJavaScript(`(function(){
                            const els=[...document.querySelectorAll('a,button,input[type=submit],[role=button],li,span,div')];
                            const el=els.find(e=>e.textContent.toLowerCase().includes('${safe.toLowerCase()}'));
                            if(el){el.click();return{clicked:true,tag:el.tagName,text:el.textContent.trim().slice(0,60)};}
                            return{clicked:false};
                        })()`);
                    } else result = { error: 'No webview' };
                    break;
                }
                case 'typeText': {
                    const wv = getActiveWebview();
                    if (wv) {
                        const target = (payload.target_text || '').replace(/'/g, '');
                        const value = (payload.value || '').replace(/'/g, '');
                        result = await wv.executeJavaScript(`(function(){
                            let el=document.querySelector('[placeholder*="${target}"]')||
                                   document.querySelector('[aria-label*="${target}"]')||
                                   document.querySelector('input,textarea');
                            if(el){el.focus();el.value='${value}';
                                el.dispatchEvent(new Event('input',{bubbles:true}));
                                el.dispatchEvent(new Event('change',{bubbles:true}));
                                return{typed:true};}
                            return{typed:false};
                        })()`);
                    } else result = { error: 'No webview' };
                    break;
                }
                case 'describeScreen': {
                    const cap = await ai.captureTab();
                    if (cap.error) { result = { error: cap.error }; break; }
                    result = await ai.describeScreen(cap.base64);
                    break;
                }
                case 'googleSearch':
                    result = navigateToUrl('https://www.google.com/search?q=' + encodeURIComponent(payload.query)); break;
                case 'searchYoutube':
                    result = navigateToUrl('https://www.youtube.com/results?search_query=' + encodeURIComponent(payload.query)); break;
                case 'openTab': {
                    const url = payload.url || '';
                    document.dispatchEvent(new CustomEvent('mauzer:openTab', { detail: { url } }));
                    result = { success: true };
                    break;
                }
                case 'aiChat':
                    result = await ai.chat(payload.messages || []); break;
                case 'aiSpeak':
                    result = await ai.speak(payload.text || ''); break;
                case 'aiVision': {
                    const cap = await ai.captureTab();
                    if (cap.error) { result = { error: cap.error }; break; }
                    result = await ai.describeScreen(cap.base64);
                    break;
                }
                default:
                    result = { error: 'Unknown action: ' + action };
            }
            replyToFrame(msgId, result, event.source, event.origin);
        } catch (err) {
            console.error('[MAUZER BRIDGE]', err.message);
            replyToFrame(msgId, { error: err.message }, event.source, event.origin);
        }
    });

    document.addEventListener('mauzer:openTab', (e) => {
        const url = e.detail && e.detail.url;
        openNewTabFromUser(url || '');
    });

    console.log('[MAUZER] Browser control bridge initialized');
})();




