import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api, call } from './api';
import { buildIndex, filterNotes, searchNotes, type SearchFilters } from './noteIndex';
import { findWikiLinks, hasLinkReservedChars, normalizeName, rewriteWikiLinks } from '../shared/wikilinks';
import { verlinkteNotizen } from '../shared/kiKontext';
import { effektiverStand, zieheUmbenennungNach, type Entwurf } from './entwuerfe';
import { vorlageNotiztypen } from '../shared/noteTypes';
import { fuegeEin } from './editor/einfuegen';
import type {
  AppSettings,
  Campaign,
  Note,
  NoteType,
  NoteTypeDef,
  NoteVersion,
  OrphanedAsset,
  SearchHit,
  UnreadableNote
} from '../shared/types';
import type { PromptCategory } from '../shared/writingPrompts';
import { CampaignBar } from './components/CampaignBar';
import { NoteList } from './components/NoteList';
import { NoteEditor } from './components/NoteEditor';
import { InfoCard } from './components/InfoCard';
import { SettingsDialog } from './components/SettingsDialog';
import { PromptDialog } from './components/PromptDialog';
import { ConfirmDialog } from './components/ConfirmDialog';
import { LanguageProvider, useLanguage, useT } from './i18n';
import { DEFAULT_LANGUAGE } from '../shared/i18n';
import type { Language } from '../shared/i18n';
import { NoteTypesDialog } from './components/NoteTypesDialog';
import { HistoryDialog } from './components/HistoryDialog';
import { PromptsDialog } from './components/PromptsDialog';
import { ExportDialog, type ExportFormat } from './components/ExportDialog';
import { GraphView } from './components/GraphView';
import { CleanupDialog } from './components/CleanupDialog';
import { HelpDialog } from './components/HelpDialog';
import { AboutDialog } from './components/AboutDialog';
import type { AiStatus } from './components/AssistantPanel';
import { AssistantProvider } from './assistant';
import type { AiMessage, AiTask } from '../shared/types';

type Dialog =
  | { kind: 'none' }
  | { kind: 'settings' }
  | { kind: 'newCampaign' }
  | { kind: 'renameCampaign'; campaign: Campaign }
  | { kind: 'deleteCampaign'; campaign: Campaign }
  | { kind: 'newNote'; type: NoteType }
  | { kind: 'deleteNote'; note: Note }
  | { kind: 'renameNote'; note: Note }
  | { kind: 'noteTypes' }
  | { kind: 'history'; note: Note }
  | { kind: 'prompts' }
  | { kind: 'export'; format: ExportFormat }
  | { kind: 'cleanup' }
  | { kind: 'help' }
  | { kind: 'about' };

const EMPTY_FILTERS: SearchFilters = { query: '', type: 'all', tag: null };
/** Der zuletzt gewaehlte Notiztyp im Dialog „Neue Notiz" (nur ein Komfort, im Browser-Speicher). */
const LETZTER_TYP = 'backstory.letzterNotiztyp';

export function App() {
  const [language, setLanguage] = useState<Language>(DEFAULT_LANGUAGE);

  return (
    <LanguageProvider language={language}>
      <Workspace onLanguageChange={setLanguage} />
    </LanguageProvider>
  );
}

