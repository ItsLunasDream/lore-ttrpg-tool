# Bedienung mit der Tastatur

Rückmeldung „Allgemein 1": überall ohne Maus hinkommen, mit Pfeiltasten und
Tastenkombinationen; was umständlich wäre (etwa im Map Maker), außen vor
lassen und benennen.

## Was geht

| Taste | Wirkung |
| --- | --- |
| Tab / Umschalt+Tab | nächstes / voriges Bedienelement; sichtbarer Fokusrahmen in allen Werkzeugen |
| Pfeiltasten | in Listen (hoch/runter) und Kachelrastern (alle vier Richtungen, nach Lage auf dem Schirm) |
| Pos1 / Ende | erstes / letztes Element der Liste oder des Rasters |
| Enter / Leertaste | Knopf, Kachel, Karte, Zeile auslösen |
| Esc | Dialog, Menü oder Vorschau schließen |
| **F6** | zwischen Hülle (Schiene) und offenem Werkzeug wechseln |
| Strg+K | Suche über alle Werkzeuge |
| Strg+Alt+Plus / Minus / 0 | ganze Oberfläche größer, kleiner, zurück |

**F6** ist nötig, weil jedes Werkzeug eine eigene eingebettete Ansicht ist:
Tab kommt dort nicht heraus. Von der Schiene aus wählen die Pfeile ein
Werkzeug, Enter öffnet es, F6 springt hinein.

## Wo Pfeiltasten wirken

- **Hülle:** Kacheln im Startmenü, Schiene, Listen im Teilen-Dialog
  (Auswahl, empfangene Pakete, Räume, gespeicherte Räume).
- **Sammlungen** in Monster, Zustände, Encounter, Loot, Magic Items,
  Initiative (Begegnungen), Charakterbogen (Bögen, Live-Bögen, Quellen).
- **Story Creator:** Notizliste, Knoten im Graphen (Pfeile nach Lage; der
  Fokus zeigt die Kurzinfo, Enter öffnet), Handlungsstränge (Stränge und
  Knoten per Tab und Enter).
- **Weitere Listen:** Würfelverlauf, NPC-Merkliste, Inspiration (Holen),
  Nachschlagewerk (Inhaltsliste; Notizstellen im Text per Tab und Enter).
- **Map Maker:** Prop-Palette (Raster), Ebenenliste, aufklappbare
  Abschnitte der Seitenleiste.

In Eingabefeldern bleiben die Pfeile beim Feld, dort bewegen sie den Cursor.
Werkzeuge mit eigener Pfeilsteuerung (Suche, Verweisfelder, Kontextmenüs,
Vorschlagslisten im Editor) behalten sie.

Neue Listen bekommen das mit einem Attribut: `data-pfeile="liste"` oder
`data-pfeile="raster"` am Behälter, bei Karten mit mehreren Knöpfen
`data-pfeil` an der Karte (`packages/tastatur`).

## Was nicht umgesetzt ist

- **Map Maker, Zeichenfläche:** Zeichnen, Wände setzen, Props platzieren,
  Auswahlrechteck, Verschieben mit der Maus. Die Werkzeuge haben Kürzel
  (Buchstaben), Rückgängig und Löschen gehen per Taste; das Setzen selbst
  braucht einen Zeiger. Ausgewählte Objekte mit Pfeiltasten verschieben
  wäre der nächste sinnvolle Schritt.
- **Map Maker, Lineale:** Hilfslinien aus dem Lineal ziehen geht nur mit
  der Maus.
- **Map Maker, Ebenen umsortieren:** nur per Ziehen; die Knöpfe
  „nach oben/unten" in der Leiste gehen per Tastatur.
- **Story Creator, Graph:** Knoten verschieben und die Fläche ziehen nur
  mit der Maus (Zoom über die Knöpfe geht).
- **Würfel in 3D:** der Wurf per Knopf geht, das Werfen mit der Maus nicht.
