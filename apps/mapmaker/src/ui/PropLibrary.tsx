/** Prop-Palette mit Kategorien, Suche und Mehrfachauswahl für den Pinsel. */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CATEGORY_ORDER,
  categoryLabel,
  onLibraryChange,
  propName,
  getProp,
  searchProps,
  type PropCategory,
  type PropDef,
} from '@/assets/library';
import { tagLabel, tagWords } from '@/assets/propTags';
import {
  allPropGroups,
  createPropGroup,
  getPropGroup,
  onPropGroupsChange,
  removePropGroup,
  renamePropGroup,
  setPropGroupMembership,
} from '@/assets/propGroupStore';
import { useEditor } from '@/model/store';
import { useT } from '@/i18n/useT';
import { getThumbnail } from './propThumbnail';
import { Section } from './controls';
import { AssetImport } from './AssetImport';
import { alsKnopf } from '@suite/tastatur';

export function PropLibrary({ rendererReady }: { rendererReady: boolean }) {
  const { t, language } = useT();
  // 'fav' und 'recent' sind keine echten Kategorien, sondern Sichten darauf.
  const [category, setCategory] = useState<PropCategory | 'all' | 'fav' | 'recent'>('all');
  const [query, setQuery] = useState('');
  const [libRev, setLibRev] = useState(0);

  // Eigene Gruppen: welche wird gerade betrachtet, welche gerade befüllt.
  // Getrennt, weil man beim Zuordnen durch die ganze Bibliothek stöbern will —
  // nicht nur durch das, was schon in der Gruppe steckt.
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [assignGroupId, setAssignGroupId] = useState<string | null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [renamingGroup, setRenamingGroup] = useState<string | null>(null);
  const [groupRev, setGroupRev] = useState(0);

  const tool = useEditor((s) => s.tool);
  const activePropId = useEditor((s) => s.activePropId);
  const setActiveProp = useEditor((s) => s.setActiveProp);
  const setTool = useEditor((s) => s.setTool);
  const brush = useEditor((s) => s.brush);
  const patchBrush = useEditor((s) => s.patchBrush);

  const favouriteProps = useEditor((s) => s.favouriteProps);
  const recentProps = useEditor((s) => s.recentProps);
  const toggleFavourite = useEditor((s) => s.toggleFavouriteProp);

  useEffect(() => onLibraryChange(() => setLibRev((r) => r + 1)), []);
  useEffect(() => onPropGroupsChange(() => setGroupRev((r) => r + 1)), []);
  const groups = allPropGroups();
  void groupRev;

  // language mitführen: bei einem Sprachwechsel ändern sich Namen und damit
  // auch die Suchtreffer.
  const props = useMemo(() => {
    if (activeGroupId) {
      const ids = getPropGroup(activeGroupId)?.propIds ?? [];
      const q = query.trim().toLowerCase();
      return ids
        .map((id) => getProp(id))
        .filter((p): p is PropDef => !!p)
        .filter(
          (p) =>
            !q ||
            propName(p).toLowerCase().includes(q) ||
            p.tags.some((tg) => tagWords(tg).some((w) => w.toLowerCase().includes(q))),
        );
    }
    if (category === 'fav' || category === 'recent') {
      const ids = category === 'fav' ? favouriteProps : recentProps;
      // Reihenfolge der Liste beibehalten: bei „zuletzt benutzt" ist gerade
      // sie die Information.
      const q = query.trim().toLowerCase();
      return ids
        .map((id) => getProp(id))
        .filter((p): p is PropDef => !!p)
        .filter(
          (p) =>
            !q ||
            propName(p).toLowerCase().includes(q) ||
            p.tags.some((tg) => tagWords(tg).some((w) => w.toLowerCase().includes(q))),
        );
    }
    return searchProps(query, category);
  }, [query, category, activeGroupId, libRev, groupRev, language, favouriteProps, recentProps]);

  const categories = useMemo(() => {
    const used = new Set(searchProps('', 'all').map((p) => p.category));
    return CATEGORY_ORDER.filter((c) => used.has(c));
  }, [libRev]);

  /** Zu einer festen Kategorie/Sicht wechseln — verlässt dabei eine offene Gruppen-Ansicht. */
  const pickCategory = (c: PropCategory | 'all' | 'fav' | 'recent') => {
    setCategory(c);
    setActiveGroupId(null);
  };

  /**
   * Zuordnungsmodus starten — verlässt dabei eine offene Gruppen-Ansicht.
   *
   * Sonst zeigte die Palette beim Zuordnen weiter nur die (anfangs leere)
   * Gruppe selbst: nichts zum Anklicken. Die aktuelle Kategorie bleibt
   * bestehen — man will die ganze Bibliothek durchstöbern können, nicht nur
   * „Alle".
   */
  const beginAssign = (id: string) => {
    setAssignGroupId(id);
    setActiveGroupId(null);
  };

  const brushMode = tool === 'brush';
  const selectedForBrush = new Set(brush.propIds);
  const assignedIds = assignGroupId ? new Set(getPropGroup(assignGroupId)?.propIds ?? []) : null;

  const onPick = (def: PropDef, additive: boolean) => {
    // Im Zuordnungsmodus setzt ein Klick nur die Gruppenmitgliedschaft — er
    // wählt das Prop nicht aus und setzt kein Werkzeug. Sonst würde man beim
    // Zusammenstellen einer Gruppe ständig aus Versehen das Pinsel-Werkzeug
    // aktivieren.
    if (assignGroupId) {
      const drin = getPropGroup(assignGroupId)?.propIds.includes(def.id) ?? false;
      setPropGroupMembership(assignGroupId, def.id, !drin);
      return;
    }

    setActiveProp(def.id);

    if (!brushMode) {
      // Ein Prop auszuwählen heißt, es platzieren zu wollen. Ohne den Wechsel
      // klickt man auf die Karte und nichts passiert.
      if (tool !== 'prop') setTool('prop');
      return;
    }

    // Im Pinselmodus sammelt Strg/Shift mehrere Props für die Zufallsauswahl.
    if (additive) {
      // Frisch aus dem Store lesen statt aus der Render-Closure: zwei schnelle
      // Klicks hintereinander sähen sonst beide denselben alten Stand und der
      // zweite überschriebe den ersten.
      const current = useEditor.getState().brush.propIds;
      const next = current.includes(def.id)
        ? current.filter((id) => id !== def.id)
        : [...current, def.id];
      patchBrush({ propIds: next, weights: next.map(() => 1) });
    } else {
      patchBrush({ propIds: [def.id], weights: [1] });
    }
  };

  return (
    <Section title={t('props.title')}>
      <input
        type="text"
        placeholder={t('props.search')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="tabs">
        <button className={!activeGroupId && category === 'all' ? 'active' : ''} onClick={() => pickCategory('all')}>
          {t('props.all')}
        </button>
        {favouriteProps.length > 0 ? (
          <button
            className={!activeGroupId && category === 'fav' ? 'active' : ''}
            onClick={() => pickCategory('fav')}
            title={t('props.favouritesHint')}
          >
            ★ {favouriteProps.length}
          </button>
        ) : null}
        {recentProps.length > 0 ? (
          <button
            className={!activeGroupId && category === 'recent' ? 'active' : ''}
            onClick={() => pickCategory('recent')}
          >
            {t('props.recent')}
          </button>
        ) : null}
        {groups.map((g) => (
          <button
            key={g.id}
            className={activeGroupId === g.id ? 'active' : ''}
            onClick={() => setActiveGroupId(g.id)}
            title={g.name}
          >
            {g.name} ({g.propIds.length})
          </button>
        ))}
        {categories.map((c) => (
          <button
            key={c}
            className={!activeGroupId && category === c ? 'active' : ''}
            onClick={() => pickCategory(c)}
          >
            {categoryLabel(c)}
          </button>
        ))}
      </div>

      {brushMode ? <p className="hint">{t('props.brushHint')}</p> : null}
      {assignGroupId ? (
        <p className="hint">
          {t('propGroups.assignHint', { name: getPropGroup(assignGroupId)?.name ?? '' })}{' '}
          <button className="ghost" onClick={() => setAssignGroupId(null)}>
            {t('propGroups.assignDone')}
          </button>
        </p>
      ) : null}

      <details className="import-box">
        <summary>{t('propGroups.title')}</summary>
        <div className="row-inline">
          <input
            value={newGroupName}
            placeholder={t('propGroups.namePlaceholder')}
            onChange={(e) => setNewGroupName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !newGroupName.trim()) return;
              const g = createPropGroup(newGroupName.trim());
              setNewGroupName('');
              beginAssign(g.id);
            }}
          />
          <button
            disabled={!newGroupName.trim()}
            onClick={() => {
              const g = createPropGroup(newGroupName.trim());
              setNewGroupName('');
              // Gleich in den Zuordnungsmodus: eine frisch angelegte Gruppe
              // ist leer, und „leer ansehen" ist kein sinnvoller nächster
              // Schritt — Props anklicken schon.
              beginAssign(g.id);
            }}
          >
            {t('propGroups.create')}
          </button>
        </div>

        {groups.length === 0 ? (
          <p className="hint">{t('propGroups.empty')}</p>
        ) : (
          <ul className="stamp-list">
            {groups.map((g) => (
              <li key={g.id} className={activeGroupId === g.id ? 'active' : ''}>
                {renamingGroup === g.id ? (
                  <input
                    autoFocus
                    defaultValue={g.name}
                    onBlur={(e) => {
                      renamePropGroup(g.id, e.target.value.trim() || g.name);
                      setRenamingGroup(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') e.currentTarget.blur();
                      if (e.key === 'Escape') setRenamingGroup(null);
                    }}
                  />
                ) : (
                  <button className="stamp-pick" onClick={() => setActiveGroupId(g.id)}>
                    <span className="stamp-name">{g.name}</span>
                    <span className="value">{g.propIds.length}</span>
                  </button>
                )}
                <button
                  className={`ghost icon${assignGroupId === g.id ? ' on' : ''}`}
                  title={assignGroupId === g.id ? t('propGroups.assignDone') : t('propGroups.assign')}
                  onClick={() => (assignGroupId === g.id ? setAssignGroupId(null) : beginAssign(g.id))}
                >
                  {assignGroupId === g.id ? '✓' : '+'}
                </button>
                <button
                  className="ghost icon"
                  title={t('propGroups.rename')}
                  onClick={() => setRenamingGroup(g.id)}
                >
                  ✎
                </button>
                <button
                  className="ghost icon"
                  title={t('propGroups.delete')}
                  onClick={() => {
                    if (!window.confirm(t('propGroups.confirmDelete', { name: g.name }))) return;
                    removePropGroup(g.id);
                    if (activeGroupId === g.id) setActiveGroupId(null);
                    if (assignGroupId === g.id) setAssignGroupId(null);
                  }}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="import-box">
        <summary>{t('import.title')}</summary>
        <AssetImport />
      </details>

      {props.length === 0 ? (
        <div className="empty">{activeGroupId ? t('propGroups.viewEmpty') : t('props.none')}</div>
      ) : (
        <div className="prop-grid" data-pfeile="raster">
          {props.map((def) => (
            <PropCard
              key={def.id}
              def={def}
              rendererReady={rendererReady}
              active={brushMode ? selectedForBrush.has(def.id) : def.id === activePropId}
              onPick={(additive) => onPick(def, additive)}
              favourite={favouriteProps.includes(def.id)}
              onToggleFavourite={() => toggleFavourite(def.id)}
              pinLabel={t('props.pin')}
              unpinLabel={t('props.unpin')}
              assigning={assignedIds !== null}
              inGroup={assignedIds?.has(def.id) ?? false}
            />
          ))}
        </div>
      )}
    </Section>
  );
}

function PropCard({
  def,
  active,
  rendererReady,
  onPick,
  favourite,
  onToggleFavourite,
  pinLabel,
  unpinLabel,
  assigning,
  inGroup,
}: {
  def: PropDef;
  active: boolean;
  rendererReady: boolean;
  onPick: (additive: boolean) => void;
  favourite: boolean;
  onToggleFavourite: () => void;
  pinLabel: string;
  unpinLabel: string;
  /** Zuordnungsmodus einer Gruppe aktiv — dann zeigt die Karte, ob sie schon drin steckt. */
  assigning: boolean;
  inGroup: boolean;
}) {
  const holder = useRef<HTMLDivElement>(null);

  /**
   * Das Vorschaubild entsteht erst, wenn die Karte sichtbar wird.
   *
   * Ein Bild zu bauen heißt, das Prop zu zeichnen und die Pixel von der
   * Grafikkarte zurückzulesen — knapp zwei Millisekunden je Prop, und die
   * Palette hält weit über hundert. Beim Start ging so eine knappe Drittel
   * Sekunde am Stück dafür drauf, für Karten, die zum größten Teil weit
   * unterhalb des sichtbaren Bereichs lagen. Sichtbar sind auf einmal etwa
   * ein Dutzend.
   *
   * `rootMargin` gibt einen Vorlauf: wer scrollt, soll keine leeren Kästchen
   * sehen, sondern fertige Bilder.
   */
  useEffect(() => {
    const el = holder.current;
    if (!el || !rendererReady) return;

    const bauen = () => {
      if (def.textureUrl) {
        const img = new Image();
        img.src = def.textureUrl;
        el.replaceChildren(img);
        return;
      }
      const canvas = getThumbnail(def);
      if (canvas) {
        // Das Canvas kommt aus dem Cache und darf nur an einer Stelle hängen —
        // darum ein Klon je Karte statt des Originals.
        const clone = canvas.cloneNode() as HTMLCanvasElement;
        const ctx = clone.getContext('2d');
        ctx?.drawImage(canvas, 0, 0);
        el.replaceChildren(clone);
      }
    };

    // Ohne IntersectionObserver — ältere Umgebungen, Tests — bleibt es beim
    // sofortigen Bauen. Ein Prop ohne Bild wäre schlimmer als ein langsamer
    // Start.
    if (typeof IntersectionObserver !== 'function') {
      bauen();
      return;
    }

    const beobachter = new IntersectionObserver(
      (eintraege) => {
        if (!eintraege.some((e) => e.isIntersecting)) return;
        beobachter.disconnect();
        bauen();
      },
      { rootMargin: '200px' },
    );
    beobachter.observe(el);
    return () => beobachter.disconnect();
  }, [def, rendererReady]);

  return (
    <div
      className={`prop-card${active ? ' active' : ''}`}
      title={`${propName(def)}${def.tags.length ? ` · ${def.tags.map(tagLabel).join(', ')}` : ''}`}
      onClick={(e) => onPick(e.ctrlKey || e.metaKey || e.shiftKey)}
      {...alsKnopf(() => onPick(false))}
      data-pfeil
      aria-label={propName(def)}
      aria-pressed={active}
    >
      <div ref={holder} style={{ width: 46, height: 46 }} />
      <span className="label">{propName(def)}</span>
      {assigning ? (
        <span className={`ingroup-badge${inGroup ? ' on' : ''}`}>{inGroup ? '✓' : '+'}</span>
      ) : null}
      <button
        className={`fav${favourite ? ' on' : ''}`}
        title={favourite ? unpinLabel : pinLabel}
        onClick={(e) => {
          // Sonst wählte der Klick zugleich das Prop aus.
          e.stopPropagation();
          onToggleFavourite();
        }}
      >
        {favourite ? '★' : '☆'}
      </button>
    </div>
  );
}
