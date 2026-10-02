/**
 * Der Bogen einer Figur, aufgebaut wie ein klassischer Spielerbogen:
 * Kopf, eine Leiste mit Attributen und Kennzahlen, darunter drei Spalten
 * (Rettungswuerfe und Uebungen, Fertigkeiten, Kampf), dann Angriffe,
 * Zauber, Merkmale und die Figur selbst.
 *
 * Wenige Werte waehlt man mit Segmenten, Stufen mit Punkten, lange Listen
 * mit einer Suchwahl. Auswahllisten gibt es hier keine mehr.
 */
import { useEffect, useRef, useState } from 'react';
import { ausblendenUnd, vorDemAuffuellen } from '@suite/motion/dom';
import { useWertBlitz } from '@suite/motion/react';
import { ZUSTAENDE } from '@suite/srd';
import { api } from './api';
import { getLanguage, t } from './i18n';
import { ZauberBlock } from './ZauberBlock';
import { Klassenhinweise } from './Klassenhinweise';
import { AngriffeBlock } from './AngriffeBlock';
import { GestaltKasten, TiergestaltBlock } from './TiergestaltBlock';
import { druidenstufe } from '../shared/tiergestalt';
import { SlMarke } from './LiveTeile';
import { Portraet } from './Portraet';
import { WurfBuehne, Wuerfelbar, useWurf } from './Wurf';
import { istTot, todesrettungWurf } from '../shared/proben';
import { Pips, Segment, Suchwahl, Uebungspunkt, VorschlagFeld, type Wahlpunkt } from './Bedienung';
import { vorschlagsliste, type Vorschlagsart } from '../shared/vorschlaege';
import type { Schritt } from '../shared/live';
import {
  gesamtstufe,
  initiativeBonus,
  kurzeRast,
  langeRast,
  leseBetragMitWurf,
  passiverWert,
  uebungIn,
  wendeBetragAn,
  werdeStabil,
  STABIL_ZEIGEN_MS,
  type Angriff,
  type Bogen,
  type Ressource,
  type Werte
} from '../shared/bogen';
import {
  ATTRIBUTE,
  ATTRIBUT_NAMEN,
  UEBUNGEN,
  fertigkeitenSortiert,
  fertigkeitsBonus,
  mitVorzeichen,
  modifikator,
  uebungsbonus,
  type Attribut,
  type Uebung
} from '../shared/regeln';

export interface FigurProps {
  readonly werte: Werte;
  /** Angriffe aus ausgeruesteten Waffen im Inventar. */
  readonly ausInventar: readonly Angriff[];
  readonly imRaum: boolean;
  readonly aendere: (wie: (w: Werte) => Werte, schritt?: Schritt) => void;
  readonly setMeldung: (text: string) => void;
  /** Das Bild haengt am Bogen, nicht an den Werten. */
  readonly bild?: Bogen['bild'];
  readonly setzeBild?: (b: Bogen['bild'] | undefined) => void;
  /** Name der Figur (fuer den Aufruf des Nachschlagewerks). */
  readonly name?: string;
}

function zahlAus(text: string, ersatz: number): number {
  const n = Number(text.replace(',', '.'));
  return Number.isFinite(n) ? Math.round(n) : ersatz;
}

