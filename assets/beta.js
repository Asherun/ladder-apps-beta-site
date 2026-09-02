(() => {
    const form = document.getElementById("betaSignupForm");
    if (!form) return;

    const isEnglish = document.documentElement.lang === "en";
    const copy = isEnglish ? {
        completed: "complete",
        none: "Not selected",
        appRequired: "Choose at least one game.",
        platformRequired: "Choose at least one platform.",
        missing: "A few details are missing before the request can be prepared.",
        noteFallback: "No note",
        subjectPrefix: "Beta waitlist request",
        greeting: "Hello,",
        request: "I would like to join the Ladder Learning Games beta waitlist.",
        firstName: "First name",
        lastName: "Last name",
        appleId: "Apple Account email",
        apps: "Games",
        platforms: "Platforms",
        background: "Background",
        note: "Note",
        consent: "I am an adult and agree to receive beta-related contact and a TestFlight invitation.",
        ready: "Your request is ready. Your email app will open so you can send it."
    } : {
        completed: "הושלם",
        none: "טרם נבחרו",
        appRequired: "יש לבחור לפחות משחק אחד.",
        platformRequired: "יש לבחור לפחות פלטפורמה אחת.",
        missing: "חסרים כמה פרטים לפני הכנת הבקשה.",
        noteFallback: "ללא הערה",
        subjectPrefix: "בקשת הצטרפות לבטא",
        greeting: "שלום,",
        request: "אשמח להצטרף לרשימת ההמתנה לבדיקות הבטא של משחקי הסולם.",
        firstName: "שם פרטי",
        lastName: "שם משפחה",
        appleId: "כתובת חשבון Apple",
        apps: "משחקים",
        platforms: "פלטפורמות",
        background: "רקע",
        note: "הערה",
        consent: "אני מבוגר/ת ומאשר/ת קבלת פנייה והזמנת TestFlight לצורך הבדיקה.",
        ready: "הבקשה הוכנה. אפליקציית הדואר תיפתח כעת לשליחה."
    };

    const progress = document.getElementById("signupProgress");
    const progressLabel = document.getElementById("progressLabel");
    const selectedApps = document.getElementById("selectedApps");
    const selectedPlatforms = document.getElementById("selectedPlatforms");
    const appsError = document.getElementById("appsError");
    const platformsError = document.getElementById("platformsError");
    const formStatus = document.getElementById("formStatus");

    const checkedValues = (name) => Array.from(
        form.querySelectorAll(`input[name="${name}"]:checked`),
        (input) => input.value
    );

    const hasValidEmail = () => {
        const email = form.elements.email;
        return Boolean(email.value.trim()) && email.validity.valid;
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
        selectedApps.textContent = apps.length ? apps.join(" · ") : copy.none;
        selectedPlatforms.textContent = platforms.length ? platforms.join(" · ") : copy.none;

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

        appsError.textContent = hasApps ? "" : copy.appRequired;
        platformsError.textContent = hasPlatforms ? "" : copy.platformRequired;

        return hasApps && hasPlatforms;
    };

    form.addEventListener("input", updateState);
    form.addEventListener("change", updateState);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        formStatus.textContent = "";

        const selectionsValid = validateSelections();
        const fieldsValid = form.reportValidity();

        if (!selectionsValid || !fieldsValid) {
            formStatus.textContent = copy.missing;
            formStatus.className = "form-status form-status-error";
            return;
        }

        const apps = checkedValues("apps");
        const platforms = checkedValues("platforms");
        const recipient = form.dataset.recipient;
        const notes = form.elements.notes.value.trim() || copy.noteFallback;
        const subject = `${copy.subjectPrefix} | ${apps.join(", ")}`;
        const body = [
            copy.greeting,
            "",
            copy.request,
            "",
            `${copy.firstName}: ${form.elements.firstName.value.trim()}`,
            `${copy.lastName}: ${form.elements.lastName.value.trim()}`,
            `${copy.appleId}: ${form.elements.email.value.trim()}`,
            `${copy.apps}: ${apps.join(", ")}`,
            `${copy.platforms}: ${platforms.join(", ")}`,
            `${copy.background}: ${form.elements.background.value}`,
            `${copy.note}: ${notes}`,
            "",
            copy.consent
        ].join("\n");

        formStatus.textContent = copy.ready;
        formStatus.className = "form-status form-status-success";
        window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    updateState();
})();
