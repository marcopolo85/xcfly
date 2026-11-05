/** Newest first. Add a new entry at the top for each relevant update; its id makes the button glow. */
export const CHANGELOG: { id: string; date: string; items: string[] }[] = [
  {
    id: "2026-11-05d",
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
      "Rangliste passt jetzt aufs Handy – Pilotenname wird nicht mehr abgeschnitten",
    ],
  },
];

export const CHANGELOG_SEEN_KEY = "xcfly-changelog-seen";

export function hasUnseenChangelog(seen: string | null) {
  return CHANGELOG.length > 0 && seen !== CHANGELOG[0].id;
}
