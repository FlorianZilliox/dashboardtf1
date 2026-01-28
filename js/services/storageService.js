/**
 * ==========================================================================
 * STORAGESERVICE.JS - Gestion du stockage local
 * ==========================================================================
 *
 * Abstraction du localStorage avec :
 * - Sérialisation/désérialisation automatique JSON
 * - Gestion des erreurs
 * - Snapshots pour sauvegarder l'état
 * - Expiration des données (optionnel)
 *
 * USAGE :
 *   import storage from './storageService.js';
 *
 *   storage.set('key', { data: 'value' });
 *   const data = storage.get('key');
 *   storage.remove('key');
 *
 *   // Snapshots
 *   storage.saveSnapshot('sprint15', state);
 *   const snapshot = storage.loadSnapshot('sprint15');
 *
 * ==========================================================================
 */

import config from '../core/config.js';
import eventBus from '../core/eventBus.js';

// =========================================================================
// CONSTANTES
// =========================================================================

const STORAGE_PREFIX = 'sprintReview_';
const SNAPSHOTS_KEY = `${STORAGE_PREFIX}snapshots`;
const HISTORY_KEY = `${STORAGE_PREFIX}sprintHistory`;
const PREFERENCES_KEY = `${STORAGE_PREFIX}preferences`;

// =========================================================================
// CLASSE STORAGESERVICE
// =========================================================================

class StorageService {
  constructor() {
    this.isAvailable = this._checkAvailability();

    if (!this.isAvailable) {
      console.warn('[StorageService] localStorage non disponible');
    }
  }

  // =========================================================================
  // MÉTHODES DE BASE
  // =========================================================================

