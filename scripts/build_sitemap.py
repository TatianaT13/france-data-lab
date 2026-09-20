"""Génère website/sitemap.xml (lastmod = date du jour) et robots.txt."""

from datetime import date
from pathlib import Path

BASE = "https://tatianat13.github.io/france-data-lab/"
PAGES = [("", "1.0", "weekly"), ("immobilier.html", "0.9", "weekly"), ("emploi.html", "0.8", "daily"),
         ("energie.html", "0.8", "daily"), ("air.html", "0.8", "daily")]
SITE = Path(__file__).resolve().parents[1] / "website"

today = date.today().isoformat()
urls = "\n".join(
    f"  <url>\n    <loc>{BASE}{path}</loc>\n    <lastmod>{today}</lastmod>\n"
    f"    <changefreq>{freq}</changefreq>\n    <priority>{prio}</priority>\n  </url>"
    for path, prio, freq in PAGES
)
(SITE / "sitemap.xml").write_text(
    '<?xml version="1.0" encoding="UTF-8"?>\n'
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + urls + "\n</urlset>\n"
)
(SITE / "robots.txt").write_text(f"User-agent: *\nAllow: /\n\nSitemap: {BASE}sitemap.xml\n")
print("sitemap.xml et robots.txt générés")
