# Konzept: Was ein eigener Server bringen würde

Rückmeldung: „Ich habe ein potenzielles Angebot, Server zum Hosting zu
bekommen. Gibt es Features, die man sinnvoll auf Server auslagern könnte?
Was wären neue Features, die mit Servern jetzt möglich wären?"

**Stand:** Konzept, nichts gebaut. Heute läuft alles lokal: Daten liegen
beim Nutzer, der Raum ist ein Rechner der Gruppe (LAN oder Portfreigabe,
`docs/raum-online.md`), die KI läuft lokal (Ollama) oder mit eigenem
API-Schlüssel.

## Grundsatz

Die App bleibt **ohne Server voll nutzbar**. Ein Server ist ein Zusatz,
kein Zwang: Wer nichts einrichtet, merkt keinen Unterschied. Das hält die
Offline-Nutzung, die Datensparsamkeit und den itch.io-Vertrieb intakt.

## Was sich lohnt, nach Nutzen geordnet

### 1. Raum-Vermittlung (Relay) — der größte Gewinn

Heute scheitert „Raum übers Internet" oft an Portfreigabe, CGNAT oder
DS-Lite. Ein Server als **Vermittler** löst das: Gastgeber und Gäste
verbinden sich beide nach außen zum Server, der Server reicht nur weiter.

- Keine Portfreigabe, keine IPv6-Frage mehr. Einladung ist ein Code
  („RAUM-7K3F").
- Die Verschlüsselung bleibt **Ende-zu-Ende** mit dem Raumpasswort, wie
  heute. Der Server sieht nur verschlüsselte Pakete, keine Inhalte.
- Last ist gering: Chat, Würfe, Bögen, Initiative sind kleine Nachrichten.
  Dateien (Bilder, Karten) sind der teure Teil; Größenlimit nötig.
- Umsetzung: WebSocket-Relay, ein Raum = ein Kanal. Die Raum-Schicht
  (`apps/shell/src/main/raum.ts`) bekommt einen dritten Weg neben LAN und
  direkter Verbindung.

### 2. Sicherung und Abgleich zwischen Geräten

Die Sammlung (Kampagnen, Monster, Bögen, Tabellen, Karten) verschlüsselt
auf dem Server ablegen und auf einem zweiten Rechner wiederherstellen.

- **Clientseitig verschlüsselt** (Schlüssel aus einem Passwort, das nie
  den Rechner verlässt). Der Server speichert nur Blobs.
- Erst **Sicherung und Wiederherstellung** (einfach, heute gibt es das
  schon als Datei), später echter Abgleich mit Konfliktauflösung (schwer:
  zwei Rechner ändern dieselbe Notiz).

### 3. Spieler:innen ohne Installation

Eine **Browser-Ansicht** für Gäste: Charakterbogen (Kompaktansicht,
`docs/charakterbogen-kompakt.md`), Würfeln, Chat, Initiative ansehen.
Die SL nutzt die App, die Gruppe braucht nur einen Link.

- Setzt den Relay voraus.
- Großer Hebel für Gruppen, in denen nicht alle die App installieren
  wollen oder am Tablet sitzen.

### 4. Asynchron zwischen den Sitzungen

Mit Relay und Speicher: Die SL stellt einen Raum „zwischen den Runden"
bereit. Spieler:innen pflegen Bögen, verteilen Beute, schreiben
Tagebucheinträge; die SL sieht es beim nächsten Öffnen. Heute geht das nur,
wenn der Rechner der SL läuft.

### 5. KI ohne eigenen Schlüssel

Ein Server kann eine KI-Schnittstelle anbieten, damit Nutzer:innen keinen
eigenen API-Schlüssel brauchen.

- **Kosten** trägt dann der Serverbetreiber; ohne Abrechnung oder Limit
  wird das schnell teuer. Deshalb nur mit Kontingent je Nutzer.
- Datenschutz: Texte gehen an den Server und von dort an den Anbieter.
  Muss klar gesagt werden. Die lokale KI (Ollama) bleibt die Vorgabe.

## Was ich nicht auslagern würde

- **Rechnen** (Generatoren, Karten, Würfel, Suche): läuft lokal schnell
  genug, auf dem Server entstünde nur Latenz.
- **Nachschlagewerk / SRD**: ist klein und offline wertvoll.
- **Konten mit E-Mail und Profil**, solange es nicht nötig ist: ein
  Raumcode und ein Sicherungspasswort reichen für 1–4.

## Voraussetzungen und Risiken

| Thema | Was es heißt |
| --- | --- |
| Datenschutz (DSGVO) | Sobald personenbezogene Daten den Server erreichen (IP-Adressen gehören dazu): Datenschutzerklärung, Auftragsverarbeitung mit dem Hoster, Löschkonzept. Ende-zu-Ende-Verschlüsselung senkt das Risiko, ersetzt die Pflichten nicht. Das bitte rechtlich prüfen lassen; ich bin da keine verlässliche Quelle. |
| Betrieb | Updates, Überwachung, Backups des Servers selbst. Ein Relay ohne Speicher ist am pflegeleichtesten. |
| Missbrauch | Größenlimits, Ratenbegrenzung, Räume laufen nach Inaktivität ab. |
| Kosten | Relay: gering. Speicher: moderat. KI: hoch und schwer planbar. |
| Abhängigkeit | Fällt der Server weg, muss die App weiter funktionieren (Grundsatz oben). |

## Vorschlag für die Reihenfolge

1. **Relay** (ohne Speicher, ohne Konten). Größter Nutzen, geringstes
   Risiko.
2. **Browser-Ansicht für Gäste** auf dem Relay.
3. **Verschlüsselte Sicherung** (nur Hochladen und Wiederherstellen).
4. Asynchrone Räume.
5. KI über den Server nur, wenn Kosten und Datenschutz geklärt sind.

## Offene Fragen an dich

1. Was genau bietet das Angebot: ein virtueller Server (Linux, eigener
   Dienst möglich) oder nur Webspace?
2. Wie viele Gruppen sollen darüber laufen: nur eure Runde oder alle, die
   die App von itch.io laden?
3. Standort des Servers (EU oder nicht)? Wichtig für den Datenschutz.
