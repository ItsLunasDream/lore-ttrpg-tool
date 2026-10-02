/**
 * Mehrere Karten in einer Datei (model/mappe.ts, io/project.ts, Store).
 *
 * Geprüft wird, was beim Etagen-Verlies schiefgehen kann: eine Karte geht
 * beim Speichern oder beim Herstellen einer Fassung verloren, Rückgängig
 * springt in die falsche Karte, ein Verweis zeigt nach dem Entfernen ins
 * Leere, und das Wechseln allein macht die Datei „ungespeichert".
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { documentFromVersion, historyFrom, packMappe, packProject, unpackProject } from '@/io/project';
import { createDocument } from '@/model/document';
import { AddVttItems } from '@/model/commands';
import { eindeutigeIds, freierKartenName } from '@/model/mappe';
import { useEditor } from '@/model/store';
import type { MapDocument, MapNote } from '@/model/types';

function karte(name: string): MapDocument {
  const doc = createDocument(12, 8, name);
  doc.meta.name = name;
  return doc;
}

function notiz(id: string, zielKarte?: string): MapNote {
  return { id, x: 50, y: 50, title: id, text: '', icon: 'door', size: 1, color: 0xffffff, playerVisible: false, ...(zielKarte ? { zielKarte } : {}) };
}

describe('Projektdatei mit mehreren Karten', () => {
  it('speichert alle Karten, Reihenfolge und die offene, und liest sie zurück', () => {
    const oben = karte('Erdgeschoss');
    const unten = karte('Keller');
    oben.vtt.notes.push(notiz('treppe', unten.meta.id));
    const { bundle, report } = unpackProject(packMappe([oben, unten], 1));
    expect(report.warnings).toEqual([]);
    expect(bundle.karten.map((k) => k.meta.name)).toEqual(['Erdgeschoss', 'Keller']);
    expect(bundle.aktiv).toBe(1);
    expect(bundle.doc.meta.name).toBe('Erdgeschoss');
    expect(bundle.karten[0].vtt.notes[0].zielKarte).toBe(bundle.karten[1].meta.id);
  });

  it('eine Datei mit einer Karte bleibt wie bisher (kein maps/, kein karten im Manifest)', () => {
    const { bundle } = unpackProject(packProject(karte('Allein')));
    expect(bundle.karten).toHaveLength(1);
    expect(bundle.manifest.karten).toBeUndefined();
  });

  it('eine Fassung enthält alle Karten, nicht nur die erste', () => {
    const erst = packMappe([karte('A1'), karte('A2')], 0);
    const zweit = packMappe([karte('B1'), karte('B2')], 0, new Map(), undefined, new Map(), historyFrom(erst));
    const { bundle } = unpackProject(zweit);
    const alt = documentFromVersion(bundle.versions[0].data);
    expect(alt.karten.map((k) => k.meta.name)).toEqual(['A1', 'A2']);
  });

  it('gleiche Kennungen werden eindeutig gemacht', () => {
    const a = karte('A');
    const b = karte('B');
    b.meta.id = a.meta.id;
    eindeutigeIds([a, b]);
    expect(a.meta.id).not.toBe(b.meta.id);
  });

  it('freie Namen doppeln keinen vorhandenen', () => {
    expect(freierKartenName([karte('Etage 2'), karte('X')], 'Etage')).toBe('Etage 3');
  });
});

describe('Karten im Editor', () => {
  beforeEach(() => {
    useEditor.getState().ladeMappe([karte('Erdgeschoss'), karte('Keller')], 0);
    useEditor.getState().setLastSavedRev(useEditor.getState().rev);
  });

  it('Wechseln ist keine Änderung an der Datei', () => {
    useEditor.getState().wechsleKarte(1);
    const s = useEditor.getState();
    expect(s.doc.meta.name).toBe('Keller');
    expect(s.doc).toBe(s.karten[1]);
    expect(s.rev).toBe(s.lastSavedRev);
  });

  it('jede Karte hat ihren eigenen Rückgängig-Verlauf', () => {
    const st = () => useEditor.getState();
    st().exec(new AddVttItems('notes', [notiz('oben')], 'Notiz'));
    st().wechsleKarte(1);
    // Im Keller gibt es nichts rückgängig zu machen; die Notiz oben bleibt.
    st().undo();
    expect(st().karten[0].vtt.notes.map((n) => n.id)).toEqual(['oben']);
    st().wechsleKarte(0);
    st().undo();
    expect(st().karten[0].vtt.notes).toEqual([]);
  });

  it('neue Karte: gleiche Größe, wird geöffnet, die Datei gilt als geändert', () => {
    useEditor.getState().neueKarte('Etage 3');
    const s = useEditor.getState();
    expect(s.karten).toHaveLength(3);
    expect(s.aktiveKarte).toBe(2);
    expect(s.doc.size).toEqual({ cols: 12, rows: 8 });
    expect(s.rev).not.toBe(s.lastSavedRev);
  });

  it('Entfernen nimmt die Verweise auf die Karte mit und öffnet die Nachbarin', () => {
    const st = () => useEditor.getState();
    const kellerId = st().karten[1].meta.id;
    st().karten[0].vtt.notes.push(notiz('treppe', kellerId));
    st().wechsleKarte(1);
    st().entferneKarte(1);
    expect(st().karten.map((k) => k.meta.name)).toEqual(['Erdgeschoss']);
    expect(st().doc.meta.name).toBe('Erdgeschoss');
    expect(st().karten[0].vtt.notes[0].zielKarte).toBeUndefined();
    // Die letzte Karte bleibt.
    st().entferneKarte(0);
    expect(st().karten).toHaveLength(1);
  });

  it('Umbenennen ändert den Namen und markiert die Datei', () => {
    useEditor.getState().benenneKarte(1, 'Gruft');
    const s = useEditor.getState();
    expect(s.karten[1].meta.name).toBe('Gruft');
    expect(s.rev).not.toBe(s.lastSavedRev);
  });
});
