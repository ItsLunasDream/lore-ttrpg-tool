/**
 * Die vier Muster als Material.
 *
 * Die Verlaeufe der flachen Darstellung lassen sich nicht uebernehmen — dort
 * sind es SVG-Verlaeufe, hier braucht es Oberflaechen mit Licht. Die Wirkung
 * soll dieselbe sein: schlicht, Metall, Marmor, Sternenhimmel, und alle vier
 * leiten sich aus der einen gewaehlten Farbe ab. Sonst waere die freie
 * Farbwahl nur beim schlichten Muster wirksam.
 */
import { CanvasTexture, Color, MeshPhysicalMaterial, MeshStandardMaterial, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Muster } from '../../shared/einstellungen';

/** Muster, die eine Umgebung spiegeln (Buehne3d haengt sie nur an diese). */
export const GLAENZEND: ReadonlySet<Muster> = new Set<Muster>(['metall', 'lack', 'perlmutt', 'kristall']);

/** Kantenlaenge der gemalten Texturen. */
const BILD = 256;

function leinwand(): { flaeche: HTMLCanvasElement; stift: CanvasRenderingContext2D } {
  const flaeche = document.createElement('canvas');
  flaeche.width = BILD;
  flaeche.height = BILD;
  const stift = flaeche.getContext('2d');
  if (!stift) throw new Error('kein 2D-Kontext fuer das Muster');
  return { flaeche, stift };
}

/** Adern fuer den Marmor, gemalt statt gerechnet. */
function marmorTextur(farbe: string): CanvasTexture {
  const { flaeche, stift } = leinwand();
  stift.fillStyle = farbe;
  stift.fillRect(0, 0, BILD, BILD);

  stift.strokeStyle = 'rgba(255,255,255,0.42)';
  stift.lineCap = 'round';
  // Feste Adern statt zufaelliger: bei zwanzig Wuerfeln waeren zwanzig
  // verschiedene Maserungen unruhig, und gerechnet wuerde bei jedem Wurf neu.
  const adern: [number, number, number, number, number, number, number][] = [
    [10, 150, 80, 110, 150, 170, 4],
    [60, 30, 120, 90, 200, 60, 2],
    [30, 220, 110, 180, 210, 230, 2.5],
    [140, 10, 190, 80, 250, 40, 1.5]
  ];
  for (const [x1, y1, cx, cy, x2, y2, breite] of adern) {
    stift.lineWidth = breite;
    stift.beginPath();
    stift.moveTo(x1, y1);
    stift.quadraticCurveTo(cx, cy, x2, y2);
    stift.stroke();
  }

  const textur = new CanvasTexture(flaeche);
  textur.wrapS = RepeatWrapping;
  textur.wrapT = RepeatWrapping;
  // Gemalt in sRGB: ohne das wirkten die Farben grau und ausgewaschen.
  textur.colorSpace = SRGBColorSpace;
  return textur;
}

/**
 * Sterne fuer den Sternenhimmel, auf dunklem Grund.
 *
 * Der Grund ist dunkel und die gewaehlte Farbe liegt nur als Schimmer darin.
 * Ein erster Anlauf ging von der Farbe aus und wurde erst am Rand dunkel; auf
 * den Koerpern blieb davon ein flaechiges Hellblau ohne erkennbaren Himmel,
 * weil jede Flaeche nur einen kleinen Ausschnitt der Textur zeigt.
 */
