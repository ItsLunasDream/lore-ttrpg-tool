/**
 * Die Leitung fuer Boegen im Raum (docs/charakterbogen.md, „Live im Raum").
 *
 * Beim Gastgeber lebt hier der `LiveTisch`: Anfragen der Gaeste kommen als
 * Werkzeugnachricht an, die Antworten gehen an die jeweilige Person. Eigene
 * Anfragen des Gastgebers laufen ohne Umweg in denselben Tisch.
 *
 * Bei Gaesten haelt die Leitung nur, was der Gastgeber zuletzt geschickt hat,
 * und reicht Anfragen weiter. Meldungen nimmt sie nur vom Gastgeber an.
 *
 * Eigene Boegen werden bei jeder Meldung auf die Platte geschrieben (kurz
 * gesammelt): wer den Raum verlaesst, behaelt den letzten Stand.
 */
import { LiveTisch, leseMeldung, type Anfrage, type Ausgang, type LiveEintrag, type Meldung, type TischEinstellungen } from '../shared/live';
import type { Bogen } from '../shared/bogen';

/** Die Kennung des Gastgebers im Raum (wie in der Huelle). */
export const GASTGEBER = 'gastgeber';
/** Groesser als das wird ein ganzer Stand in einzelne Boegen zerlegt (Grenze im Raum: 2 MB). */
const STAND_GRENZE = 1_500_000;
const SPEICHER_PAUSE_MS = 800;

export interface RaumLage {
  readonly rolle: 'aus' | 'gastgeber' | 'gast';
  readonly ich: { readonly id: string; readonly name: string } | null;
  readonly personen: readonly { readonly id: string; readonly name: string; readonly sl?: boolean }[];
  /** Nur beim Gastgeber: die Einstellungen des gespeicherten Raums. */
  readonly einstellungen?: Partial<TischEinstellungen>;
  /** Nur beim Gastgeber: das Gruppeninventar des gespeicherten Raums (Kennung des Bogens). */
  readonly gruppeninventar?: string | null;
}

export interface LiveZustand {
  readonly rolle: RaumLage['rolle'];
  readonly ich: string | null;
  readonly ichSl: boolean;
  readonly eintraege: readonly LiveEintrag[];
  /** Die letzte Ablehnung, zum Anzeigen. */
  readonly abgelehnt: string | null;
}

export interface LiveWege {
  sende(inhalt: string, an: string | null): boolean;
  /** Der Stand hat sich geaendert (an die Oberflaeche). */
  melde(zustand: LiveZustand): void;
  /** Einen eigenen Bogen auf die Platte schreiben. */
  speichereEigenen(bogen: Bogen): Promise<void>;
  /** Einen eigenen Bogen lesen (das Gruppeninventar des Raums). */
  lies(id: string): Promise<Bogen | null>;
  /** Der Gastgeber hat ein Gruppeninventar hereingebracht: mit dem Raum merken. */
  merkeGruppe(id: string): void;
  sprache(): 'de' | 'en';
  /** Ein voller Bogen kam an (fuer den Initiative Tracker). */
  bogenGesehen?(e: LiveEintrag): void;
}

export class Liveleitung {
  private lage: RaumLage = { rolle: 'aus', ich: null, personen: [] };
  private tisch: LiveTisch | null = null;
  private eintraege = new Map<string, LiveEintrag>();
  private abgelehnt: string | null = null;
  private gruppeVersucht = false;
  private zuSpeichern = new Map<string, Bogen>();
  private speicherTakt: ReturnType<typeof setTimeout> | null = null;

  constructor(private readonly wege: LiveWege) {}

  zustand(): LiveZustand {
    const ich = this.lage.ich?.id ?? null;
    return {
      rolle: this.lage.rolle,
      ich,
      ichSl: this.lage.personen.some((p) => p.id === ich && p.sl === true),
      eintraege: [...this.eintraege.values()],
      abgelehnt: this.abgelehnt
    };
  }