export function Figurenbogen({ werte: w, aendere, setMeldung, ausInventar, imRaum, bild, setzeBild, name }: FigurProps) {
  const stufe = gesamtstufe(w);
  const pb = uebungsbonus(stufe);

  return (
    <WurfBuehne imRaum={Boolean(imRaum)}>
      {istTot(w) ? <TotMarke /> : null}
      <Kopf w={w} aendere={aendere} bild={bild} setzeBild={setzeBild} />
      <Klassenhinweise w={w} aendere={aendere} />

      <section className="blatt__leiste">
        <div className="attribute">
          {ATTRIBUTE.map((a) => (
            <AttributKarte key={a} a={a} w={w} aendere={aendere} />
          ))}
        </div>
        <div className="kennzahlen">
          <div className="kennbox" data-pb={pb} title={t('gesamtstufe', { stufe, pb: mitVorzeichen(pb) })}>
            <span className="kennbox__titel">{t('uebungsbonus')}</span>
            <strong className="kennbox__wert">{mitVorzeichen(pb)}</strong>
            <span className="kennbox__fuss">{t('stufe')} {stufe}</span>
          </div>
          <label className="kennbox">
            <span className="kennbox__titel">{t('bewegung')}</span>
            <input
              className="kennbox__eingabe"
              data-feld="bewegung"
              value={w.bewegung}
              maxLength={40}
              placeholder={t('bewegung.platzhalter')}
              onChange={(e) => aendere((x) => ({ ...x, bewegung: e.target.value }))}
            />
          </label>
          <button
            type="button"
            className={`kennbox kennbox--knopf inspiration${w.inspiration ? ' ist-an' : ''}`}
            data-feld="inspiration"
            aria-pressed={w.inspiration}
            title={t('inspiration')}
            onClick={() => aendere((x) => ({ ...x, inspiration: !x.inspiration }))}
          >
            <span className="inspiration__stern" aria-hidden="true">
              ✦
            </span>
            <span className="kennbox__titel">{t('inspiration.kurz')}</span>
          </button>
        </div>
      </section>

      <div className="spalten">
        <div className="spalte">
          <Rettungswuerfe w={w} pb={pb} aendere={aendere} />
          <section className="kasten">
            <h2>{t('passiv.titel')}</h2>
            <ul className="passiv">
              {(
                [
                  ['wahrnehmung', 'passiv.wahrnehmung'],
                  ['nachforschungen', 'passiv.nachforschungen'],
                  ['motiv-erkennen', 'passiv.motiv']
                ] as const
              ).map(([f, k]) => (
                <li key={f} data-passiv={f}>
                  <strong>{passiverWert(w, f)}</strong>
                  <span>{t(k)}</span>
                </li>
              ))}
            </ul>
            <Textfeld label={t('sinne')} wert={w.sinne} feld="sinne" platzhalter={t('sinne.platzhalter')} laenge={500} aendern={(v) => aendere((x) => ({ ...x, sinne: v }))} />
          </section>
          <Uebungen w={w} aendere={aendere} />
        </div>

        <div className="spalte">
          <Fertigkeiten w={w} pb={pb} aendere={aendere} />
          <section className="kasten">
            <h2>{t('verteidigung')}</h2>
            <Textfeld label={t('resistenzen')} wert={w.resistenzen} feld="resistenzen" laenge={500} aendern={(v) => aendere((x) => ({ ...x, resistenzen: v }))} />
            <Textfeld label={t('immunitaeten')} wert={w.immunitaeten} feld="immunitaeten" laenge={500} aendern={(v) => aendere((x) => ({ ...x, immunitaeten: v }))} />
            <Textfeld
              label={t('anfaelligkeiten')}
              wert={w.anfaelligkeiten}
              feld="anfaelligkeiten"
              laenge={500}
              aendern={(v) => aendere((x) => ({ ...x, anfaelligkeiten: v }))}
            />
          </section>
        </div>

        <div className="spalte">
          <section className="kasten kampf">
            <div className="kampf__oben">
              <Initiative w={w} aendere={aendere} />
              <label className="schild" title={t('rk.lang')}>
                <span className="schild__titel">{t('rk')}</span>
                <ZahlRoh wert={w.rk} min={0} max={99} feld="rk" label={t('rk.lang')} aendern={(v) => aendere((x) => ({ ...x, rk: v }))} />
                <SlMarke feld="rk" />
              </label>
            </div>
            <Trefferpunkte w={w} aendere={aendere} setMeldung={setMeldung} kennung={name} />
            <Todesrettung w={w} aendere={aendere} name={name} />
            <Trefferwuerfel w={w} aendere={aendere} />
            <Rasten w={w} aendere={aendere} setMeldung={setMeldung} name={name} />
          </section>



          <section className="kasten">
            <h2>
              {t('zustaende')} <SlMarke feld="zustaende" /> <SlMarke feld="erschoepfung" />
            </h2>
            <Zustaende w={w} aendere={aendere} />
          </section>

          <section className="kasten">
            <h2>
              {t('ressourcen')} <SlMarke feld="ressourcen" />
            </h2>
            <Ressourcen w={w} aendere={aendere} />
          </section>
        </div>
      </div>

      <section className="kasten">
        <h2>
          {t('angriffe')} <SlMarke feld="angriffe" />
        </h2>
        <AngriffeBlock w={w} aendere={aendere} ausInventar={ausInventar} imRaum={imRaum} />
      </section>

      <section className="kasten" data-block="zauber">
        <h2>
          {t('zauber')} <SlMarke feld="zauber" />
        </h2>
        <ZauberBlock w={w} pb={pb} aendere={aendere} />
      </section>

      {druidenstufe(w) > 0 || w.tiergestalt ? (
        <section className="kasten" data-block="tiergestalt">
          <h2>{t('tiergestalt')}</h2>
          <TiergestaltBlock w={w} aendere={aendere} name={name ?? ''} />
        </section>
      ) : null}

      <section className="kasten">
        <h2>{t('merkmale')}</h2>
        <div className="texte">
          <Langtext label={t('klassenmerkmale')} wert={w.klassenmerkmale} feld="klassenmerkmale" aendern={(v) => aendere((x) => ({ ...x, klassenmerkmale: v }))} />
          <Langtext label={t('speziesmerkmale')} wert={w.speziesmerkmale} feld="speziesmerkmale" aendern={(v) => aendere((x) => ({ ...x, speziesmerkmale: v }))} />
          <Langtext label={t('talente')} wert={w.talente} feld="talente" aendern={(v) => aendere((x) => ({ ...x, talente: v }))} />
        </div>
      </section>

      <section className="kasten">
        <h2>{t('figur')}</h2>
        <div className="texte texte--zwei">
          <Langtext label={t('aussehen')} wert={w.aussehen} feld="aussehen" aendern={(v) => aendere((x) => ({ ...x, aussehen: v }))} />
          <Langtext label={t('persoenlichkeit')} wert={w.persoenlichkeit} feld="persoenlichkeit" aendern={(v) => aendere((x) => ({ ...x, persoenlichkeit: v }))} />
        </div>
      </section>
    </WurfBuehne>
  );
}

// --- Kompaktansicht (docs/charakterbogen-kompakt.md) -----------------------

/**
 * Was am Tisch im Kampf gebraucht wird, in einer Spalte: RK und Initiative,
 * Trefferpunkte mit Schaden/Heilen, Todesrettung (nur bei 0 TP),
 * Trefferwürfel und Rasten, Zauberplätze, Zustände. Dieselben Bausteine wie
 * im vollen Bogen, damit beide nie auseinanderlaufen.
 */
