#!/usr/bin/env python3
"""Render src/index.src.html -> index.html, expanding app-driven blocks."""
import html, json, pathlib, re
from apps import APPS
from logo_parts import GRADS, MARK, WORDS

ROOT = pathlib.Path(__file__).resolve().parent.parent
e = html.escape

ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 17 17 7M8 7h9v9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
CHEV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
APPLE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.37 12.6c-.02-2.3 1.88-3.4 1.97-3.46-1.07-1.57-2.74-1.78-3.33-1.8-1.42-.15-2.77.83-3.49.83-.72 0-1.83-.81-3.01-.79-1.55.02-2.98.9-3.78 2.29-1.61 2.8-.41 6.94 1.16 9.2.77 1.11 1.68 2.36 2.88 2.31 1.16-.05 1.6-.75 3-.75s1.79.75 3.01.72c1.25-.02 2.03-1.13 2.79-2.25.88-1.29 1.24-2.53 1.26-2.6-.03-.01-2.42-.93-2.46-3.7zM14.1 5.86c.64-.77 1.07-1.85.95-2.92-.92.04-2.03.61-2.69 1.38-.59.68-1.11 1.77-.97 2.82 1.02.08 2.07-.52 2.71-1.28z"/></svg>'
STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2.8 2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4-4.7-4.4 6.4-.8z"/></svg>'
PREV = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'
NEXT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>'


def logo(cls="logo", gid="a"):
    g = GRADS.replace('id="ptA"', f'id="ptA{gid}"').replace('id="ptB"', f'id="ptB{gid}"')
    m = MARK.replace("url(#ptA)", f"url(#ptA{gid})").replace("url(#ptB)", f"url(#ptB{gid})")
    return (f'<svg class="{cls}" viewBox="8 1 177 40" role="img" aria-label="Pixeltouch">'
            f'<defs>{g}</defs><g class="logo__mark">{m}</g><g class="logo__word" fill="currentColor">{WORDS}</g></svg>')


def mark(cls="mark", gid="m"):
    g = GRADS.replace('id="ptA"', f'id="ptA{gid}"').replace('id="ptB"', f'id="ptB{gid}"')
    m = MARK.replace("url(#ptA)", f"url(#ptA{gid})").replace("url(#ptB)", f"url(#ptB{gid})")
    return f'<svg class="{cls}" viewBox="5.21 1.59 38.2 38.2" aria-hidden="true"><defs>{g}</defs>{m}</svg>'


def dl_text(a):
    return f'{a["dl"]} downloads' if a["dl"] else "New release"


def nav_apps():
    return "".join(
        f'<a class="mega__app" href="{a["url"]}" target="_blank" rel="noopener" style="--accent:{a["accent"]};--tint:{a["tint"]}">'
        f'<img src="assets/icons/{a["key"]}.webp" alt="" width="40" height="40" loading="lazy">'
        f'<span><b>{e(a["short"])}</b><small>{e(a["sub"])}</small></span></a>' for a in APPS)


def hero_cards():
    out = []
    for i, a in enumerate(APPS):
        lazy = ""  # all eager: cards travel through view, lazy pop-in would flash
        out.append(f'<button class="hc" type="button" data-i="{i}" aria-label="Show {e(a["short"])}" tabindex="-1">'
                   f'<img src="assets/screens/{a["key"]}-md.webp?v=2" srcset="assets/screens/{a["key"]}-sm.webp?v=2 480w, assets/screens/{a["key"]}-md.webp?v=2 780w" sizes="(max-width:960px) 45vw, 300px" alt="{e(a["name"])} app screen" {lazy}decoding="async"></button>')
    return "".join(out)


import hashlib, subprocess
VER = hashlib.md5(((ROOT / "styles.css").read_bytes() + (ROOT / "app.js").read_bytes())).hexdigest()[:8]
SITE = "https://pixeltouch-redesign.vercel.app/"


