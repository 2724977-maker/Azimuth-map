#!/usr/bin/env python3
"""Збирає index.html: вбудовує Leaflet із vendor/ у src/index.template.html.

Запуск: python3 tools/build.py
"""
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
template = (root / "src" / "index.template.html").read_text(encoding="utf-8")
css = (root / "vendor" / "leaflet.css").read_text(encoding="utf-8")
js = (root / "vendor" / "leaflet.js").read_text(encoding="utf-8")
js = re.sub(r"\n//# sourceMappingURL=.*", "", js)

if "</script" in js.lower() or "</style" in css.lower():
    raise SystemExit("vendor files contain a closing tag and cannot be inlined")

html = template.replace("/*__LEAFLET_CSS__*/", css).replace("/*__LEAFLET_JS__*/", js)
(root / "index.html").write_text(html, encoding="utf-8")
print(f"index.html: {len(html.encode('utf-8')) // 1024} KB")
