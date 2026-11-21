#!/usr/bin/env python3
"""Generate the short-link stub pages and the sitemap.

    python build_stubs.py            # writes <key>/index.html for every paper + sitemap.xml
    python build_stubs.py --clean    # removes what a previous run wrote

Why: 3dcp.fyi/<bibtex key> is the public address of a paper (v1 served a real
page there; v2 filters the table to ID IS "<key>"). GitHub Pages answers a path
that is not a file with 404.html - which redirects correctly, but with HTTP
status 404, so search engines drop the page and link previews (Slack, Teams,
Zotero) see nothing. A one-file stub per key turns those into 200s with a
title, description, canonical and Open Graph tags, then hands off to the
table (meta refresh for no-JS, location.replace otherwise). The stub keeps
the article's own metadata out of the data-delivery path: it is ~1 KB of
static HTML, built from data/tabular_data.js at deploy time.

Standard library only. Reads the data file as JSON after stripping the
`window.ARTICLES_DATA=` assignment (same trick as semantic-search.js).
Writes a manifest (.stubs-manifest.txt) so --clean removes exactly its files.
"""
import html
import json
import os
import re
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
DATA = os.path.join(ROOT, "data", "tabular_data.js")
SITE = "https://3dcp.fyi/"
MANIFEST = os.path.join(ROOT, ".stubs-manifest.txt")
KEY_RE = re.compile(r"^[A-Za-z0-9_-]+\.(?:\d{4}[a-z]?)?\.[A-Za-z0-9_-]+$")  # the year can be missing (key..Title)

STUB = """<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>{title} • 3dcp.fyi</title>
<meta name="description" content="{description}"/>
<link rel="canonical" href="{url}"/>
<meta property="og:type" content="article"/>
<meta property="og:site_name" content="3dcp.fyi"/>
<meta property="og:url" content="{url}"/>
<meta property="og:title" content="{title}"/>
<meta property="og:description" content="{description}"/>
{citation_meta}<meta http-equiv="refresh" content="0; url={target}"/>
<link rel="icon" type="image/svg+xml" href="/src/favicon.svg"/>
<script>(function(){{var t={target_js};var r=location.search.replace(/^[?]/,"").split("&").filter(function(p){{return p&&!/^q=/i.test(p)}}).join("&");location.replace(t+(r?"&"+r:"")+location.hash)}})();</script>
<style>html{{background:#000;color:#aeb4bd;font:15px/1.5 system-ui,sans-serif}}body{{margin:0;min-height:100vh;display:grid;place-items:center;padding:24px}}a{{color:#4f9bff}}</style>
</head>
<body><p>Opening <a href="{target}">{title_short}</a> in the 3dcp.fyi database…</p></body>
</html>
"""


def load_rows():
    with open(DATA, "r", encoding="utf-8") as f:
        text = f.read()
    at = text.rfind("window.ARTICLES_DATA")
    start = text.find("[", at if at >= 0 else 0)
    end = text.rfind("]")
    return json.loads(text[start:end + 1])


def author_label(a):
    if isinstance(a, str):
        parts = a.split("_")
        return parts[0].capitalize()
    if isinstance(a, dict):
        return a.get("lastName") or a.get("family") or str(a.get("id") or a.get("slug") or "")
    return ""


def clean():
    if not os.path.exists(MANIFEST):
        return
    with open(MANIFEST, "r", encoding="utf-8") as f:
        for line in f:
            p = os.path.join(ROOT, line.strip())
            if os.path.isfile(p):
                os.remove(p)
                d = os.path.dirname(p)
                if d != ROOT and not os.listdir(d):
                    os.rmdir(d)
    os.remove(MANIFEST)


def main():
    clean()
    if "--clean" in sys.argv:
        print("removed previous stubs")
        return
    rows = load_rows()
    written = []
    # The map page (map-affiliations.html) shows invented sample counts until
    # real affiliation data exists, so it is kept out of the sitemap (and
    # carries noindex).
    urls = [SITE, SITE + "rechtliches.html", SITE + "adjacency.html"]
    for row in rows:
        key = str(row.get("id") or "")
        if not KEY_RE.match(key):
            continue
        title = str(row.get("title") or key).strip()
        authors = [author_label(a) for a in (row.get("authors") or [])]
        authors = [a for a in authors if a]
        who = ", ".join(authors[:3]) + (" et al." if len(authors) > 3 else "")
        venue = str(row.get("venue") or "").strip()
        date = str(row.get("date") or "")[:7]
        desc = " · ".join(p for p in (who, venue, date) if p) or "3D concrete printing research, curated at TU Munich."
        url = SITE + key
        target = "/?q=" + _q(key)
        cite = ""
        if row.get("doi"):
            cite += '<meta name="citation_doi" content="%s"/>\n' % html.escape(str(row["doi"]))
        cite += '<meta name="citation_title" content="%s"/>\n' % html.escape(title)
        for a in authors:
            cite += '<meta name="citation_author" content="%s"/>\n' % html.escape(a)
        if date:
            cite += '<meta name="citation_publication_date" content="%s"/>\n' % html.escape(date.replace("-", "/"))
        out_dir = os.path.join(ROOT, key)
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, "index.html")
        with open(path, "w", encoding="utf-8") as f:
            f.write(STUB.format(
                title=html.escape(title), title_short=html.escape(title[:90] + ("…" if len(title) > 90 else "")),
                description=html.escape(desc), url=url, target=target,
                target_js=json.dumps(target), citation_meta=cite))
        written.append(os.path.relpath(path, ROOT))
        urls.append(url)
    with open(os.path.join(ROOT, "sitemap.xml"), "w", encoding="utf-8") as f:
        f.write('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n')
        for u in urls:
            f.write("  <url><loc>%s</loc></url>\n" % html.escape(u))
        f.write("</urlset>\n")
    written.append("sitemap.xml")
    with open(os.path.join(ROOT, "robots.txt"), "w", encoding="utf-8") as f:
        f.write("User-agent: *\nAllow: /\nSitemap: %ssitemap.xml\n" % SITE)
    written.append("robots.txt")
    with open(MANIFEST, "w", encoding="utf-8") as f:
        f.write("\n".join(written) + "\n")
    print("wrote %d stubs + sitemap.xml + robots.txt" % (len(written) - 2))


def _q(key):
    # The query the 404 router would have produced: ID IS "<key>", URL-encoded.
    from urllib.parse import quote
    return quote('ID IS "' + key + '"', safe="")


if __name__ == "__main__":
    main()
