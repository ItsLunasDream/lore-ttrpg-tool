import type { AppSettings, Campaign } from '../../shared/types';
import { useT } from '../i18n';
import { Menu } from './Menu';

interface Props {
  campaigns: Campaign[];
  activeCampaignId: string | null;
  settings: AppSettings;
  graphOpen: boolean;
  /** Wie viele Notizen ungespeicherte Aenderungen haben. 0 blendet die Anzeige aus. */
  ungespeichertAnzahl: number;
  onSelect: (campaignId: string) => void;
  onCreate: () => void;
  onImport: () => void;
  onRename: () => void;
  onDelete: () => void;
  onExport: () => void;
  onExportMarkdown: () => void;
  onExportPdf: () => void;
  onEditNoteTypes: () => void;
  onCleanup: () => void;
  onToggleGraph: () => void;
  onOpenHelp: () => void;
  onOpenAbout: () => void;
  /**
   * `null`, wenn eine Huelle die Einstellungen fuehrt: dann steht der Knopf
   * dort und hier gar nicht.
   */
  onOpenSettings: (() => void) | null;
}

/**
 * Kopfzeile. Die Aktionen einer Kampagne stecken in einem Klappmenue: als
 * einzelne Knoepfe waren es so viele, dass die Zeile umbrach und nichts mehr
 * zu finden war.
 */
export function CampaignBar(props: Props) {
  const t = useT();
  const { campaigns, activeCampaignId, settings } = props;
  const noCampaign = !activeCampaignId;

  return (
    <header className="campaign-bar">
      <span className="campaign-bar__brand">Story Creator</span>

      {/* Ein eigenes Menue statt einer Auswahlliste des Systems: nur so
          steht das Anlegen dort, wo man es sucht — unten in der offenen
          Liste, neben den vorhandenen Kampagnen. */}
      <div className="campaign-bar__picker">
        <Menu
          label={campaigns.find((campaign) => campaign.id === activeCampaignId)?.name ?? t('bar.chooseCampaign')}
          entries={[
            ...campaigns.map((campaign) => ({
              label: campaign.name,
              active: campaign.id === activeCampaignId,
              onSelect: () => props.onSelect(campaign.id)
            })),
            { label: t('bar.newCampaign'), onSelect: props.onCreate, separated: campaigns.length > 0 }
          ]}
        />
      </div>

      <Menu
        label={t('bar.campaign')}
        entries={[
          { label: t('bar.newCampaign'), onSelect: props.onCreate },
          { label: t('bar.rename'), onSelect: props.onRename, disabled: noCampaign },
          { label: t('bar.noteTypes'), onSelect: props.onEditNoteTypes, disabled: noCampaign, separated: true },
          { label: t('cleanup.open'), onSelect: props.onCleanup, disabled: noCampaign },
          { label: t('bar.exportZip'), onSelect: props.onExport, disabled: noCampaign, separated: true },
          // Der Weg zurueck steht neben dem hin. Eine Sicherung, die man nur
          // von Hand zurueckspielen kann, ist keine.
          { label: t('bar.importZip'), onSelect: props.onImport },
          { label: t('export.markdownCampaign'), onSelect: props.onExportMarkdown, disabled: noCampaign },
          { label: t('export.pdfCampaign'), onSelect: props.onExportPdf, disabled: noCampaign },
          {
            label: t('bar.deleteCampaign'),
            onSelect: props.onDelete,
            disabled: noCampaign,
            danger: true,
            separated: true
          }
        ]}
      />

      <button
        type="button"
        className={props.graphOpen ? 'is-active' : undefined}
        data-graph-knopf
        onClick={props.onToggleGraph}
        disabled={noCampaign}
      >
        {t('graph.open')}
      </button>

      <span className="campaign-bar__spacer" />

      <span className="campaign-bar__autosave">
        {t(settings.autosaveEnabled ? 'bar.autosaveOn' : 'bar.autosaveOff')}
      </span>
      {/* Ohne Autosave koennen mehrere Notizen gleichzeitig ungespeichert
          sein. Diese Zahl ist die einzige Stelle, die das auf einen Blick
          sagt — in der Liste sieht man nur, was gerade sichtbar ist. */}
      {props.ungespeichertAnzahl > 0 ? (
        <span className="campaign-bar__ungespeichert">
          {t('bar.unsavedCount', { count: props.ungespeichertAnzahl })}
        </span>
      ) : null}
      <button type="button" onClick={props.onOpenHelp}>
        {t('bar.help')}
      </button>
      <button type="button" onClick={props.onOpenAbout}>
        {t('bar.about')}
      </button>
      {props.onOpenSettings ? (
        <button type="button" onClick={props.onOpenSettings}>
          {t('bar.settings')}
        </button>
      ) : null}
    </header>
  );
}
