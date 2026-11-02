import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import logoImg from "@/assets/xcfly-logo.png";

export function InfoDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90dvh] w-[calc(100%-2rem)] flex-col overflow-hidden p-0 sm:max-w-2xl">
        <DialogHeader className="shrink-0 border-b border-border px-6 pb-4 pt-5 text-left">
          <DialogTitle className="flex items-center gap-3 pr-6 text-lg">
            <img src={logoImg} alt="XCFly Logo" className="h-10 w-auto" />
            XCFly · Spielanleitung
          </DialogTitle>
          <DialogDescription>Vom ersten Start bis zum Streckenflug: Bedienung, Instrumente und Wertung.</DialogDescription>
        </DialogHeader>
        <div className="min-h-0 space-y-6 overflow-y-auto overscroll-contain px-6 py-5 text-sm leading-relaxed text-foreground">
          <section className="space-y-2">
            <h3 className="font-semibold text-base">1. Worum geht es?</h3>
            <p>XCFly ist ein zweidimensionaler Gleitschirm-Streckenflugsimulator über der Schweiz und ihren Nachbarregionen. Du steuerst den Schirm von oben, suchst aufsteigende Luft, gewinnst beim Kreisen Höhe und gleitest zum nächsten Aufwind. Ohne genügend Aufwind sinkt der Schirm. Berührt er das Gelände, endet der Flug.</p>
            <p>Das Ziel ist, mit guter Routenwahl und möglichst effizientem Höhengewinn weit zu fliegen. Es gibt keine Wegpunkte, die du abfliegen musst. Die Uhrzeit verändert den Sonnenstand und damit die Bedingungen für sonnenabhängige Thermik.</p>
            <p className="text-muted-foreground">Dies ist ein Spiel, kein Flugplanungs- oder Navigationsinstrument. Gelände, Aufwinde, Wolkenbasis und Luftraumanzeigen dürfen nicht für reale Flüge verwendet werden.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">2. Deinen Flug vorbereiten</h3>
            <ol className="list-decimal space-y-1.5 pl-5">
              <li>Wähle einen der drei Flugmodi. Die kleinen Info-Symbole an den Modus-Buttons erklären den jeweiligen Modus separat.</li>
              <li>Wähle einen Startplatz aus der alphabetischen Liste. Unter dem Namen steht die Starthöhe in Metern. Das Pokalsymbol öffnet die Ranglisten dieses Startplatzes.</li>
              <li>Mit <strong>Auf Karte wählen</strong> kannst du einen eigenen Startpunkt festlegen. Verschiebe und zoome die Karte, wähle einen Punkt und bestätige ihn; seine Geländehöhe wird geladen.</li>
              <li>Im Freeflight kannst du die Startzeit mit dem Regler wählen. Im XC-Modus startest du um 11 Uhr. Die Simulation verwendet Sommerbedingungen.</li>
              <li>Schalte den Geräteton ein und drücke <strong>Starten</strong>. Gelände und Thermikkarte werden geladen; bei der vollständigen regionalen Thermikkarte siehst du einen Fortschrittsbalken.</li>
            </ol>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">3. Flugmodi und Wertung</h3>
            <p><strong>XC:</strong> Gewertet wie beim XContest Schweiz. Nach der Landung wird automatisch die beste Streckenart berechnet: <strong>freie Strecke</strong> über bis zu 3 Wendepunkte (Faktor 1.0, oranges Symbol), <strong>flaches Dreieck</strong> (Faktor 1.2, grünes Dreieck) oder <strong>FAI-Dreieck</strong> mit jeder Seite mindestens 28 % des Umfangs (Faktor 1.4, blaues Dreieck). Ein Dreieck ist geschlossen, wenn Anfangs- und Endpunkt höchstens 20 % des Umfangs auseinanderliegen; gewertet wird der Umfang minus diese Schliessdistanz. Die Rangliste ist nach XC-Punkten sortiert.</p>
            <p><strong>Freeflight:</strong> Freies Fliegen ohne Zeitlimit und mit wählbarer Startzeit. Hier kannst du üben, Thermiken erkunden oder lange Strecken fliegen. Es gibt keine öffentliche Freeflight-Rangliste.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">4. Schirm steuern und Zeit beschleunigen</h3>
            <p><strong>Am Laptop:</strong> Halte <strong>←</strong> oder <strong>→</strong>, um nach links oder rechts zu drehen. Mit <strong>Leertaste</strong> oder <strong>↑</strong> aktivierst du den Beschleuniger, solange du die Taste hältst.</p>
            <p><strong>Am Handy:</strong> Halte die Pfeil-Buttons unten für Kurven. Halte <strong>SPEED</strong> für beschleunigten Flug. Während du SPEED hältst, kannst du den Finger nach links oder rechts verschieben, um die Richtung sanft anzupassen. Kleine Bewegungen um den ursprünglichen Druckpunkt bleiben neutral; weiter seitliches Verschieben verstärkt die Korrektur. Beim Loslassen endet sie.</p>
            <p><strong>Lange Kurven:</strong> Hältst du einen Pfeil länger als zwei Sekunden, läuft die Simulation bis zum Loslassen mit Faktor <strong>20</strong>. Das funktioniert auch mit den Pfeiltasten am Laptop. Der Kurvenradius bleibt dabei gleich – du fliegst denselben Kreis nur schneller durch.</p>
            <p><strong>Beschleunigter Geradeausflug:</strong> SPEED beziehungsweise Leertaste/↑ erhöht die Fluggeschwindigkeit und beschleunigt die Simulation auf Faktor <strong>40</strong>. Der Schirm sinkt dabei stärker. Nutze dies für Gleitstrecken, nicht zum effizienten Auskreisen einer Thermik. Die Anzeige SPEED im GPS zeigt den aktiven Beschleuniger.</p>
            <p>Wenn du den Beschleuniger und gleichzeitig einen Pfeil länger als zwei Sekunden hältst, multiplizieren sich die Zeitfaktoren auf <strong>800</strong>. Die Flugzeit läuft dann sehr schnell ab; für sanfte Richtungskorrekturen ist das seitliche Verschieben auf SPEED besser geeignet.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">5. Thermik finden und nutzen</h3>
            <p>Die Thermikkarte basiert auf <strong>thermal.kk7.ch · July / All day</strong>. Sie zeigt mögliche Aufwindgebiete, keine Garantie für dein aktuelles Steigen. Die simulierte Stärke variiert pro Ort: Blau entspricht ungefähr <strong>1–3 m/s</strong>, Dunkelrot <strong>6–9 m/s</strong>, die Zwischenfarben werden proportional abgestuft. Die Farbkarte bleibt unverändert; zufällige Stärken bleiben am jeweiligen Ort stabil.</p>
            <p>Zusätzlich entstehen simulierte Thermiken an <strong>markanten, exponierten Gipfeln</strong> und zufällig auf <strong>gut besonnten Flächen</strong>, unabhängig von der KK7-Karte. Gipfelquellen haben zufällige Stärken von 3–6 m/s, nicht abhängig von der absoluten Gipfelhöhe; die Gipfelerkennung prüft die Umgebung im Radius von 350 m. Besonnte Flächen können dir auch unterhalb der Kretenhöhe helfen. Sonneneinstrahlung und Geländeschatten beeinflussen diese zusätzlichen Quellen.</p>
            <p>Dein tatsächliches Vario ergibt sich aus Aufwind minus Schirmsinken und kann deshalb kleiner sein als die Stärke der Quelle. Der <strong>Varioton</strong> und die VARIO-Anzeige helfen dir, den Kern zu finden: Suche einen Bereich mit positivem Vario, kreise darin und korrigiere den Kreis, wenn das Steigen schwächer wird.</p>
            <p>Die Thermik läuft an der lokalen <strong>Wolkenbasis</strong> aus. Im Flachland reicht die modellierte Basis mindestens 1500 m über das lokale Bezugsgelände. Nach genügend Höhengewinn gleitest du zur nächsten Quelle. Achte dabei auf AGL und vor dir liegende Berge.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">6. Das GPS lesen</h3>
            <dl className="space-y-2 [&_dt]:font-semibold [&_dd]:text-muted-foreground">
              <div><dt>ALT / AGL und seitlicher Balken</dt><dd>ALT ist deine Höhe über Meer, AGL dein Abstand zum Gelände direkt unter dem Schirm. Der seitliche AGL-Balken ergänzt die Zahl; bei wenig Bodenabstand bleibt wenig Reserve.</dd></div>
              <div><dt>VARIO / GZ</dt><dd>VARIO zeigt die geglättete vertikale Geschwindigkeit in m/s: positiv bedeutet Steigen, negativ Sinken. GZ ist die aktuelle Gleitzahl. 1:8 bedeutet ungefähr 8 m horizontale Strecke pro 1 m Höhenverlust unter den momentanen Bedingungen. Bei Steigen steht 1:∞.</dd></div>
              <div><dt>GESCHW. / FLUGDAUER</dt><dd>Die aktuelle Geschwindigkeit in km/h und die simulierte Flugdauer in Minuten:Sekunden. Die Uhrzeit im GPS-Kopf zeigt die Tageszeit im Spiel.</dd></div>
              <div><dt>XC KM / XC GESCHW.</dt><dd>Die optimierte freie XC-Distanz und diese Distanz geteilt durch die Flugdauer. XC KM ist nicht einfach die Summe aller geflogenen Kreise: Es wird die längste Strecke vom Start über einen aufgezeichneten Zwischenpunkt bis zur jeweiligen Flugposition gesucht; der beste bisher erreichte Wert bleibt erhalten. Diese XC-Werte sind nicht dieselbe Wertung wie die Startentfernung der Wettbewerbsmodi.</dd></div>
              <div><dt>TRIANGLE / MIN FAI / MAX FAI</dt><dd>TRIANGLE zeigt den Umfang des aus deinem Track ermittelten, noch nicht geschlossenen Dreiecks. MIN und MAX FAI beschreiben die möglichen Umfangsgrenzen der dazugehörigen FAI-Sektoren. Ohne passenden Wert erscheint ein Strich.</dd></div>
              <div><dt>CLOSE / WOLKENBASIS</dt><dd>CLOSE ist die noch verbleibende Entfernung bis zum Schliessbereich des Dreiecks; 0,0 km bedeutet, dass du darin bist. WOLKENBASIS zeigt die lokale Thermikobergrenze in Metern über Meer.</dd></div>
              
            </dl>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">7. Flugkarte, Gleitbereich und Dreiecke</h3>
            <p>Die Karte zeigt deinen Schirm samt Richtung und den zurückgelegten Flugweg. Zoome mit Mausrad, Touch-Gesten oder den Zoom-Symbolen; die Rückstelltaste setzt die Ansicht zurück. Die Karte bleibt beim Fliegen auf deinen Schirm bezogen.</p>
            <p>Dezente <strong>Höhenlinien</strong> machen die Geländeform lesbar. Eine zusätzliche Linie markiert Gelände auf deiner aktuellen Flughöhe. Die gestrichelte <strong>Gleitlinie</strong> zeigt die Prognose in Flugrichtung bis zum nächsten Geländekontakt. Die durchgezogene <strong>Gleitgrenze</strong> zeigt, wie weit du unter den momentanen Gleitbedingungen in verschiedene Richtungen kommst; blockierende Berge begrenzen sie. Beides sind Momentaufnahmen, keine Zusage: Neue Thermik oder geändertes Sinken verändern die Reichweite.</p>
            <p>Zum optimierten Dreieck werden <strong>FAI-Sektoren</strong> und ein Schliessbereich angezeigt. Für ein FAI-Dreieck muss jede Seite mindestens 28 % des gesamten Umfangs ausmachen. Der Schliessbereich um den ersten Dreieckspunkt hat einen Radius von 20 % des Umfangs. Die Sektoren helfen bei der Wahl der nächsten Flugrichtung; du musst ihnen nicht folgen.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">8. Einstellungen und Seitenansicht</h3>
            <p>Das Einstellungs-Symbol oben rechts öffnet die Anzeigeoptionen. Du kannst zwischen <strong>Relief, Landeskarte, Landeskarte grau, Luftbild, Topo, OSM Farbe und Dunkel</strong> wählen. Der Kartenstil wird auf deinem Gerät gespeichert. Beim Relief erscheinen auch Seen, grosse Flüsse und Wälder als zusätzliche Kartenebenen.</p>
            <p>Der Regler <strong>Thermikkarte</strong> bestimmt ihre Deckkraft. Bei 0 % ist sie ausgeblendet – die Thermik wirkt trotzdem weiter, denn der Regler ändert nur die Darstellung.</p>
            <p>Das <strong>Seitenprofil</strong> ist zunächst ausgeblendet. Eingeschaltet zeigt es neben dem GPS das Gelände in deiner Flugrichtung und den Gleitpfad. Es lässt sich unabhängig von der Flugkarte zoomen. Es ist ein Schnitt entlang deiner Richtung, keine vollständige Ansicht aller seitlich liegenden Hindernisse.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">9. Lufträume</h3>
            <p><strong>Lufträume</strong> sind standardmässig ausgeblendet. Schalte sie in den Einstellungen ein, um TMA, CTR sowie Bereiche bei Heliports und kleinen Flugplätzen zu sehen. Verschiedene Kategorien haben verschiedene Farben und eine Füllung mit 15 % Deckkraft.</p>
            <p>Liegt deine Höhe zwischen Unter- und Obergrenze eines Bereichs, erscheint sein Rand hervorgehoben. Die Beschriftung zeigt die Grenzen in Metern und liegt entlang des Randes innerhalb der Fläche, sofern genügend Platz vorhanden ist. Mit <strong>Luftraum-Beschriftung</strong> kannst du die Texte separat ein- oder ausschalten.</p>
            <p>Wenn das Seitenprofil eingeblendet ist, zeigt es die aktivierten Lufträume auch als Schnitt in Flugrichtung, einschliesslich geländebezogener Höhenlimits. Die Anzeige dient der Orientierung im Spiel; für reale Flugplätze und Luftraumgrenzen ist sie nicht verbindlich.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">10. Landung, Auswertung und Ranglisten</h3>
            <p>Nach der Landung oder dem Zeitlimit öffnet sich die Flugauswertung. Sie zeigt die Moduswertung, XC-Strecke, XC-Punkte (ein Punkt je XC-Kilometer), Flugdauer, XC-Geschwindigkeit, maximale Höhe, kumulierten Höhengewinn, erkannte Thermiken und vollständige Thermikkreise.</p>
            <p>Die <strong>Trackübersicht</strong> zeigt deinen Flugweg auf dem gewählten Kartenstil; der Punkt markiert den Start. Mit <strong>Nochmal</strong> startest du mit denselben Vorgaben erneut, mit <strong>Menü</strong> kehrst du zur Startauswahl zurück.</p>
            <p>Für einen Ranglisteneintrag gibst du deinen Pilotennamen ein und drückst <strong>Eintragen</strong>. Mit <strong>Abbrechen</strong> überspringst du die Eintragung. Ranglisteneinträge werden in der Cloud gespeichert und sind für andere Spieler sichtbar – verwende nur einen Namen, den du öffentlich anzeigen möchtest.</p>
            <p>Das Pokalsymbol eines Startplatzes zeigt dessen getrennte Ranglisten für <strong>Out & Return</strong> und <strong>One-Way</strong> nebeneinander, jeweils mit Namen und Kilometern. Klicke auf einen Pilotennamen, um die Trackübersicht dieses Fluges zu öffnen. Bei älteren Einträgen kann noch kein Track vorhanden sein.</p>
          </section>
          <section className="space-y-2">
            <h3 className="font-semibold text-base">11. Daten laden und ein guter erster Flug</h3>
            <p>Für Kartendarstellung, Gelände, Thermik und Ranglisten brauchst du eine Internetverbindung. Die regionale KK7-Karte umfasst die Schweiz und angrenzende Regionen; auch grenzüberschreitende Flüge, etwa Richtung Domodossola, sind möglich. Die Farbkarte kann örtlich leer sein – dort wird keine KK7-Thermik erfunden.</p>
            <p>Bei längeren Flügen werden weitere Gelände- und Thermikdaten nachgeladen. Reichen die vorhandenen Daten nicht mehr aus, wartet die Simulation auf neue Abdeckung. Bei einem Ladefehler kannst du <strong>Erneut versuchen</strong> wählen.</p>
            <p><strong>Zum Einstieg:</strong> Starte im Freeflight, lass die Thermikkarte sichtbar und suche zunächst einen Aufwind nahe dem Start. Kreise mit positivem Vario bis du genügend Höhe hast. Wähle dann eine kurze Gleitstrecke mit guter Bodenreserve. Erst wenn du Thermiken zuverlässig findest, versuche einen 4-Stunden-Flug – bei Out & Return immer mit Rückweg im Blick.</p>
          </section>
          <section className="space-y-1.5">
            <h3 className="font-semibold text-base">Copyright & Quellen</h3>
            <div>
              <span className="text-muted-foreground">Karte: </span>
              <a href="https://www.swisstopo.admin.ch/de/nutzungsbedingungen" target="_blank" rel="noopener noreferrer" className="underline">© swisstopo</a>
            </div>
            <div>
              <span className="text-muted-foreground">Thermik: </span>
              <a href="https://thermal.kk7.ch/" target="_blank" rel="noopener noreferrer" className="underline">M. von Känel · KK7 · Juli / All day</a>
            </div>
            <div>
              <span className="text-muted-foreground">Lufträume: </span>
              <a href="https://www.bazl.admin.ch/" target="_blank" rel="noopener noreferrer" className="underline">© BAZL · geo.admin.ch</a> (nicht für Navigation)
            </div>
            <div>
              <span className="text-muted-foreground">Lizenz: </span>
              <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/" target="_blank" rel="noopener noreferrer" className="underline">CC BY-NC-SA 4.0 · bearbeitet</a>
            </div>
          </section>
          <section className="space-y-1">
            <div>Erstellt durch Marco Bürgisser</div>
            <div className="text-muted-foreground">Kontakt: <a href="mailto:xcfly@gmx.ch" className="underline">xcfly@gmx.ch</a></div>
          </section>
          <a hidden href="https://buymeacoffee.com/marcopolo85" target="_blank" rel="noopener noreferrer" className="hidden w-full items-center justify-center gap-2 rounded-lg bg-sun py-2.5 font-bold text-background transition hover:brightness-110">
            ☕ Buy me a coffee
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}
