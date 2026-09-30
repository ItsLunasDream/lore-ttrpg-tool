// Sammelpunkt fuer die Tests: buendelt die reinen Logikmodule ohne Electron.
export { findeUebernahme } from '../src/main/uebernahme';
export { harmloserPfad, ohneWurzel, leseArchiv } from '../src/main/einlesen';
export { anker, nachNamen, verlinkeImDokument } from '../src/main/pdfVerweise';
export { zeichneGraph } from '../src/main/graphBild';
export { abschnitt, hatInhalt, ueberschriften, versteckteBloecke } from '../src/shared/abschnitte';
export { zieheUmbenennungNach, effektiverStand } from '../src/renderer/entwuerfe';
export { findWikiLinks, rewriteWikiLinks, normalizeName, insideWikiLink } from '../src/shared/wikilinks';
export { leseAntwort, leseStuecke } from '../src/shared/antwortMarkdown';
export { leseBreite, istAnteil, breiteAlsAttribute, breiteAusAttributen } from '../src/shared/bildbreite';
export { verlinkteNotizen, KONTEXT_HOECHSTENS } from '../src/shared/kiKontext';
export { begrenzeZoom, naechsteZoomstufe, ZOOM_MIN, ZOOM_MAX, ZOOM_NORMAL, ZOOM_STUFEN } from '../src/shared/zoom';
export {
  DEFAULT_NOTE_TYPES,
  NOTIZTYP_VORLAGEN,
  vorlageNotiztypen,
  findNoteType,
  fieldLabel,
  toKey,
  factoryFieldKey,
  finalizeNewEntries,
  mergeNoteTypes,
  countMergeChanges
} from '../src/shared/noteTypes';
export { translate, isLanguage, LANGUAGES, MESSAGE_KEYS, DEFAULT_LANGUAGE } from '../src/shared/i18n';
export { parseFrontmatter, stringifyFrontmatter } from '../src/main/frontmatter';
export {
  countWords,
  markdownToHtml,
  pastedMarkdownToHtml,
  htmlToMarkdown,
  textPreview,
  stripMarkdown
} from '../src/renderer/editor/markdown';
export { assetUrl, assetPath } from '../src/renderer/editor/assets';
export {
  buildIndex,
  backlinksFor,
  unresolvedLinks,
  filterNotes,
  searchNotes,
  findOccurrences
} from '../src/renderer/noteIndex';
export { Vault } from '../src/main/vault';
export { zipDirectory } from '../src/main/export';
export { systemPrompt, userPrompt } from '../src/main/ai/prompts';
export { renderNoteMarkdown, referencedAssets, toFileName, aliasKopf } from '../src/main/markdownExport';
export { defaultPrompts } from '../src/shared/writingPrompts';
export { layoutGraph } from '../src/renderer/graph/layout';
export { buildGraphEdges, buildGraphNodes } from '../src/renderer/graph/build';
export { CHANNEL_PREFIX, channel } from '../src/shared/channels';
export { istAnbieterId } from '@suite/ki';

export { kiAbgeschaltet } from '../src/renderer/components/AssistantThread';
export { beispieltext } from '../src/shared/noteTypes';
export { zeitSchluessel, vergleicheZeit } from '../src/shared/zeitstrahl';
export { erkenneSprachen } from '../src/shared/spracherkennung';
export { bereinigeStraenge, ordneStraenge } from '../src/shared/straenge';
