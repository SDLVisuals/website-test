# SDL Visuals

Snelle portfoliosite met een afgeschermde beheeromgeving op `/admin/`.

## Eenmalige beheerkoppeling

1. Maak een Firebase-project en activeer Google-login, Firestore en Storage.
2. Vul de webconfiguratie en het toegelaten e-mailadres in `assets/js/firebase-config.js` in.
3. Vervang `ADMIN_EMAIL` in `firestore.rules` en `storage.rules` door hetzelfde e-mailadres en publiceer de regels.

De publieke site blijft ook zonder Firebase werken met de bestaande selectie. Nieuwe uploads verschijnen automatisch bovenaan zodra de koppeling actief is.
