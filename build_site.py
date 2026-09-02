#!/usr/bin/env python3
"""Materialize the public support site without storing contact data in source."""

from __future__ import annotations

import argparse
import os
import re
import shutil
from pathlib import Path


PLACEHOLDER = "{{SUPPORT_EMAIL}}"
EMAIL_PATTERN = re.compile(r"^[^\s@]+@[^\s@]+\.[^\s@]+$")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, default=Path("dist"))
    return parser.parse_args()


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
    print(f"Support site built: {output} ({replaced} contact placeholders resolved)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
