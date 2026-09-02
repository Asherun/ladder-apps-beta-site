# Ladder Apps Support Site

Static Hebrew showcase, beta waitlist, support, privacy, and terms pages for Flag Ladder, Math Ladder, and English Ladder.

This repository is intentionally isolated from the native application repositories. It must contain only public website HTML, CSS, JavaScript, marketing images, and deployment files. The build fails if a non-web artifact, local URL, public TestFlight invite, private-key marker, or broken internal link reaches the publishable output.

The source intentionally contains `{{SUPPORT_EMAIL}}`. Build a publishable copy only after the account owner approves the address for public display:

```bash
LADDER_SUPPORT_EMAIL="approved@example.com" python3 AppSupportSite/build_site.py --output /tmp/ladder-apps-support
```

Do not publish the source directory while the placeholder remains. The expected public routes are:

- `/` - shared support hub
- `/privacy/` - shared privacy policy
- `/terms/` - shared terms of use and Apple Standard EULA reference
- `/flag/` - Flag Ladder support
- `/math/` - Math Ladder support
- `/english/` - English Ladder support
- `/beta/` - controlled adult beta waitlist with no public TestFlight links

Deployment notes for GitHub Pages and Codex Sites are in `DEPLOYMENT_HE.md`.

The legal pages are an operational draft and should be reviewed by the account owner, and by qualified counsel when needed, before public release.
