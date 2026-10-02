/**
 * Der Entwurf als Notizen fuer den Story Creator.
 *
 * „Entwurf hier, Wahrheit dort" (docs/inspirationshilfe.md): dieses Werkzeug
 * fuehrt keine zweite Welt. Was bleiben soll, wandert auf Knopfdruck
 * hinueber — als Notizen mit Wiki-Verweisen untereinander, damit der Graph
 * drueben sofort etwas zu zeichnen hat.
 *
 * Zwei Formen, weil beide gebraucht werden: alles in eine Notiz, wenn man
 * nur nachlesen will, und eine Notiz je Figur und Ort, wenn daraus eine
 * Kampagne werden soll.
 */
import type { Entwurf, EntwurfsFigur, Fraktion, Ort, Verbindung } from './erzeuge';
import type { Sprache } from './tabellen';

/** Die Notiztypen des Story Creators, soweit hier gebraucht. */
export type NotizTyp = 'character' | 'location' | 'faction' | 'note';

export interface Notiz {
  readonly typ: NotizTyp;
  readonly titel: string;
  readonly markdown: string;
}

function w(sprache: Sprache, de: string, en: string): string {
  return sprache === 'de' ? de : en;
}

/** Ein Wiki-Verweis, wie der Story Creator ihn liest. */
export function verweis(titel: string): string {
  return `[[${titel}]]`;
}

/**
 * Setzt Absaetze zusammen und laesst Leeres weg.
 *
 * Mit Leerzeile dazwischen, nicht mit einfachem Umbruch: der Backstory
 * Creator liest Markdown mit `breaks: false`, und dort werden aus drei
 * Zeilen ohne Leerzeile ein einziger Absatz — „**Rolle:** … **Will:** …"
 * hintereinander weg. Zeilen, die als Liste zusammengehoeren, kommen deshalb
 * fertig verbunden als EIN Absatz herein.
 */
function zeilen(...teile: Array<string | false | null | undefined>): string {
  return teile.filter((teil): teil is string => typeof teil === 'string' && teil !== '').join('\n\n');
}

export function aufhaengerText(entwurf: Entwurf, sprache: Sprache): string {
  const a = entwurf.aufhaenger;
  return zeilen(
    a.ausloeser,
    a.betroffene,
    a.komplikation,
    a.frist && `**${w(sprache, 'Frist', 'Deadline')}:** ${a.frist}`
  );
}

export function fraktionText(fraktion: Fraktion, sprache: Sprache): string {
  return zeilen(
    `*${fraktion.art}*`,
    `**${w(sprache, 'Ziel', 'Goal')}:** ${fraktion.ziel}`,
    `**${w(sprache, 'Mittel', 'Methods')}:** ${fraktion.mittel}`,
    `**${w(sprache, 'Schwachstelle', 'Weak point')}:** ${fraktion.schwaeche}`
  );
}

export function figurText(
  figur: EntwurfsFigur,
  sprache: Sprache,
  verbindungen: readonly string[] = []
): string {
  return zeilen(
    `**${w(sprache, 'Rolle', 'Role')}:** ${figur.rolle}`,
    `**${w(sprache, 'Will', 'Wants')}:** ${figur.triebfeder}`,
    `**${w(sprache, 'Hat', 'Holds')}:** ${figur.hebel}`,
    `**${w(sprache, 'Haken', 'Snag')}:** ${figur.makel}`,
    verbindungen.length > 0 ? `### ${w(sprache, 'Verbindungen', 'Connections')}` : '',
    // Die Liste als ein Stueck: Aufzaehlungspunkte gehoeren zusammen und
    // brauchen untereinander keine Leerzeile.
    verbindungen.map((satz) => `- ${satz}`).join('\n')
  );
}

export function ortText(ort: Ort, sprache: Sprache): string {
  return zeilen(
    `*${ort.art}*`,
    ort.merkmal,
    ort.zustand,
    `**${w(sprache, 'Auf der Karte', 'On the map')}:** ${ort.karte}`,
    ort.ausstattung && `**${w(sprache, 'Was dort steht', 'What stands there')}:** ${ort.ausstattung}`
  );
}

/**
 * Die Ausstattung in ihre einzelnen Stuecke.
 *
 * Gespeichert ist sie als ein Feld mit Semikolon dazwischen, damit sie sich
 * wie jedes andere Feld bearbeiten laesst. Gebraucht werden die Stuecke
 * einzeln, sobald daraus Pins auf einer Karte werden — je Ding ein Pin, den
 * man an die Stelle schiebt, an die er gehoert.
 */
