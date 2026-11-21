# Pixeltouch — website redesign

Light-theme redesign of [pixeltouch.net](https://pixeltouch.net), an independent iOS app studio.

**Live:** https://pixeltouch-redesign.vercel.app

## Structure
- `src/index.src.html` – page template · `src/apps.py` – app data · `src/build.py` – builds `index.html`
- `styles.css`, `app.js` – styles and interactions (Lenis smooth scroll)
- `assets/` – optimised images, icons, device mockup, hero video, Liniqo illustrations (free tier)

## Build & run
```bash
python3 src/build.py          # regenerate index.html
python3 -m http.server 8888   # preview at http://127.0.0.1:8888
```
