(() => {
    document.documentElement.classList.add("js");

    document.querySelectorAll("[data-language-switch]").forEach((link) => {
        link.addEventListener("click", () => {
            try {
                localStorage.setItem("ladder-site-language", link.hreflang || "");
            } catch (_) {
                // Language selection still works when storage is unavailable.
            }
        });
    });

    const revealItems = Array.from(document.querySelectorAll("[data-reveal]"));
    if (!revealItems.length) return;

    if (!("IntersectionObserver" in window)) {
        revealItems.forEach((item) => item.classList.add("is-visible"));
        return;
    }

    const observer = new IntersectionObserver((entries, instance) => {
        entries.forEach((entry) => {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            instance.unobserve(entry.target);
        });
    }, { rootMargin: "0px 0px -8%", threshold: 0.08 });

    revealItems.forEach((item) => observer.observe(item));
})();