export function ausstattungsstuecke(ort: Ort): string[] {
  return ort.ausstattung
    .split(';')
    .map((stueck) => stueck.trim())
    .filter((stueck) => stueck !== '');
}

/** Die Verbindungen einer Figur, als Saetze mit Verweis auf die Gegenseite. */
export function verbindungenVon(
  stelle: number,
  entwurf: Entwurf
): string[] {
  const satz = (verbindung: Verbindung): string => {
    const andere = verbindung.a === stelle ? verbindung.b : verbindung.a;
    const name = entwurf.figuren[andere]?.name ?? '?';
    // Beide Saetze, immer. Eine gerichtete Beziehung ist erst zu zweit zu
    // verstehen: „{a} hat {b} das Leben gerettet" heisst wenig, solange nicht
    // danebensteht, dass {b} lieber ertrunken waere.
    const beides = `${verbindung.hin} ${verbindung.zurueck}`;
    // Nur der Name der Gegenseite wird zum Verweis, der eigene nicht — eine
    // Notiz, die auf sich selbst zeigt, waere im Graph eine Schleife.
    return `**${verbindung.muster}:** ${beides.split(name).join(verweis(name))}`;
  };
  return entwurf.verbindungen
    .filter((verbindung) => verbindung.a === stelle || verbindung.b === stelle)
    .map(satz);
}

/**
 * Was von einem Ort auf die Karte gehoert.
 *
 * NUR, WAS MAN ZEICHNEN KANN — und das ist der ganze Unterschied zur Notiz
 * im Story Creator.
 *
 * Vorher gingen auch Merkmal und Zustand als Pins mit: „es riecht
 * durchgehend nach etwas, das hier nicht verarbeitet wird", „er ist
 * verpfaendet und wird in drei Monaten versteigert". Beides sind gute
 * Saetze, und beim Kartenbau ist keiner davon zu gebrauchen: einen Geruch
 * zeichnet man nicht, eine Verpfaendung auch nicht. Sie stehen weiterhin in
 * der Ortsnotiz, wo sie hingehoeren.
 *
 * Auf die Karte geht deshalb nur zweierlei: der Grundriss — die Zeile, die
 * sagt, wie der Ort geschnitten ist — und die Dinge, die darin stehen, je
 * eines als eigener Pin. Ein Pin je Ding, weil man ihn dorthin schiebt, wo
 * das Ding steht; alles in einem Pin waere wieder eine Notiz.
 */
export function alsKartennotizen(
  ort: Ort,
  sprache: Sprache
): { title: string; text: string }[] {
  const heraus: { title: string; text: string }[] = [];
  if (ort.karte) heraus.push({ title: w(sprache, 'Grundriss', 'Layout'), text: ort.karte });
  if (ort.art) heraus.push({ title: ort.name || w(sprache, 'Der Ort', 'The place'), text: ort.art });
  for (const stueck of ausstattungsstuecke(ort)) {
    heraus.push({ title: w(sprache, 'Hier steht', 'Standing here'), text: stueck });
  }
  return heraus;
}

/**
 * Alles in einem Text.
 *
 * Das ist auch die Fassung, die in die Zwischenablage geht.
 */
export function alsMarkdown(entwurf: Entwurf, sprache: Sprache): string {
  const teile: string[] = [];

  // Die Welt steht oben und ohne Ueberschrift — sie ist der Rahmen, nicht
  // ein Baustein unter anderen.
  if (entwurf.welt) teile.push(`*${entwurf.welt}*`);

  teile.push(`## ${w(sprache, 'Aufhänger', 'Hook')}`, aufhaengerText(entwurf, sprache));

  if (entwurf.fraktionen.length > 0) {
    teile.push(`## ${w(sprache, 'Fraktionen', 'Factions')}`);
    for (const fraktion of entwurf.fraktionen) {
      teile.push(`### ${fraktion.name}`, fraktionText(fraktion, sprache));
    }
  }

  if (entwurf.figuren.length > 0) {
    teile.push(`## ${w(sprache, 'Figuren', 'Characters')}`);
    entwurf.figuren.forEach((figur, stelle) => {
      teile.push(`### ${figur.name}`, figurText(figur, sprache, verbindungenVon(stelle, entwurf)));
    });
  }

  if (entwurf.orte.length > 0) {
    teile.push(`## ${w(sprache, 'Orte', 'Places')}`);
    for (const ort of entwurf.orte) {
      teile.push(`### ${ort.name}`, ortText(ort, sprache));
    }
  }

  if (entwurf.zeitstrahl.length > 0) {
    teile.push(
      `## ${w(sprache, 'Wenn niemand eingreift', 'If nobody intervenes')}`,
      entwurf.zeitstrahl.map((punkt) => `- **${punkt.marke}:** ${punkt.was}`).join('\n')
    );
  }

  return teile.join('\n\n');
}

