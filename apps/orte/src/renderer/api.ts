/** Der Zugang zur Bruecke, einmal getippt. */
import type { OrteApi } from '../preload/index';

declare global {
  interface Window {
    readonly orte: OrteApi;
  }
}

export const api = window.orte;
