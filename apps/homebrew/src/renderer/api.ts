/** Der Zugang zur Bruecke, einmal getippt. */
import type { HomebrewApi } from '../preload/index';

declare global {
  interface Window {
    readonly homebrew: HomebrewApi;
  }
}

export const api = window.homebrew;
