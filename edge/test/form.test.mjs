import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const source = fs.readFileSync(new URL("../../assets/beta.js", import.meta.url), "utf8");
const allApps = ["flag-ladder", "math-ladder", "english-ladder", "confused-robot"];

function formFixture(locale, selected, { consent = true, captcha = true, search = "" } = {}) {
    const html = fs.readFileSync(new URL(locale === "he" ? "../../beta/index.html" : "../../en/beta/index.html", import.meta.url), "utf8");
    const values = [...html.matchAll(/name="apps" value="([^"]+)"/g)].map(match => match[1]);
    assert.deepEqual(values, allApps);
    assert.match(html, new RegExp(`lang="${locale}" dir="${locale === "he" ? "rtl" : "ltr"}"`));
    assert.match(html, /name="adultConsent" required/);
    assert.doesNotMatch(html, /testflight\.apple\.com\/join\//);
    const choices = values.map(value => ({ value, checked: selected.includes(value) }));
    const listeners = {};
    const elements = Object.fromEntries(["firstName", "lastName", "email", "background", "notes", "website"].map(name => [name, { value: "" }]));
    Object.assign(elements, {
        firstName: { value: "Synthetic" }, lastName: { value: "Tester" },
        email: { value: "synthetic@example.invalid", validity: { valid: true } },
        adultConsent: { checked: consent }
    });
    const button = {};
    const nodes = {};
    const requests = [];
    const form = {
        elements, dataset: { endpoint: "https://waitlist.example.invalid/v1/beta-signups", locale },
        querySelectorAll(selector) {
            if (selector === 'input[name="apps"]:checked') return choices.filter(input => input.checked);
            if (selector === 'input[name="apps"]') return choices;
            if (selector === 'input[name="platforms"]:checked') return [{ value: "ios" }];
            if (selector === ".game-choice") return values.map(value => ({ classList: { toggle() {} }, querySelector: () => ({ checked: selected.includes(value) }) }));
            throw new Error(`Unexpected selector ${selector}`);
        },
        querySelector(selector) {
            if (selector === 'button[type="submit"]') return button;
            if (selector === 'input[name="cf-turnstile-response"]') return { value: captcha ? "mock-token" : "" };
            throw new Error(`Unexpected selector ${selector}`);
        },
        addEventListener(name, callback) { listeners[name] = callback; },
        reportValidity: () => consent,
        reset() {}, setAttribute() {}
    };
    vm.runInNewContext(source, {
        document: { documentElement: { lang: locale }, getElementById: id => id === "betaSignupForm" ? form : (nodes[id] ??= {}) },
        window: { location: { search }, setTimeout: () => 1, clearTimeout() {}, turnstile: { reset() {} } },
        AbortController, URLSearchParams,
        fetch: async (url, options) => { requests.push({ url, options, payload: JSON.parse(options.body) }); return { ok: true }; }
    });
    return { nodes, requests, elements, submit: () => listeners.submit({ preventDefault() {} }) };
}

for (const locale of ["he", "en"]) {
    test(`${locale} Robot link selects the game without consent or automatic submission`, async () => {
        const fixture = formFixture(locale, [], { search: "?app=confused-robot", consent: false });
        assert.match(fixture.nodes.selectedApps.textContent, locale === "he" ? /הרובוט המבולבל/ : /The Confused Robot/);
        assert.equal(fixture.elements.adultConsent.checked, false);
        assert.equal(fixture.requests.length, 0);
        await fixture.submit();
        assert.equal(fixture.requests.length, 0);
    });
    test(`${locale} unknown preselection is ignored`, () => {
        const fixture = formFixture(locale, [], { search: "?app=unknown-game" });
        assert.equal(fixture.nodes.selectedApps.textContent, locale === "he" ? "טרם נבחרו" : "Not selected");
        assert.equal(fixture.requests.length, 0);
    });
    for (const apps of [["confused-robot"], allApps]) {
        test(`${locale} form summarizes and submits ${apps.length} game(s) through mocked intake`, async () => {
            const fixture = formFixture(locale, apps);
            assert.match(fixture.nodes.selectedApps.textContent, locale === "he" ? /הרובוט המבולבל/ : /The Confused Robot/);
            assert.equal(fixture.nodes.signupProgress.value, 100);
            await fixture.submit();
            assert.equal(fixture.requests.length, 1);
            assert.deepEqual(fixture.requests[0].payload.apps, apps);
            assert.equal(fixture.requests[0].payload.locale, locale);
            assert.equal(fixture.requests[0].payload.adultConsent, true);
            assert.match(fixture.nodes.formStatus.textContent, locale === "he" ? /הזמנת TestFlight אישית/ : /personal TestFlight invitation/);
        });
    }
    for (const [name, apps, options] of [["no games", [], {}], ["no adult consent", ["confused-robot"], { consent: false }], ["no CAPTCHA", ["confused-robot"], { captcha: false }]]) {
        test(`${locale} form blocks ${name} without any request`, async () => {
            const fixture = formFixture(locale, apps, options);
            await fixture.submit();
            assert.equal(fixture.requests.length, 0);
            assert.equal(fixture.nodes.formStatus.className, "form-status form-status-error");
        });
    }
}