  /** Die Lage im Raum hat sich geaendert (Personen, Rollen, Rolle). */
  setzeLage(lage: RaumLage): void {
    const vorher = this.lage;
    this.lage = lage;
    const neuerRaum = lage.rolle !== vorher.rolle || lage.ich?.id !== vorher.ich?.id;
    if (neuerRaum) {
      this.eintraege.clear();
      this.abgelehnt = null;
      this.tisch = lage.rolle === 'gastgeber' ? new LiveTisch(undefined, () => this.wege.sprache()) : null;
    }
    if (this.tisch) {
      this.leite(this.tisch.setzeEinstellungen(lage.einstellungen ?? {}));
      this.leite(this.tisch.setzePersonen(lage.personen));
    }
    // Ein fortgesetzter Raum bringt sein Gruppeninventar gleich wieder mit,
    // einmal je Raum (die Kennung kommt erst kurz nach dem Eroeffnen an).
    if (neuerRaum) this.gruppeVersucht = false;
    const gruppe = lage.gruppeninventar;
    if (!this.gruppeVersucht && this.tisch && gruppe) {
      this.gruppeVersucht = true;
      void this.wege.lies(gruppe).then((b) => {
        if (b && this.tisch && b.art === 'gruppe') this.anfrage({ art: 'bringe', bogen: b });
      });
    }
    // Ein Gast fragt beim Eintreten nach dem Stand.
    if (neuerRaum && lage.rolle === 'gast') this.wege.sende(JSON.stringify({ art: 'hallo' } satisfies Anfrage), GASTGEBER);
    this.wege.melde(this.zustand());
  }

  /** Eine Werkzeugnachricht aus dem Raum. */
  nachricht(von: { id: string }, inhalt: string): void {
    const ich = this.lage.ich?.id;
    if (!ich || von.id === ich) return;
    if (this.tisch) {
      let anfrage: Anfrage;
      try {
        anfrage = JSON.parse(inhalt) as Anfrage;
      } catch {
        return;
      }
      this.leite(this.tisch.anfrage(von.id, anfrage));
      return;
    }
    // Als Gast: nur, was vom Gastgeber kommt.
    if (this.lage.rolle !== 'gast' || von.id !== GASTGEBER) return;
    const meldung = leseMeldung(inhalt);
    if (meldung) this.nimm(meldung);
  }

  /** Eine Anfrage aus der eigenen Oberflaeche. */
  anfrage(a: Anfrage): boolean {
    const ich = this.lage.ich?.id;
    if (!ich || this.lage.rolle === 'aus') return false;
    this.abgelehnt = null;
    if (this.tisch) {
      if (a.art === 'bringe' && (a.bogen as Partial<Bogen> | null)?.art === 'gruppe' && typeof (a.bogen as Bogen).id === 'string') {
        this.wege.merkeGruppe((a.bogen as Bogen).id);
      }
      this.leite(this.tisch.anfrage(ich, a));
      return true;
    }
    return this.wege.sende(JSON.stringify(a), GASTGEBER);
  }

  /** Was noch nicht geschrieben ist, jetzt schreiben (beim Schliessen). */
  async flush(): Promise<void> {
    if (this.speicherTakt) clearTimeout(this.speicherTakt);
    this.speicherTakt = null;
    const liste = [...this.zuSpeichern.values()];
    this.zuSpeichern.clear();
    for (const b of liste) await this.wege.speichereEigenen(b).catch(() => undefined);
  }

  private leite(ausgaenge: readonly Ausgang[]): void {
    const ich = this.lage.ich?.id;
    for (const { an, meldung } of ausgaenge) {
      if (an === ich) {
        this.nimm(meldung);
        continue;
      }
      const text = JSON.stringify(meldung);
      if (meldung.art === 'stand' && text.length > STAND_GRENZE) {
        // Zu gross fuer eine Nachricht: erst leeren, dann Bogen fuer Bogen.
        this.wege.sende(JSON.stringify({ art: 'stand', eintraege: [] } satisfies Meldung), an);
        for (const eintrag of meldung.eintraege) this.wege.sende(JSON.stringify({ art: 'bogen', eintrag } satisfies Meldung), an);
      } else {
        this.wege.sende(text, an);
      }
    }
  }

  private nimm(m: Meldung): void {
    if (m.art === 'stand') {
      this.eintraege = new Map(m.eintraege.map((e) => [e.id, e]));
      for (const e of m.eintraege) this.merkeEigenen(e);
    } else if (m.art === 'bogen') {
      this.eintraege.set(m.eintrag.id, m.eintrag);
      this.merkeEigenen(m.eintrag);
    } else if (m.art === 'weg') {
      this.eintraege.delete(m.id);
    } else if (m.art === 'abgelehnt') {
      this.abgelehnt = m.grund;
    }
    this.wege.melde(this.zustand());
  }

  private merkeEigenen(e: LiveEintrag): void {
    if (e.bogen) this.wege.bogenGesehen?.(e);
    if (!e.bogen || e.besitzer.id !== this.lage.ich?.id) return;
    this.zuSpeichern.set(e.bogen.id, e.bogen);
    if (this.speicherTakt) return;
    this.speicherTakt = setTimeout(() => {
      this.speicherTakt = null;
      void this.flush();
    }, SPEICHER_PAUSE_MS);
  }
}