/**
 * Eine Notiz je Baustein, mit Verweisen untereinander.
 *
 * Die Uebersichtsnotiz haelt den Aufhaenger und den Zeitstrahl und verweist
 * auf alles andere. Die Titel sind die Namen aus dem Entwurf — genau die
 * stehen auch in den Verweisen, sonst zeigten sie ins Leere.
 */
export function alsNotizen(entwurf: Entwurf, sprache: Sprache, titel: string): Notiz[] {
  const notizen: Notiz[] = [];

  const liste = (ueberschrift: string, namen: readonly string[]) =>
    namen.length > 0 ? `### ${ueberschrift}\n${namen.map((name) => `- ${verweis(name)}`).join('\n')}` : '';

  notizen.push({
    typ: 'note',
    titel,
    markdown: zeilen(
      entwurf.welt ? `*${entwurf.welt}*` : '',
      `## ${w(sprache, 'Aufhänger', 'Hook')}`,
      aufhaengerText(entwurf, sprache),
      liste(w(sprache, 'Fraktionen', 'Factions'), entwurf.fraktionen.map((f) => f.name)),
      liste(w(sprache, 'Figuren', 'Characters'), entwurf.figuren.map((f) => f.name)),
      liste(w(sprache, 'Orte', 'Places'), entwurf.orte.map((o) => o.name)),
      entwurf.zeitstrahl.length > 0
        ? `### ${w(sprache, 'Wenn niemand eingreift', 'If nobody intervenes')}\n${entwurf.zeitstrahl
            .map((punkt) => `- **${punkt.marke}:** ${punkt.was}`)
            .join('\n')}`
        : ''
    )
  });

  for (const fraktion of entwurf.fraktionen) {
    notizen.push({ typ: 'faction', titel: fraktion.name, markdown: fraktionText(fraktion, sprache) });
  }

  entwurf.figuren.forEach((figur, stelle) => {
    // Figuren aus der Kampagne bekommen keine zweite Notiz. Der Verweis in
    // der Uebersicht und in den Verbindungen trifft ihre vorhandene — genau
    // dafuer holt man sie herueber. Was hier ueber sie steht (Rolle,
    // Triebfeder), gehoert zu diesem Entwurf und nicht zu ihr; es wuerde
    // ihre gepflegte Notiz eher stoeren als ergaenzen.
    if (figur.vorhanden) return;
    notizen.push({
      typ: 'character',
      titel: figur.name,
      markdown: figurText(figur, sprache, verbindungenVon(stelle, entwurf))
    });
  });

  for (const ort of entwurf.orte) {
    notizen.push({ typ: 'location', titel: ort.name, markdown: ortText(ort, sprache) });
  }

  return notizen;
}

/**
 * Titel, die beim Export mehr als einmal vorkämen (Groß-/Kleinschreibung
 * egal). Der Story Creator legt jeden Titel nur einmal an und überspringt
 * den zweiten; das passiert, wenn man zwei Bausteinen von Hand denselben
 * Namen gibt. Die Oberfläche warnt davor (Rückmeldung).
 */
export function doppelteTitel(notizen: readonly Pick<Notiz, 'titel'>[]): string[] {
  const gesehen = new Map<string, { titel: string; anzahl: number }>();
  for (const n of notizen) {
    const schluessel = n.titel.trim().toLowerCase();
    if (!schluessel) continue;
    const alt = gesehen.get(schluessel);
    gesehen.set(schluessel, { titel: alt?.titel ?? n.titel.trim(), anzahl: (alt?.anzahl ?? 0) + 1 });
  }
  return [...gesehen.values()].filter((x) => x.anzahl > 1).map((x) => x.titel);
}
