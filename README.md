# Ladder Apps Support Site

Static bilingual Hebrew/English showcase, beta waitlist, support, privacy, and terms pages for Flag Ladder, Math Ladder, and English Ladder. Hebrew pages use full RTL layout; their English counterparts use LTR layout with a page-level language switch.

Typography uses a locally hosted Hebrew and Latin subset of Rubik. The font files and their SIL Open Font License are stored in `assets/fonts/`; the public site does not contact a font CDN at runtime.

This repository is intentionally isolated from the native application repositories. It must contain only public website HTML, CSS, JavaScript, marketing images, and deployment files. The build fails if a non-web artifact, local URL, public TestFlight invite, private-key marker, or broken internal link reaches the publishable output.

Every public page includes an absolute canonical URL plus Open Graph and Twitter Card metadata. The build also verifies that the shared preview image exists and is reachable through the public GitHub Pages path, preventing blank social previews from being deployed again.

The source intentionally contains protected build placeholders for the public support address, waitlist endpoint, and Turnstile site key. Build a publishable copy only after the production values are configured:

```bash
LADDER_SUPPORT_EMAIL="approved@example.com" \
LADDER_WAITLIST_API_URL="https://waitlist.example.workers.dev/v1/beta-signups" \
LADDER_TURNSTILE_SITE_KEY="production-site-key" \
python3 build_site.py --output /tmp/ladder-apps-support
```

Do not publish the source directory while placeholders remain. The browser submits beta applications only to the hardened Cloudflare Worker in `edge/`; n8n and PostgreSQL remain local and private. The expected public routes are:

- `/` - shared support hub
- `/privacy/` - shared privacy policy
- `/terms/` - shared terms of use and Apple Standard EULA reference
- `/flag/` - Flag Ladder support
- `/math/` - Math Ladder support
- `/english/` - English Ladder support
- `/beta/` - controlled adult beta waitlist with no public TestFlight links
- `/en/` - English showcase and support hub
- `/en/privacy/`, `/en/terms/`, `/en/beta/` - English legal and beta pages
- `/en/flag/`, `/en/math/`, `/en/english/` - English app support pages

Deployment notes for GitHub Pages are in `DEPLOYMENT_HE.md`. Worker provisioning and security controls are documented in `edge/README.md`.

The legal pages are an operational draft and should be reviewed by the account owner, and by qualified counsel when needed, before public release.