function sternenTextur(farbe: string): CanvasTexture {
  const { flaeche, stift } = leinwand();
  stift.fillStyle = '#05060a';
  stift.fillRect(0, 0, BILD, BILD);

  // Ein paar farbige Schwaden, damit die gewaehlte Farbe sichtbar bleibt.
  for (const [x, y, r] of [
    [70, 80, 90],
    [190, 170, 110],
    [40, 210, 70]
  ] as [number, number, number][]) {
    const schwade = stift.createRadialGradient(x, y, 2, x, y, r);
    schwade.addColorStop(0, farbe);
    schwade.addColorStop(1, 'transparent');
    stift.globalAlpha = 0.5;
    stift.fillStyle = schwade;
    stift.fillRect(0, 0, BILD, BILD);
  }
  stift.globalAlpha = 1;

  // Mehr und kleinere Sterne als zuerst: eine Wuerfelflaeche zeigt nur einen
  // Ausschnitt, und bei acht Sternen auf der ganzen Textur traf sie oft
  // keinen einzigen.
  stift.fillStyle = '#ffffff';
  const sterne: [number, number, number][] = [];
  // Feste Stellen aus einer einfachen Folge statt Zufall: die Textur wird bei
  // jedem Farbwechsel neu gemalt, und ein wanderndes Sternbild waere unruhig.
  let zahl = 7;
  for (let i = 0; i < 60; i++) {
    zahl = (zahl * 1103515245 + 12345) % 2147483648;
    const x = (zahl / 2147483648) * BILD;
    zahl = (zahl * 1103515245 + 12345) % 2147483648;
    const y = (zahl / 2147483648) * BILD;
    zahl = (zahl * 1103515245 + 12345) % 2147483648;
    sterne.push([x, y, 0.8 + (zahl / 2147483648) * 1.8]);
  }
  for (const [x, y, r] of sterne) {
    stift.beginPath();
    stift.arc(x, y, r, 0, Math.PI * 2);
    stift.fill();
  }

  const textur = new CanvasTexture(flaeche);
  textur.wrapS = RepeatWrapping;
  textur.wrapT = RepeatWrapping;
  // Gemalt in sRGB: ohne das wirkten die Farben grau und ausgewaschen.
  textur.colorSpace = SRGBColorSpace;
  return textur;
}

/** Feine Striche fuer gebuerstetes Metall, als Rauheit (hell = rau). */
function buerstTextur(): CanvasTexture {
  const { flaeche, stift } = leinwand();
  stift.fillStyle = '#6e6e6e';
  stift.fillRect(0, 0, BILD, BILD);
  let zahl = 11;
  for (let i = 0; i < 220; i++) {
    zahl = (zahl * 1103515245 + 12345) % 2147483648;
    const y = (zahl / 2147483648) * BILD;
    const hell = 90 + ((zahl >> 8) % 70);
    stift.strokeStyle = `rgb(${hell},${hell},${hell})`;
    stift.lineWidth = 0.6;
    stift.beginPath();
    stift.moveTo(0, y);
    stift.lineTo(BILD, y + ((zahl >> 4) % 5) - 2);
    stift.stroke();
  }
  const textur = new CanvasTexture(flaeche);
  textur.wrapS = RepeatWrapping;
  textur.wrapT = RepeatWrapping;
  return textur;
}

/** Jahresringe in der gewaehlten Farbe, heller und dunkler gemasert. */
function holzTextur(farbe: string): CanvasTexture {
  const { flaeche, stift } = leinwand();
  const grund = new Color(farbe);
  const dunkel = grund.clone().lerp(new Color('#1a0e05'), 0.45);
  const hell = grund.clone().lerp(new Color('#f3dcb2'), 0.25);
  stift.fillStyle = `#${hell.getHexString()}`;
  stift.fillRect(0, 0, BILD, BILD);
  stift.strokeStyle = `#${dunkel.getHexString()}`;
  // Wellige Linien statt Kreisen: ein Wuerfel ist aus einem Brett geschnitten.
  for (let n = 0; n < 26; n++) {
    const y0 = (n / 26) * BILD;
    stift.lineWidth = 1 + (n % 3);
    stift.globalAlpha = 0.35 + (n % 4) * 0.12;
    stift.beginPath();
    for (let x = 0; x <= BILD; x += 8) {
      const y = y0 + Math.sin(x / 37 + n) * 5 + Math.sin(x / 11 + n * 2) * 1.5;
      if (x === 0) stift.moveTo(x, y);
      else stift.lineTo(x, y);
    }
    stift.stroke();
  }
  stift.globalAlpha = 1;
  const textur = new CanvasTexture(flaeche);
  textur.wrapS = RepeatWrapping;
  textur.wrapT = RepeatWrapping;
  // Gemalt in sRGB: ohne das wirkten die Farben grau und ausgewaschen.
  textur.colorSpace = SRGBColorSpace;
  return textur;
}

