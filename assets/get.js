// Download pages for paid ads (/get/<app>/, 2026-10-25). Meta sends the ad set's name in the page
// address (?ct=math-ig); the App Store buttons then carry it as an App Store Connect campaign token,
// so App Analytics > Campaigns counts downloads per ad set. Nothing is stored or sent anywhere.
(() => {
    const token = new URLSearchParams(window.location.search).get("ct") || "";
    document.querySelectorAll("a[data-campaign-app]").forEach((link) => {
        // Only this page's own ad sets are accepted, so a link can never point at another app.
        const app = link.dataset.campaignApp;
        if (!new RegExp(`^${app}-(ig|fb)$`).test(token)) return;
        link.href = `https://apps.apple.com/app/apple-store/id${link.dataset.appId}?pt=129321414&ct=${token}&mt=8`;
    });
})();
