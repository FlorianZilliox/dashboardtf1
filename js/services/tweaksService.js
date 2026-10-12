/**
 * ==========================================================================
 * TWEAKSSERVICE.JS - Gestion du theming (palette, dark mode, densite, typo)
 * ==========================================================================
 *
 * Applique les data-attributes sur <html> et persiste dans localStorage.
 * Emet un evenement quand la palette change pour rafraichir les charts.
 *
 * ==========================================================================
 */

import eventBus from '../core/eventBus.js';

const STORAGE_KEY = 'sprintReview_tweaks';

const DEFAULTS = {
  palette: 'earth',
  density: 'normal',
  typo: 'editorial',
  dark: false
};

class TweaksService {
  constructor() {
    this.tweaks = { ...DEFAULTS };
  }

  /**
   * Initialise le service : restaure les preferences et applique
   */
  init() {
    this._restore();
    this._apply();
    this._bindPanel();
  }

  /**
   * Modifie un parametre de theming
   * @param {string} key - palette | density | typo | dark
   * @param {*} value
   */
  setTweak(key, value) {
    this.tweaks[key] = value;
    this._apply();
    this._persist();

    // Si la palette ou le theme change, les charts doivent etre recrees
    if (key === 'palette' || key === 'dark') {
      eventBus.emit('tweaks:palette-changed', { ...this.tweaks });
    }
  }

  /**
   * Retourne les preferences actuelles
   * @returns {Object}
   */
  getTweaks() {
    return { ...this.tweaks };
  }

  /**
   * Applique les data-attributes sur l'element racine
   * @private
   */
  _apply() {
    const root = document.documentElement;
    root.setAttribute('data-palette', this.tweaks.palette);
    root.setAttribute('data-density', this.tweaks.density);
    root.setAttribute('data-typo', this.tweaks.typo);
    root.setAttribute('data-theme', this.tweaks.dark ? 'dark' : 'light');
  }

  /**
   * Persiste les preferences dans localStorage
   * @private
   */
  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tweaks));
    } catch (e) {
      // localStorage plein ou indisponible
    }
  }

  /**
   * Restaure les preferences depuis localStorage
   * @private
   */
  _restore() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        Object.assign(this.tweaks, parsed);
      }
    } catch (e) {
      // Donnees corrompues, on garde les defaults
    }
  }

  /**
   * Lie les evenements du panel Tweaks dans le DOM
   * @private
   */
  _bindPanel() {
    const panel = document.getElementById('twk-panel');
    if (!panel) return;

    // Bouton d'ouverture (FAB)
    const fab = document.getElementById('twk-fab');
    if (fab) {
      fab.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
      });
    }

    // Bouton de fermeture
    const closeBtn = document.getElementById('twk-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        panel.hidden = true;
      });
    }

    // Segments (palette, density, typo)
    panel.querySelectorAll('.twk-seg').forEach(seg => {
      const key = seg.dataset.tweak;
      // Restaurer l'etat actif
      seg.querySelectorAll('button').forEach(btn => {
        btn.setAttribute('aria-checked', btn.dataset.value === String(this.tweaks[key]));
      });

      seg.addEventListener('click', e => {
        const btn = e.target.closest('button');
        if (!btn) return;
        seg.querySelectorAll('button').forEach(b => b.setAttribute('aria-checked', b === btn));
        this.setTweak(key, btn.dataset.value);
      });
    });

    // Toggle dark mode
    const darkToggle = document.getElementById('twk-dark');
    if (darkToggle) {
      darkToggle.checked = this.tweaks.dark;
      darkToggle.addEventListener('change', e => {
        this.setTweak('dark', e.target.checked);
      });
    }
  }
}

const tweaksService = new TweaksService();
export default tweaksService;
