(() => {
    const form = document.getElementById("betaSignupForm");
    if (!form) return;

    const isEnglish = document.documentElement.lang === "en";
    const copy = isEnglish ? {
        completed: "complete",
        none: "Not selected",
        appRequired: "Choose at least one game.",
        platformRequired: "Choose at least one platform.",
        captchaRequired: "Complete the security check.",
        missing: "A few details are missing before the request can be submitted.",
        sending: "Submitting securely...",
        submit: "Submit beta request",
        ready: "Your request was received securely. We will review it before sending a personal TestFlight invitation.",
        rateLimited: "Too many requests were sent from this connection. Please try again in a few minutes.",
        failed: "We could not submit the request right now. Please try again shortly."
    } : {
        completed: "הושלם",
        none: "טרם נבחרו",
        appRequired: "יש לבחור לפחות משחק אחד.",
        platformRequired: "יש לבחור לפחות פלטפורמה אחת.",
        captchaRequired: "יש להשלים את בדיקת האבטחה.",
        missing: "חסרים כמה פרטים לפני שליחת הבקשה.",
        sending: "הבקשה נשלחת בצורה מאובטחת...",
        submit: "שליחת בקשת הצטרפות",
        ready: "הבקשה התקבלה בצורה מאובטחת. נבדוק אותה לפני שליחת הזמנת TestFlight אישית.",
        rateLimited: "נשלחו יותר מדי בקשות מהחיבור הזה. נסו שוב בעוד כמה דקות.",
        failed: "לא הצלחנו לשלוח את הבקשה כרגע. נסו שוב בעוד זמן קצר."
    };

    const appLabels = isEnglish ? {
        "flag-ladder": "Flag Ladder",
        "math-ladder": "Math Ladder",
        "english-ladder": "English Ladder"
    } : {
        "flag-ladder": "סולם הדגלים",
        "math-ladder": "סולם החשבון",
        "english-ladder": "סולם האנגלית"
    };
    const platformLabels = {
        ios: isEnglish ? "iPhone / iPad" : "iPhone או iPad",
        tvos: "Apple TV"
    };

    const progress = document.getElementById("signupProgress");
    const progressLabel = document.getElementById("progressLabel");
    const selectedApps = document.getElementById("selectedApps");
    const selectedPlatforms = document.getElementById("selectedPlatforms");
    const appsError = document.getElementById("appsError");
    const platformsError = document.getElementById("platformsError");
    const captchaError = document.getElementById("captchaError");
    const formStatus = document.getElementById("formStatus");
    const submitButton = form.querySelector('button[type="submit"]');

    const checkedValues = (name) => Array.from(
        form.querySelectorAll(`input[name="${name}"]:checked`),
        (input) => input.value
    );

    const hasValidEmail = () => {
        const email = form.elements.email;
        return Boolean(email.value.trim()) && email.validity.valid;
    };

    const captchaToken = () => {
        const tokenField = form.querySelector('input[name="cf-turnstile-response"]');
        return tokenField ? tokenField.value.trim() : "";
    };

    const updateState = () => {
        const apps = checkedValues("apps");
        const platforms = checkedValues("platforms");
        const completed = [
            apps.length > 0,
            platforms.length > 0,
            Boolean(form.elements.firstName.value.trim()),
            Boolean(form.elements.lastName.value.trim()),
            hasValidEmail(),
            form.elements.adultConsent.checked
        ].filter(Boolean).length;
        const percent = Math.round((completed / 6) * 100);

        progress.value = percent;
        progress.textContent = `${percent}%`;
        progressLabel.textContent = `${percent}% ${copy.completed}`;
        selectedApps.textContent = apps.length
            ? apps.map((value) => appLabels[value] || value).join(" · ")
            : copy.none;
        selectedPlatforms.textContent = platforms.length
            ? platforms.map((value) => platformLabels[value] || value).join(" · ")
            : copy.none;

        form.querySelectorAll(".game-choice").forEach((choice) => {
            choice.classList.toggle(
                "is-selected",
                choice.querySelector('input[name="apps"]').checked
            );
        });
    };

    const validateSelections = () => {
        const hasApps = checkedValues("apps").length > 0;
        const hasPlatforms = checkedValues("platforms").length > 0;
        const hasCaptcha = Boolean(captchaToken());

        appsError.textContent = hasApps ? "" : copy.appRequired;
        platformsError.textContent = hasPlatforms ? "" : copy.platformRequired;
        captchaError.textContent = hasCaptcha ? "" : copy.captchaRequired;

        return hasApps && hasPlatforms && hasCaptcha;
    };

    const setSubmitting = (submitting) => {
        submitButton.disabled = submitting;
        submitButton.textContent = submitting ? copy.sending : copy.submit;
        form.setAttribute("aria-busy", String(submitting));
    };

    form.addEventListener("input", updateState);
    form.addEventListener("change", updateState);

    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        formStatus.textContent = "";

        const selectionsValid = validateSelections();
        const fieldsValid = form.reportValidity();

        if (!selectionsValid || !fieldsValid) {
            formStatus.textContent = copy.missing;
            formStatus.className = "form-status form-status-error";
            return;
        }

        const endpoint = form.dataset.endpoint;
        if (!endpoint || !endpoint.startsWith("https://")) {
            formStatus.textContent = copy.failed;
            formStatus.className = "form-status form-status-error";
            return;
        }

        const payload = {
            firstName: form.elements.firstName.value.trim(),
            lastName: form.elements.lastName.value.trim(),
            email: form.elements.email.value.trim(),
            apps: checkedValues("apps"),
            platforms: checkedValues("platforms"),
            background: form.elements.background.value,
            notes: form.elements.notes.value.trim(),
            locale: form.dataset.locale,
            adultConsent: form.elements.adultConsent.checked,
            captchaToken: captchaToken(),
            website: form.elements.website.value
        };

        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 15000);
        setSubmitting(true);

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                mode: "cors",
                credentials: "omit",
                cache: "no-store",
                referrerPolicy: "no-referrer",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(payload),
                signal: controller.signal
            });

            if (!response.ok) {
                if (response.status === 429) throw new Error("rate_limited");
                throw new Error("submission_failed");
            }

            form.reset();
            window.turnstile?.reset();
            appsError.textContent = "";
            platformsError.textContent = "";
            captchaError.textContent = "";
            updateState();
            formStatus.textContent = copy.ready;
            formStatus.className = "form-status form-status-success";
        } catch (error) {
            formStatus.textContent = error.message === "rate_limited"
                ? copy.rateLimited
                : copy.failed;
            formStatus.className = "form-status form-status-error";
            window.turnstile?.reset();
        } finally {
            window.clearTimeout(timeout);
            setSubmitting(false);
        }
    });

    updateState();
})();
