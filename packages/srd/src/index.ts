/**
 * Alles, was aus dem SRD 5.2.1 kommt, an einer Stelle.
 *
 * WARUM EIN EIGENES PAKET
 * =======================
 * Drei Werkzeuge brauchen denselben Bestand: das Nachschlagewerk den
 * Text, der Magic Item Generator die Gegenstaende als Eichpunkte, der
 * Encounter Creator die Schwierigkeitszahlen. Laege er in der
 * Anwendung, die ihn zuerst braucht, haetten die anderen beiden
 * entweder eine Kopie oder eine Abhaengigkeit auf eine Anwendung — und
 * Anwendungen haengen in dieser Sammlung nicht voneinander ab.
 *
 * Unter `quelle/` liegen die beiden Sprachfassungen des Dokuments, aus
 * denen alles hier stammt. Sie bleiben liegen, damit sich jede Zahl
 * nachpruefen laesst, ohne sie neu zu beschaffen.
 *
 * Die Namensnennung ist Pflicht und steht in `namensnennung.ts`. Sie
 * gehoert in den Ueber-Dialog jeder Anwendung, die etwas von hier
 * benutzt.
 */
export * from './namensnennung';
export * from './erfahrung';
export * from './zustaende';
export * from './gegenstaende';