  /**
   * Stocke une valeur
   * @param {string} key - Clé de stockage
   * @param {*} value - Valeur à stocker (sera sérialisée en JSON)
   * @returns {boolean} Succès de l'opération
   *
   * @example
   * storage.set('myKey', { name: 'John', age: 30 });
   */
  set(key, value) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const serialized = JSON.stringify({
        value,
        timestamp: Date.now()
      });
      localStorage.setItem(STORAGE_PREFIX + key, serialized);
      return true;
    } catch (error) {
      console.error(`[StorageService] Erreur écriture "${key}":`, error);
      return false;
    }
  }

  /**
   * Récupère une valeur
   * @param {string} key - Clé de stockage
   * @param {*} defaultValue - Valeur par défaut si non trouvée
   * @returns {*} Valeur stockée ou valeur par défaut
   *
   * @example
   * const data = storage.get('myKey', { name: 'Anonymous' });
   */
  get(key, defaultValue = null) {
    if (!this.isAvailable) {
      return defaultValue;
    }

    try {
      const item = localStorage.getItem(STORAGE_PREFIX + key);

      if (item === null) {
        return defaultValue;
      }

      const parsed = JSON.parse(item);
      return parsed.value !== undefined ? parsed.value : parsed;
    } catch (error) {
      console.error(`[StorageService] Erreur lecture "${key}":`, error);
      return defaultValue;
    }
  }

  /**
   * Supprime une valeur
   * @param {string} key - Clé à supprimer
   * @returns {boolean} Succès de l'opération
   */
  remove(key) {
    if (!this.isAvailable) {
      return false;
    }

    try {
      localStorage.removeItem(STORAGE_PREFIX + key);
      return true;
    } catch (error) {
      console.error(`[StorageService] Erreur suppression "${key}":`, error);
      return false;
    }
  }

  /**
   * Vérifie si une clé existe
   * @param {string} key - Clé à vérifier
   * @returns {boolean}
   */
  has(key) {
    if (!this.isAvailable) {
      return false;
    }

    return localStorage.getItem(STORAGE_PREFIX + key) !== null;
  }

  /**
   * Efface toutes les données de l'application
   * @returns {boolean} Succès de l'opération
   */
  clear() {
    if (!this.isAvailable) {
      return false;
    }

    try {
      const keys = Object.keys(localStorage).filter(k => k.startsWith(STORAGE_PREFIX));
      keys.forEach(key => localStorage.removeItem(key));
      return true;
    } catch (error) {
      console.error('[StorageService] Erreur clear:', error);
      return false;
    }
  }

  // =========================================================================
  // SNAPSHOTS
  // =========================================================================

  /**
   * Sauvegarde un snapshot de l'état
   * @param {string} name - Nom du snapshot (ex: "Sprint 15")
   * @param {Object} data - Données à sauvegarder
   * @returns {Object|null} Le snapshot créé ou null en cas d'erreur
   *
   * @example
   * storage.saveSnapshot('Sprint 15', {
   *   manualInput: { ... },
   *   sprintHistory: [ ... ]
   * });
   */
  saveSnapshot(name, data) {
    const snapshots = this.getSnapshots();

    const snapshot = {
      id: this._generateId(),
      name,
      data,
      createdAt: new Date().toISOString(),
      version: config.app.version
    };

    snapshots.unshift(snapshot);

    // Limiter le nombre de snapshots (garder les 20 derniers)
    const maxSnapshots = 20;
    if (snapshots.length > maxSnapshots) {
      snapshots.length = maxSnapshots;
    }

    if (this.set('snapshots', snapshots)) {
      eventBus.emit('snapshot:saved', { id: snapshot.id, name });
      return snapshot;
    }

    return null;
  }

  /**
   * Récupère tous les snapshots
   * @returns {Array<Object>} Liste des snapshots
   */
  getSnapshots() {
    return this.get('snapshots', []);
  }

  /**
   * Charge un snapshot par son ID
   * @param {string} id - ID du snapshot
   * @returns {Object|null} Données du snapshot ou null
   */
  loadSnapshot(id) {
    const snapshots = this.getSnapshots();
    const snapshot = snapshots.find(s => s.id === id);

    if (snapshot) {
      eventBus.emit('snapshot:loaded', { id });
      return snapshot.data;
    }

    return null;
  }

  /**
   * Supprime un snapshot
   * @param {string} id - ID du snapshot à supprimer
   * @returns {boolean} Succès de l'opération
   */
  deleteSnapshot(id) {
    const snapshots = this.getSnapshots();
    const filtered = snapshots.filter(s => s.id !== id);

    if (filtered.length !== snapshots.length) {
      if (this.set('snapshots', filtered)) {
        eventBus.emit('snapshot:deleted', { id });
        return true;
      }
    }

    return false;
  }

  // =========================================================================
  // HISTORIQUE DES SPRINTS
  // =========================================================================

  /**
   * Récupère l'historique des sprints
   * @returns {Array<Object>} Liste des sprints
   */
  getSprintHistory() {
    return this.get('sprintHistory', []);
  }

  /**
   * Ajoute ou met à jour un sprint dans l'historique
   * @param {Object} sprint - Données du sprint
   * @returns {boolean} Succès de l'opération
   */
  saveSprintToHistory(sprint) {
    const history = this.getSprintHistory();

    // Chercher si le sprint existe déjà
    const existingIndex = history.findIndex(s =>
      s.sprintNumber === sprint.sprintNumber ||
      s.id === sprint.id
    );

    const sprintData = {
      id: sprint.id || this._generateId(),
      sprintName: sprint.sprintName || `Sprint ${sprint.sprintNumber}`,
      sprintNumber: sprint.sprintNumber,
      committed: sprint.committed || sprint.storyPointsCommitted || 0,
      delivered: sprint.delivered || sprint.storyPointsDelivered || 0,
      startDate: sprint.startDate,
      endDate: sprint.endDate,
      updatedAt: new Date().toISOString()
    };

    if (existingIndex >= 0) {
      history[existingIndex] = { ...history[existingIndex], ...sprintData };
      eventBus.emit('history:updated', { sprint: sprintData });
    } else {
      sprintData.createdAt = new Date().toISOString();
      history.unshift(sprintData);
      eventBus.emit('history:added', { sprint: sprintData });
    }

    // Trier par numéro de sprint décroissant
    history.sort((a, b) => b.sprintNumber - a.sprintNumber);

    // Limiter la taille
    const maxHistory = config.limits?.maxSprintHistory || 20;
    if (history.length > maxHistory) {
      history.length = maxHistory;
    }

    return this.set('sprintHistory', history);
  }

  /**
   * Supprime un sprint de l'historique
   * @param {string} id - ID du sprint à supprimer
   * @returns {boolean} Succès de l'opération
   */
  removeSprintFromHistory(id) {
    const history = this.getSprintHistory();
    const filtered = history.filter(s => s.id !== id);

    if (filtered.length !== history.length) {
      if (this.set('sprintHistory', filtered)) {
        eventBus.emit('history:removed', { id });
        return true;
      }
    }

    return false;
  }

  // =========================================================================
  // PRÉFÉRENCES UTILISATEUR
  // =========================================================================

  /**
   * Récupère les préférences utilisateur
   * @returns {Object} Préférences
   */
  getPreferences() {
    return this.get('preferences', {
      statsMode: 'average',
      teamName: 'Data Tribe TF1',
      adminExpanded: true
    });
  }

  /**
   * Sauvegarde une préférence
   * @param {string} key - Clé de la préférence
   * @param {*} value - Valeur
   * @returns {boolean} Succès de l'opération
   */
  setPreference(key, value) {
    const prefs = this.getPreferences();
    prefs[key] = value;
    return this.set('preferences', prefs);
  }

  /**
   * Récupère une préférence spécifique
   * @param {string} key - Clé de la préférence
   * @param {*} defaultValue - Valeur par défaut
   * @returns {*} Valeur de la préférence
   */
  getPreference(key, defaultValue = null) {
    const prefs = this.getPreferences();
    return prefs[key] !== undefined ? prefs[key] : defaultValue;
  }

  // =========================================================================
  // MÉTHODES PRIVÉES
  // =========================================================================

  /**
   * Vérifie si localStorage est disponible
   * @private
   * @returns {boolean}
   */
  _checkAvailability() {
    try {
      const testKey = '__storage_test__';
      localStorage.setItem(testKey, testKey);
      localStorage.removeItem(testKey);
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Génère un ID unique
   * @private
   * @returns {string}
   */
  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
  }

  // =========================================================================
  // SESSION STATE (dernier état)
  // =========================================================================

  /**
   * Sauvegarde l'état de la dernière session
   * @param {Object} state - État à sauvegarder
   * @returns {boolean}
   */
  saveLastState(state) {
    return this.set('lastState', state);
  }

  /**
   * Récupère l'état de la dernière session
   * @returns {Object|null}
   */
  getLastState() {
    return this.get('lastState', null);
  }

  /**
   * Supprime l'état de la dernière session
   * @returns {boolean}
   */
  clearLastState() {
    return this.remove('lastState');
  }

  /**
   * Liste tous les snapshots avec formatage
   * @returns {Array<Object>}
   */
  listSnapshots() {
    const snapshots = this.getSnapshots();
    const locale = 'fr-FR';

    return snapshots.map(snapshot => ({
      ...snapshot,
      dateFormatted: new Date(snapshot.createdAt).toLocaleDateString(locale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }));
  }

  /**
   * Récupère l'espace utilisé en localStorage
   * @returns {Object} { used, total, percentage }
   */
  getStorageInfo() {
    if (!this.isAvailable) {
      return { used: 0, total: 0, percentage: 0 };
    }

    let used = 0;
    for (let key in localStorage) {
      if (localStorage.hasOwnProperty(key)) {
        used += localStorage[key].length * 2; // UTF-16
      }
    }

    const total = 5 * 1024 * 1024; // 5MB estimation
    const percentage = (used / total) * 100;

    return {
      used,
      total,
      percentage: Math.round(percentage * 100) / 100,
      usedFormatted: this._formatBytes(used),
      totalFormatted: this._formatBytes(total)
    };
  }

  /**
   * Formate des bytes en chaîne lisible
   * @private
   */
  _formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}

// =========================================================================
// EXPORT - Instance singleton
// =========================================================================

const storage = new StorageService();

export default storage;
