# Inbal Korene — Landing Page (Venus Versa)

**Custom domain:** https://www.inbalkorene.co.il/  
**GitHub username:** eladkorene26-jpg

## קבצים חשובים
- `CNAME` — מכיל: `www.inbalkorene.co.il` (כבר בפנים)
- `index.html`, `styles.css`, `script.js`
- `assets/` — פלייסהולדרים + favicon/אייקונים
- `robots.txt`, `sitemap.xml`, `.nojekyll`, `404.html`, `site.webmanifest`

## פריסה (GitHub Pages)
1. דחוף/י את התיקייה לריפו ציבורי.
2. Repo → **Settings → Pages** → Source: `Deploy from a branch` (`main` / `/root`).
3. ב־**Custom domain** הכנס/י: `www.inbalkorene.co.il` ושמור/י.
4. סמן/י **Enforce HTTPS** כשזמין.

## DNS אצל רשם הדומיין
- **apex** (`inbalkorene.co.il`): 4 רשומות **A** ל־GitHub Pages  
  `185.199.108.153` · `185.199.109.153` · `185.199.110.153` · `185.199.111.153`  
  (אופציונלי IPv6 — AAAA): `2606:50c0:8000::153` · `2606:50c0:8001::153` · `2606:50c0:8002::153` · `2606:50c0:8003::153`
- **www** (`www.inbalkorene.co.il`): רשומת **CNAME** → **`eladkorene26-jpg.github.io`**

לאחר שה-DNS מתפשט, GitHub יאמת את הדומיין וינפיק תעודה. אם יש קשיי אימות, ודא/י שאין A/CNAME סותרים ושה-CNAME מפנה בדיוק ל-`eladkorene26-jpg.github.io`.

Built: 2025-08-26
