/** Newest first. Add a new entry at the top for each relevant update; its id makes the button glow. */
export const CHANGELOG: { id: string; date: string; items: string[] }[] = [
  {
    id: "2026-11-11b",
    date: "11. Nov 2026",
    items: ["Multiplayer: knallige Schirmfarben, Track in Schirmfarbe", "Einstellungen bleiben pro Gerät gespeichert, Kartendeckkraft einstellbar", "Minimap mit automatischem Zoom auf Track und FAI-Sektoren, separat zoombar", "Weekly-Task: jede Woche neue 150-km-Aufgabe mit eigener Rangliste (km, dann Flugdauer)", "Weekly-Task ohne Zeitlimit"],
  },
  {
    id: "2026-11-10c",
    date: "10. Nov 2026",
    items: ["GPS neu angeordnet, XC km/Unfinished farbig nach Streckentyp", "Touch-Steuerung auch auf iPad und Tablets", "FlyXC-Aufgaben importieren (Zylinder 400 m)", "Im Flug: «Aufgabe abbrechen», «Neustart», «Navigiere zum SP» und «Menü»", "Als App installiert im Vollbild", "Multiplayer: Flugspuren der anderen Piloten", "Startseite: «Tracks von heute» mit Seitenliste nach Punkten, Track antippen hebt ihn hervor", "Ranglisten: eigener Start/Aufgabe zeigt nächsten Startplatz oder Berg"],
  },
  {
    id: "2026-11-09a",
    date: "9. Nov 2026",
    items: ["Feinfühligere, progressive Steuerung im beschleunigten Flug", "Multiplayer: andere Piloten bewegen sich flüssig", "AGL-Balken zeigt Boden bis Wolkenbasis"],
  },
  {
    id: "2026-11-08a",
    date: "8. Nov 2026",
    items: ["Live-Multiplayer: andere Piloten mit Name und Höhe auf der Karte", "Wöchentliche Ranglisten (Reset sonntags 23:00)"],
  },
  {
    id: "2026-11-07b",
    date: "7. Nov 2026",
    items: [
      "Automatischer Zoomwechsel merkt sich die auf der Karte gewählte Thermik-Zoomstufe",
      "Handy: doppeltes Zoomtempo, Schirm mittig oberhalb des Varios",
    ],
  },
  {
    id: "2026-11-06g",
    date: "6. Nov 2026",
    items: [
      "Handy: stufenloser Zoomschieber rechts neben dem Vario – unten rein, oben raus",
      "Optimierung Drehgeschwindigkeit in der Thermik",
      "Thermik: kleiner Kurvenradius bei unverändert schnellem Steigen",
      "Flugkarte zentrieren: Mausrad-Doppelklick oder Doppeltipp auf dem Handy",
    ],
  },
  {
    id: "2026-11-05e",
    date: "5. Nov 2026",
    items: [
      "Thermikkarte in der App gespeichert – lädt nur 1× pro Gerät",
      "Schnellerer Start: nur Kartenteile im Bild werden geladen",
      "Thermikkarte wird alle 3 Monate aktualisiert",
      "Startplätze nur noch in der Schweiz und Grenzregion",
      "Neu: Changelog-Button",
      "Karte zoomen mit Taste A (rein) und Q (raus)",
      "Einstellbare Standard-Zoomstufen und automatischer Zoomwechsel Thermik ↔ Speed",
      "Fliessende Zoomübergänge",
      "Datum in den Ranglisten",
      "Rangliste passt jetzt aufs Handy – voller Pilotenname, Startplatz und Datum daneben, ohne sichtbaren Scrollbalken",
    ],
  },
];

export const CHANGELOG_SEEN_KEY = "xcfly-changelog-seen";

export function hasUnseenChangelog(seen: string | null) {
  return CHANGELOG.length > 0 && seen !== CHANGELOG[0].id;
}
