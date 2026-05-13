# Legacy Guardians — Brand Kit

## Color palette

| Role | Light mode | Dark mode |
|---|---|---|
| Primary blue | `#2E4A7F` | `#7A95C9` |
| Accent bronze | `#A87444` | `#D4A574` |
| Cream highlight (inside shield) | `#F4F1EA` | `#F4F1EA` |
| Antique gold (L in shield) | `#C9A961` | `#C9A961` |

**Reference — Speedwell Law blue:** `#3F64AE` (kept for record; Legacy Guardians uses the deeper `#2E4A7F` to differentiate as a related but distinct brand).

## Folder structure

```
legacy-guardians-brand-kit/
├── README.md                  ← this file
├── svg/                       ← master vector files (use these for anything new)
├── png-app-icon/              ← Concept D shield, square, multiple sizes
├── png-mark/                  ← Concept C arch mark, light & dark, multiple sizes
├── png-mark-simplified/       ← Concept C without per stirpes lines, for tiny sizes
├── png-lockup/                ← Mark + wordmark + tagline, horizontal, light & dark
└── favicon/                   ← favicon.ico + 16/32/48 PNGs for web
```

## What to use where

| Use case | File |
|---|---|
| Browser tab favicon | `favicon/favicon.ico` |
| iOS home screen / Apple touch icon | `png-app-icon/apple-touch-icon.png` (180px) |
| Android home screen | `png-app-icon/icon-192.png` |
| App store listings | `png-app-icon/icon-1024.png` |
| Social profile picture (LinkedIn, Twitter, etc.) | `png-app-icon/icon-512.png` |
| Marketing site header logo | `png-lockup/lockup-light-1200.png` (or SVG) |
| Marketing site dark footer | `png-lockup/lockup-dark-1200.png` |
| Email signature | `png-lockup/lockup-light-600.png` |
| Business card, letterhead | use the SVG for print |
| Slide deck cover | `png-lockup/lockup-light-2400.png` |
| In-app brand mark (without wordmark) | `png-mark/mark-light-512.png` or `mark-dark-512.png` |
| In-app tiny brand mark (under 32px display) | `png-mark-simplified/` |

## Web favicon setup

In your HTML `<head>`:

```html
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/icon-32.png" type="image/png" sizes="32x32">
<link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
```

## Conceptual notes

The primary brandmark (Concept C) encodes two ideas simultaneously:
1. **Outer arch** — protection, architecture, the law as a structure that shelters what is inside.
2. **Interior** — a per stirpes distribution diagram. An ancestor at the apex, three descendants at the base, lines of inheritance fanning down. Recognizable to any estate practitioner; meaningful but abstract to laypeople.

The bronze descendants are the visual focus — they are who the entire system exists for. Everything blue is the infrastructure.

The app icon (Concept D) is a deliberately simpler mark: a shield containing an interlocking L and G monogram. Designed to survive at 16px where the per stirpes lines of the primary mark would disappear. Together, they form a system — the arch is the brand's "voice," the shield is its "signature."

## Re-generating from source

All PNG files are generated from the SVGs in `svg/`. To regenerate at a different size:

```bash
# Install: pip install cairosvg
python3 -c "import cairosvg; cairosvg.svg2png(url='svg/legacy-guardians-icon-D.svg', write_to='out.png', output_width=2048, output_height=2048)"
```

Or use a graphics tool (Figma, Illustrator, Inkscape) — the SVGs are clean and editable.
