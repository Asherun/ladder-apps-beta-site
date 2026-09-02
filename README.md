# Ladder Apps Support Site

Static Hebrew support and privacy pages for Flag Ladder, Math Ladder, and English Ladder.

The source intentionally contains `{{SUPPORT_EMAIL}}`. Build a publishable copy only after the account owner approves the address for public display:

```bash
LADDER_SUPPORT_EMAIL="approved@example.com" python3 AppSupportSite/build_site.py --output /tmp/ladder-apps-support
```

Do not publish the source directory while the placeholder remains. The expected public routes are:

- `/` - shared support hub
- `/privacy/` - shared privacy policy
- `/flag/` - Flag Ladder support
- `/math/` - Math Ladder support
- `/english/` - English Ladder support
- `/beta/` - controlled adult beta waitlist with no public TestFlight links

Deployment notes for GitHub Pages and Codex Sites are in `DEPLOYMENT_HE.md`.
