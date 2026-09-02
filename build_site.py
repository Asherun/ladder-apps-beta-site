#!/usr/bin/env python3
"""Materialize the public support site without storing contact data in source."""

from __future__ import annotations

import argparse
import os
import re
import shutil
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit


PLACEHOLDER = "{{SUPPORT_EMAIL}}"
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")
ALLOWED_PUBLIC_SUFFIXES = {
    ".css",
    ".html",
    ".ico",
    ".jpeg",
    ".jpg",
    ".js",
    ".png",
    ".svg",
    ".txt",
    ".webmanifest",
    ".webp",
    ".woff2",
    ".xml",
}
ALLOWED_EXTENSIONLESS_FILES = {".nojekyll", "CNAME"}
FORBIDDEN_PUBLIC_TEXT = {
    "127.0.0.1": "local URL",
    "localhost": "local URL",
    "testflight.apple.com/join/": "public TestFlight link",
    "-----BEGIN PRIVATE KEY-----": "private key",
    "-----BEGIN EC PRIVATE KEY-----": "private key",
}
PUBLIC_BASE_URL = "https://asherun.github.io/ladder-apps-beta-site/"
REQUIRED_SOCIAL_META = {
    "og:type",
    "og:site_name",
    "og:locale",
    "og:title",
    "og:description",
    "og:url",
    "og:image",
    "og:image:secure_url",
    "og:image:type",
    "og:image:width",
    "og:image:height",
    "og:image:alt",
    "twitter:card",
    "twitter:title",
    "twitter:description",
    "twitter:image",
    "twitter:image:alt",
}


class PublicLinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        for name, value in attrs:
            if name in {"href", "src"} and value:
                self.urls.append(value)


class SocialMetaParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__()
        self.meta: dict[str, str] = {}
        self.canonical_urls: list[str] = []

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        values = {name: value for name, value in attrs if value is not None}
        if tag == "meta":
            key = values.get("property") or values.get("name")
            content = values.get("content")
            if key and content:
                self.meta[key] = content
        elif tag == "link" and "canonical" in values.get("rel", "").split():
            href = values.get("href")
            if href:
                self.canonical_urls.append(href)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("dist"))
    return parser.parse_args()


def verify_internal_links(output: Path) -> int:
    checked = 0
    for page in output.rglob("*.html"):
        parser = PublicLinkParser()
        parser.feed(page.read_text(encoding="utf-8"))
        for raw_url in parser.urls:
            parsed = urlsplit(raw_url)
            if parsed.scheme or parsed.netloc or not parsed.path:
                continue
            target = (page.parent / unquote(parsed.path)).resolve()
            if output not in target.parents and target != output:
                raise SystemExit(f"Public link escapes build output: {page.relative_to(output)} -> {raw_url}")
            if target.is_dir() or parsed.path.endswith("/"):
                target /= "index.html"
            if not target.is_file():
                raise SystemExit(f"Broken public link: {page.relative_to(output)} -> {raw_url}")
            checked += 1
    return checked


def expected_public_url(page: Path, output: Path) -> str:
    relative = page.relative_to(output)
    if relative == Path("index.html"):
        return PUBLIC_BASE_URL
    return f"{PUBLIC_BASE_URL}{relative.parent.as_posix().strip('/')}/"


def verify_social_metadata(output: Path) -> int:
    checked = 0
    for page in output.rglob("*.html"):
        parser = SocialMetaParser()
        parser.feed(page.read_text(encoding="utf-8"))
        relative = page.relative_to(output)
        expected_url = expected_public_url(page, output)
        missing = sorted(REQUIRED_SOCIAL_META - parser.meta.keys())
        if missing:
            raise SystemExit(f"Missing social metadata in {relative}: {', '.join(missing)}")
        if parser.canonical_urls != [expected_url]:
            raise SystemExit(
                f"Invalid canonical URL in {relative}: expected {expected_url}, got {parser.canonical_urls}"
            )
        if parser.meta["og:url"] != expected_url:
            raise SystemExit(f"Open Graph URL mismatch in {relative}: {parser.meta['og:url']}")
        if parser.meta["twitter:card"] != "summary_large_image":
            raise SystemExit(f"Invalid Twitter card type in {relative}")
        social_image = parser.meta["og:image"]
        if not social_image.startswith(PUBLIC_BASE_URL) or parser.meta["twitter:image"] != social_image:
            raise SystemExit(f"Social image must use one absolute public URL in {relative}")
        if parser.meta["og:image:secure_url"] != social_image:
            raise SystemExit(f"Open Graph secure image URL mismatch in {relative}")
        image_path = output / unquote(social_image.removeprefix(PUBLIC_BASE_URL))
        if not image_path.is_file():
            raise SystemExit(f"Social image is missing in {relative}: {social_image}")
        checked += 1
    return checked


def verify_public_artifact(output: Path) -> tuple[int, int, int]:
    files = [path for path in output.rglob("*") if path.is_file()]
    for path in files:
        relative = path.relative_to(output)
        if any(part.startswith(".") and part != ".nojekyll" for part in relative.parts):
            raise SystemExit(f"Hidden development file blocked from publish: {relative}")
        if path.name not in ALLOWED_EXTENSIONLESS_FILES and path.suffix.lower() not in ALLOWED_PUBLIC_SUFFIXES:
            raise SystemExit(f"Non-web file blocked from publish: {relative}")
        if path.suffix.lower() not in {".css", ".html", ".js", ".txt", ".xml", ".webmanifest"}:
            continue
        content = path.read_text(encoding="utf-8", errors="ignore")
        if PLACEHOLDER in content:
            raise SystemExit(f"Unresolved contact placeholder in {relative}")
        for marker, description in FORBIDDEN_PUBLIC_TEXT.items():
            if marker.lower() in content.lower():
                raise SystemExit(f"Blocked {description} in public file: {relative}")
    return len(files), verify_internal_links(output), verify_social_metadata(output)


def main() -> int:
    args = parse_args()
    source = Path(__file__).resolve().parent
    output = args.output.resolve()
    email = os.environ.get("LADDER_SUPPORT_EMAIL", "").strip()

    if not EMAIL_PATTERN.fullmatch(email):
        raise SystemExit("Set LADDER_SUPPORT_EMAIL to the approved public support address.")
    if output == source or source in output.parents:
        raise SystemExit("Choose an output directory outside AppSupportSite.")

    if output.exists():
        shutil.rmtree(output)
    shutil.copytree(
        source,
        output,
        ignore=shutil.ignore_patterns(
            "build_site.py",
            "README.md",
            "DEPLOYMENT_HE.md",
            "__pycache__",
            ".git",
            ".github",
            ".gitignore",
        ),
    )

    replaced = 0
    for page in output.rglob("*.html"):
        content = page.read_text(encoding="utf-8")
        replaced += content.count(PLACEHOLDER)
        page.write_text(content.replace(PLACEHOLDER, email), encoding="utf-8")

    if replaced == 0:
        raise SystemExit("Support email placeholder was not found.")
    public_file_count, internal_link_count, social_page_count = verify_public_artifact(output)
    print(
        f"Support site built: {output} "
        f"({replaced} contact placeholders resolved, {public_file_count} public web files verified, "
        f"{internal_link_count} internal links checked, {social_page_count} social previews checked)"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
