/** Der Zugang zur Bruecke, einmal getippt. */
import type { BogenApi } from '../preload/index';

declare global {
  interface Window {
    readonly charakterbogen: BogenApi;
  }
}

export const api = window.charakterbogen;
