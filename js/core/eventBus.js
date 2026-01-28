/**
 * ==========================================================================
 * EVENTBUS.JS - Système d'événements centralisé
 * ==========================================================================
 *
 * Bus d'événements pour la communication entre composants découplés.
 * Permet d'émettre et d'écouter des événements de manière globale.
 *
 * PRINCIPES :
 * - Communication découplée entre modules
 * - Un composant émet, d'autres écoutent
 * - Évite les dépendances directes entre composants
 *
 * USAGE :
 *   import eventBus from './eventBus.js';
 *
 *   // Écouter un événement
 *   eventBus.on('csv:loaded', (data) => {
 *     console.log('CSV chargé:', data);
 *   });
 *
 *   // Émettre un événement
 *   eventBus.emit('csv:loaded', { filename: 'Bugs.csv', rows: 10 });
 *
 *   // Se désabonner
 *   const unsubscribe = eventBus.on('event', handler);
 *   unsubscribe();
 *
 * ==========================================================================
 */

/**
 * Classe EventBus
 * Implémente le pattern Pub/Sub (Publish/Subscribe)
 */
class EventBus {
  constructor() {
    /**
     * Map des événements et leurs handlers
     * @type {Object.<string, Function[]>}
     */
    this.events = {};

    /**
     * Mode debug (active le logging)
     * @type {boolean}
     */
    this.debug = false;

    /**
     * Historique des événements émis (pour debug)
     * @type {Array<{event: string, data: any, timestamp: Date}>}
     */
    this.history = [];
  }

  // =========================================================================
  // MÉTHODES PUBLIQUES
  // =========================================================================

  /**
   * S'abonne à un événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction à appeler quand l'événement est émis
   * @returns {Function} Fonction pour se désabonner
   *
   * @example
   * const unsubscribe = eventBus.on('csv:loaded', (data) => {
   *   console.log('Fichier chargé:', data.filename);
   * });
   */
  on(event, callback) {
    if (typeof callback !== 'function') {
      throw new Error(`[EventBus] Le callback pour "${event}" doit être une fonction`);
    }

    // Créer le tableau de handlers si nécessaire
    if (!this.events[event]) {
      this.events[event] = [];
    }

    // Ajouter le handler
    this.events[event].push(callback);

    if (this.debug) {
      console.log(`[EventBus] Abonnement à "${event}"`);
    }

    // Retourner une fonction de désabonnement
    return () => this.off(event, callback);
  }

  /**
   * S'abonne à un événement une seule fois
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Fonction à appeler
   * @returns {Function} Fonction pour se désabonner
   *
   * @example
   * eventBus.once('app:ready', () => {
   *   console.log('Application prête (une seule fois)');
   * });
   */
  once(event, callback) {
    const wrapper = (data) => {
      this.off(event, wrapper);
      callback(data);
    };
    return this.on(event, wrapper);
  }

  /**
   * Se désabonne d'un événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - La fonction qui était abonnée
   *
   * @example
   * eventBus.off('csv:loaded', myHandler);
   */
  off(event, callback) {
    if (!this.events[event]) {
      return;
    }

    this.events[event] = this.events[event].filter(cb => cb !== callback);

    if (this.debug) {
      console.log(`[EventBus] Désabonnement de "${event}"`);
    }

    // Nettoyer si plus de handlers
    if (this.events[event].length === 0) {
      delete this.events[event];
    }
  }

  /**
   * Émet un événement
   * @param {string} event - Nom de l'événement
   * @param {*} data - Données à passer aux handlers
   *
   * @example
   * eventBus.emit('csv:loaded', { filename: 'Bugs.csv', rows: 10 });
   */
  emit(event, data = null) {
    if (this.debug) {
      console.log(`[EventBus] Émission "${event}":`, data);
      this.history.push({
        event,
        data,
        timestamp: new Date()
      });
    }

    if (!this.events[event]) {
      return;
    }

    // Appeler tous les handlers
    this.events[event].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`[EventBus] Erreur dans handler pour "${event}":`, error);
      }
    });
  }

  /**
   * Vérifie si un événement a des abonnés
   * @param {string} event - Nom de l'événement
   * @returns {boolean}
   */
  hasListeners(event) {
    return this.events[event] && this.events[event].length > 0;
  }

  /**
   * Compte le nombre d'abonnés pour un événement
   * @param {string} event - Nom de l'événement
   * @returns {number}
   */
  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }

  /**
   * Supprime tous les abonnés d'un événement
   * @param {string} event - Nom de l'événement
   */
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }

    if (this.debug) {
      console.log(`[EventBus] Tous les listeners supprimés pour "${event || 'tous'}"`);
    }
  }

  /**
   * Liste tous les événements avec des abonnés
   * @returns {string[]}
   */
  getEventNames() {
    return Object.keys(this.events);
  }

  /**
   * Active/désactive le mode debug
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
    if (enabled) {
      console.log('[EventBus] Mode debug activé');
    }
  }

  /**
   * Récupère l'historique des événements (en mode debug)
   * @returns {Array}
   */
  getHistory() {
    return this.history;
  }

  /**
   * Efface l'historique
   */
  clearHistory() {
    this.history = [];
  }
}

// =========================================================================
// ÉVÉNEMENTS DISPONIBLES (Documentation)
// =========================================================================

/**
 * LISTE DES ÉVÉNEMENTS
 *
 * CSV / Données :
 * - 'csv:loaded'      : Un fichier CSV a été chargé { type, data, rowCount }
 * - 'csv:error'       : Erreur de chargement CSV { type, error }
 * - 'csv:allLoaded'   : Tous les CSV requis sont chargés
 * - 'data:transformed': Données transformées et prêtes { sprintData }
 * - 'data:reset'      : Données réinitialisées
 *
 * Navigation :
 * - 'navigate'        : Changement de section { section }
 * - 'section:changed' : Section active changée { from, to }
 *
 * UI :
 * - 'statsMode:changed': Toggle moyenne/médiane { mode }
 * - 'admin:toggle'     : Toggle section admin { expanded }
 * - 'theme:changed'    : Thème modifié { theme }
 *
 * Snapshots :
 * - 'snapshot:saved'   : Snapshot sauvegardé { id, timestamp }
 * - 'snapshot:loaded'  : Snapshot chargé { id }
 * - 'snapshot:deleted' : Snapshot supprimé { id }
 *
 * Export :
 * - 'pdf:generating'   : Génération PDF en cours
 * - 'pdf:generated'    : PDF généré { filename }
 * - 'pdf:error'        : Erreur génération PDF { error }
 *
 * Goals :
 * - 'goal:added'       : Goal ajouté { goal }
 * - 'goal:updated'     : Goal mis à jour { goal }
 * - 'goal:removed'     : Goal supprimé { id }
 *
 * Sprint History :
 * - 'history:added'    : Sprint ajouté à l'historique { sprint }
 * - 'history:updated'  : Sprint mis à jour { sprint }
 * - 'history:removed'  : Sprint supprimé { id }
 *
 * Application :
 * - 'app:ready'        : Application initialisée
 * - 'app:error'        : Erreur globale { error }
 */

// =========================================================================
// EXPORT - Instance singleton
// =========================================================================

/**
 * Instance unique du bus d'événements
 * Utilisée dans toute l'application
 */
const eventBus = new EventBus();

export default eventBus;