function Workspace({ onLanguageChange }: { onLanguageChange: (language: Language) => void }) {
  const { t, compare, language } = useLanguage();
  const [settings, setSettings] = useState<AppSettings | null>(null);
  /**
   * Ob eine Huelle einbettet. Sie fuehrt dann die Einstellungen, und der
   * eigene Knopf dafuer faellt weg — zwei Stellen fuer dieselbe Sache heisst,
   * dass man immer zuerst in der falschen nachsieht.
   */
  const [inHuelle, setInHuelle] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [activeCampaignId, setActiveCampaignId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [draft, setDraft] = useState<Note | null>(null);
  const [dirty, setDirty] = useState(false);
  /**
   * Geaenderte Notizen, die noch nicht auf der Platte stehen — nach ID.
   *
   * Bei ausgeschaltetem Autosave schreibt nichts mehr von allein, auch nicht
   * der Wechsel auf eine andere Notiz. Der bisherige Zustand kannte nur *eine*
   * offene Notiz; wer zwei anfasste, verlor die erste oder erzwang ein
   * Schreiben. Hier stehen sie alle, bis Strg+S oder der Dialog beim
   * Schliessen sie loswird.
   *
   * Bei eingeschaltetem Autosave bleibt der Speicher leer: dort wird
   * geschrieben wie eh und je.
   */
  const [entwuerfe, setEntwuerfe] = useState<Map<string, Entwurf>>(() => new Map());
  const [saving, setSaving] = useState(false);
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [hover, setHover] = useState<{ note: Note; rect: DOMRect } | null>(null);
  const [dialog, setDialog] = useState<Dialog>({ kind: 'none' });
  const [message, setMessage] = useState<{
    text: string;
    tone: 'info' | 'error';
    /** Ein Knopf im Hinweis, etwa „Rückgängig“ nach dem Löschen. */
    aktion?: { label: string; run: () => void };
  } | null>(null);
  const [versions, setVersions] = useState<NoteVersion[] | null>(null);
  // Wird hochgezaehlt, wenn der Text einer offenen Notiz von aussen ersetzt
  // wurde. Ohne dieses Signal zeigte der Editor weiter den alten Stand.
  const [reloadKey, setReloadKey] = useState(0);
  const [prompts, setPrompts] = useState<PromptCategory[] | null>(null);
  const [showGraph, setShowGraph] = useState(false);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [orphans, setOrphans] = useState<OrphanedAsset[] | null>(null);
  const [unreadable, setUnreadable] = useState<UnreadableNote[]>([]);

  const draftRef = useRef<Note | null>(null);
  draftRef.current = draft;
  const dirtyRef = useRef(false);
  dirtyRef.current = dirty;
  const notesRef = useRef<Note[]>([]);
  notesRef.current = notes;
  const savingRef = useRef(false);
  const activeCampaignIdRef = useRef<string | null>(null);
  activeCampaignIdRef.current = activeCampaignId;
  const entwuerfeRef = useRef<Map<string, Entwurf>>(new Map());
  entwuerfeRef.current = entwuerfe;
  /**
   * Ob ueberhaupt automatisch geschrieben werden darf.
   *
   * `settings` ist beim ersten Zeichnen `null`. Dann *nicht* schreiben: eine
   * ausgeschaltete Einstellung, die noch nicht geladen ist, darf nicht kurz
   * als eingeschaltet gelten und Ungespeichertes wegschreiben.
   */
  const autosaveAn = settings?.autosaveEnabled ?? false;
  const autosaveAnRef = useRef(false);
  autosaveAnRef.current = autosaveAn;

  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId) ?? null;
  // Ohne offene Kampagne gilt die Vorlage in der eingestellten Sprache.
  const noteTypes: NoteTypeDef[] =
    activeCampaign?.noteTypes ?? vorlageNotiztypen(settings?.language ?? DEFAULT_LANGUAGE);
  /**
   * Der Stand, den die Person vor sich hat: die Notizen von der Platte, wo
   * vorhanden durch ihren Entwurf ersetzt.
   *
   * `notes` bleibt daneben der reine Plattenstand — `schreibe` braucht ihn,
   * um beim Umbenennen den *alten* Titel zu kennen. Wer die beiden
   * verwechselt, benennt gegen sich selbst um.
   *
   * Ohne diese Trennung zeigten Liste, Suche und Graph den Stand von vor der
   * letzten Aenderung: man tippt einen neuen Titel, und die Liste daneben
   * nennt weiter den alten. Mit Autosave fiel das nicht auf, weil nach
   * anderthalb Sekunden ohnehin geschrieben wurde.
   */
  const effektiveNotizen = useMemo(
    () => effektiverStand(notes, entwuerfe, activeCampaignId, dirty && draft ? draft : null),
    [notes, entwuerfe, activeCampaignId, dirty, draft]
  );

  const index = useMemo(
    () => buildIndex(effektiveNotizen, noteTypes, compare),
    [effektiveNotizen, noteTypes, compare]
  );
  const visibleNotes = useMemo(() => filterNotes(index, filters), [index, filters]);

  /** Warnt, wenn Titel oder Alias schon einer anderen Notiz gehoeren. */
  const titelVergeben = (titel: string, eigeneId: string | null): string | null => {
    const key = normalizeName(titel);
    const treffer = effektiveNotizen.find(
      (note) => note.id !== eigeneId && [note.title, ...note.aliases].some((name) => normalizeName(name) === key)
    );
    return treffer ? t('dialog.titleTaken', { title: treffer.title }) : null;
  };

  /** Wie viele andere Notizen auf diese verweisen, per [[Link]] oder Beziehung. Fuer den Loeschdialog. */
  const verweiseAuf = (note: Note): number => {
    const namen = new Set([note.title, ...note.aliases].map(normalizeName));
    return effektiveNotizen.filter(
      (andere) =>
        andere.id !== note.id &&
        (andere.relations.some((relation) => relation.targetId === note.id) ||
          findWikiLinks(andere.body).some((link) => namen.has(normalizeName(link.target))))
    ).length;
  };

  // Treffer der Volltextsuche, damit die Liste Ausschnitt und Fundstelle
  // zeigen kann. Ohne Suchbegriff bleibt die Zuordnung leer.
  const searchHits = useMemo(() => {
    if (!filters.query.trim()) return new Map<string, SearchHit>();
    return new Map(searchNotes(index, filters.query).map((hit) => [hit.noteId, hit]));
  }, [index, filters.query]);

  /**
   * Alle Notizen mit ungespeicherten Aenderungen: die beiseitegelegten *und*
   * die gerade offene, wenn sie schmutzig ist. Die offene steht nicht im
   * Entwurfsspeicher — dort landet sie erst beim Wechsel —, gehoert in der
   * Liste aber genauso markiert.
   */
  /**
   * `speichereAlles` haengt an fast jedem Zustand und bekaeme bei jeder
   * Aenderung eine neue Identitaet. Ueber diese Referenz bleibt der
   * IPC-Anschluss unten stehen, statt sich staendig ab- und wieder
   * anzumelden — waehrenddessen ginge eine Frage des Hauptprozesses ins Leere.
   */
  const speichereAllesRef = useRef<() => Promise<void>>(async () => {});

  const ungespeicherteIds = useMemo(() => {
    const ids = new Set(
      [...entwuerfe.values()]
        .filter((entwurf) => entwurf.campaignId === activeCampaignId)
        .map((entwurf) => entwurf.notiz.id)
    );
    if (dirty && draft) ids.add(draft.id);
    return ids;
  }, [entwuerfe, dirty, draft, activeCampaignId]);

  const report = useCallback((text: string, tone: 'info' | 'error' = 'info') => {
    setMessage({ text, tone });
  }, []);

  const guard = useCallback(
    async <T,>(action: () => Promise<T>): Promise<T | null> => {
      try {
        return await action();
      } catch (error) {
        report(error instanceof Error ? error.message : String(error), 'error');
        return null;
      }
    },
    [report]
  );

  // --- Laden ---------------------------------------------------------------

  useEffect(() => {
    void guard(async () => {
      const loaded = await call(api.settings.get());
      setSettings(loaded);
      onLanguageChange(loaded.language);
      // Der Status haengt an einem Netzaufruf, deshalb nebenlaeufig.
      void call(api.ai.status()).then(setAiStatus, () => setAiStatus(null));

      const list = await call(api.campaigns.list());
      setCampaigns(list);

      const preferred = list.find((campaign) => campaign.id === loaded.lastCampaignId) ?? list[0] ?? null;
      setActiveCampaignId(preferred?.id ?? null);
    });
  }, [guard]);

  // Die Huelle kann die Sprache von aussen setzen (Einstellungen dort gelten
  // fuer die ganze Sammlung). Ohne diesen Effekt liefe die Oberflaeche mit
  // der alten Sprache weiter, obwohl schon eine neue in den Einstellungen
  // steht.
  useEffect(() => {
    return api.onLanguageChange((language) => {
      setSettings((prev) => (prev ? { ...prev, language } : prev));
      onLanguageChange(language);
    });
  }, [onLanguageChange]);

  /*
   * Die Vorschlagsliste der Schreibhilfe haengt an der Sprache: sie liegt je
   * Sprache als eigene Datei im Speicherort. Einmal geholt, blieb sie im
   * Zustand stehen — wer auf Englisch umstellte, bekam weiter die deutsche
   * Liste, solange das Fenster offen war.
   *
   * Weggeworfen und nicht sofort nachgeholt: der Dialog holt sie beim
   * Oeffnen, und die meisten Sprachwechsel geschehen, ohne dass er je
   * aufgeht.
   *
   * Haengt an `settings.language` und nicht an einem der beiden Wege dorthin:
   * umgestellt wird hier im Dialog und in der Huelle, und beide landen hier.
   */
  useEffect(() => {
    setPrompts(null);
  }, [settings?.language]);

  const reloadNotes = useCallback(
    async (campaignId: string) => {
      const list = await call(api.notes.list(campaignId));
      // Auch die Referenz sofort setzen. Sonst arbeitet der noch laufende
      // Ablauf mit dem alten Stand weiter, denn die Referenz wird erst beim
      // naechsten Rendern nachgezogen. Nach einem Umbenennen haette der
      // Editor dann den Text von vor dem Link-Rewrite gezeigt und beim
      // Speichern wieder zurueckgeschrieben.
      notesRef.current = list;
      setNotes(list);
      return list;
    },
    []
  );

  /*
   * Die KI wurde in der Huelle an- oder abgeschaltet.
   *
   * Ohne das fragte die Oberflaeche den Zustand nur einmal beim Laden ab: wer
   * die KI abschaltet, saehe den Assistenten weiter, bis zufaellig etwas
   * anderes ein Neuzeichnen ausloeste.
   */
  useEffect(
    () => api.onKiWechsel(() => void call(api.ai.status()).then(setAiStatus, () => setAiStatus(null))),
    []
  );

  useEffect(() => {
    void call(api.app.inHuelle()).then(setInHuelle, () => setInHuelle(false));
  }, []);

  /*
   * Im Einstellungen-Dialog der Huelle wurde etwas verstellt.
   *
   * Der ganze Stand kommt mit. Ohne diese Meldung schriebe die Oberflaeche
   * weiter mit der alten Wartezeit und zeigte den alten Ordner — die
   * Einstellungen liegen hier im Speicher, nicht bei jedem Zugriff auf der
   * Platte.
   */
  useEffect(() => api.onEinstellungen(setSettings), []);

  /*
   * Der Speicherort wurde von der Huelle aus gewechselt. Kampagnen und
   * Notizen im Speicher gehoeren danach zum alten Ordner; sie stehen zu
   * lassen hiesse, auf Dateien zu zeigen, die hier nicht liegen.
   */
  useEffect(
    () =>
      api.onSpeicherortWechsel(() => {
        void guard(async () => {
          const liste = await call(api.campaigns.list());
          setCampaigns(liste);
          setActiveCampaignId(liste[0]?.id ?? null);
        });
      }),
    [guard]
  );

  /*
   * Ein anderes Werkzeug hat etwas abgelegt — der NPC Creator eine Figur.
   *
   * Nur die Liste wird neu geholt, nicht die offene Notiz: wer gerade
   * schreibt, soll seinen Text behalten. Ohne das sah es aus, als waere gar
   * nichts angelegt worden: die Datei lag auf der Platte, die Liste hatte
   * ihren Stand vom Oeffnen, und beim Zurueckwechseln wird die Ansicht
   * bewusst nicht neu geladen, weil das den Zustand wegwuerfe.
   */
  /**
   * Der Verlauf der Huelle: melden, welche Notiz offen ist, und einem Sprung
   * folgen.
   *
   * Laeuft der Story Creator eigenstaendig, hoert niemand zu und nichts
   * davon tut etwas — die Bruecke ist dieselbe.
   */
  useEffect(() => {
    api.verlauf.melde(draft?.id ?? null);
  }, [draft?.id]);

  useEffect(() => {
    if (!activeCampaignId) return;
    return api.onFremdeAenderung(() => {
      void guard(() => reloadNotes(activeCampaignId));
    });
  }, [activeCampaignId, guard, reloadNotes]);



  useEffect(() => {
    if (!activeCampaignId) {
      setNotes([]);
      setDraft(null);
      return;
    }
    void guard(async () => {
      const list = await reloadNotes(activeCampaignId);
      setDraft(list[0] ?? null);
      setDirty(false);
      setFilters(EMPTY_FILTERS);
      setUnreadable(await call(api.notes.unreadable(activeCampaignId)));
      await call(api.settings.update({ lastCampaignId: activeCampaignId }));
    });
  }, [activeCampaignId, guard, reloadNotes]);

  // --- Speichern -----------------------------------------------------------

  /** Zieht eine Umbenennung durch die Entwuerfe. Regel in ./entwuerfe.ts. */
  const zieheEntwuerfeNach = useCallback(
    (campaignId: string, alterTitel: string, neuerTitel: string) => {
      setEntwuerfe(
        (vorher) => zieheUmbenennungNach(vorher, campaignId, alterTitel, neuerTitel) as Map<string, Entwurf>
      );
    },
    []
  );

  const loescheEntwurf = useCallback((noteId: string) => {
    setEntwuerfe((vorher) => {
      if (!vorher.has(noteId)) return vorher;
      const naechste = new Map(vorher);
      naechste.delete(noteId);
      return naechste;
    });
  }, []);

  /**
   * Legt den offenen Entwurf beiseite, ohne ihn zu schreiben.
   *
   * Das Gegenstueck zu `persist` fuer ausgeschalteten Autosave: der Text ist
   * weiter da, nur eben im Arbeitsspeicher statt auf der Platte. Verloren geht
   * er erst, wenn das Programm abstuerzt — und beim geordneten Schliessen
   * fragt der Dialog danach.
   */
  const parke = useCallback(() => {
    const aktuell = draftRef.current;
    const campaignId = activeCampaignIdRef.current;
    if (!aktuell || !dirtyRef.current || !campaignId) return;
    setEntwuerfe((vorher) => new Map(vorher).set(aktuell.id, { notiz: aktuell, campaignId }));
  }, []);

  /**
   * Schreibt eine Notiz auf die Platte, mit allem, was dazugehoert.
   *
   * Herausgeloest aus `persist`, weil es jetzt zwei Aufrufer gibt: die offene
   * Notiz beim Speichern, und beim Schliessen jeder beiseitegelegte Entwurf.
   * Die Umbenennung darf dabei nicht verlorengehen — sie zieht die [[Links]]
   * der ganzen Kampagne mit, und ein Entwurf mit geaendertem Titel, der ohne
   * sie geschrieben wird, hinterlaesst tote Links.
   */
  const schreibe = useCallback(
    async (notiz: Note, campaignId: string): Promise<Note> => {
      const persisted = notesRef.current.find((note) => note.id === notiz.id);
      const umbenannt = Boolean(persisted && persisted.title !== notiz.title);

      if (umbenannt && persisted) {
        // Erst den Inhalt unter dem alten Titel sichern, dann umbenennen.
        await call(api.notes.save(campaignId, { ...notiz, title: persisted.title }));
        const result = await call(api.notes.rename(campaignId, notiz.id, notiz.title));
        await reloadNotes(campaignId);
        // Das Umbenennen zieht die [[Links]] auf der Platte mit — die
        // beiseitegelegten Entwuerfe erreicht es nicht. Ohne diesen Schritt
        // schriebe ein spaeter gespeicherter Entwurf den alten Namen zurueck
        // und machte den Link tot. Das faellt niemandem auf: der Link sieht
        // nach dem Umbenennen richtig aus und wird erst beim Speichern der
        // anderen Notiz wieder falsch.
        zieheEntwuerfeNach(campaignId, persisted.title, result.note.title);
        if (result.rewritten > 0) {
          report(result.rewritten === 1 ? t('msg.renamedOne') : t('msg.renamed', { count: result.rewritten }));
        }
        return result.note;
      }

      const saved = await call(api.notes.save(campaignId, notiz));
      notesRef.current = notesRef.current.map((note) => (note.id === saved.id ? saved : note));
      setNotes(notesRef.current);
      return saved;
    },
    [reloadNotes, report, t, zieheEntwuerfeNach]
  );

  const persist = useCallback(async (ohneUmbenennen = false): Promise<Note | null> => {
    const current = draftRef.current;
    const campaignId = activeCampaignId;
    if (!current || !campaignId || !dirtyRef.current || savingRef.current) return current;

    savingRef.current = true;
    setSaving(true);
    try {
      /*
       * Der Autosave benennt nicht um, solange im Titelfeld getippt wird.
       *
       * Sonst wurde bei jeder Pause umbenannt: aus „Aldric" wurde „B", „Bo",
       * „Borin" — und weil es schon eine Notiz „Bo" gab, zog der letzte
       * Schritt auch deren Links mit (Testbericht). Gesichert wird der Text
       * unter dem alten Titel; umbenannt wird beim Verlassen des Felds.
       */
      const persisted = notesRef.current.find((note) => note.id === current.id);
      if (ohneUmbenennen && persisted && persisted.title !== current.title) {
        const saved = await call(api.notes.save(campaignId, { ...current, title: persisted.title }));
        notesRef.current = notesRef.current.map((note) => (note.id === saved.id ? saved : note));
        setNotes(notesRef.current);
        return current;
      }
      const saved = await schreibe(current, campaignId);
      // Beim Umbenennen kann der Rumpf von der Platte anders aussehen als im
      // Editor (die Links wurden mitgezogen).
      if (saved.body !== current.body) setReloadKey((previous) => previous + 1);
      setDraft((previous) => (previous && previous.id === saved.id ? saved : previous));
      setDirty(false);
      // Steht auf der Platte, gehoert also nicht mehr in den Entwurfsspeicher.
      loescheEntwurf(saved.id);
      return saved;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }, [activeCampaignId, schreibe, loescheEntwurf]);

  const save = useCallback(() => guard(persist), [guard, persist]);

  /**
   * Schreibt alles Ungespeicherte: die offene Notiz und jeden
   * beiseitegelegten Entwurf.
   *
   * Fuer den Dialog beim Schliessen. Der Reihe nach und nicht nebenlaeufig:
   * `schreibe` fasst dieselbe Notizliste an, und beim Umbenennen laedt es sie
   * neu — parallele Laeufe wuerden sich gegenseitig ueberholen.
   */
  const speichereAlles = useCallback(async (): Promise<void> => {
    await persist();
    for (const entwurf of [...entwuerfeRef.current.values()]) {
      await guard(async () => {
        // In *seine* Kampagne, nicht in die gerade offene.
        const gespeichert = await schreibe(entwurf.notiz, entwurf.campaignId);
        loescheEntwurf(gespeichert.id);
      });
    }
  }, [persist, schreibe, guard, loescheEntwurf]);
  speichereAllesRef.current = speichereAlles;

  /**
   * Vorbereitung fuer eine Aktion, die den Stand auf der Platte braucht —
   * Export, Aufraeumen, der Assistent. Antwortet `false`, wenn abgebrochen
   * wurde.
   *
   * Diese Aktionen laufen im Hauptprozess und lesen die Dateien; einen
   * Entwurf im Arbeitsspeicher koennen sie nicht sehen. Frueher schrieb der
   * Editor deshalb vor jeder von ihnen einfach los. Ohne Autosave darf er das
   * nicht mehr — also wird gefragt, statt still den alten Stand zu exportieren
   * oder den neuen ungefragt festzuschreiben.
   */
  const bereitFuerPlattenaktion = useCallback(async (): Promise<boolean> => {
    if (autosaveAnRef.current) {
      await persist();
      return true;
    }
    const offen = draftRef.current;
    const anzahl =
      entwuerfeRef.current.size + (dirtyRef.current && offen && !entwuerfeRef.current.has(offen.id) ? 1 : 0);
    if (anzahl === 0) return true;

    const antwort = await call(api.frageSpeichern(anzahl));
    if (antwort === 'abbrechen') return false;
    if (antwort === 'speichern') await speichereAllesRef.current();
    return true;
  }, [persist]);

  /**
   * Was vor einem Wechsel passiert — der offenen Notiz, der Kampagne, der
   * Anwendung.
   *
   * Mit Autosave: schreiben wie bisher. Ohne: beiseitelegen. Das ist die eine
   * Stelle, an der diese Entscheidung faellt; jeder Aufrufer, der frueher
   * `persist()` rief, um vor einem Wechsel nichts zu verlieren, ruft jetzt
   * das hier.
   */
  const sichereVorWechsel = useCallback(async (): Promise<void> => {
    if (autosaveAnRef.current) {
      await persist();
      return;
    }
    parke();
  }, [persist, parke]);

  // Titel und Aliase mit [ ] oder | lehnt der Vault ab. Der Editor weist
  // darauf hin; der Autosave wuerde bis zur Korrektur im Sekundentakt
  // dieselbe Fehlermeldung einblenden und pausiert deshalb solange.
  const draftLinkable =
    !draft || ![draft.title, ...draft.aliases].some((name) => hasLinkReservedChars(name));

  // Autosave laeuft nur, wenn er in den Einstellungen aktiv ist.
  useEffect(() => {
    if (!settings?.autosaveEnabled || !dirty || !draft || !draftLinkable) return;
    const timer = window.setTimeout(
      () => void guard(() => persist(document.activeElement?.classList.contains('note-editor__title') ?? false)),
      settings.autosaveDelayMs
    );
    return () => window.clearTimeout(timer);
  }, [settings?.autosaveEnabled, settings?.autosaveDelayMs, dirty, draft, draftLinkable, guard, persist]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') {
        event.preventDefault();
        void save();
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [save]);

  useEffect(() => {
    /**
     * Beim Wegklicken sichern — Alt-Tab, ein anderes Fenster, der Wechsel auf
     * ein anderes Werkzeug in der Huelle.
     *
     * Nur mit Autosave. Ohne ihn wird der Entwurf beiseitegelegt, nicht
     * geschrieben: „Autosave aus" hiess hier frueher trotzdem „beim
     * Wegklicken schreibe ich", was die Einstellung an der Stelle
     * wirkungslos machte, an der sie am meisten auffaellt.
     */
    function onBlur() {
      if (!dirtyRef.current) return;
      if (autosaveAnRef.current) void save();
      else parke();
    }

    window.addEventListener('blur', onBlur);

    // Vor dem Schliessen fragt der Hauptprozess, was ungespeichert ist, und
    // zeigt danach gegebenenfalls den Dialog. Geantwortet wird mit Titeln,
    // nicht mit einer Zahl: der Dialog nennt sie, damit man weiss, worum es
    // geht, bevor man „Nicht speichern" drueckt.
    const stopFrage = api.onUngespeichertGefragt(() => {
      // Mit Autosave wird nicht gefragt. Wer ihn anlaesst, hat gesagt, dass
      // von allein gespeichert werden soll — ein Dialog beim Schliessen
      // waere dort eine Frage, die niemand gestellt haben wollte. Die leere
      // Liste fuehrt zum bisherigen Weg: still sichern und schliessen.
      if (autosaveAnRef.current) return [];
      const titel = [...entwuerfeRef.current.values()].map((entwurf) => entwurf.notiz.title);
      const offen = draftRef.current;
      if (dirtyRef.current && offen && !entwuerfeRef.current.has(offen.id)) titel.push(offen.title);
      return titel;
    });

    // Die Antwort „Speichern" aus dem Dialog.
    const stopAlles = api.onSpeichereAlles(() => speichereAllesRef.current());

    // Beim Schliessen wartet der Hauptprozess auf diese Rueckmeldung.
    const stopListening = api.onFlush(() => {
      void (async () => {
        try {
          await persist();
        } finally {
          api.flushed();
        }
      })();
    });

    return () => {
      window.removeEventListener('blur', onBlur);
      stopListening();
      stopFrage();
      stopAlles();
    };
  }, [save, persist, parke]);

  useEffect(() => {
    if (!message) return;
    // Mit Knopf etwas laenger, damit man ihn noch erwischt.
    const timer = window.setTimeout(() => setMessage(null), message.aktion ? 10000 : 5000);
    return () => window.clearTimeout(timer);
  }, [message]);

  // --- Aktionen ------------------------------------------------------------

  /** Bild in die Kampagne kopieren. Liefert den relativen Verweis oder null. */
  const importImage = useCallback(
    async (file: File): Promise<string | null> => {
      const campaignId = activeCampaignId;
      if (!campaignId) return null;
      return guard(async () =>
        call(api.assets.save(campaignId, file.name, new Uint8Array(await file.arrayBuffer())))
      );
    },
    [activeCampaignId, guard]
  );

  const pickImage = useCallback(async (): Promise<string | null> => {
    const campaignId = activeCampaignId;
    if (!campaignId) return null;
    return (await guard(() => call(api.assets.pick(campaignId)))) ?? null;
  }, [activeCampaignId, guard]);

  /**
   * Verlauf oeffnen.
   *
   * Der Verlauf kennt nur, was auf der Platte steht — er wird beim Speichern
   * fortgeschrieben. Ein ungespeicherter Entwurf taucht darin nicht auf, und
   * das ist richtig so: er ist keine Fassung, sondern eine Absicht. Mit
   * Autosave wird vorher geschrieben und steht dann drin.
   */
  const openHistory = useCallback(
    async (note: Note) => {
      const campaignId = activeCampaignId;
      if (!campaignId) return;

      setVersions(null);
      setDialog({ kind: 'history', note });
      await guard(async () => {
        await sichereVorWechsel();
        setVersions(await call(api.history.list(campaignId, note.id)));
      });
    },
    [activeCampaignId, guard, sichereVorWechsel]
  );

  const patchDraft = useCallback((patch: Partial<Note>) => {
    setDraft((previous) => (previous ? { ...previous, ...patch } : previous));
    setDirty(true);
  }, []);

  const openNote = useCallback(
    (noteId: string) => {
      if (draftRef.current?.id === noteId) return;
      void guard(async () => {
        await sichereVorWechsel();
        // Liegt fuer diese Notiz ein Entwurf bereit, gilt der und nicht der
        // Stand von der Platte — sonst waere der ungespeicherte Text beim
        // Zurueckkommen verschwunden, obwohl er nie verworfen wurde.
        const eintrag = entwuerfeRef.current.get(noteId);
        const geparkt =
          eintrag && eintrag.campaignId === activeCampaignIdRef.current ? eintrag.notiz : undefined;
        const target = geparkt ?? notesRef.current.find((note) => note.id === noteId);
        if (!target) return;
        setDraft(target);
        // Ein zurueckgeholter Entwurf ist weiterhin ungespeichert. Ohne das
        // haelte der Editor ihn fuer sauber, und Strg+S taete nichts.
        setDirty(Boolean(geparkt));
        setHover(null);
      });
    },
    [guard, sichereVorWechsel]
  );

  /*
   * Ein Treffer aus der Suche der Huelle.
   *
   * Erst die Kampagne, dann die Notiz — und dazwischen muss die Liste neu
   * gelesen sein. `openNote` sucht in `notesRef`, und die traegt bis dahin
   * noch die Notizen der alten Kampagne; ohne das Nachladen faende der
   * Sprung in eine fremde Kampagne nichts und taete stillschweigend gar
   * nichts.
   */
  useEffect(() => {
    return api.beiSuchtreffer((ziel) => {
      void guard(async () => {
        if (ziel.kampagne !== activeCampaignIdRef.current) {
          await sichereVorWechsel();
          setActiveCampaignId(ziel.kampagne);
          await reloadNotes(ziel.kampagne);
        }
        openNote(ziel.notiz);
      });
    });
  }, [guard, openNote, reloadNotes, sichereVorWechsel]);

  const createNote = useCallback(
    (type: NoteType, title: string) => {
      const campaignId = activeCampaignId;
      if (!campaignId) return;

      void guard(async () => {
        await sichereVorWechsel();
        const created = await call(api.notes.create(campaignId, type, title));
        const list = await reloadNotes(campaignId);
        setDraft(list.find((note) => note.id === created.id) ?? created);
        setDirty(false);
      });
    },
    [activeCampaignId, guard, sichereVorWechsel, reloadNotes]
  );

  /**
   * Die drei Wege, eine ganze Kampagne auszugeben.
   *
   * Sie haengen an zwei Stellen: im Menue "Kampagne" und am Export-Knopf des
   * Editors. Einmal gebaut und zweimal gereicht — zwei Fassungen liefen
   * frueher oder spaeter auseinander.
   *
   * Exportiert wird der Stand auf der Platte. Ungespeichertes fehlte darin,
   * deshalb fragt bereitFuerPlattenaktion vorher.
   */
  const exportiereKampagneZip = useCallback(() => {
    if (!activeCampaign) return;
    void guard(async () => {
      if (!(await bereitFuerPlattenaktion())) return;
      const target = await call(api.exportCampaignZip(activeCampaign.id, activeCampaign.name));
      if (target) report(t('msg.exported', { path: target }));
    });
  }, [activeCampaign, guard, bereitFuerPlattenaktion, report, t]);

  /**
   * Der Export der ganzen Kampagne fragt erst, was hinein soll. Bei zwanzig
   * Notizen war "alle" richtig, bei zweihundert selten.
   */
  const exportiereKampagneMarkdown = useCallback(() => {
    if (activeCampaign) setDialog({ kind: 'export', format: 'markdown' });
  }, [activeCampaign]);

  const exportiereKampagnePdf = useCallback(() => {
    if (activeCampaign) setDialog({ kind: 'export', format: 'pdf' });
  }, [activeCampaign]);

  const fuehreExportAus = useCallback(
    (format: ExportFormat, noteIds: string[] | null, inhaltsverzeichnis: boolean, mitGraph: boolean) => {
      if (!activeCampaign) return;
      setDialog({ kind: 'none' });
      void guard(async () => {
        if (!(await bereitFuerPlattenaktion())) return;
        const result =
          format === 'markdown'
            ? await call(api.exportMarkdown.campaign(activeCampaign.id, noteIds))
            : await call(
                api.exportPdf.campaign(
                  activeCampaign.id,
                  activeCampaign.name,
                  noteIds,
                  inhaltsverzeichnis,
                  mitGraph
                )
              );
        if (result) report(t('export.doneCount', { count: result.count, path: result.path }));
      });
    },
    [activeCampaign, guard, bereitFuerPlattenaktion, report, t]
  );

  useEffect(() => {
    return api.verlauf.beiSprung((ort) => {
      if (!ort) return;
      // Eine Notiz, die es nicht mehr gibt, ist kein Fehler: sie kann
      // geloescht worden sein, seit der Schritt in den Verlauf kam.
      if (!index.byId.has(ort)) return;
      openNote(ort);
    });
  }, [index, openNote]);

  /** Aus einem offenen [[Link]] heraus: nur anlegen, wenn es den Namen noch nicht gibt. */
  /**
   * Wie viele Notizen mit an den Assistenten gingen. Gerechnet mit derselben
   * Funktion, die der Hauptprozess zum Verschicken benutzt — sonst stuende
   * neben dem Kaestchen eine Zahl, die nicht stimmt.
   */
  const aiLinkedCount = useMemo(
    () => (draft ? verlinkteNotizen(draft, index.notes).length : 0),
    [draft, index]
  );

  const createNoteFromLink = useCallback(
    (title: string) => {
      if (index.byName.has(normalizeName(title))) {
        report(t('msg.alreadyExists', { title }));
        return;
      }
      // Der zuletzt gewaehlte Typ statt immer „Charakter" (Testbericht).
      let typ: NoteType = 'character';
      try {
        const gemerkt = localStorage.getItem(LETZTER_TYP);
        if (gemerkt && noteTypes.some((d) => d.id === gemerkt)) typ = gemerkt as NoteType;
      } catch {
        // Ohne Speicher bleibt es beim Charakter.
      }
      setDialog({ kind: 'newNote', type: typ });
      setPendingLinkTitle(title);
    },
    [index, report, noteTypes]
  );

  /**
   * Aus einem [[Link]] angelegt: die neue Notiz entsteht im Hintergrund, und
   * man schreibt in der alten weiter (Testbericht: der Satz war sonst
   * unterbrochen). Wurde der Titel im Dialog geaendert, bekommt die neue
   * Notiz den alten als Alias — so greift der Link, der schon im Text steht.
   */
  const createNoteInBackground = useCallback(
    (type: NoteType, title: string, linkTitle: string) => {
      const campaignId = activeCampaignId;
      if (!campaignId) return;
      void guard(async () => {
        const created = await call(api.notes.create(campaignId, type, title));
        if (normalizeName(linkTitle) !== normalizeName(title)) {
          await call(api.notes.save(campaignId, { ...created, aliases: [...created.aliases, linkTitle] }));
        }
        await reloadNotes(campaignId);
        report(t('msg.createdInBackground', { title }));
      });
    },
    [activeCampaignId, guard, reloadNotes, report, t]
  );

  const [pendingLinkTitle, setPendingLinkTitle] = useState<string | null>(null);

  const switchCampaign = useCallback(
    (campaignId: string) => {
      if (campaignId === activeCampaignId) return;
      void guard(async () => {
        // Der Entwurf wird beiseitegelegt, nicht geschrieben — mitsamt seiner
        // Kampagne, damit er beim Speichern dorthin zurueckfindet und nicht in
        // die neue.
        await sichereVorWechsel();
        setActiveCampaignId(campaignId);
      });
    },
    [activeCampaignId, guard, persist]
  );

  const updateSettings = useCallback(
    (patch: Partial<AppSettings>) => {
      void guard(async () => {
        const updated = await call(api.settings.update(patch));
        setSettings(updated);
        onLanguageChange(updated.language);
        void call(api.ai.status()).then(setAiStatus, () => setAiStatus(null));
      });
    },
    [guard, onLanguageChange]
  );

  /**
   * Eine Frage an den Assistenten. Liegt hier statt im Assistenten selbst,
   * weil vorher gespeichert werden muss: als Kontext geht der Stand auf der
   * Platte mit, nicht der im Editor.
   */
  const askAssistant = useCallback(
    async (
      task: AiTask,
      history: AiMessage[],
      question: string,
      onChunk: (text: string) => void
    ): Promise<string | null> => {
      const campaignId = activeCampaignId;
      const noteId = draftRef.current?.id;
      if (!campaignId || !noteId) return null;
      // Der Assistent liest die Notiz von der Platte. Mit ungespeichertem
      // Entwurf bekaeme er den Text von vorhin und antwortete daneben.
      if (!(await bereitFuerPlattenaktion())) return null;

      // Eigene Kennung je Anfrage, damit Teiltexte einer alten Anfrage nicht
      // in einer neuen Antwort landen.
      const streamId = crypto.randomUUID();
      const unsubscribe = api.ai.onChunk(streamId, onChunk);
      try {
        return await guard(() => call(api.ai.ask(campaignId, noteId, task, streamId, history, question)));
      } finally {
        unsubscribe();
      }
    },
    [activeCampaignId, guard, persist]
  );

  if (!settings) {
    return <div className="boot">{t('app.loading')}</div>;
  }

  return (
    <AssistantProvider noteId={draft?.id ?? null} onAsk={askAssistant}>
    <div className="app" onMouseLeave={() => setHover(null)}>
      <CampaignBar
        campaigns={campaigns}
        activeCampaignId={activeCampaignId}
        settings={settings}
        ungespeichertAnzahl={ungespeicherteIds.size}
        onSelect={switchCampaign}
        onCreate={() => setDialog({ kind: 'newCampaign' })}
        onRename={() => activeCampaign && setDialog({ kind: 'renameCampaign', campaign: activeCampaign })}
        onDelete={() => activeCampaign && setDialog({ kind: 'deleteCampaign', campaign: activeCampaign })}
        onExport={exportiereKampagneZip}
        onImport={() =>
          void guard(async () => {
            // Auch hier gilt: erst sichern, was offen ist. Das Einlesen
            // wechselt die Kampagne, und ein Entwurf bliebe sonst haengen.
            if (!(await bereitFuerPlattenaktion())) return;
            const eingelesen = await call(api.importCampaignZip());
            if (!eingelesen) return;
            const liste = await call(api.campaigns.list());
            setCampaigns(liste);
            setActiveCampaignId(eingelesen.id);
            report(t('msg.imported', { name: eingelesen.name }));
          })
        }
        onExportMarkdown={exportiereKampagneMarkdown}
        onExportPdf={exportiereKampagnePdf}
        onToggleGraph={() => setShowGraph((previous) => !previous)}
        graphOpen={showGraph}
        onCleanup={() =>
          activeCampaign &&
          void guard(async () => {
            setOrphans(null);
            setDialog({ kind: 'cleanup' });
            // Verwaiste Bilder werden an den Dateien gemessen. Ein Entwurf,
            // der ein Bild noch benutzt, macht es sonst faelschlich verwaist.
            if (!(await bereitFuerPlattenaktion())) return;
            setOrphans(await call(api.assets.orphans(activeCampaign.id)));
          })
        }
        onOpenHelp={() => setDialog({ kind: 'help' })}
        onOpenAbout={() => setDialog({ kind: 'about' })}
        onOpenSettings={inHuelle ? null : () => setDialog({ kind: 'settings' })}
        onEditNoteTypes={() => setDialog({ kind: 'noteTypes' })}
      />

      {activeCampaignId ? (
        <main className="app__body">
          <aside className="app__sidebar">
            <NoteList
              index={index}
              notes={visibleNotes}
              hits={searchHits}
              activeNoteId={draft?.id ?? null}
              ungespeichert={ungespeicherteIds}
              filters={filters}
              onFiltersChange={setFilters}
              onSelect={openNote}
              onCreate={(type) => setDialog({ kind: 'newNote', type })}
              unreadable={unreadable}
              onRevealVault={() => void guard(() => call(api.vault.reveal()))}
              onRename={(note) => setDialog({ kind: 'renameNote', note })}
              onDelete={(note) => setDialog({ kind: 'deleteNote', note })}
            />
          </aside>

          <section className="app__content">
            {showGraph ? (
              <GraphView
                index={index}
                activeNoteId={draft?.id ?? null}
                positions={activeCampaign?.graphPositions ?? {}}
                onSavePositions={(next) =>
                  void guard(async () => {
                    const updated = await call(api.campaigns.saveGraphPositions(activeCampaignId, next));
                    setCampaigns((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)));
                  })
                }
                onClose={() => setShowGraph(false)}
                campaignId={activeCampaignId}
                onOpenNote={(noteId) => {
                  openNote(noteId);
                  setShowGraph(false);
                }}
              />
            ) : draft ? (
              <NoteEditor
                note={draft}
                index={index}
                dirty={dirty}
                saving={saving}
                autosaveEnabled={settings.autosaveEnabled}
                onPatch={patchDraft}
                onSave={() => void save()}
                onRename={() => void save()}
                onDelete={() => setDialog({ kind: 'deleteNote', note: draft })}
                onOpenHistory={() => void openHistory(draft)}
                aiStatus={aiStatus}
                aiSendLinked={settings.aiSendLinkedNotes}
                onToggleAiSendLinked={(value) => updateSettings({ aiSendLinkedNotes: value })}
                aiLinkedCount={aiLinkedCount}
                editorZoom={settings.editorZoom}
                onEditorZoom={(prozent) => updateSettings({ editorZoom: prozent })}
                onOpenPrompts={() => {
                  setDialog({ kind: 'prompts' });
                  if (!prompts) void guard(async () => setPrompts(await call(api.prompts.get())));
                }}
                onExportMarkdown={() =>
                  void guard(async () => {
                    const campaignId = activeCampaignId;
                    if (!campaignId) return;
                    if (!(await bereitFuerPlattenaktion())) return;
                    const result = await call(api.exportMarkdown.note(campaignId, draft.id));
                    if (result) report(t('export.done', { path: result.path }));
                  })
                }
                onExportPdf={() =>
                  void guard(async () => {
                    const campaignId = activeCampaignId;
                    if (!campaignId) return;
                    if (!(await bereitFuerPlattenaktion())) return;
                    const result = await call(api.exportPdf.note(campaignId, draft.id, draft.title));
                    if (result) report(t('export.done', { path: result.path }));
                  })
                }
                onExportCampaignZip={exportiereKampagneZip}
                onExportCampaignMarkdown={exportiereKampagneMarkdown}
                onExportCampaignPdf={exportiereKampagnePdf}
                onOpenNote={openNote}
                onCreateNote={createNoteFromLink}
                onHoverNote={(note, rect) => setHover(note && rect ? { note, rect } : null)}
                onOpenExternal={(url) => void guard(() => call(api.openExternal(url)))}
                onEditNoteTypes={() => setDialog({ kind: 'noteTypes' })}
                searchQuery={filters.query}
                campaignId={activeCampaignId}
                reloadKey={reloadKey}
                onImportImage={importImage}
                onPickImage={pickImage}
                onReport={report}
                onAddReverseRelation={(targetId) =>
                  void guard(async () => {
                    const campaignId = activeCampaignId;
                    if (!campaignId) return;

                    // Erst den eigenen Stand sichern, sonst ginge er beim
                    // Neuladen nach dem Speichern der anderen Notiz verloren.
                    await sichereVorWechsel();

                    const target = notesRef.current.find((entry) => entry.id === targetId);
                    if (!target || target.relations.some((entry) => entry.targetId === draft.id)) return;

                    await call(
                      api.notes.save(campaignId, {
                        ...target,
                        relations: [
                          ...target.relations,
                          { id: crypto.randomUUID(), targetId: draft.id, type: '', note: '' }
                        ]
                      })
                    );
                    await reloadNotes(campaignId);
                    report(t('relations.reverseAdded', { title: target.title }));
                  })
                }
              />
            ) : (
              <div className="placeholder">
                <p>{t('app.noNotes')}</p>
                <p>{t('app.noNotesHint')}</p>
              </div>
            )}
          </section>
        </main>
      ) : (
        <div className="placeholder">
          <p>{t('app.noCampaign')}</p>
          <button type="button" className="primary" onClick={() => setDialog({ kind: 'newCampaign' })}>
            {t('app.createFirstCampaign')}
          </button>
        </div>
      )}

      {hover && activeCampaignId ? (
        <InfoCard
          note={hover.note}
          types={noteTypes}
          campaignId={activeCampaignId}
          rect={hover.rect}
          onOpen={openNote}
        />
      ) : null}

      {message ? (
        <div className={`toast toast--${message.tone}`} role="status">
          {message.text}
          {message.aktion ? (
            <button
              type="button"
              className="toast__aktion"
              data-toast-aktion
              onClick={() => {
                const aktion = message.aktion;
                setMessage(null);
                aktion?.run();
              }}
            >
              {message.aktion.label}
            </button>
          ) : null}
        </div>
      ) : null}

      {dialog.kind === 'noteTypes' && activeCampaign ? (
        <NoteTypesDialog
          types={noteTypes}
          notes={notes}
          otherCampaigns={campaigns.filter((campaign) => campaign.id !== activeCampaign.id)}
          onClose={() => setDialog({ kind: 'none' })}
          onSave={(types) =>
            void guard(async () => {
              const updated = await call(api.campaigns.updateNoteTypes(activeCampaign.id, types));
              setCampaigns((previous) => previous.map((entry) => (entry.id === updated.id ? updated : entry)));
              setDialog({ kind: 'none' });
              report(t('types.saved'));
            })
          }
        />
      ) : null}

      {dialog.kind === 'help' ? <HelpDialog onClose={() => setDialog({ kind: 'none' })} /> : null}

      {dialog.kind === 'about' ? <AboutDialog onClose={() => setDialog({ kind: 'none' })} /> : null}

      {dialog.kind === 'cleanup' && activeCampaignId ? (
        <CleanupDialog
          campaignId={activeCampaignId}
          assets={orphans}
          onClose={() => setDialog({ kind: 'none' })}
          onDelete={(names) =>
            void guard(async () => {
              const removed = await call(api.assets.deleteMany(activeCampaignId, names));
              report(removed === 1 ? t('cleanup.deletedOne') : t('cleanup.deleted', { count: removed }));
              setOrphans(await call(api.assets.orphans(activeCampaignId)));
            })
          }
        />
      ) : null}

      {dialog.kind === 'export' && activeCampaign ? (
        <ExportDialog
          format={dialog.format}
          index={index}
          onExport={(noteIds, inhalt, graph) => fuehreExportAus(dialog.format, noteIds, inhalt, graph)}
          onClose={() => setDialog({ kind: 'none' })}
        />
      ) : null}

      {dialog.kind === 'prompts' ? (
        <PromptsDialog
          categories={prompts}
          noteType={draft?.type}
          aiStatus={aiStatus}
          aiSendLinked={settings.aiSendLinkedNotes}
          onToggleAiSendLinked={(value) => updateSettings({ aiSendLinkedNotes: value })}
          aiLinkedCount={aiLinkedCount}
          onClose={() => setDialog({ kind: 'none' })}
          onEditFile={() => void guard(() => call(api.prompts.reveal()))}
          onInsert={(text) => {
            // An der Schreibmarke einfuegen, als eigener Absatz (Wunsch aus
            // dem Testbericht). Ist kein Editor offen, hinten anhaengen.
            if (!draft) return;
            setDialog({ kind: 'none' });
            if (fuegeEin(text)) return;
            patchDraft({ body: draft.body.trimEnd() ? `${draft.body.trimEnd()}\n\n${text}` : text });
            setReloadKey((previous) => previous + 1);
          }}
        />
      ) : null}

      {dialog.kind === 'history' ? (
        <HistoryDialog
          note={dialog.note}
          versions={versions}
          historyEnabled={settings.historyEnabled}
          onClose={() => setDialog({ kind: 'none' })}
          onRestore={(versionId) =>
            void guard(async () => {
              const campaignId = activeCampaignId;
              if (!campaignId) return;

              const restored = await call(api.history.restore(campaignId, dialog.note.id, versionId));
              await reloadNotes(campaignId);
              setDraft(restored);
              setDirty(false);
              setReloadKey((previous) => previous + 1);
              setDialog({ kind: 'none' });

              const version = versions?.find((entry) => entry.id === versionId);
              if (version) {
                report(t('history.restored', { date: new Date(version.savedAt).toLocaleString(language) }));
              }
            })
          }
        />
      ) : null}

      {dialog.kind === 'settings' ? (
        <SettingsDialog
          settings={settings}
          hasApiKey={aiStatus?.hasKey ?? false}
          kiVonHuelle={aiStatus?.managedByShell ?? false}
          onSaveApiKey={(apiKey) =>
            void guard(async () => {
              setSettings(await call(api.ai.setApiKey(apiKey)));
              setAiStatus(await call(api.ai.status()));
            })
          }
          onChange={updateSettings}
          onChooseVaultRoot={() =>
            void guard(async () => {
              const next = await call(api.settings.chooseVaultRoot());
              if (!next) return;
              setSettings(next);
              const list = await call(api.campaigns.list());
              setCampaigns(list);
              setActiveCampaignId(list[0]?.id ?? null);
              setDialog({ kind: 'none' });
            })
          }
          onRevealVault={() => void guard(() => call(api.vault.reveal()))}
          onClose={() => setDialog({ kind: 'none' })}
        />
      ) : null}

      {dialog.kind === 'newCampaign' ? (
        <PromptDialog
          title={t('dialog.newCampaign')}
          label={t('dialog.campaignName')}
          confirmLabel={t('dialog.create')}
          onClose={() => setDialog({ kind: 'none' })}
          onConfirm={(name) =>
            void guard(async () => {
              const campaign = await call(api.campaigns.create(name));
              setCampaigns(await call(api.campaigns.list()));
              setActiveCampaignId(campaign.id);
              setDialog({ kind: 'none' });
            })
          }
        />
      ) : null}

      {dialog.kind === 'renameCampaign' ? (
        <PromptDialog
          title={t('dialog.renameCampaign')}
          label={t('dialog.newName')}
          confirmLabel={t('dialog.rename')}
          initialValue={dialog.campaign.name}
          onClose={() => setDialog({ kind: 'none' })}
          onConfirm={(name) =>
            void guard(async () => {
              await call(api.campaigns.rename(dialog.campaign.id, name));
              setCampaigns(await call(api.campaigns.list()));
              setDialog({ kind: 'none' });
            })
          }
        />
      ) : null}

      {dialog.kind === 'deleteCampaign' ? (
        <ConfirmDialog
          title={t('dialog.deleteCampaign')}
          message={t('dialog.deleteCampaignText', { name: dialog.campaign.name })}
          onClose={() => setDialog({ kind: 'none' })}
          onConfirm={() =>
            void guard(async () => {
              await call(api.campaigns.remove(dialog.campaign.id));
              // Entwuerfe der geloeschten Kampagne verwerfen; gespeichert
              // legten sie einen verwaisten Ordner ohne campaign.json an.
              const weg = dialog.campaign.id;
              setEntwuerfe((vorher) => {
                const naechste = new Map([...vorher].filter(([, entwurf]) => entwurf.campaignId !== weg));
                return naechste.size === vorher.size ? vorher : naechste;
              });
              if (activeCampaignIdRef.current === weg) {
                setDirty(false);
                setDraft(null);
              }
              const list = await call(api.campaigns.list());
              setCampaigns(list);
              setActiveCampaignId(list[0]?.id ?? null);
              setDialog({ kind: 'none' });
            })
          }
        />
      ) : null}

      {dialog.kind === 'newNote' ? (
        <NewNoteDialog
          types={noteTypes}
          initialType={dialog.type}
          initialTitle={pendingLinkTitle ?? ''}
          warnung={(titel) => titelVergeben(titel, null)}
          onClose={() => {
            setDialog({ kind: 'none' });
            setPendingLinkTitle(null);
          }}
          onConfirm={(type, title) => {
            // Ungueltige Titel gleich hier abfangen: vorher ging der Dialog
            // zu, und die Eingabe war mit dem Fehler weg (Testbericht).
            if (!title.trim()) {
              report(t('error.noteTitle'));
              return;
            }
            if (hasLinkReservedChars(title)) {
              report(t('error.linkChars', { name: title }));
              return;
            }
            try {
              localStorage.setItem(LETZTER_TYP, type);
            } catch {
              // Nur ein Komfort.
            }
            if (pendingLinkTitle !== null) createNoteInBackground(type, title, pendingLinkTitle);
            else createNote(type, title);
            setDialog({ kind: 'none' });
            setPendingLinkTitle(null);
          }}
        />
      ) : null}

      {dialog.kind === 'renameNote' ? (
        <PromptDialog
          title={t('dialog.renameNote')}
          label={t('dialog.newName')}
          confirmLabel={t('dialog.rename')}
          initialValue={dialog.note.title}
          warnung={(titel) => titelVergeben(titel, dialog.note.id)}
          onClose={() => setDialog({ kind: 'none' })}
          onConfirm={(title) =>
            void guard(async () => {
              const campaignId = activeCampaignId;
              if (!campaignId) return;
              // Umbenennen zieht die [[Links]] in der ganzen Kampagne mit —
              // das macht der Vault, nicht die Oberflaeche.
              const alterTitel = dialog.note.title;
              const ergebnis = await call(api.notes.rename(campaignId, dialog.note.id, title));
              const neuerTitel = ergebnis.note.title;
              const list = await reloadNotes(campaignId);
              // Die beiseitegelegten Entwuerfe erreicht der Vault nicht; ohne
              // das schrieb ein spaeter gespeicherter Entwurf den alten Namen
              // zurueck (Testbericht).
              zieheEntwuerfeNach(campaignId, alterTitel, neuerTitel);
              /*
               * Und die offene Notiz. Ungespeicherter Text bleibt stehen und
               * bekommt nur Titel und Links nachgezogen — vorher ersetzte der
               * Plattenstand den Entwurf, und „Neu" war nach Strg+S weg.
               * Ohne Aenderungen kommt der Plattenstand, denn dort wurden die
               * Links schon mitgezogen.
               */
              const offen = draftRef.current;
              if (offen) {
                if (dirtyRef.current) {
                  const body = rewriteWikiLinks(offen.body, alterTitel, neuerTitel);
                  const titel = offen.id === dialog.note.id ? neuerTitel : offen.title;
                  if (body !== offen.body || titel !== offen.title) setDraft({ ...offen, title: titel, body });
                  if (body !== offen.body) setReloadKey((vorher) => vorher + 1);
                } else {
                  const frisch = list.find((eintrag) => eintrag.id === offen.id);
                  if (frisch && (frisch.body !== offen.body || frisch.title !== offen.title)) {
                    setDraft(frisch);
                    if (frisch.body !== offen.body) setReloadKey((vorher) => vorher + 1);
                  }
                }
              }
              if (ergebnis.rewritten > 0) {
                report(
                  ergebnis.rewritten === 1 ? t('msg.renamedOne') : t('msg.renamed', { count: ergebnis.rewritten })
                );
              }
              setDialog({ kind: 'none' });
            })
          }
        />
      ) : null}

      {dialog.kind === 'deleteNote' ? (
        <ConfirmDialog
          title={t('dialog.deleteNote')}
          message={
            t('dialog.deleteNoteText', { title: dialog.note.title }) +
            (verweiseAuf(dialog.note) ? ` ${t('dialog.deleteNoteLinked', { count: verweiseAuf(dialog.note) })}` : '')
          }
          onClose={() => setDialog({ kind: 'none' })}
          onConfirm={() =>
            void guard(async () => {
              const campaignId = activeCampaignId;
              if (!campaignId) return;
              await call(api.notes.remove(campaignId, dialog.note.id));
              // Auch der beiseitegelegte Entwurf muss weg, sonst schrieb ihn
              // „Speichern" spaeter wieder auf die Platte (Testbericht).
              loescheEntwurf(dialog.note.id);
              const geloescht = dialog.note;
              const list = await reloadNotes(campaignId);
              setMessage({
                text: t('msg.noteDeleted', { title: geloescht.title || t('list.untitled') }),
                tone: 'info',
                aktion: {
                  label: t('msg.undo'),
                  run: () =>
                    void guard(async () => {
                      const zurueck = await call(api.notes.restore(campaignId, geloescht.id));
                      await reloadNotes(campaignId);
                      if (activeCampaignIdRef.current === campaignId) {
                        setDraft(zurueck);
                        setDirty(false);
                      }
                    })
                }
              });
              // Die offene Notiz bleibt, wenn eine andere geloescht wurde.
              const offen = draftRef.current;
              if (!offen || offen.id === dialog.note.id) {
                setDraft(list[0] ?? null);
                setDirty(false);
              }
              setDialog({ kind: 'none' });
            })
          }
        />
      ) : null}
    </div>
    </AssistantProvider>
  );
}

interface NewNoteDialogProps {
  types: NoteTypeDef[];
  warnung?: (value: string) => string | null;
  initialType: NoteType;
  initialTitle: string;
  onConfirm: (type: NoteType, title: string) => void;
  onClose: () => void;
}

/** Titel und Typ in einem Schritt, damit ein offener [[Link]] direkt zur Notiz wird. */
function NewNoteDialog({ types, initialType, initialTitle, warnung, onConfirm, onClose }: NewNoteDialogProps) {
  const t = useT();
  const [type, setType] = useState<NoteType>(initialType);

  return (
    <PromptDialog
      title={t('dialog.newNote')}
      label={t('editor.title')}
      confirmLabel={t('dialog.create')}
      initialValue={initialTitle}
      warnung={warnung}
      onClose={onClose}
      onConfirm={(value) => onConfirm(type, value)}
    >
      <label className="field">
        <span className="field__label">{t('dialog.type')}</span>
        <select value={type} onChange={(event) => setType(event.target.value)}>
          {types.map((def) => (
            <option value={def.id} key={def.id}>
              {def.label}
            </option>
          ))}
        </select>
      </label>
    </PromptDialog>
  );
}
