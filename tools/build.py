#!/usr/bin/env python3
"""Збирає index.html (вбудовує Leaflet із vendor/) і sw.js із src/.

Запуск: python3 tools/build.py
"""
import hashlib
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

# Версія service worker змінюється разом із застосунком, тож старий кеш оновлюється автоматично.
build = hashlib.sha256(html.encode("utf-8")).hexdigest()[:12]
sw = (root / "src" / "sw.template.js").read_text(encoding="utf-8").replace("__BUILD__", build)
(root / "sw.js").write_text(sw, encoding="utf-8")
print(f"sw.js: build {build}")
