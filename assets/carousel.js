(() => {
    document.querySelectorAll("[data-carousel]").forEach((carousel) => {
        const slides = Array.from(carousel.querySelectorAll("[data-slide]"));
        const choices = Array.from(carousel.querySelectorAll("[data-select]"));
        const controls = carousel.querySelector("[data-carousel-controls]");
        const status = carousel.querySelector("[data-carousel-status]");
        const stage = carousel.querySelector(".carousel-stage");
        if (!slides.length || choices.length !== slides.length || !controls) return;

        const rtl = document.documentElement.dir === "rtl";
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
        let selected = 0;
        let pointer;

        function select(index, announce = true, animate = true) {
            const next = (index + slides.length) % slides.length;
            if (next === selected && announce) return;
            carousel.dataset.motion = announce && animate && !reducedMotion.matches ? "fade" : "instant";
            selected = next;
            slides.forEach((slide, i) => {
                // Keep a stable stacked layout while only the selected slide is interactive.
                slide.hidden = false;
                slide.inert = i !== selected;
                slide.setAttribute("aria-hidden", String(i !== selected));
                choices[i].setAttribute("aria-pressed", String(i === selected));
            });
            const slide = slides[selected];
            carousel.dataset.game = slide.dataset.slide;
            if (announce) {
                status.textContent = `${slide.dataset.title}, ${selected + 1} / ${slides.length}`;
            }
        }

        choices.forEach((choice, index) => {
            choice.addEventListener("click", (event) => select(index, true, event.detail !== 0));
        });
        carousel.querySelectorAll("[data-step]").forEach((arrow) => {
            arrow.addEventListener("click", (event) => select(selected + Number(arrow.dataset.step), true, event.detail !== 0));
        });
        controls.addEventListener("keydown", (event) => {
            if (event.altKey || event.ctrlKey || event.metaKey) return;
            let next;
            if (event.key === "ArrowRight") next = selected + (rtl ? -1 : 1);
            if (event.key === "ArrowLeft") next = selected + (rtl ? 1 : -1);
            if (event.key === "Home") next = 0;
            if (event.key === "End") next = slides.length - 1;
            if (next === undefined) return;
            event.preventDefault();
            select(next, true, false);
            choices[selected].focus({ preventScroll: true });
        });

        // Only deliberate horizontal swipes on artwork change the game; vertical scrolling stays native.
        stage.addEventListener("pointerdown", (event) => {
            if (!event.isPrimary || event.button !== 0 || !event.target.closest(".carousel-media")) return;
            pointer = { id: event.pointerId, x: event.clientX, y: event.clientY };
            stage.setPointerCapture(event.pointerId);
        });
        stage.addEventListener("pointerup", (event) => {
            if (!pointer || pointer.id !== event.pointerId) return;
            const dx = event.clientX - pointer.x;
            const dy = event.clientY - pointer.y;
            pointer = undefined;
            if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
            select(selected + (dx < 0 ? 1 : -1) * (rtl ? -1 : 1));
        });
        ["pointercancel", "lostpointercapture"].forEach((name) => {
            stage.addEventListener(name, () => { pointer = undefined; });
        });
        reducedMotion.addEventListener("change", () => {
            if (reducedMotion.matches) carousel.dataset.motion = "instant";
        });
        select(0, false);
        carousel.dataset.enhanced = "true";
        controls.hidden = false;
    });
})();
