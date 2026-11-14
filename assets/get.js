// Download pages for paid ads (/get/<app>/ and /get/family/, 2026-10-25, tokens widened 2026-11-14).
// Meta sends the ad's campaign token in the page address (?ct=f1-a1-ig); the App Store buttons then
// carry it as an App Store Connect campaign token, so App Analytics > Campaigns counts downloads per ad.
// Nothing is stored or sent anywhere. analytics.js accepts exactly the same tokens (tests compare them).
(() => {
    const token = new URLSearchParams(window.location.search).get("ct") || "";
    // Tokens that name an ad, not an app, so every app's button may carry them:
    // f<flight>-a<angle>[variant]-<placement> (f1-a1-ig, f1-a45-ig, f2-a3h-ig, f2-a6-us) and org-ig / org-fb.
    const shared = /^(?:f[1-9][0-9]?-a[1-9][0-9]{0,2}[a-z]?-(?:ig|fb|us)|org-(?:ig|fb))$/;
    document.querySelectorAll("a[data-campaign-app]").forEach((link) => {
        const app = link.dataset.campaignApp;
        // The October per-app ad sets (math-ig) stay on their own app, so a link never points at another app.
        const own = new RegExp(`^${app}-(?:ig|fb)$`);
        if (token.length > 30 || !(shared.test(token) || own.test(token))) return;
        link.href = `https://apps.apple.com/app/apple-store/id${link.dataset.appId}?pt=129321414&ct=${token}&mt=8`;
    });
})();