export function Kompaktbogen({ werte: w, aendere, setMeldung, name, imRaum }: Pick<FigurProps, 'werte' | 'aendere' | 'setMeldung' | 'name' | 'imRaum'>) {
  const plaetze = w.zauber?.plaetze.filter((p) => p.max > 0) ?? [];
  return (
    <WurfBuehne imRaum={Boolean(imRaum)}>
    <div className="kompakt" data-kompakt>
      {istTot(w) ? <TotMarke /> : null}
      <section className="kasten kampf">
        <div className="kampf__oben">
          <Initiative w={w} aendere={aendere} />
          <label className="schild" title={t('rk.lang')}>
            <span className="schild__titel">{t('rk')}</span>
            <ZahlRoh wert={w.rk} min={0} max={99} feld="rk" label={t('rk.lang')} aendern={(v) => aendere((x) => ({ ...x, rk: v }))} />
            <SlMarke feld="rk" />
          </label>
        </div>
        <Trefferpunkte w={w} aendere={aendere} setMeldung={setMeldung} kennung={name} />
        {w.tp.aktuell === 0 ? <Todesrettung w={w} aendere={aendere} name={name} /> : null}
        <Trefferwuerfel w={w} aendere={aendere} />
        <Rasten w={w} aendere={aendere} setMeldung={setMeldung} name={name} />
      </section>
      <GestaltKasten w={w} aendere={aendere} />
      {plaetze.length ? (
        <section className="kasten" data-kompakt-plaetze>
          <h2>{t('zauber.plaetze')}</h2>
          <div className="plaetze">
            {plaetze.map((p) => (
              <div className="platz" key={p.grad}>
                <span className="leise">{p.grad}</span>
                <span className="punkte">
                  {Array.from({ length: p.max }, (_, n) => (
                    <button
                      key={n}
                      type="button"
                      className={n < p.verbraucht ? 'punkt punkt--weg' : 'punkt'}
                      data-platz={`${p.grad}-${n}`}
                      aria-label={t('zauber.platzUmschalten', { grad: p.grad })}
                      title={t('zauber.platzUmschalten', { grad: p.grad })}
                      onClick={() =>
                        aendere((x) =>
                          x.zauber
                            ? {
                                ...x,
                                zauber: {
                                  ...x.zauber,
                                  plaetze: x.zauber.plaetze.map((q) =>
                                    q.grad === p.grad ? { ...q, verbraucht: n < q.verbraucht ? n : n + 1 } : q
                                  )
                                }
                              }
                            : x
                        )
                      }
                    />
                  ))}
                </span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
      <section className="kasten">
        <h2>
          {t('zustaende')} <SlMarke feld="zustaende" /> <SlMarke feld="erschoepfung" />
        </h2>
        <Zustaende w={w} aendere={aendere} />
      </section>
    </div>
    </WurfBuehne>
  );
}

/** Drei fehlgeschlagene Todesrettungswürfe: deutlich sichtbar oben im Bogen (Rückmeldung). */
function TotMarke() {
  return (
    <div className="totmarke" role="status" data-tot title={t('tot.hinweis')}>
      ☠ {t('tot')} <span className="leise">· {t('tot.hinweis')}</span>
    </div>
  );
}

// --- Kopf ------------------------------------------------------------------

function Kopf({ w, aendere, bild, setzeBild }: { w: Werte; aendere: FigurProps['aendere']; bild?: Bogen['bild']; setzeBild?: FigurProps['setzeBild'] }) {
  const setzeKlasse = (n: number, teil: Partial<Werte['klassen'][number]>) =>
    aendere((x) => ({ ...x, klassen: x.klassen.map((kk, m) => (m === n ? { ...kk, ...teil } : kk)) }));
  return (
    <section className="blatt__kopf">
      {setzeBild ? <Portraet bild={bild} setze={setzeBild} /> : null}
      <div className="klassen">
        {w.klassen.map((k, n) => (
          <div className="klassen__zeile" key={n} data-ausblenden>
            <label className="linie linie--breit">
              <VorschlagFeld
                placeholder={t('klasse')}
                data-feld={`klasse-${n}`}
                wert={k.name}
                maxLength={60}
                liste={vorschlagsliste('klasse', getLanguage() === 'de' ? 'de' : 'en')}
                aendern={(v) => setzeKlasse(n, { name: v })}
              />
              <span className="linie__label">
                {t('klasse')} <SlMarke feld="klassen" />
              </span>
            </label>
            <label className="linie">
              <input placeholder={t('unterklasse')} data-feld={`unterklasse-${n}`} value={k.unterklasse ?? ''} maxLength={80} onChange={(e) => setzeKlasse(n, { unterklasse: e.target.value })} />
              <span className="linie__label">{t('unterklasse')}</span>
            </label>
            <label className="linie linie--zahl">
              <ZahlRoh wert={k.stufe} min={1} max={20} feld={`stufe-${n}`} label={t('stufe')} aendern={(v) => setzeKlasse(n, { stufe: v })} />
              <span className="linie__label">{t('stufe')}</span>
            </label>
            {w.klassen.length > 1 ? (
              <button
                type="button"
                className="knopf--klein knopf--leise"
                aria-label={t('klasse.weg')}
                title={t('klasse.weg')}
                onClick={(e) => ausblendenUnd(e.currentTarget, () => aendere((x) => ({ ...x, klassen: x.klassen.filter((_, m) => m !== n) })))}
              >
                ×
              </button>
            ) : null}
          </div>
        ))}
        {w.klassen.length < 6 ? (
          <button type="button" className="knopf--klein knopf--leise klassen__dazu" onClick={() => aendere((x) => ({ ...x, klassen: [...x.klassen, { name: '', stufe: 1 }] }))}>
            {t('klasse.dazu')}
          </button>
        ) : null}
      </div>
      <div className="kopfraster">
         <Linie art="spezies" label={t('spezies')} wert={w.spezies} feld="spezies" aendern={(v) => aendere((x) => ({ ...x, spezies: v }))} />
        <Linie art="hintergrund" label={t('hintergrund')} wert={w.hintergrund} feld="hintergrund" aendern={(v) => aendere((x) => ({ ...x, hintergrund: v }))} />
        <Linie label={t('spieler')} wert={w.spieler} feld="spieler" aendern={(v) => aendere((x) => ({ ...x, spieler: v }))} />
        <Linie art="gesinnung" label={t('gesinnung')} wert={w.gesinnung} feld="gesinnung" aendern={(v) => aendere((x) => ({ ...x, gesinnung: v }))} />
        <Linie art="groesse" label={t('groesse')} wert={w.groesse} feld="groesse" aendern={(v) => aendere((x) => ({ ...x, groesse: v }))} />
        <label className="linie linie--zahl">
          <ZahlRoh wert={w.ep} min={0} max={10_000_000} feld="ep" label={t('ep')} aendern={(v) => aendere((x) => ({ ...x, ep: v }))} />
          <span className="linie__label">{t('ep')}</span>
        </label>
      </div>
    </section>
  );
}

// --- Attribute und Rettungswuerfe -----------------------------------------------

function AttributKarte({ a, w, aendere }: { a: Attribut; w: Werte; aendere: FigurProps['aendere'] }) {
  const i = getLanguage() === 'de' ? 0 : 1;
  const wert = w.attribute[a];
  return (
    <div className="attribut" title={ATTRIBUT_NAMEN[a].lang[i]}>
      <Wuerfelbar name={ATTRIBUT_NAMEN[a].lang[i]} bonus={modifikator(wert)} klasse="attribut__name" daten={{ 'data-wurf-attribut': a }}>
        {ATTRIBUT_NAMEN[a].lang[i]}
      </Wuerfelbar>
      <Wuerfelbar name={ATTRIBUT_NAMEN[a].lang[i]} bonus={modifikator(wert)} klasse="attribut__mod" daten={{ 'data-mod': a }}>
        {mitVorzeichen(modifikator(wert))}
      </Wuerfelbar>
      <span className="attribut__oval">
        <ZahlRoh
          wert={wert}
          min={1}
          max={30}
          feld={`attribut-${a}`}
          label={ATTRIBUT_NAMEN[a].lang[i]}
          aendern={(v) => aendere((x) => ({ ...x, attribute: { ...x.attribute, [a]: v } }))}
        />
      </span>
      <SlMarke feld="attribute" />
    </div>
  );
}

function Rettungswuerfe({ w, pb, aendere }: { w: Werte; pb: number; aendere: FigurProps['aendere'] }) {
  const i = getLanguage() === 'de' ? 0 : 1;
  return (
    <section className="kasten">
      <h2>
        {t('rettung')} <SlMarke feld="rettung" />
      </h2>
      <ul className="rettungen">
        {ATTRIBUTE.map((a) => {
          const geuebt = w.rettung.includes(a);
          return (
            <li key={a}>
              <button
                type="button"
                className="uebung"
                data-rettung={a}
                aria-pressed={geuebt}
                aria-label={`${ATTRIBUT_NAMEN[a].lang[i]}: ${t(geuebt ? 'uebung.1' : 'uebung.0')}`}
                title={t('rettung.uebung')}
                onClick={() =>
                  aendere((x) => ({
                    ...x,
                    rettung: x.rettung.includes(a) ? x.rettung.filter((k) => k !== a) : ATTRIBUTE.filter((k) => k === a || x.rettung.includes(k))
                  }))
                }
              >
                <Uebungspunkt stufe={geuebt ? 1 : 0} />
              </button>
              <Wuerfelbar name={`${t('rettung')}: ${ATTRIBUT_NAMEN[a].lang[i]}`} bonus={modifikator(w.attribute[a]) + (geuebt ? pb : 0)} klasse="rettungen__name" daten={{ 'data-wurf-rettung': a }}>
                {ATTRIBUT_NAMEN[a].kurz[i]}
              </Wuerfelbar>
              <Wuerfelbar name={`${t('rettung')}: ${ATTRIBUT_NAMEN[a].lang[i]}`} bonus={modifikator(w.attribute[a]) + (geuebt ? pb : 0)} klasse="wertkasten" daten={{ 'data-rettungswert': a }}>
                {mitVorzeichen(modifikator(w.attribute[a]) + (geuebt ? pb : 0))}
              </Wuerfelbar>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// --- Uebungen ------------------------------------------------------------------

function Uebungen({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  const ru = w.ruestungsuebung;
  return (
    <section className="kasten">
      <h2>{t('uebungen')}</h2>
      <div className="feld">
        <span className="feld__label">{t('ruestung.titel')}</span>
        <div className="umschalter">
          {(['leicht', 'mittel', 'schwer', 'schilde'] as const).map((k) => (
            <button
              key={k}
              type="button"
              className={ru[k] ? 'ist-an' : ''}
              aria-pressed={ru[k]}
              data-ruestung={k}
              onClick={() => aendere((x) => ({ ...x, ruestungsuebung: { ...x.ruestungsuebung, [k]: !x.ruestungsuebung[k] } }))}
            >
              {t(`ruestung.${k}`)}
            </button>
          ))}
        </div>
      </div>
      <Textfeld art="waffen" label={t('waffenuebung')} wert={w.waffenuebung} feld="waffenuebung" laenge={500} aendern={(v) => aendere((x) => ({ ...x, waffenuebung: v }))} />
      <Textfeld art="werkzeug" label={t('werkzeuguebung')} wert={w.werkzeuguebung} feld="werkzeuguebung" laenge={500} aendern={(v) => aendere((x) => ({ ...x, werkzeuguebung: v }))} />
      <Textfeld art="sprachen" label={t('sprachen')} wert={w.sprachen} feld="sprachen" laenge={500} aendern={(v) => aendere((x) => ({ ...x, sprachen: v }))} />
    </section>
  );
}

// --- Fertigkeiten -------------------------------------------------------------

function Fertigkeiten({ w, pb, aendere }: { w: Werte; pb: number; aendere: FigurProps['aendere'] }) {
  const sprache = getLanguage() === 'de' ? 'de' : 'en';
  const i = sprache === 'de' ? 0 : 1;
  return (
    <section className="kasten">
      <h2>
        {t('fertigkeiten')} <SlMarke feld="fertigkeiten" />
      </h2>
      <div className="fertigkeiten__kopf" aria-hidden="true">
        <span>{t('spalte.uebung')}</span>
        <span>{t('spalte.attribut')}</span>
        <span>{t('spalte.fertigkeit')}</span>
        <span>{t('spalte.bonus')}</span>
      </div>
      <ul className="fertigkeiten" title={t('fertigkeit.stufe')}>
        {fertigkeitenSortiert(sprache).map((f) => {
          const u = uebungIn(w, f.id);
          const bonus = fertigkeitsBonus(w.attribute[f.attribut], u, pb);
          return (
            <li key={f.id}>
              <button
                type="button"
                className="uebung"
                data-fertigkeit={f.id}
                data-uebung={u}
                aria-label={`${f.name[i]}: ${t(`uebung.${u}` as Parameters<typeof t>[0])}`}
                title={t(`uebung.${u}` as Parameters<typeof t>[0])}
                onClick={() =>
                  aendere((x) => {
                    // Vom aktuellen Stand aus, nicht vom gezeichneten: zwei schnelle Klicks zaehlen beide.
                    // Mit Alleskoenner ist „ungeuebt" schon halb: die Stufe ½ wird uebersprungen,
                    // sonst brauchte es einen Klick, der scheinbar nichts tut (Rueckmeldung).
                    const folge: readonly Uebung[] = x.alleskoenner ? [0, 1, 2] : UEBUNGEN;
                    const jetzt = x.fertigkeiten[f.id] ?? 0;
                    const stelle = folge.indexOf(jetzt);
                    const neu = folge[(stelle < 0 ? 0 : stelle + 1) % folge.length];
                    const rest = { ...x.fertigkeiten };
                    if (neu === 0) delete rest[f.id];
                    else rest[f.id] = neu;
                    return { ...x, fertigkeiten: rest };
                  })
                }
              >
                <Uebungspunkt stufe={u} />
              </button>
              <span className="leise fertigkeiten__attr">{ATTRIBUT_NAMEN[f.attribut].kurz[i]}</span>
              <Wuerfelbar name={f.name[i]} bonus={bonus} daten={{ 'data-wurf-fertigkeit': f.id }}>
                {f.name[i]}
              </Wuerfelbar>
              <Wuerfelbar name={f.name[i]} bonus={bonus} klasse="wertkasten" daten={{ 'data-bonus': f.id }}>
                {mitVorzeichen(bonus)}
              </Wuerfelbar>
            </li>
          );
        })}
      </ul>
      <label className="schalter" title={t('alleskoenner.hinweis')}>
        <input type="checkbox" data-feld="alleskoenner" checked={w.alleskoenner} onChange={(e) => aendere((x) => ({ ...x, alleskoenner: e.target.checked }))} />
        <span>{t('alleskoenner')}</span>
      </label>
    </section>
  );
}

// --- Kampf --------------------------------------------------------------------

function Initiative({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  return (
    <label className="raute" title={t('initiative.auto')}>
      <Wuerfelbar name={t('initiative')} bonus={w.initiative ?? initiativeBonus({ ...w, initiative: null })} klasse="raute__titel" daten={{ 'data-wurf-initiative': '' }}>
        {t('initiative')}
      </Wuerfelbar>
      <input
        data-feld="initiative"
        inputMode="numeric"
        placeholder={mitVorzeichen(initiativeBonus({ ...w, initiative: null }))}
        value={w.initiative === null ? '' : String(w.initiative)}
        onChange={(e) => {
          const roh = e.target.value.trim();
          aendere((x) => ({ ...x, initiative: roh === '' || roh === '-' ? null : zahlAus(roh, 0) }));
        }}
      />
    </label>
  );
}

interface TeilProps {
  readonly w: Werte;
  readonly aendere: FigurProps['aendere'];
  readonly setMeldung: (text: string) => void;
}

function Trefferpunkte({ w, aendere, setMeldung, kennung }: TeilProps & { readonly kennung?: string }) {
  const [eingabe, setEingabe] = useState('');
  // Schaden blitzt rot, Heilung grün (Rückmeldung); temporäre TP zählen mit.
  const kasten = useRef<HTMLDivElement>(null);
  useWertBlitz(kasten, w.tp.aktuell + w.tp.temp, kennung);
  const [hinweis, setHinweis] = useState('');
  const anteil = w.tp.max > 0 ? w.tp.aktuell / w.tp.max : 0;
  const { zeige } = useWurf();
  const uebernimm = () => {
    const gelesen = leseBetragMitWurf(eingabe);
    if (gelesen === null) {
      setHinweis(t('tp.unlesbar'));
      return;
    }
    const betrag = gelesen.betrag;
    // Mit Würfeln im Ausdruck steht der Wurf unten rechts (Rückmeldung).
    if (gelesen.wurf) zeige(`🎲 ${t(betrag < 0 ? 'tp.wurfSchaden' : 'tp.wurfHeilung')}: ${Math.abs(betrag)} (${gelesen.wurf})`);
    // Im Raum reist der Betrag, nicht der neue Stand: zwei Treffer zugleich zaehlen beide.
    aendere((x) => wendeBetragAn(x, betrag), { typ: 'betrag', text: betrag > 0 ? `+${betrag}` : String(betrag) });
    setEingabe('');
    setHinweis('');
    setMeldung(betrag < 0 ? t('tp.schaden', { n: -betrag }) : t('tp.heilung', { n: betrag }));
  };
  return (
    <div className="tp" ref={kasten} data-tp-kasten>
      <div className="tp__kopf">
        <span className="kennbox__titel">
          {t('tp.lang')} <SlMarke feld="tp" />
        </span>
      </div>
      <div className="tp__zahlen">
        <label className="tp__zahl tp__zahl--gross">
          <ZahlRoh wert={w.tp.aktuell} min={0} max={w.tp.max} feld="tp-aktuell" label={t('tp.aktuell')} aendern={(v) => aendere((x) => ({ ...x, tp: { ...x.tp, aktuell: v } }))} />
          <span className="linie__label">{t('tp.aktuell')}</span>
        </label>
        <span className="tp__strich">/</span>
        <label className="tp__zahl">
          <ZahlRoh
            wert={w.tp.max}
            min={1}
            max={9999}
            feld="tp-max"
            label={t('tp.max')}
            aendern={(v) => aendere((x) => ({ ...x, tp: { ...x.tp, max: v, aktuell: Math.min(x.tp.aktuell, v) } }))}
          />
          <span className="linie__label">{t('tp.max')}</span>
        </label>
        <label className="tp__zahl">
          <ZahlRoh wert={w.tp.temp} min={0} max={9999} feld="tp-temp" label={t('tp.temp')} aendern={(v) => aendere((x) => ({ ...x, tp: { ...x.tp, temp: v } }))} />
          <span className="linie__label">{t('tp.temp')}</span>
        </label>
      </div>
      {/* Temporaere TP als eigenes Stueck hinter den echten (Rueckmeldung); der Balken reicht dann ueber das Maximum. */}
      <div className="tp__balken" aria-hidden="true" data-tp-balken>
        <span
          style={{ width: `${Math.round((w.tp.aktuell / Math.max(1, w.tp.max + w.tp.temp)) * 100)}%` }}
          className={anteil <= 0.25 ? 'kritisch' : anteil <= 0.5 ? 'angeschlagen' : ''}
        />
        {w.tp.temp > 0 ? (
          <span className="tp__temp" data-tp-temp-balken style={{ width: `${Math.round((w.tp.temp / Math.max(1, w.tp.max + w.tp.temp)) * 100)}%` }} />
        ) : null}
      </div>
      <input
        className="tp__betrag"
        data-feld="tp-betrag"
        aria-label={t('tp.feld')}
        value={eingabe}
        placeholder={`${t('tp.feld')}: ${t('tp.feldBeispiel')}`}
        title={t('tp.feldHinweis')}
        onChange={(e) => {
          setEingabe(e.target.value);
          setHinweis('');
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') uebernimm();
          if (e.key === 'Escape') setEingabe('');
        }}
      />
      {hinweis ? <p className="leise">{hinweis}</p> : null}
    </div>
  );
}

function Todesrettung({ w, aendere, name }: { w: Werte; aendere: FigurProps['aendere']; name?: string }) {
  const { zeige } = useWurf();
  const sprache = getLanguage() === 'de' ? 'de' : 'en';
  const stabil = Boolean(w.todesrettung.stabil) && w.tp.aktuell === 0;
  // Rückmeldung: die drei Erfolge kurz zeigen, dann verschwinden sie und die Figur ist stabil.
  const wirdStabil = werdeStabil(w) !== w;
  // Über einen Ref, damit ein neu gebautes `aendere` die Uhr nicht neu startet.
  const aendereRef = useRef(aendere);
  aendereRef.current = aendere;
  useEffect(() => {
    if (!wirdStabil) return;
    const uhr = window.setTimeout(() => aendereRef.current(werdeStabil), STABIL_ZEIGEN_MS);
    return () => window.clearTimeout(uhr);
  }, [wirdStabil]);
  return (
    <div
      className={`todesrettung${w.tp.aktuell === 0 ? ' ist-akut' : ''}${istTot(w) ? ' ist-tot' : ''}${wirdStabil ? ' ist-wird-stabil' : ''}${stabil ? ' ist-stabil' : ''}`}
      data-todesrettung
    >
      <span className="kennbox__titel">
        {t('todesrettung')} <SlMarke feld="todesrettung" />
        <button
          type="button"
          className="knopf--klein todesrettung__wurf"
          data-todesrettung-wuerfeln
          // Nur bei 0 TP (SRD); mit TP gehen die Würfe ohnehin auf null.
          title={w.tp.aktuell > 0 ? t('todesrettung.erstBei0') : t('todesrettung.titel')}
          disabled={istTot(w) || w.tp.aktuell > 0 || stabil || wirdStabil}
          onClick={() => {
            // Gewürfelt wird gegen den aktuellen Stand; die Zeile entsteht mit.
            let zeile = '';
            let d20 = 0;
            aendere((x) => {
              const r = todesrettungWurf(x, name?.trim() || t('figur'), sprache);
              zeile = r.text;
              d20 = r.d20;
              return r.werte;
            });
            if (zeile) zeige(zeile, { d20 });
          }}
        >
          🎲 {t('todesrettung.wuerfeln')}
        </button>
      </span>
      {(['erfolge', 'fehlschlaege'] as const).map((art) => (
        <div key={art} className={`todesrettung__zeile todesrettung__zeile--${art}`}>
          <span>{t(`todesrettung.${art}`)}</span>
          <Pips
            wert={w.todesrettung[art]}
            max={3}
            label={t(`todesrettung.${art}`)}
            daten={{ [`data-todesrettung-${art}`]: '' }}
            aendern={(n) => aendere((x) => ({ ...x, todesrettung: { ...x.todesrettung, [art]: n } }))}
          />
        </div>
      ))}
      {stabil ? (
        <p className="todesrettung__stabil" data-stabil>
          {t('todesrettung.stabil')}
          <button
            type="button"
            className="knopf--klein"
            data-stabil-1tp
            title={t('todesrettung.einsTpTitel')}
            onClick={() => aendere((x) => ({ ...x, tp: { ...x.tp, aktuell: Math.max(1, x.tp.aktuell) } }))}
          >
            {t('todesrettung.einsTp')}
          </button>
        </p>
      ) : null}
    </div>
  );
}

function Trefferwuerfel({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  const w_ = getLanguage() === 'de' ? 'W' : 'd';
  return (
    <div className="tw">
      <span className="kennbox__titel">
        {t('trefferwuerfel')} <SlMarke feld="trefferwuerfel" />
      </span>
      {w.trefferwuerfel.map((tw, n) => (
        <div className="tw__zeile" key={n} data-ausblenden>
          <Segment
            klein
            label={t('trefferwuerfel')}
            wert={tw.seiten}
            optionen={[6, 8, 10, 12].map((s) => ({ wert: s, text: `${w_}${s}` }))}
            daten={{ 'data-tw-seiten': String(n) }}
            aendern={(s) => aendere((x) => ({ ...x, trefferwuerfel: x.trefferwuerfel.map((y, m) => (m === n ? { ...y, seiten: s } : y)) }))}
          />
          <ZahlRoh
            wert={tw.uebrig}
            min={0}
            max={tw.gesamt}
            feld={`tw-uebrig-${n}`}
            label={t('tw.uebrig')}
            aendern={(v) => aendere((x) => ({ ...x, trefferwuerfel: x.trefferwuerfel.map((y, m) => (m === n ? { ...y, uebrig: v } : y)) }))}
          />
          <span>/</span>
          <ZahlRoh
            wert={tw.gesamt}
            min={0}
            max={20}
            feld={`tw-gesamt-${n}`}
            label={t('trefferwuerfel')}
            aendern={(v) =>
              aendere((x) => ({
                ...x,
                trefferwuerfel: x.trefferwuerfel.map((y, m) => (m === n ? { ...y, gesamt: v, uebrig: Math.min(y.uebrig, v) } : y))
              }))
            }
          />
          {w.trefferwuerfel.length > 1 ? (
            <button
              type="button"
              className="knopf--klein knopf--leise"
              aria-label="×"
              onClick={(e) => ausblendenUnd(e.currentTarget, () => aendere((x) => ({ ...x, trefferwuerfel: x.trefferwuerfel.filter((_, m) => m !== n) })))}
            >
              ×
            </button>
          ) : null}
        </div>
      ))}
      {w.trefferwuerfel.length < 4 ? (
        <button
          type="button"
          className="knopf--klein knopf--leise"
          onClick={() => aendere((x) => ({ ...x, trefferwuerfel: [...x.trefferwuerfel, { seiten: 8, gesamt: 1, uebrig: 1 }] }))}
        >
          {t('tw.dazu')}
        </button>
      ) : null}
    </div>
  );
}

/** Was eine Rast auffüllt und dabei kurz aufploppt (Rückmeldung): Zauberplätze und Punkte (Trefferwürfel, Ressourcen). */
const AUFFUELLBAR = '.punkt:not(.punkt--weg), .pip.ist-an';

function Rasten({ w, aendere, setMeldung, name }: TeilProps & { readonly name?: string }) {
  const de = getLanguage() === 'de';
  const wer = name?.trim() || (de ? 'Figur' : 'Character');
  const [kurz, setKurz] = useState<Record<number, number> | null>(null);
  const w_ = getLanguage() === 'de' ? 'W' : 'd';
  return (
    <div className="rasten">
      <div className="leiste">
        <button type="button" data-rast="kurz" disabled={w.tp.aktuell === 0} onClick={() => setKurz({})} title={w.tp.aktuell === 0 ? t('rast.langOhneTp') : t('rast.kurzHinweis')}>
          ☾ {t('rast.kurz')}
        </button>
        <button
          type="button"
          data-rast="lang"
          disabled={w.tp.aktuell === 0}
          title={w.tp.aktuell === 0 ? t('rast.langOhneTp') : t('rast.langHinweis')}
          onClick={() => {
            if (!window.confirm(t('rast.langSicher'))) return;
            const aufgefuellt = vorDemAuffuellen(AUFFUELLBAR);
            aendere(langeRast);
            aufgefuellt();
            setMeldung(t('rast.langFertig', { tp: w.tp.max }));
            api.protokoll({ art: 'rast', text: de ? `${wer}: lange Rast` : `${wer}: long rest` });
          }}
        >
          ☀ {t('rast.lang')}
        </button>
      </div>
      {kurz ? (
        <div className="kurzrast" data-kurzrast>
          <p className="leise">{t('rast.kurzHinweis')}</p>
          {w.trefferwuerfel.map((tw) => (
            <label key={tw.seiten} className="kurzrast__zeile">
              <span>
                {w_}
                {tw.seiten} ({tw.uebrig} {t('tw.uebrig')})
              </span>
              <Pips
                wert={kurz[tw.seiten] ?? 0}
                max={tw.uebrig}
                label={`${w_}${tw.seiten}`}
                daten={{ [`data-kurz-${tw.seiten}`]: '' }}
                aendern={(v) => setKurz((k) => ({ ...(k ?? {}), [tw.seiten]: v }))}
              />
            </label>
          ))}
          <div className="leiste">
            <button
              type="button"
              className="knopf--haupt"
              data-kurz-wuerfeln
              onClick={() => {
                let ergebnis: ReturnType<typeof kurzeRast> | null = null;
                const aufgefuellt = vorDemAuffuellen(AUFFUELLBAR);
                aendere((x) => {
                  ergebnis = kurzeRast(x, kurz);
                  return ergebnis.werte;
                });
                aufgefuellt();
                const e = ergebnis as ReturnType<typeof kurzeRast> | null;
                if (e) {
                  const summe = e.wuerfe.reduce((s, x) => s + x.geheilt, 0);
                  setMeldung(t('rast.kurzFertig', { wuerfe: e.wuerfe.map((x) => x.wurf).join(', ') || '—', summe }));
                  api.protokoll({ art: 'rast', text: de ? `${wer}: kurze Rast, +${summe} TP` : `${wer}: short rest, +${summe} HP` });
                }
                setKurz(null);
              }}
            >
              {t('rast.wuerfeln')}
            </button>
            <button type="button" onClick={() => setKurz(null)}>
              {t('abbrechen')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

// --- Zustaende -------------------------------------------------------------------

/** Eigene Zustaende stehen als `eigen:<Name>` im Bogen. */
const EIGEN = 'eigen:';

function Zustaende({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  const sprache = getLanguage() === 'de' ? 'de' : 'en';
  const [eigene, setEigene] = useState<{ name: string; text: string }[]>([]);
  useEffect(() => {
    let aktiv = true;
    void api.eigeneZustaende().then((liste) => aktiv && setEigene(liste));
    return () => {
      aktiv = false;
    };
  }, []);

  const punkte: Wahlpunkt[] = [
    ...ZUSTAENDE.filter((z) => z.id !== 'exhaustion' && !w.zustaende.includes(z.id)).map((z) => ({
      id: z.id,
      name: z.name[sprache],
      gruppe: t('zustand.srd'),
      titel: z.text[sprache]
    })),
    ...eigene
      .filter((z) => !w.zustaende.includes(EIGEN + z.name))
      .map((z) => ({ id: EIGEN + z.name, name: z.name, gruppe: t('zustand.eigene'), titel: z.text }))
  ];

  const e = w.erschoepfung;
  const stufentext = (n: number) =>
    n >= 6 ? t('erschoepfung.tot') : t('erschoepfung.stufe', { n, w: 2 * n, b: sprache === 'de' ? String(1.5 * n).replace('.', ',') : 5 * n });

  return (
    <div className="zustaende">
      <ul className="chips">
        {w.zustaende.map((id) => {
          const z = ZUSTAENDE.find((x) => x.id === id);
          const eigen = id.startsWith(EIGEN) ? eigene.find((x) => EIGEN + x.name === id) : undefined;
          const name = z ? z.name[sprache] : id.startsWith(EIGEN) ? id.slice(EIGEN.length) : id;
          return (
            <li key={id}>
              <span className={`chip${id.startsWith(EIGEN) ? ' chip--eigen' : ''}`} title={z ? z.text[sprache] : eigen?.text ?? ''} data-zustand={id} data-ausblenden>
                {name}
                <button type="button" aria-label={t('zustand.weg', { name })} onClick={(e) => ausblendenUnd(e.currentTarget, () => aendere((x) => ({ ...x, zustaende: x.zustaende.filter((y) => y !== id) })))}>
                  ×
                </button>
              </span>
            </li>
          );
        })}
        <li>
          <Suchwahl
            punkte={punkte}
            knopf={t('zustand.dazu')}
            suche={t('zustand.suche')}
            daten={{ 'data-zustand-dazu': '' }}
            klasse="suchwahl--klein"
            aendern={(id) => id && aendere((x) => ({ ...x, zustaende: x.zustaende.includes(id) ? x.zustaende : [...x.zustaende, id] }))}
          />
        </li>
      </ul>
      <div className="erschoepfung" title={t('erschoepfung.hinweis')}>
        <span className="feld__label">{t('erschoepfung')}</span>
        <Pips wert={e} max={6} gefahr={6} label={t('erschoepfung')} titel={stufentext} daten={{ 'data-feld': 'erschoepfung' }} aendern={(n) => aendere((x) => ({ ...x, erschoepfung: n }))} />
        <span className="leise">{e > 0 ? stufentext(e) : ''}</span>
      </div>
    </div>
  );
}

// --- Ressourcen -------------------------------------------------------------------

function Ressourcen({ w, aendere }: { w: Werte; aendere: FigurProps['aendere'] }) {
  const setze = (n: number, teil: Partial<Ressource>) =>
    aendere((x) => ({ ...x, ressourcen: x.ressourcen.map((r, m) => (m === n ? { ...r, ...teil } : r)) }));
  return (
    <div className="ressourcen">
      {w.ressourcen.map((r, n) => (
        <div className="ressource" key={n} data-ressource={n} data-ausblenden>
          <input aria-label={t('ressource.name')} placeholder={t('ressource.name')} value={r.name} maxLength={80} onChange={(e) => setze(n, { name: e.target.value })} />
          <Pips wert={r.uebrig} max={Math.min(r.max, 20)} label={r.name || t('ressource.name')} aendern={(v) => setze(n, { uebrig: v })} />
          <ZahlRoh wert={r.max} min={1} max={20} feld={`ressource-max-${n}`} label={t('ressource.max')} aendern={(v) =>
              aendere((x) => ({
                ...x,
                // War sie voll, bleibt sie voll.
                ressourcen: x.ressourcen.map((y, m) => (m === n ? { ...y, max: v, uebrig: y.uebrig >= y.max ? v : Math.min(y.uebrig, v) } : y))
              }))
            } />
          <Segment
            klein
            label={t('rasten')}
            wert={r.rast}
            optionen={[
              { wert: 'kurz', text: '☾', titel: t('ressource.kurz') },
              { wert: 'lang', text: '☀', titel: t('ressource.lang') }
            ]}
            aendern={(v) => setze(n, { rast: v })}
          />
          <button
            type="button"
            className="knopf--klein knopf--leise"
            aria-label={t('ressource.weg')}
            title={t('ressource.weg')}
            onClick={(e) => ausblendenUnd(e.currentTarget, () => aendere((x) => ({ ...x, ressourcen: x.ressourcen.filter((_, m) => m !== n) })))}
          >
            ×
          </button>
        </div>
      ))}
      {w.ressourcen.length < 30 ? (
        <button
          type="button"
          className="knopf--klein knopf--leise"
          data-ressource-dazu
          onClick={() => aendere((x) => ({ ...x, ressourcen: [...x.ressourcen, { name: '', max: 1, uebrig: 1, rast: 'lang' }] }))}
        >
          {t('ressource.dazu')}
        </button>
      ) : null}
    </div>
  );
}

// --- Kleine Felder ---------------------------------------------------------

function Linie({ label, wert, feld, aendern, art }: { label: string; wert: string; feld: string; aendern: (v: string) => void; art?: Vorschlagsart }) {
  return (
    <label className="linie">
      {art ? (
        <VorschlagFeld data-feld={feld} wert={wert} maxLength={80} placeholder={label} liste={vorschlagsliste(art, getLanguage() === 'de' ? 'de' : 'en')} aendern={aendern} />
      ) : (
        <input data-feld={feld} value={wert} maxLength={80} placeholder={label} onChange={(e) => aendern(e.target.value)} />
      )}
      <span className="linie__label">
        {label} <SlMarke feld={feld} />
      </span>
    </label>
  );
}

function Textfeld({
  label,
  wert,
  feld,
  platzhalter,
  laenge = 80,
  aendern,
  art
}: {
  label: string;
  wert: string;
  feld: string;
  platzhalter?: string;
  laenge?: number;
  aendern: (v: string) => void;
  /** Vorschläge beim Tippen; Waffen, Werkzeuge und Sprachen sind Listen mit Komma. */
  art?: Vorschlagsart;
}) {
  return (
    <label className="feld">
      <span className="feld__label">
        {label} <SlMarke feld={feld} />
      </span>
      {art ? (
        <VorschlagFeld
          data-feld={feld}
          wert={wert}
          maxLength={laenge}
          placeholder={platzhalter}
          liste={vorschlagsliste(art, getLanguage() === 'de' ? 'de' : 'en')}
          mehrere={art === 'waffen' || art === 'werkzeug' || art === 'sprachen'}
          aendern={aendern}
        />
      ) : (
        <input data-feld={feld} value={wert} maxLength={laenge} placeholder={platzhalter} onChange={(e) => aendern(e.target.value)} />
      )}
    </label>
  );
}

function Langtext({ label, wert, feld, aendern }: { label: string; wert: string; feld: string; aendern: (v: string) => void }) {
  return (
    <label className="feld">
      <span className="feld__label">
        {label} <SlMarke feld={feld} />
      </span>
      <textarea data-feld={feld} rows={5} value={wert} maxLength={20_000} onChange={(e) => aendern(e.target.value)} />
    </label>
  );
}

/**
 * Zahlenfeld, das waehrend des Tippens auch leer sein darf. Uebernommen wird
 * jede gueltige Zahl sofort, begrenzt beim Verlassen. Ohne sichtbares Label:
 * das setzt der Kasten drumherum.
 */
export function ZahlRoh({
  label,
  wert,
  min,
  max,
  feld,
  aendern
}: {
  label: string;
  wert: number;
  min: number;
  max: number;
  feld: string;
  aendern: (v: number) => void;
}) {
  const [text, setText] = useState(String(wert));
  const fokus = useRef(false);
  useEffect(() => {
    if (!fokus.current) setText(String(wert));
  }, [wert]);
  const begrenze = (n: number) => Math.min(max, Math.max(min, n));
  return (
    <input
      className="zahl"
      aria-label={label}
      data-feld={feld}
      inputMode="numeric"
      value={text}
      onFocus={() => {
        fokus.current = true;
      }}
      onChange={(e) => {
        setText(e.target.value);
        const n = Number(e.target.value);
        if (e.target.value.trim() !== '' && Number.isFinite(n)) aendern(begrenze(Math.round(n)));
      }}
      onBlur={() => {
        fokus.current = false;
        const n = Number(text);
        // Leer gelassen heißt 0 (bzw. das Kleinste, was erlaubt ist), nicht „wie vorher"
        // (Rückmeldung: gelöschte temporäre TP blieben stehen).
        const gueltig = text.trim() === '' ? begrenze(0) : Number.isFinite(n) ? begrenze(Math.round(n)) : wert;
        if (text.trim() === '' && gueltig !== wert) aendern(gueltig);
        setText(String(gueltig));
        if (gueltig !== wert) aendern(gueltig);
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          const neu = begrenze(wert + (e.key === 'ArrowUp' ? 1 : -1));
          setText(String(neu));
          aendern(neu);
        }
      }}
    />
  );
}
