/**
 * ==========================================================================
 * STORE.JS - État global de l'application
 * ==========================================================================
 *
 * Store centralisé inspiré du pattern Redux simplifié.
 *
 * API :
 *   store.getState()           - Récupère l'état complet
 *   store.dispatch(changes)    - Met à jour l'état (merge)
 *   store.subscribe(callback)  - S'abonne aux changements
 *   store.subscribe(selector, callback) - S'abonne avec sélecteur
 *
 * ==========================================================================
 */

class Store {
  constructor() {
    // État initial vide - sera initialisé par main.js
    this.state = {};

    // Listeners
    this.listeners = [];

    // Listeners avec sélecteurs
    this.selectorListeners = [];

    // Debug mode
    this.debug = false;
  }

  /**
   * Récupère l'état complet
   * @returns {Object}
   */
  getState() {
    return { ...this.state };
  }

  /**
   * Met à jour l'état (merge shallow)
   * @param {Object} changes - Changements à appliquer
   */
  dispatch(changes) {
    if (typeof changes !== 'object' || changes === null) {
      console.error('[Store] dispatch() attend un objet');
      return;
    }

    const prevState = { ...this.state };

    // Merge les changements
    this.state = { ...this.state, ...changes };

    if (this.debug) {
      console.log('[Store] dispatch:', changes);
    }

    // Notifier les listeners
    this._notify(prevState);
  }

  /**
   * S'abonne aux changements
   *
   * Usage 1: store.subscribe(callback)
   *   - callback(state) appelé à chaque changement
   *
   * Usage 2: store.subscribe(selector, callback)
   *   - selector(state) => value
   *   - callback(value, state) appelé quand value change
   *
   * @param {Function} selectorOrCallback
   * @param {Function} [callback]
   * @returns {Function} Fonction de désabonnement
   */
  subscribe(selectorOrCallback, callback) {
    // Usage avec sélecteur
    if (typeof callback === 'function') {
      const selector = selectorOrCallback;
      const entry = {
        selector,
        callback,
        lastValue: selector(this.state)
      };

      this.selectorListeners.push(entry);

      return () => {
        this.selectorListeners = this.selectorListeners.filter(e => e !== entry);
      };
    }

    // Usage simple
    const listener = selectorOrCallback;
    if (typeof listener !== 'function') {
      console.error('[Store] subscribe() attend une fonction');
      return () => {};
    }

    this.listeners.push(listener);

    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  /**
   * Notifie tous les listeners
   * @private
   */
  _notify(prevState) {
    // Listeners simples
    this.listeners.forEach(listener => {
      try {
        listener(this.state);
      } catch (error) {
        console.error('[Store] Erreur listener:', error);
      }
    });

    // Listeners avec sélecteur
    this.selectorListeners.forEach(entry => {
      try {
        const newValue = entry.selector(this.state);

        // Vérifier si la valeur a changé (shallow compare)
        if (!this._shallowEqual(entry.lastValue, newValue)) {
          entry.lastValue = newValue;
          entry.callback(newValue, this.state);
        }
      } catch (error) {
        console.error('[Store] Erreur selector listener:', error);
      }
    });
  }

  /**
   * Comparaison shallow
   * @private
   */
  _shallowEqual(a, b) {
    if (a === b) return true;
    if (typeof a !== 'object' || typeof b !== 'object') return false;
    if (a === null || b === null) return false;

    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    for (const key of keysA) {
      if (a[key] !== b[key]) return false;
    }

    return true;
  }

  /**
   * Active le mode debug
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * Réinitialise le store
   */
  reset() {
    this.state = {};
    this.listeners = [];
    this.selectorListeners = [];
  }
}

// Instance singleton
const store = new Store();

export default store;
