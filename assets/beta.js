(() => {
    const form = document.getElementById("betaSignupForm");
    if (!form) return;

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
        progressLabel.textContent = `${percent}% הושלם`;
        selectedApps.textContent = apps.length ? apps.join(" · ") : "טרם נבחרו";
        selectedPlatforms.textContent = platforms.length ? platforms.join(" · ") : "טרם נבחרו";

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

        appsError.textContent = hasApps ? "" : "יש לבחור לפחות משחק אחד.";
        platformsError.textContent = hasPlatforms ? "" : "יש לבחור לפחות פלטפורמה אחת.";

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
            formStatus.textContent = "חסרים כמה פרטים לפני הכנת הבקשה.";
            formStatus.className = "form-status form-status-error";
            return;
        }

        const apps = checkedValues("apps");
        const platforms = checkedValues("platforms");
        const recipient = form.dataset.recipient;
        const notes = form.elements.notes.value.trim() || "ללא הערה";
        const subject = `בקשת הצטרפות לבטא | ${apps.join(", ")}`;
        const body = [
            "שלום,",
            "",
            "אשמח להצטרף לרשימת ההמתנה לבדיקות הבטא של משחקי הסולם.",
            "",
            `שם פרטי: ${form.elements.firstName.value.trim()}`,
            `שם משפחה: ${form.elements.lastName.value.trim()}`,
            `Apple ID: ${form.elements.email.value.trim()}`,
            `משחקים: ${apps.join(", ")}`,
            `פלטפורמות: ${platforms.join(", ")}`,
            `רקע: ${form.elements.background.value}`,
            `הערה: ${notes}`,
            "",
            "אני מבוגר/ת ומאשר/ת קבלת פנייה והזמנת TestFlight לצורך הבדיקה."
        ].join("\n");

        formStatus.textContent = "הבקשה הוכנה. אפליקציית הדואר תיפתח כעת לשליחה.";
        formStatus.className = "form-status form-status-success";
        window.location.href = `mailto:${recipient}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    });

    updateState();
})();