/**
 * Das Material fuer ein Muster.
 *
 * Wird je Kombination aus Farbe und Muster einmal gebaut und geteilt: bei
 * hundert Wuerfeln waeren hundert eigene hundertmal derselbe Speicher.
 */
export function baueMaterial(muster: Muster, farbe: string): MeshStandardMaterial {
  const grund = new Color(farbe);

  if (muster === 'metall') {
    /*
     * Echtes Metall: fast voll metallisch, leicht gebuerstet. Das geht, seit
     * die Szene eine Umgebung zum Spiegeln hat (Buehne3d); die gewaehlte
     * Farbe faerbt die Spiegelung, wie bei Messing oder Kupfer.
     */
    return new MeshStandardMaterial({
      color: grund,
      metalness: 0.9,
      roughness: 0.3,
      roughnessMap: buerstTextur(),
      envMapIntensity: 1.2,
      flatShading: true
    });
  }

  if (muster === 'lack') {
    // Glaenzender Lack: eine klare Schicht ueber der Farbe.
    return new MeshPhysicalMaterial({
      color: grund,
      metalness: 0,
      roughness: 0.45,
      clearcoat: 1,
      clearcoatRoughness: 0.04,
      envMapIntensity: 0.5,
      flatShading: true
    });
  }

  if (muster === 'perlmutt') {
    // Schillernd: die Farbe wandert mit dem Blickwinkel.
    return new MeshPhysicalMaterial({
      color: grund.clone().lerp(new Color('#ffffff'), 0.2),
      metalness: 0.1,
      envMapIntensity: 0.7,
      roughness: 0.25,
      iridescence: 1,
      iridescenceIOR: 1.35,
      iridescenceThicknessRange: [180, 620],
      clearcoat: 0.6,
      sheen: 0.6,
      sheenColor: grund,
      flatShading: true
    });
  }

  if (muster === 'kristall') {
    // Durchscheinend wie geschliffenes Glas, in der gewaehlten Farbe getoent.
    return new MeshPhysicalMaterial({
      color: grund,
      metalness: 0,
      roughness: 0.04,
      envMapIntensity: 0.8,
      transmission: 0.6,
      thickness: 0.8,
      ior: 1.6,
      attenuationColor: grund,
      attenuationDistance: 1.5,
      clearcoat: 1,
      flatShading: true
    });
  }

  if (muster === 'holz') {
    return new MeshStandardMaterial({
      map: holzTextur(farbe),
      metalness: 0,
      roughness: 0.62,
      flatShading: true
    });
  }

  if (muster === 'marmor') {
    return new MeshStandardMaterial({
      map: marmorTextur(farbe),
      metalness: 0.05,
      roughness: 0.35,
      flatShading: true
    });
  }

  if (muster === 'sternenhimmel') {
    const himmel = sternenTextur(farbe);
    return new MeshStandardMaterial({
      map: himmel,
      metalness: 0.15,
      roughness: 0.6,
      // Dieselbe Textur als Eigenleuchten: die Sterne sollen auch dort hell
      // sein, wo kein Licht hinfaellt. Ein eigenes zweites Bild dafuer waere
      // dasselbe Bild ein zweites Mal.
      emissiveMap: himmel,
      emissive: new Color('#5b6ea8'),
      flatShading: true
    });
  }

  return new MeshStandardMaterial({
    color: grund,
    metalness: 0.1,
    roughness: 0.45,
    flatShading: true
  });
}
