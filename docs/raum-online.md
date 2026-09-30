# Raum übers Internet einrichten

Kurzanleitung für Gastgeber. Im selben WLAN braucht es nichts davon: dort
findet man den Raum in der Liste.

> **Stand:** Die Internet-Funktion ist bisher nur lokal getestet, nicht über
> echte Anschlüsse. Rückmeldungen, was bei euch klappt und was nicht, helfen.

## 1. Raum eröffnen

1. **Teilen → Raum → Einen Raum eröffnen**.
2. Häkchen **„Auch über das Internet (Portfreigabe oder IPv6)“** setzen.
3. **Passwort** vergeben (ist hier Pflicht; der Raum ist damit verschlüsselt).
4. **Port** stehen lassen (Vorgabe **47812**) oder einen eigenen wählen.
5. **Raum eröffnen**. Unter Windows fragt die Firewall beim ersten Mal, ob
   die App ins Netz darf: **zulassen**, sonst erreicht dich niemand.

Die App zeigt danach deine Adressen: lokales Netz, öffentliche IPv4 und,
falls vorhanden, öffentliche IPv6.

## 2. Erreichbar machen

Es gibt zwei Wege. Einer genügt.

### Weg A: Portfreigabe (IPv4)

Im Router eine Portfreigabe (auch „Port-Weiterleitung“, „Port Forwarding“,
„Virtual Server“) anlegen:

| Einstellung | Wert |
| --- | --- |
| Protokoll | **TCP** |
| Port (außen und innen) | **47812** (oder dein eigener) |
| Ziel | die **lokale Adresse** deines Rechners, die die App unter „Lokales Netz“ zeigt (z. B. `192.168.178.23`) |

Wo das Menü liegt, hängt vom Router ab; meist unter „Internet“, „Netzwerk“
oder „NAT“. Tipp: dem Rechner im Router eine feste lokale Adresse geben,
sonst zeigt die Freigabe nach einem Neustart ins Leere.

**Geht nicht hinter CGNAT oder DS-Lite.** Das ist bei Kabel- und
Mobilfunkanschlüssen häufig. So prüfst du es: Vergleiche die IPv4, die dein
Router als „Internet-Adresse“ oder „WAN-IP“ anzeigt, mit der öffentlichen
IPv4 in der App. Weichen sie ab, oder beginnt die Router-Adresse mit `100.64`
bis `100.127`, hilft keine Portfreigabe. Dann Weg B.

### Weg B: IPv6

Hat dein Rechner eine öffentliche IPv6, zeigt die App sie an. Eine
Weiterleitung braucht es nicht, aber der Router blockt eingehende
Verbindungen meist. Im Router für **diesen Rechner** eingehenden **TCP-Port
47812** über IPv6 erlauben (oft unter „Freigaben“ oder „Firewall“).

Nachteil: Die Gäste brauchen dann ebenfalls IPv6. Ohne IPv6 bei ihnen kommt
keine Verbindung zustande.

## 3. Gäste einladen

- **Einladung kopieren** legt Raumname und alle Adressen in die
  Zwischenablage, **ohne Passwort**. Das Passwort auf anderem Weg weitergeben.
- Gäste gehen auf **Teilen → Raum** und tragen die Adresse ins Adressfeld
  ein, etwa `203.0.113.7:47812` oder `[2001:db8::1]:47812`. Ohne Port gilt
  47812.

## 4. Wenn es nicht klappt

„Keine Antwort vom Raum“ beim Gast heißt fast immer eins davon:

1. Portfreigabe fehlt, zeigt auf die falsche lokale Adresse oder ist UDP
   statt TCP.
2. Die Firewall des Gastgebers lässt die App nicht durch (Windows:
   „Windows-Sicherheit → Firewall- & Netzwerkschutz → Zugriff von App durch
   Firewall zulassen“).
3. CGNAT oder DS-Lite beim Gastgeber (siehe oben).
4. Gast hat die falsche Adresse, etwa die lokale statt der öffentlichen.
5. Port belegt: dann beim Eröffnen einen anderen Port wählen und die
   Freigabe anpassen.

Test ohne zweite Person: vom Handy aus im Mobilfunknetz (WLAN aus) mit einem
Online-Portprüfer testen, ob der Port offen ist, während der Raum läuft.
Solche Dienste sehen dabei deine IP.

## 5. Danach

Die Freigabe ist nur offen, solange die App den Raum hält. Wer ganz sicher
gehen will, schaltet die Portfreigabe im Router nach der Runde wieder aus.

Kein fremder Server, kein UPnP, kein VPN: Die App öffnet selbst keine Ports
im Router. Technik dahinter: `docs/austausch.md`.
