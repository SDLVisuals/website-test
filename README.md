# SDL Visuals

Fotografie, videografie en drone: https://sdlvisuals.be.

## Project

Dit is de publieke websitecode. HTML, CSS en JavaScript worden rechtstreeks
door GitHub Pages geserveerd; een bouwstap is niet nodig.

De centrale lokale projectmap is `Documenten/SDL Visuals Website`:

- `Website/`: deze Git-checkout.
- `Beheer/`: de aparte beheerapp met haar eigen publicatie en opslag.
- `Onderhoud/`: tests, lokale preview, assetversies en livecontrole.
- `Documentatie/`: uitleg over bestanden, beheer en publiceren.

Foto's, video's, galerijen en teksten kunnen via de bestaande beheerapp worden
gepubliceerd. De website leest die inhoud via `cms-content.js`. De broncode
bevat daarnaast de ingebouwde foto's, films en inhoud voor de eerste weergave.

## Lokale preview

Gebruik `Start website.command` vanuit de centrale projectmap, of:

```sh
python3 ../Onderhoud/preview.py
```

Open http://127.0.0.1:8766/index.html. De preview serveert alleen deze map.

## Wegwijzer

- `index.html` en `glass.html`: homepage en identieke bestaande alias.
- `home.js`, `hero.css`: startscherm en automatische fotoslider.
- `collection-controls.js`, `collection-controls.css`: compacte seriebediening.
- `trouw.html`, `evenementen.html`, `portret.html`, `koppelshoot.html`,
  `auto.html`, `product.html`: fotogalerijen.
- `Video.html`, `drone.html`, `galerij.html`: film, drone en dynamische galerijen.
- `gear.html`, `contact.html`: materiaal en contact.
- `viewer.js`, `viewer.css`: gedeelde foto- en videoviewer.
- `portfolio-nav.js`, `portfolio-nav.css`: navigatie met categorieën.
- `cms-content.js`, `cms-config.js`, `cms-prefetch.js`: beheerintegratie.
- `theme-init.js`: systeem-, lichte en donkere modus.
- `assets/`: afgewerkte foto's, webvideo's en logo's.

## Publicatie

Behoud `CNAME` en de zelfstandige `nest-homekit`-pagina's. De checkout kan
sparse zijn; bestanden buiten de lokale werkboom zijn niet automatisch weg
uit Git of van de live website.

Controleer relevante tests, telefoon- en desktopbediening, beide thema's en
lokale koppelingen. Vernieuw CSS/JS-versienummers met
`python3 ../Onderhoud/version_assets.py`. Publiceer via de bestaande GitHub
Pages-workflow en controleer dezelfde commit en live bestanden voordat een
wijziging als gepubliceerd wordt gemeld.