def jsonld():
    data = {
        "@context": "https://schema.org",
        "@graph": [
            {"@type": "Organization", "@id": SITE + "#org", "name": "Pixeltouch", "url": SITE,
             "logo": SITE + "assets/brand/apple-touch-icon.png",
             "sameAs": ["https://apps.apple.com/us/developer/sohel-ibna-saad/id1374788998"]},
            {"@type": "WebSite", "@id": SITE + "#site", "url": SITE, "name": "Pixeltouch", "publisher": {"@id": SITE + "#org"}},
            {"@type": "ItemList", "name": "Pixeltouch iOS apps", "itemListElement": [
                {"@type": "ListItem", "position": i + 1, "item": {
                    "@type": "MobileApplication", "name": a["name"], "operatingSystem": "iOS",
                    "applicationCategory": "PhotographyApplication" if a["cat"].startswith("Photo") else "DesignApplication",
                    "url": a["url"], "description": a["desc"],
                    "image": SITE + "assets/icons/" + a["key"] + ".webp",
                    "offers": {"@type": "Offer", "price": "0", "priceCurrency": "USD"},
                    "author": {"@id": SITE + "#org"}}}
                for i, a in enumerate(APPS)]},
        ]}
    return json.dumps(data, separators=(",", ":")).replace("</", "<\\/")


def app_json():
    return json.dumps([dict(key=a["key"], name=a["name"], short=a["short"], cat=a["cat"], dl=a["dl"], rating=a["rating"],
                            url=a["url"], accent=a["accent"], tint=a["tint"]) for a in APPS], ensure_ascii=False)


def marquee():
    items = "".join(
        f'<a class="chip" href="{a["url"]}" target="_blank" rel="noopener"><img src="assets/icons/{a["key"]}.webp" alt="" width="30" height="30" loading="lazy"><span>{e(a["short"])}</span><em>{STAR}{a["rating"]}</em></a>'
        for a in APPS)
    return f'<div class="marquee__track">{items}</div><div class="marquee__track" aria-hidden="true" inert>{items}</div>'


def lab_list():
    out = []
    for i, a in enumerate(APPS):
        group = "photo" if a["cat"].startswith("Photo") else "design"
        out.append(f'''
        <li class="lab__item{" is-active" if i == 0 else ""}" data-i="{i}" data-group="{group}" style="--accent:{a["accent"]};--tint:{a["tint"]}">
          <button type="button" class="lab__btn" aria-controls="labStage" aria-pressed="{"true" if i == 0 else "false"}">
            <span class="lab__n">{i+1:02d}</span>
            <img src="assets/icons/{a["key"]}.webp" alt="" width="40" height="40" loading="lazy">
            <span class="lab__name"><b>{e(a["short"])}</b><small>{e(a["cat"])} · {STAR}{a["rating"]}</small></span>
            <span class="lab__go" aria-hidden="true">{ARROW}</span>
            <i class="lab__bar"></i>
          </button>
        </li>''')
    return "".join(out)


def lab_screens():
    return "".join(
        f'<img class="lab__screen{" is-active" if i == 0 else ""}" data-i="{i}" src="assets/screens/{a["key"]}-md.webp" alt="{e(a["name"])} app screen" loading="lazy" decoding="async">'
        for i, a in enumerate(APPS))


def lab_details():
    out = []
    for i, a in enumerate(APPS):
        dl = f'<div><dt>Downloads</dt><dd>{a["dl"]}</dd></div>' if a["dl"] else '<div><dt>Status</dt><dd>New</dd></div>'
        out.append(f'''
        <div class="lab__detail{" is-active" if i == 0 else ""}" data-i="{i}" role="tabpanel">
          <span class="lab__cat">{e(a["cat"])}</span>
          <h3>{e(a["name"])}</h3>
          <p>{e(a["desc"])}</p>
          <dl class="lab__stats">{dl}<div><dt>Rating</dt><dd>{a["rating"]}<i>{STAR}</i></dd></div></dl>
          <a class="btn btn--dark" href="{a["url"]}" target="_blank" rel="noopener" tabindex="{0 if i == 0 else -1}">{APPLE}<span>Get it on the App Store</span><b class="btn__arrow">{ARROW}</b></a>
        </div>''')
    return "".join(out)


