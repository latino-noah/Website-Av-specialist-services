/* ==========================================================================
   Urban Digital — interactions
   Core behaviour (menu, anchors, form, slider, clock) works without GSAP.
   Motion is layered on only when GSAP loaded AND the user allows motion.
   ========================================================================== */
(() => {
    const root = document.documentElement;
    const $ = (sel, ctx = document) => ctx.querySelector(sel);
    const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));
    const pad = (n) => String(n).padStart(2, '0');

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    const hasGSAP = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';
    const motionOK = hasGSAP && !reduceMotion;

    const navbar = $('#navbar');
    const loader = $('.loader');

    if (!motionOK) {
        root.classList.remove('motion');
        root.classList.add('reduced');
        if (loader) loader.remove();
    }

    /* ------------------------------------------------------------------
       1. Navigation: index menu, hide-on-scroll, colour that follows the
          section underneath the header
       ------------------------------------------------------------------ */
    const hamburger = $('#hamburger');
    const menu = $('#nav-links');
    const hamburgerLabel = $('.hamburger__label', hamburger);
    const outside = [$('main'), $('footer')];

    const isMenuOpen = () => menu.classList.contains('active');
    const setMenu = (open) => {
        menu.classList.toggle('active', open);
        root.classList.toggle('menu-open', open);
        hamburger.setAttribute('aria-expanded', String(open));
        hamburger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
        hamburgerLabel.textContent = open ? 'Close' : 'Index';
        outside.forEach((el) => { el.inert = open; });
        navbar.classList.remove('is-hidden');
        if (open) $('a', menu).focus({ preventScroll: true });
    };

    hamburger.addEventListener('click', () => setMenu(!isMenuOpen()));
    $$('a', menu).forEach((link) => link.addEventListener('click', () => setMenu(false)));
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && isMenuOpen()) {
            setMenu(false);
            hamburger.focus();
        }
    });

    // Header theme: sample what sits under the bar (clip-path aware, so the
    // hero's expanding image flips it to light text exactly when it covers).
    const updateNavTheme = () => {
        const stack = document.elementsFromPoint(window.innerWidth / 2, 34);
        const under = stack.find((el) => !navbar.contains(el) && !menu.contains(el));
        const themed = under && under.closest('[data-theme]');
        navbar.classList.toggle('on-dark', !!themed && themed.dataset.theme === 'dark');
    };

    let lastY = window.scrollY;
    let ticking = false;
    window.addEventListener('scroll', () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(() => {
            const y = window.scrollY;
            if (!isMenuOpen()) navbar.classList.toggle('is-hidden', y > lastY && y > 400);
            lastY = y;
            updateNavTheme();
            ticking = false;
        });
    }, { passive: true });
    window.addEventListener('resize', updateNavTheme);
    updateNavTheme();

    /* ------------------------------------------------------------------
       2. Anchor scrolling (pin-aware, no CSS smooth-scroll conflicts)
       ------------------------------------------------------------------ */
    document.addEventListener('click', (e) => {
        const link = e.target.closest('a[href^="#"]');
        if (!link) return;
        const id = link.getAttribute('href');
        if (id.length < 2) return;
        const target = document.querySelector(id);
        if (!target) return;
        e.preventDefault();

        // When a section is pinned, its wrapper holds the real document position
        const anchor = target.parentElement && target.parentElement.classList.contains('pin-spacer')
            ? target.parentElement
            : target;
        const top = id === '#home' ? 0 : anchor.getBoundingClientRect().top + window.scrollY;

        window.scrollTo({ top, behavior: motionOK ? 'smooth' : 'auto' });
        history.pushState(null, '', id);
        if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
    });

    /* ------------------------------------------------------------------
       3. Local time (South Holland)
       ------------------------------------------------------------------ */
    const clocks = $$('[data-local-time]');
    try {
        const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam' });
        const tick = () => clocks.forEach((el) => { el.textContent = `${fmt.format(new Date())} CET`; });
        tick();
        setInterval(tick, 20000);
    } catch (err) {
        clocks.forEach((el) => el.remove());
    }

    /* ------------------------------------------------------------------
       4. Contact form validation (+ package pre-fill from the rate card)
       ------------------------------------------------------------------ */
    const form = $('#contactForm');
    const successMsg = $('#successMsg');
    const messageField = $('#message');

    $$('[data-package]').forEach((btn) => {
        btn.addEventListener('click', () => {
            if (!messageField.value.trim() || messageField.dataset.prefilled === 'true') {
                messageField.value = `Hi! I'd like to book: ${btn.dataset.package}. `;
                messageField.dataset.prefilled = 'true';
                messageField.parentElement.classList.remove('invalid');
            }
        });
    });

    if (form) {
        const emailPattern = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
        const rules = [
            { field: $('#name'), valid: (v) => v.trim() !== '' },
            { field: $('#email'), valid: (v) => emailPattern.test(v.trim()) },
            { field: messageField, valid: (v) => v.trim() !== '' },
        ];
        const submitBtn = $('#submitBtn');
        const submitLabel = $('span', submitBtn);
        let hideTimer;

        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            let firstInvalid = null;

            rules.forEach(({ field, valid }) => {
                const ok = valid(field.value);
                field.parentElement.classList.toggle('invalid', !ok);
                field.setAttribute('aria-invalid', String(!ok));
                if (!ok && !firstInvalid) firstInvalid = field;
            });

            if (firstInvalid) {
                firstInvalid.focus();
                return;
            }

            submitBtn.disabled = true;
            submitLabel.textContent = 'Sending…';
            clearTimeout(hideTimer);
            successMsg.hidden = true;

            try {
                const res = await fetch('https://api.web3forms.com/submit', {
                    method: 'POST',
                    headers: { Accept: 'application/json' },
                    body: new FormData(form),
                });
                if (!res.ok) throw new Error(`Send failed: ${res.status}`);

                successMsg.textContent = 'Thank you! Your message has been sent.';
                successMsg.classList.remove('is-error');
                form.reset();
                messageField.dataset.prefilled = 'false';
                rules.forEach(({ field }) => field.removeAttribute('aria-invalid'));
                hideTimer = setTimeout(() => { successMsg.hidden = true; }, 5000);
            } catch (err) {
                // Keep the visitor's text in the form and leave this message up.
                console.error(err);
                successMsg.textContent = 'Sorry, sending failed. Please email or call me directly.';
                successMsg.classList.add('is-error');
            }

            successMsg.hidden = false;
            submitBtn.disabled = false;
            submitLabel.textContent = 'Send message';
        });

        $$('input, textarea', form).forEach((input) => {
            input.addEventListener('input', () => {
                input.parentElement.classList.remove('invalid');
                input.removeAttribute('aria-invalid');
                if (input === messageField) messageField.dataset.prefilled = 'false';
            });
        });
    }

    /* ------------------------------------------------------------------
       5. Testimonials slider
       ------------------------------------------------------------------ */
    const section = $('.testimonials');
    const quotes = $$('.quote', section);
    const nav = $('.quotes__nav', section);
    if (quotes.length > 1) {
        section.classList.add('js-slider');
        nav.hidden = false;
        const current = $('[data-current]', nav);
        const bar = $('.quotes__bar span', nav);
        $('[data-total]', nav).textContent = pad(quotes.length);
        let index = 0;

        const show = (next, dir, animate = true) => {
            index = (next + quotes.length) % quotes.length;
            quotes.forEach((q, i) => {
                q.classList.toggle('is-active', i === index);
                q.setAttribute('aria-hidden', String(i !== index));
            });
            current.textContent = pad(index + 1);
            bar.style.transform = `scaleX(${(index + 1) / quotes.length})`;

            if (motionOK && animate) {
                const q = quotes[index];
                gsap.fromTo($('blockquote', q),
                    { clipPath: 'inset(0% 0% 100% 0%)', yPercent: 6 * dir },
                    { clipPath: 'inset(0% 0% 0% 0%)', yPercent: 0, duration: 1.1, ease: 'expo.out' });
                gsap.fromTo($('figcaption', q), { autoAlpha: 0, y: 16 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.25, ease: 'power3.out' });
            }
        };

        $$('.quotes__btn', nav).forEach((btn) => {
            btn.addEventListener('click', () => show(index + Number(btn.dataset.dir), Number(btn.dataset.dir)));
        });
        section.addEventListener('keydown', (e) => {
            if (e.key === 'ArrowRight') show(index + 1, 1);
            if (e.key === 'ArrowLeft') show(index - 1, -1);
        });
        show(0, 1, false);
    }

    /* ------------------------------------------------------------------
       6. Footer wordmark — split + fit to the full width
       ------------------------------------------------------------------ */
    const wordmark = $('.footer__wordmark');
    if (wordmark) {
        const text = wordmark.textContent;
        wordmark.innerHTML = '';
        [...text].forEach((ch) => {
            const span = document.createElement('span');
            span.className = 'char';
            span.setAttribute('aria-hidden', 'true');
            span.textContent = ch === ' ' ? ' ' : ch;
            wordmark.appendChild(span);
        });
        const fit = () => {
            wordmark.style.fontSize = '100px';
            const available = wordmark.parentElement.clientWidth;
            wordmark.style.fontSize = `${(100 * available) / wordmark.offsetWidth}px`;
        };
        fit();
        window.addEventListener('resize', fit);
        if (document.fonts) document.fonts.ready.then(() => {
            fit();
            if (motionOK) ScrollTrigger.refresh();
        });
    }

    if (!motionOK) return;

    /* ==================================================================
       MOTION LAYER
       ================================================================== */
    gsap.registerPlugin(ScrollTrigger);

    /* ---------- Custom cursor ---------- */
    if (finePointer) {
        const cursor = $('.cursor');
        const label = $('.cursor__label', cursor);
        root.classList.add('has-cursor');
        const xTo = gsap.quickTo(cursor, 'x', { duration: 0.18, ease: 'power3' });
        const yTo = gsap.quickTo(cursor, 'y', { duration: 0.18, ease: 'power3' });

        window.addEventListener('pointermove', (e) => {
            cursor.style.opacity = '1';
            xTo(e.clientX);
            yTo(e.clientY);
        }, { passive: true });
        root.addEventListener('mouseleave', () => { cursor.style.opacity = '0'; });

        document.addEventListener('pointerover', (e) => {
            const t = e.target.closest('input, textarea, [data-cursor], a, button');
            cursor.classList.remove('is-link', 'is-label', 'is-text');
            if (!t) return;
            if (t.matches('input, textarea')) {
                cursor.classList.add('is-text');
            } else if (t.dataset.cursor) {
                label.textContent = t.dataset.cursor;
                cursor.classList.add('is-label');
            } else {
                cursor.classList.add('is-link');
            }
        });

        /* ---------- Magnetic elements ---------- */
        $$('[data-magnetic]').forEach((el) => {
            const mx = gsap.quickTo(el, 'x', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
            const my = gsap.quickTo(el, 'y', { duration: 0.8, ease: 'elastic.out(1, 0.4)' });
            const strength = el.classList.contains('btn-send') ? 0.3 : 0.4;
            el.addEventListener('pointermove', (e) => {
                const r = el.getBoundingClientRect();
                mx((e.clientX - (r.left + r.width / 2)) * strength);
                my((e.clientY - (r.top + r.height / 2)) * strength);
            });
            el.addEventListener('pointerleave', () => { mx(0); my(0); });
        });
    }

    /* ---------- Preloader → hero intro ---------- */
    const heroLines = $$('.hero__title .line__inner');
    const heroBits = $$('.hero__meta > *, .hero__foot > *');
    const toTimecode = (frames) => `00:00:${pad(Math.floor(frames / 24))}:${pad(frames % 24)}`;

    gsap.set(heroLines, { yPercent: 110 });
    gsap.set(heroBits, { autoAlpha: 0, y: 24 });

    const intro = gsap.timeline({ defaults: { ease: 'expo.out' } });
    if (loader) {
        root.classList.add('is-loading');
        loader.style.animation = 'none';
        const tc = $('.loader__tc', loader);
        const counter = { f: 0 };
        intro
            .to(counter, {
                f: 48, duration: 1.3, ease: 'power2.inOut',
                onUpdate: () => { tc.textContent = toTimecode(Math.round(counter.f)); },
            })
            .to(loader, { clipPath: 'inset(0% 0% 100% 0%)', duration: 1, ease: 'expo.inOut' }, '+=0.1')
            .add(() => {
                root.classList.remove('is-loading');
                loader.remove();
                ScrollTrigger.refresh();
            }, '-=0.35');
    }
    intro
        .to(heroLines, { yPercent: 0, duration: 1.4, stagger: 0.09 }, loader ? '-=0.55' : 0)
        .to(heroBits, { autoAlpha: 1, y: 0, duration: 1, stagger: 0.04, ease: 'power3.out' }, '-=1.1');

    /* ---------- Hero: inline frame expands into a viewfinder ---------- */
    const hero = $('.hero');
    const frame = $('.hero__frame');
    const media = $('.hero__media');
    const mediaImg = $('img', media);
    const viewfinder = $('.viewfinder', media);
    const timecodeEl = $('[data-timecode]', media);

    hero.classList.add('is-expandable');

    // Frame geometry relative to the hero, ignoring transforms (offset* based)
    const frameGeom = () => {
        let x = 0;
        let y = 0;
        let el = frame;
        while (el && el !== hero) {
            x += el.offsetLeft;
            y += el.offsetTop;
            el = el.offsetParent;
        }
        const W = hero.clientWidth;
        const H = hero.clientHeight;
        const w = frame.offsetWidth;
        const h = frame.offsetHeight;
        return { x, y, w, h, W, H, scale: Math.max(w / W, h / H) };
    };
    const startClip = () => {
        const g = frameGeom();
        return `inset(${g.y}px ${g.W - g.x - g.w}px ${g.H - g.y - g.h}px ${g.x}px)`;
    };

    const heroTl = gsap.timeline({
        defaults: { ease: 'none' },
        scrollTrigger: {
            trigger: hero,
            start: 'top top',
            end: '+=140%',
            pin: true,
            scrub: 0.7,
            invalidateOnRefresh: true,
            onUpdate: updateNavTheme,
        },
    });
    heroTl
        .fromTo(media, { clipPath: startClip }, { clipPath: 'inset(0px 0px 0px 0px)', duration: 1, ease: 'power2.inOut' }, 0)
        .fromTo(mediaImg, {
            // shrink the full-bleed image into the frame so the whole shot is visible at first
            scale: () => frameGeom().scale,
            x: () => { const g = frameGeom(); return g.x + g.w / 2 - g.W / 2; },
            y: () => { const g = frameGeom(); return g.y + g.h / 2 - g.H / 2; },
        }, { scale: 1.06, x: 0, y: 0, duration: 1, ease: 'power2.inOut' }, 0)
        .to('.hero__title .line:nth-child(1)', { xPercent: -14, duration: 1 }, 0)
        .to('.hero__title .line:nth-child(3)', { xPercent: 14, duration: 1 }, 0)
        .to('.hero__meta, .hero__foot', { autoAlpha: 0, duration: 0.3 }, 0)
        .to(viewfinder, { opacity: 1, duration: 0.25 }, 0.8)
        .fromTo($$('.vf-statement .line__inner', media), { yPercent: 110 }, { yPercent: 0, stagger: 0.06, duration: 0.3, ease: 'power3.out' }, 0.85)
        .to(mediaImg, { scale: 1, duration: 0.35 }, 1);

    // Running timecode while the viewfinder is on screen
    let frameCount = 0;
    let tcTimer = null;
    ScrollTrigger.create({
        trigger: hero,
        start: 'top top',
        end: 'bottom top',
        onToggle: (self) => {
            clearInterval(tcTimer);
            if (self.isActive) {
                tcTimer = setInterval(() => { timecodeEl.textContent = toTimecode(frameCount++); }, 1000 / 24);
            }
        },
    });

    /* ---------- Generic reveals ---------- */
    $$('.split-lines').forEach((heading) => {
        gsap.from($$('.line__inner', heading), {
            yPercent: 110, duration: 1.3, stagger: 0.09, ease: 'expo.out',
            scrollTrigger: { trigger: heading, start: 'top 85%' },
        });
    });

    $$('.section-tag').forEach((tag) => {
        gsap.from(tag, {
            clipPath: 'inset(0% 100% 0% 0%)', duration: 1.2, ease: 'expo.inOut',
            scrollTrigger: { trigger: tag, start: 'top 90%' },
        });
    });

    /* ---------- Manifesto: words light up as you read ---------- */
    const splitWords = (el) => {
        Array.from(el.childNodes).forEach((node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const frag = document.createDocumentFragment();
                node.textContent.split(/(\s+)/).forEach((part) => {
                    if (!part) return;
                    if (/^\s+$/.test(part)) {
                        frag.appendChild(document.createTextNode(' '));
                    } else {
                        const span = document.createElement('span');
                        span.className = 'word';
                        span.textContent = part;
                        frag.appendChild(span);
                    }
                });
                node.replaceWith(frag);
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                splitWords(node);
            }
        });
    };
    $$('[data-words]').forEach((block) => {
        splitWords(block);
        gsap.fromTo($$('.word', block), { opacity: 0.12 }, {
            opacity: 1, stagger: 0.05, ease: 'none',
            scrollTrigger: { trigger: block, start: 'top 78%', end: 'bottom 50%', scrub: true },
        });
    });

    $$('[data-count]').forEach((el) => {
        const end = Number(el.dataset.count);
        const state = { v: 0 };
        el.textContent = '0';
        gsap.to(state, {
            v: end, duration: 1.8, ease: 'power3.out',
            scrollTrigger: { trigger: el, start: 'top 88%', once: true },
            onUpdate: () => { el.textContent = Math.round(state.v); },
        });
    });

    $$('[data-reveal]').forEach((fig) => {
        gsap.from(fig, {
            clipPath: 'inset(100% 0% 0% 0%)', duration: 1.5, ease: 'expo.inOut',
            scrollTrigger: { trigger: fig, start: 'top 85%' },
        });
    });
    $$('[data-parallax]').forEach((img) => {
        gsap.fromTo(img, { yPercent: -8 }, {
            yPercent: 8, ease: 'none',
            scrollTrigger: { trigger: img.parentElement, start: 'top bottom', end: 'bottom top', scrub: true },
        });
    });

    /* ---------- Services: mask-in, then a horizontal film strip ---------- */
    const services = $('.services');
    const track = $('.services__track');
    const panels = $$('.service', track);
    const progressBar = $('.services__progress span', services);

    gsap.fromTo(services, { clipPath: 'inset(7% 5% 0% 5%)' }, {
        clipPath: 'inset(0% 0% 0% 0%)', ease: 'none',
        scrollTrigger: { trigger: services, start: 'top bottom', end: 'top top', scrub: true },
    });

    const mm = gsap.matchMedia();
    mm.add('(min-width: 900px)', () => {
        root.classList.add('has-hscroll');
        const distance = () => track.scrollWidth - window.innerWidth;

        const strip = gsap.to(track, {
            x: () => -distance(),
            ease: 'none',
            scrollTrigger: {
                trigger: services,
                start: 'top top',
                end: () => `+=${distance()}`,
                pin: true,
                scrub: 0.8,
                invalidateOnRefresh: true,
                onUpdate: (self) => gsap.set(progressBar, { scaleX: self.progress }),
            },
        });

        panels.forEach((panel) => {
            const img = $('.service__media img', panel);
            const num = $('.service__num', panel);
            gsap.fromTo(img, { xPercent: -7 }, {
                xPercent: 7, ease: 'none',
                scrollTrigger: { trigger: panel, containerAnimation: strip, start: 'left right', end: 'right left', scrub: true },
            });
            gsap.from($('.service__media', panel), {
                clipPath: 'inset(0% 0% 0% 100%)', ease: 'none',
                scrollTrigger: { trigger: panel, containerAnimation: strip, start: 'left 95%', end: 'left 35%', scrub: true },
            });
            gsap.from(num, {
                xPercent: 45, autoAlpha: 0, ease: 'none',
                scrollTrigger: { trigger: panel, containerAnimation: strip, start: 'left 90%', end: 'left 30%', scrub: true },
            });
        });

        return () => root.classList.remove('has-hscroll');
    });

    mm.add('(max-width: 899px)', () => {
        panels.forEach((panel) => {
            const fig = $('.service__media', panel);
            gsap.from(fig, {
                clipPath: 'inset(100% 0% 0% 0%)', duration: 1.4, ease: 'expo.inOut',
                scrollTrigger: { trigger: fig, start: 'top 85%' },
            });
            gsap.fromTo($('img', fig), { yPercent: -6 }, {
                yPercent: 6, ease: 'none',
                scrollTrigger: { trigger: fig, start: 'top bottom', end: 'bottom top', scrub: true },
            });
        });
    });

    /* ---------- Pricing: rows enter, image preview follows the pointer ---------- */
    const rates = $$('.rate');
    gsap.from(rates, {
        y: 60, autoAlpha: 0, duration: 1.1, stagger: 0.12, ease: 'expo.out',
        scrollTrigger: { trigger: '.rates', start: 'top 82%' },
    });

    if (finePointer) {
        const preview = $('.rates__preview');
        const previewImgs = $$('img', preview);
        gsap.set(preview, { xPercent: 18, yPercent: -50, scale: 0.8, rotate: -4 });
        const px = gsap.quickTo(preview, 'x', { duration: 0.6, ease: 'power3' });
        const py = gsap.quickTo(preview, 'y', { duration: 0.6, ease: 'power3' });
        rates.forEach((row, i) => {
            row.addEventListener('pointerenter', (e) => {
                previewImgs.forEach((img, k) => img.classList.toggle('is-active', k === i));
                gsap.set(preview, { x: e.clientX, y: e.clientY });
                gsap.to(preview, { autoAlpha: 1, scale: 1, rotate: 0, duration: 0.5, ease: 'expo.out', overwrite: 'auto' });
            });
            row.addEventListener('pointermove', (e) => { px(e.clientX); py(e.clientY); });
            row.addEventListener('pointerleave', () => {
                gsap.to(preview, { autoAlpha: 0, scale: 0.8, rotate: -4, duration: 0.35, ease: 'power2.in', overwrite: 'auto' });
            });
        });
    }

    /* ---------- Marquee: drifts on its own, rushes with scroll velocity ---------- */
    const marqueeInner = $('.marquee__inner');
    const loop = gsap.to(marqueeInner, { xPercent: -50, duration: 26, ease: 'none', repeat: -1 });
    ScrollTrigger.create({
        trigger: '.marquee',
        start: 'top bottom',
        end: 'bottom top',
        onToggle: (self) => (self.isActive ? loop.play() : loop.pause()),
        onUpdate: (self) => {
            const boost = 1 + Math.min(Math.abs(self.getVelocity()) / 250, 6);
            gsap.to(loop, { timeScale: boost, duration: 0.15, overwrite: true });
            gsap.to(loop, { timeScale: 1, duration: 1.2, delay: 0.15, ease: 'power2.out' });
        },
    });

    /* ---------- Testimonials / contact / footer entrances ---------- */
    gsap.from('.quote.is-active blockquote', {
        clipPath: 'inset(0% 0% 100% 0%)', yPercent: 6, duration: 1.4, ease: 'expo.out',
        scrollTrigger: { trigger: '.quotes', start: 'top 80%' },
    });

    gsap.from('.contact-info, .form-sentence, .field--block, .form-submit', {
        y: 50, autoAlpha: 0, duration: 1.1, stagger: 0.1, ease: 'expo.out',
        scrollTrigger: { trigger: '.contact-grid', start: 'top 96%' },
    });

    gsap.from('.footer__wordmark .char', {
        yPercent: 105, duration: 1.3, stagger: 0.035, ease: 'expo.out',
        scrollTrigger: { trigger: '.footer__brand', start: 'top 95%' },
    });

    // Triggers were created per-concern, not in page order: sort them so each
    // one accounts for the pin spacing (hero + film strip) above it.
    ScrollTrigger.sort();
    ScrollTrigger.refresh();
    window.addEventListener('load', () => ScrollTrigger.refresh());
})();
