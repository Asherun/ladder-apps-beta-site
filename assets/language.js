// Functional language selection only. Country is never returned or sent to analytics.
(() => {
    const script = document.currentScript;
    const root = new URL('../', script.src);
    const current = new URL(window.location.href);
    const supported = new Set(['', 'flag/', 'math/', 'english/', 'robot/', 'privacy/', 'terms/',
        'beta/', 'get/math/', 'get/english/']);
    const valid = value => value === 'he' || value === 'en';
    function route(url) {
        if (url.origin !== root.origin || !url.pathname.startsWith(root.pathname)) return null;
        const path = url.pathname.slice(root.pathname.length).replace(/index\.html$/, '');
        const neutral = path.replace(/^en\//, '');
        return supported.has(neutral) ? neutral : null;
    }
    const page = route(current);
    if (page === null) return;
    const currentLanguage = document.documentElement.lang === 'he' ? 'he' : 'en';
    let settle, finished = false, timer, controller;
    window.ladderLocaleReady = new Promise(resolve => { settle = resolve; });

    function updateLinks(language) {
        document.querySelectorAll('a[href]').forEach(link => {
            const url = new URL(link.href, current);
            if (route(url) === null || link.getAttribute('href').startsWith('#')) return;
            const targetLanguage = url.pathname.slice(root.pathname.length).startsWith('en/') ? 'en' : 'he';
            const marked = link.hasAttribute('data-language-switch');
            const manual = marked || targetLanguage !== currentLanguage;
            const selected = manual ? (valid(link.hreflang) ? link.hreflang : targetLanguage) : language;
            if (manual) {
                link.hreflang = selected;
                // Inline support links are language choices too, even without the header marker.
                if (!marked) {
                    link.setAttribute('data-language-switch', '');
                    link.addEventListener('click', () => {
                        try { window.localStorage.setItem('ladder-site-language', selected); } catch { /* Optional. */ }
                    });
                }
                url.search = current.search;
                url.hash = current.hash;
            }
            url.searchParams.set('lang', selected);
            link.href = url.href;
        });
    }

    function finish(language, canRedirect = true) {
        if (finished) return;
        finished = true;
        clearTimeout(timer);
        controller?.abort();
        const destination = new URL(current);
        destination.pathname = root.pathname + (language === 'en' ? 'en/' : '') + page;
        if (canRedirect && language !== currentLanguage) {
            destination.searchParams.set('lang', language);
            settle(false); // The destination page, not this transient page, records the view.
            window.location.replace(destination.href);
        } else {
            updateLinks(currentLanguage);
            settle(true);
        }
    }

    // Do not interrupt a reader, form entry or an App Store click if a network answer arrives late.
    for (const event of ['pointerdown', 'keydown', 'click', 'input', 'scroll']) {
        document.addEventListener(event, e => {
            if (e.isTrusted) finish(currentLanguage, false);
        }, { capture: true, passive: true, once: true });
    }
    updateLinks(currentLanguage);
    const explicit = current.searchParams.get('lang');
    let saved;
    try { saved = window.localStorage.getItem('ladder-site-language'); } catch { /* Storage is optional. */ }
    if (valid(explicit) || valid(saved)) return finish(valid(explicit) ? explicit : saved);
    const endpoint = script.dataset.localeEndpoint;
    if (!endpoint || !window.fetch || !window.AbortController) return finish(currentLanguage);
    const fallback = () => /^(he|iw)(-|$)/i.test(navigator.languages?.[0] || navigator.language || '') ? 'he' : 'en';
    controller = new window.AbortController();
    timer = setTimeout(() => finish(fallback()), 800);
    try {
        window.fetch(endpoint, { credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
            signal: controller.signal }).then(result => result.ok ? result.json() : null)
            .then(result => finish(valid(result?.language) ? result.language : fallback()))
            .catch(() => finish(fallback()));
    } catch { finish(fallback()); }
})();