def lab_dock():
    return "".join(
        f'<button type="button" role="tab" class="lab__item{" is-active" if i == 0 else ""}" data-i="{i}" style="--accent:{a["accent"]};--tint:{a["tint"]}" '
        f'aria-selected="{"true" if i == 0 else "false"}" tabindex="{0 if i == 0 else -1}" aria-label="{e(a["name"])}">'
        f'<img src="assets/icons/{a["key"]}.webp" alt="" width="56" height="56" loading="lazy"><span class="lab__tip">{e(a["short"])}</span><i class="lab__bar"></i></button>'
        for i, a in enumerate(APPS))


SPLITS = {
    "Blur Photo Editor": ("Blur Photo", "Editor"),
    "Blur Video - AI Blur Maker": ("Blur Video", "AI Blur Maker"),
    "Inva: Invitation Maker + RSVP": ("Inva: Invitation", "Maker + RSVP"),
    "PixelLab: AI Background Eraser": ("PixelLab: AI", "Background Eraser"),
    "Dark Table - Presets for LR": ("Dark Table", "Presets for LR"),
    "AI Art: AI Photo Generator": ("AI Art: AI", "Photo Generator"),
    "KapiCam - Filters for Pictures": ("KapiCam", "Filters for Pictures"),
    "Vidz: Reels Templates & Maker": ("Vidz: Reels", "Templates & Maker"),
    "Unroll: Carousel Collage Maker": ("Unroll: Carousel", "Collage Maker"),
}


def title2(name):
    a, b = SPLITS.get(name, (name, ""))
    return f'<span>{e(a)}</span> <span>{e(b)}</span>'


def stack_cards():
    out = []
    n = len(APPS)
    for i, a in enumerate(APPS):
        dl = (f'<div><dt>Downloads</dt><dd>{a["dl"]}</dd></div>' if a["dl"] else '<div><dt>Status</dt><dd>New</dd></div>')
        out.append(f'''
      <article class="scard" data-i="{i}" style="--i:{i};--accent:{a["accent"]};--tint:{a["tint"]}" aria-label="{e(a["name"])}">
        <div class="scard__in">
          <div class="scard__copy">
            <div class="scard__top">
              <img class="scard__icon" src="assets/icons/{a["key"]}.webp" alt="" width="72" height="72" loading="lazy">
              <span class="scard__meta"><b>{e(a["cat"])}</b><span>{i+1:02d} / {n:02d}</span></span>
            </div>
            <h3 class="scard__title">{title2(a["name"])}</h3>
            <p>{e(a["desc"])}</p>
            <dl class="scard__stats">{dl}<div><dt>Rating</dt><dd>{a["rating"]}<i>{STAR}</i></dd></div></dl>
            <a class="btn btn--dark" href="{a["url"]}" target="_blank" rel="noopener">{APPLE}<span>Get it on the App Store</span><b class="btn__arrow">{ARROW}</b></a>
          </div>
          <div class="scard__media" aria-hidden="true">
            <span class="scard__ring"></span><span class="scard__ring scard__ring--2"></span>
            <div class="scard__phone">
              <img class="scard__screen" src="assets/screens/{a["key"]}-md.webp?v=2" srcset="assets/screens/{a["key"]}-sm.webp?v=2 480w, assets/screens/{a["key"]}-md.webp?v=2 780w" sizes="(max-width:960px) 60vw, 340px" alt="{e(a["name"])} app screen" width="780" height="1690" loading="lazy" decoding="async">
              <img class="scard__device" src="assets/device.webp" alt="" width="760" height="1545" loading="lazy" decoding="async">
            </div>
          </div>
        </div>
        <span class="scard__shade" aria-hidden="true"></span>
      </article>''')
    return "".join(out)


def stack_dock():
    return "".join(
        f'<button type="button" class="sdock__item{" is-active" if i == 0 else ""}" data-i="{i}" aria-label="{e(a["name"])}">'
        f'<img src="assets/icons/{a["key"]}.webp" alt="" width="56" height="56" loading="lazy"><span class="sdock__tip">{e(a["short"])}</span></button>'
        for i, a in enumerate(APPS))


TECH_BB = json.loads((ROOT / "src/tech_bbox.json").read_text())


