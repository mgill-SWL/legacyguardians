#!/usr/bin/env python3
"""Template linter for DOCX-based deterministic assembly.

Currently detects placeholder tokens in DOCX text (document + headers + footers)
for these syntaxes:
- legacy: [[TOKEN]]
- hotdocs-style: <<TOKEN>>
- jinja: {{ token }}

It reports counts + uniques and can optionally validate against an allowlist.

Usage:
  python3 tools/template_lint.py path/to/template1.docx [template2.docx ...]

Optional allowlist (one key per line):
  python3 tools/template_lint.py --allowlist data/dictionary_keys.txt templates/*.docx

Exit codes:
  0 ok
  2 unknown tokens found (when allowlist provided)
"""

import argparse
import collections
import os
import re
import sys
import zipfile
from xml.etree import ElementTree as ET

NS = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
PARTS_RE = re.compile(r"^word/(document|header\d+|footer\d+)\.xml$")

PATTERNS = {
    "double_brackets": re.compile(r"\[\[([^\]]+?)\]\]"),
    "hotdocs_component": re.compile(r"<<\s*([^>\n\r]+?)\s*>>"),
    "jinja": re.compile(r"\{\{\s*([^\}\n\r]+?)\s*\}\}"),
}


def extract_docx_text(z: zipfile.ZipFile, name: str) -> str:
    """Return plain text built from all w:t nodes, paragraph-delimited."""
    try:
        xml_bytes = z.read(name)
        root = ET.fromstring(xml_bytes)
    except Exception:
        return ""

    paras = []
    for p in root.findall(".//w:p", NS):
        texts = []
        for t in p.findall(".//w:t", NS):
            texts.append(t.text or "")
        paras.append("".join(texts))
    return "\n".join(paras)


def scan_docx(path: str) -> str:
    alltext = []
    with zipfile.ZipFile(path) as z:
        for name in z.namelist():
            if PARTS_RE.match(name):
                alltext.append(extract_docx_text(z, name))
    return "\n".join(alltext)


def normalize_token(tok: str) -> str:
    return " ".join(tok.split())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--allowlist", help="Path to file containing allowed token keys, one per line")
    ap.add_argument("paths", nargs="+", help="DOCX templates to lint")
    args = ap.parse_args()

    allow = None
    if args.allowlist:
        with open(args.allowlist, "r", encoding="utf-8") as f:
            allow = {line.strip() for line in f if line.strip() and not line.lstrip().startswith("#")}

    any_unknown = False

    for path in args.paths:
        if not os.path.exists(path):
            print(f"MISSING: {path}")
            any_unknown = True
            continue

        text = scan_docx(path)
        print(f"\n=== {path} ===")

        for pname, rx in PATTERNS.items():
            hits = [normalize_token(h) for h in rx.findall(text)]
            c = collections.Counter(hits)
            print(f"{pname}: {sum(c.values())} hits, {len(c)} unique")

            # show top 40
            for tok, n in c.most_common(40):
                extra = ""
                if allow is not None:
                    # Only validate the *token* itself; for jinja patterns, callers should allow
                    # expressions or use a stricter tokenizer later.
                    if tok not in allow:
                        extra = "  <-- UNKNOWN"
                        any_unknown = True
                print(f"  {n:4d} {tok}{extra}")

    if allow is not None and any_unknown:
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
