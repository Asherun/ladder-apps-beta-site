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

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const header = document.querySelector(".site-header");
    const hebrew = (document.documentElement.lang || "").startsWith("he");

    // The sticky header's height, for the on-page navigation and for anchors that land under it.
    const measureHeader = () => {
        if (!header) return;
        document.documentElement.style.setProperty("--header-h", `${header.offsetHeight}px`);
    };
    measureHeader();
    window.addEventListener("resize", measureHeader);

    // Support pages: an "on this page" row of links to each section, built from the page's own
    // headings, that follows the reader and marks the section being read.
    const page = document.querySelector("main.page");
    const sections = page
        ? Array.from(page.querySelectorAll(":scope > section.policy-section, :scope > section.support-panel"))
            .filter((section) => section.querySelector("h2"))
        : [];
    const tocLinks = new Map();
    if (sections.length >= 4) {
        const nav = document.createElement("nav");
        nav.className = "page-toc";
        nav.setAttribute("aria-label", hebrew ? "בעמוד הזה" : "On this page");
        const list = document.createElement("ol");
        sections.forEach((section, index) => {
            // Link to the section's id, else its heading's, else a new one; ids are never duplicated.
            const heading = section.querySelector("h2");
            if (!section.id && !heading.id) section.id = `topic-${index + 1}`;
            const item = document.createElement("li");
            const link = document.createElement("a");
            link.href = `#${section.id || heading.id}`;
            link.textContent = section.querySelector("h2").textContent.trim();
            item.append(link);
            list.append(item);
            tocLinks.set(section, link);
        });
        nav.append(list);
        const hero = page.querySelector(":scope > .subpage-hero");
        (hero || page.firstElementChild).after(nav);

        let current = null;
        const mark = (section) => {
            if (current === section) return;
            current = section;
            tocLinks.forEach((link, owner) => {
                if (owner === section) link.setAttribute("aria-current", "true");
                else link.removeAttribute("aria-current");
            });
            // Keep the marked link in view inside the row (it scrolls sideways on phones).
            const link = tocLinks.get(section);
            const row = list.getBoundingClientRect(), box = link.getBoundingClientRect();
            if (box.left < row.left || box.right > row.right) {
                list.scrollBy({ left: box.left - row.left - (row.width - box.width) / 2,
                    behavior: reducedMotion.matches ? "auto" : "smooth" });
            }
        };
        // The section being read is the last one that starts above a line a third of the way down
        // the space left under the navigation.
        const update = () => {
            const top = Math.max(0, nav.getBoundingClientRect().bottom);
            const line = top + (window.innerHeight - top) / 3;
            let reading = sections[0];
            sections.forEach((section) => {
                if (section.getBoundingClientRect().top <= line) reading = section;
            });
            if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 4) {
                reading = sections[sections.length - 1];
            }
            mark(reading);
        };
        let queued = false;
        window.addEventListener("scroll", () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => { queued = false; update(); });
        }, { passive: true });
        update();
    }

    // Phones: the header steps aside while reading down and comes back on the way up.
    const compact = window.matchMedia("(max-width: 760px)");
    if (header) {
        let lastY = window.scrollY;
        let ticking = false;
        const tuck = (hidden) => {
            header.classList.toggle("is-tucked", hidden);
            document.documentElement.classList.toggle("header-tucked", hidden);
        };
        const onScroll = () => {
            ticking = false;
            const y = window.scrollY;
            const delta = y - lastY;
            if (!compact.matches || y < header.offsetHeight + 40 || header.contains(document.activeElement)) tuck(false);
            else if (delta > 6) tuck(true);
            else if (delta < -6) tuck(false);
            if (Math.abs(delta) > 6 || y < header.offsetHeight) lastY = y;
        };
        window.addEventListener("scroll", () => {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(onScroll);
        }, { passive: true });
        header.addEventListener("focusin", () => tuck(false));
        compact.addEventListener("change", () => tuck(false));
    }

    // Sections ease in once as they reach the reader; without JavaScript they are simply there.
    document.querySelectorAll("main.page > section.policy-section, main.page > .support-panel, .home-essentials")
        .forEach((section) => section.setAttribute("data-reveal", ""));

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