def tech_svg(key, k):
    """Inline a Liniqo SVG: ids namespaced, viewBox cropped to the artwork so it is never clipped."""
    svg = (ROOT / f"assets/tech/{key}.svg").read_text()
    for name in ("hatch", "illustration", "float"):
        svg = svg.replace(f'id="{name}"', f'id="{name}-{k}"').replace(f"url(#{name})", f"url(#{name}-{k})").replace(f"#{name}{{", f"#{name}-{k}{{")
    b = TECH_BB[key]
    pad = 26
    x, y, w, h = b["x"] - pad, b["y"] - pad - 18, b["w"] + pad * 2, b["h"] + pad * 2 + 18   # +18: room for the float lift
    svg = re.sub(r'viewBox="[^"]+" width="1000" height="1000"', f'viewBox="{x:.1f} {y:.1f} {w:.1f} {h:.1f}" preserveAspectRatio="xMidYMid meet"', svg, count=1)
    svg = svg.replace("translateY(-16px)", "translateY(-34px)").replace("hl-float 2.8s ease-in-out 1.2s infinite", "hl-float 3.6s ease-in-out 1.4s infinite")
    svg = re.sub(r"<title>.*?</title>", "", svg, count=1)
    svg = svg.replace('role="img"', 'aria-hidden="true" focusable="false"', 1)
    return f'<template class="tart" data-k="{k}">{svg}</template>'


def cta_icons():
    return "".join(
        f'<a href="{a["url"]}" target="_blank" rel="noopener" title="{e(a["name"])}" class="cicon"><img src="assets/icons/{a["key"]}.webp" alt="{e(a["name"])}" width="64" height="64" loading="lazy"></a>'
        for a in APPS)


def footer_apps():
    return "".join(f'<li><a href="{a["url"]}" target="_blank" rel="noopener">{e(a["short"])}</a></li>' for a in APPS)


def mnav_apps():
    return "".join(f'<a href="{a["url"]}" target="_blank" rel="noopener" aria-label="{e(a["short"])}"><img src="assets/icons/{a["key"]}.webp" alt="" width="44" height="44" loading="lazy"></a>' for a in APPS)


tpl = (ROOT / "src/index.src.html").read_text()
blocks = {
    "LOGO": logo("logo", "h"), "LOGO_FOOT": logo("logo", "f"), "MARK": mark("mark", "s"),
    "VER": VER, "JSONLD": jsonld(), "NAV_APPS": nav_apps(), "MNAV_APPS": mnav_apps(), "HERO_CARDS": hero_cards(), "APP_JSON": app_json(),
    "MARQUEE": marquee(), "STACK_CARDS": stack_cards(), "STACK_DOCK": stack_dock(),
    "CTA_ICONS": cta_icons(), "FOOTER_APPS": footer_apps(),
    "WORDS": WORDS, "ARROW": ARROW, "CHEV": CHEV, "APPLE": APPLE, "STAR": STAR, "PREV": PREV, "NEXT": NEXT,
}
for k, v in blocks.items():
    tpl = tpl.replace("{{" + k + "}}", v)
# Liniqo live hairline figures (free tier, commercial use): pointer-reactive, idle-animated
for key in re.findall(r"\{\{TECH:([a-z-]+)\}\}", tpl):
    tpl = tpl.replace("{{TECH:" + key + "}}", f'<div class="tfig" data-liniqo="{key}" data-accent="#00b8c9" data-intensity="0.85" role="img" aria-label=""></div>', 1)
assert "{{" not in tpl, tpl[tpl.index("{{"):tpl.index("{{") + 40]
(ROOT / "index.html").write_text(tpl)
print("built index.html", len(tpl))

# minified production assets (esbuild); index.html references *.min.* with a content hash
for src_, out_ in (("styles.css", "styles.min.css"), ("app.js", "app.min.js")):
    r = subprocess.run(["npx", "-y", "esbuild@0.28.2", str(ROOT / src_), "--minify", "--log-level=warning",
                        "--outfile=" + str(ROOT / out_)] + (["--target=es2020"] if src_.endswith(".js") else []),
                       capture_output=True, text=True)
    if r.returncode: raise SystemExit(r.stderr)
    print("minified", out_, (ROOT / out_).stat().st_size)
