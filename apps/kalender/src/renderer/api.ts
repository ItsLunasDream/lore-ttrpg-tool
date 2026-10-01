/** Der Zugang zur Bruecke, einmal getippt. */
import type { KalenderApi } from '../preload/index';

declare global {
  interface Window {
    readonly kalender: KalenderApi;
  }
}

export const api = window.kalender;
