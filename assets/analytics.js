// Explicit, personless counts only. No third-party SDK or persistent browser identifier.
(() => {
    const token = document.currentScript?.dataset.posthogToken || '';
    const base = '/ladder-apps-beta-site/';
    const location = window.location;
    if (!/^phc_[A-Za-z0-9_-]{20,200}$/.test(token) ||
        location.origin !== 'https://asherun.github.io' || !location.pathname.startsWith(base)) return;

    const path = location.pathname.slice(base.length).replace(/index\.html$/, '');
    const routes = new Map([
        ['', ['home', 'all', 'he']], ['en/', ['home', 'all', 'en']],
        ['get/family/', ['download', 'all', 'he']], ['en/get/family/', ['download', 'all', 'en']]
    ]);
    for (const app of ['flag', 'math', 'english', 'robot', 'riddle']) {
        routes.set(`${app}/`, ['support', app, 'he']);
        routes.set(`en/${app}/`, ['support', app, 'en']);
        routes.set(`get/${app}/`, ['download', app, 'he']);
        routes.set(`en/get/${app}/`, ['download', app, 'en']);
    }
    if (!routes.has(path) || !window.crypto?.randomUUID || !window.fetch) return;
    const [page, pageApp, language] = routes.get(path);
    const optedOut = () => navigator.globalPrivacyControl === true ||
        navigator.doNotTrack === '1' || window.doNotTrack === '1';
    if (optedOut()) return;

    const parameters = new URLSearchParams(location.search);
    const suppliedCampaign = parameters.get('ct') || '';
    const qa = parameters.get('qa') === '1';
    // The same tokens get.js accepts (tests compare the two). Ad tokens fit every page:
    // f<flight>-a<angle>[variant]-<placement> (f1-a1-ig, f2-a3h-ig, f2-a6-us) and org-ig / org-fb (bio links).
    // The October per-app tokens (math-ig) count only on their own app's pages and the all-games pages.
    const sharedCampaign = /^(?:f[1-9][0-9]?-a[1-9][0-9]{0,2}[a-z]?-(ig|fb|us)|org-(ig|fb))$/;
    const appCampaign = /^(flag|math|english|robot|riddle)-(ig|fb)$/;
    const shared = sharedCampaign.exec(suppliedCampaign);
    const own = appCampaign.exec(suppliedCampaign);
    const accepted = suppliedCampaign.length <= 30 &&
        (shared || (own && (pageApp === 'all' || pageApp === own[1])));
    const campaign = accepted ? suppliedCampaign : 'none';
    // "us" names the US+CA audience cell, not a platform, so its source is Meta in general.
    const channel = accepted ? (shared ? shared[1] || shared[2] : own[2]) : '';
    const source = { ig: 'instagram', fb: 'facebook', us: 'meta' }[channel] || 'unattributed';
    const apps = new Map([
        ['6802382851', 'flag'], ['6806677285', 'math'],
        ['6807340912', 'english'], ['6813171077', 'robot'], ['6835017597', 'riddle']
    ]);
    // This ID joins a view to its clicks, not a person to other pages or visits.
    const pageLoadId = window.crypto.randomUUID();
    const clickedApps = new Set();
    let viewed = false;
    let localeReady = !window.ladderLocaleReady;

    function capture(event, properties = {}) {
        if (optedOut()) return;
        try {
            const body = JSON.stringify({
                api_key: token,
                distinct_id: pageLoadId,
                event,
                properties: {
                    $process_person_profile: false,
                    $geoip_disable: true,
                    $ip: null,
                    measurement_version: 1, qa,
                    page, app: pageApp, language, campaign, source,
                    ...properties
                }
            });
            // A small, simple POST can outlive navigation; never wait for it or intercept the link.
            void window.fetch('https://eu.i.posthog.com/i/v0/e/', {
                method: 'POST', mode: 'no-cors', credentials: 'omit',
                referrerPolicy: 'no-referrer', keepalive: true,
                headers: { 'Content-Type': 'text/plain;charset=UTF-8' }, body
            }).catch(() => {});
        } catch {
            // Analytics availability must never affect a download.
        }
    }

    function recordView() {
        if (!localeReady || viewed || document.visibilityState !== 'visible' || optedOut()) return;
        viewed = true;
        capture('site_page_view');
    }

    function recordClick(event) {
        if (!localeReady) {
            window.ladderLocaleReady?.then(stay => { if (stay) recordClick(event); });
            return;
        }
        if (!event.isTrusted || event.defaultPrevented || optedOut()) return;
        if (event.type === 'click' ? event.button !== 0 : event.button !== 1) return;
        const link = event.target?.closest?.('a[href]');
        if (!link || link.closest('[inert]')) return;
        let destination;
        try { destination = new URL(link.href); } catch { return; }
        if (destination.origin !== 'https://apps.apple.com' || destination.username || destination.password) return;
        const app = apps.get(destination.pathname.match(/\/id(\d+)\/?$/)?.[1]);
        if (!app) return;
        recordView();
        const firstClickOnPage = clickedApps.size === 0;
        const firstClickForApp = !clickedApps.has(app);
        clickedApps.add(app);
        const placement = link.closest('.get-hero') ? 'download_top'
            : link.closest('.get-more') ? 'download_bottom'
            : link.closest('.download-panel') ? 'support'
            : link.classList.contains('app-store-badge') ? 'carousel' : 'other_store_link';
        capture('app_store_click', {
            app, placement, first_click_on_page: firstClickOnPage,
            first_click_for_app: firstClickForApp
        });
    }

    document.addEventListener('visibilitychange', recordView);
    document.addEventListener('click', recordClick);
    document.addEventListener('auxclick', recordClick);
    if (window.ladderLocaleReady) {
        window.ladderLocaleReady.then(stay => { localeReady = stay; if (stay) recordView(); });
    } else recordView();
})();
