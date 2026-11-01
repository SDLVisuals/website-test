# SDL Visuals

Photography, film and drone portfolio at https://sdlvisuals.be.

## Local preview

This is a static HTML, CSS and JavaScript website. No build step is required.

```sh
python3 -m http.server 8766
```

Open http://127.0.0.1:8766/index.html.

## Editing

- `index.html`: homepage; `glass.html` is the matching local concept alias. Keep their contents aligned.
- `hero.css`, `home.js`: immersive photo opening and swipe slideshow.
- `home-motion.js`, `scroll-scenes.css`: scroll-driven image and text reveals.
- `trouw.html`, `evenementen.html`, `auto.html`, `portret.html`, `koppelshoot.html`, `product.html`: photo galleries.
- `Video.html`, `drone.html`, `gear.html`: film, drone and equipment pages.
- `viewer.js`, `viewer.css`, `gallery.css`, `ui.js`, `ui.css`: shared viewers and gallery controls.
- `assets/`: finished photographs, optimized web videos, logos and equipment imagery.

The galleries contain 204 selected photographs. Four film players use Gumlet; two optimized MP4s are served from this repository. External fonts use Google Fonts. Photos in the galleries are photographs, not stills extracted from films.

## Hosting

The existing `CNAME` retains the custom domain. Existing files for the separate `nest-homekit` pages are retained.

Before publishing a change, check desktop and mobile framing, both color themes, swipe and keyboard navigation, gallery zoom, video playback and local links. Reduced-motion preferences are respected.
