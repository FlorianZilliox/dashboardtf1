/**
 * ==========================================================================
 * ROUTER.JS - Navigation entre les sections
 * ==========================================================================
 *
 * Gère la navigation entre les différentes sections de l'application
 * (Admin, Review, Forecast) sans rechargement de page.
 *
 * PRINCIPES :
 * - SPA-like navigation
 * - Support de l'historique navigateur (back/forward)
 * - Animation de transition entre sections
 *
 * USAGE :
 *   import router from './router.js';
 *
 *   // Enregistrer une route
 *   router.register('review', () => {
 *     reviewPage.mount();
 *   });
 *
 *   // Naviguer
 *   router.navigate('review');
 *
 *   // Écouter les changements
 *   router.onRouteChange((route) => {
 *     console.log('Route changée:', route);
 *   });
 *
 * ==========================================================================
 */

import eventBus from './eventBus.js';

/**
 * Classe Router
 * Gère la navigation interne de l'application
 */
class Router {
  constructor() {
    /**
     * Routes enregistrées
     * @type {Object.<string, Function>}
     */
    this.routes = {};

    /**
     * Route actuelle
     * @type {string|null}
     */
    this.currentRoute = null;

    /**
     * Route précédente
     * @type {string|null}
     */
    this.previousRoute = null;

    /**
     * Callbacks appelés à chaque changement de route
     * @type {Function[]}
     */
    this.listeners = [];

    /**
     * Route par défaut
     * @type {string}
     */
    this.defaultRoute = 'admin';

    /**
     * Mode debug
     * @type {boolean}
     */
    this.debug = false;

    // Initialiser l'écoute de l'historique navigateur
    this._initHistoryListener();
  }

  // =========================================================================
  // MÉTHODES PUBLIQUES
  // =========================================================================

  /**
   * Enregistre une route et son handler
   * @param {string} route - Nom de la route
   * @param {Function} handler - Fonction à exécuter quand on navigue vers cette route
   * @returns {Router} this (pour chaînage)
   *
   * @example
   * router
   *   .register('admin', () => adminPage.mount())
   *   .register('review', () => reviewPage.mount())
   *   .register('forecast', () => forecastPage.mount());
   */
  register(route, handler) {
    if (typeof handler !== 'function') {
      throw new Error(`[Router] Le handler pour "${route}" doit être une fonction`);
    }

    // Normaliser la route (avec ou sans /)
    const normalizedRoute = route.startsWith('/') ? route.slice(1) : route;
    this.routes[normalizedRoute] = handler;

    if (this.debug) {
      console.log(`[Router] Route enregistrée: "${normalizedRoute}"`);
    }

    return this;
  }

  /**
   * Alias pour register()
   */
  addRoute(route, handler) {
    return this.register(route, handler);
  }

  /**
   * Navigue vers une route
   * @param {string} route - Nom de la route
   * @param {Object} options - Options de navigation
   * @param {boolean} options.replace - Remplace l'entrée historique au lieu d'en ajouter
   * @param {boolean} options.silent - Ne pas émettre d'événements
   * @returns {boolean} Succès de la navigation
   *
   * @example
   * router.navigate('review');
   * router.navigate('admin', { replace: true });
   */
  navigate(route, options = {}) {
    const { replace = false, silent = false } = options;

    // Normaliser la route (avec ou sans /)
    const normalizedRoute = route.startsWith('/') ? route.slice(1) : route;

    // Vérifier que la route existe
    if (!this.routes[normalizedRoute]) {
      console.warn(`[Router] Route inconnue: "${normalizedRoute}"`);
      return false;
    }

    // Si on est déjà sur cette route, ne rien faire
    if (normalizedRoute === this.currentRoute) {
      return true;
    }

    if (this.debug) {
      console.log(`[Router] Navigation: "${this.currentRoute}" → "${normalizedRoute}"`);
    }

    // Sauvegarder la route précédente
    this.previousRoute = this.currentRoute;
    this.currentRoute = normalizedRoute;

    // Mettre à jour l'URL (hash)
    if (replace) {
      window.history.replaceState({ route: normalizedRoute }, '', `#${normalizedRoute}`);
    } else {
      window.history.pushState({ route: normalizedRoute }, '', `#${normalizedRoute}`);
    }

    // Exécuter le handler de la route
    try {
      this.routes[normalizedRoute]();
    } catch (error) {
      console.error(`[Router] Erreur dans le handler de "${normalizedRoute}":`, error);
      return false;
    }

    // Notifier les listeners
    if (!silent) {
      this._notifyListeners(normalizedRoute);

      // Émettre un événement global
      eventBus.emit('navigate', { route: normalizedRoute });
      eventBus.emit('section:changed', {
        from: this.previousRoute,
        to: normalizedRoute
      });
    }

    return true;
  }

  /**
   * Retourne à la route précédente
   * @returns {boolean} Succès de la navigation
   */
  back() {
    if (this.previousRoute) {
      return this.navigate(this.previousRoute);
    }
    return false;
  }

  /**
   * Récupère la route actuelle
   * @returns {string|null}
   */
  getCurrentRoute() {
    return this.currentRoute;
  }

  /**
   * Récupère la route précédente
   * @returns {string|null}
   */
  getPreviousRoute() {
    return this.previousRoute;
  }

  /**
   * Vérifie si une route est active
   * @param {string} route
   * @returns {boolean}
   */
  isActive(route) {
    return this.currentRoute === route;
  }

  /**
   * Définit la route par défaut
   * @param {string} route
   */
  setDefaultRoute(route) {
    this.defaultRoute = route;
  }

  /**
   * Enregistre un callback appelé à chaque changement de route
   * @param {Function} callback
   * @returns {Function} Fonction pour se désabonner
   *
   * @example
   * const unsubscribe = router.onRouteChange((route) => {
   *   console.log('Nouvelle route:', route);
   *   updateNavigation(route);
   * });
   */
  onRouteChange(callback) {
    if (typeof callback !== 'function') {
      throw new Error('[Router] Le callback doit être une fonction');
    }

    this.listeners.push(callback);

    return () => {
      this.listeners = this.listeners.filter(cb => cb !== callback);
    };
  }

  /**
   * Initialise le router (lit le hash initial et navigue)
   */
  init() {
    // Lire le hash de l'URL
    const hash = window.location.hash.slice(1);
    const initialRoute = hash && this.routes[hash] ? hash : this.defaultRoute;

    if (this.debug) {
      console.log(`[Router] Initialisation avec route: "${initialRoute}"`);
    }

    // Naviguer vers la route initiale
    this.navigate(initialRoute, { replace: true });
  }

  /**
   * Liste toutes les routes enregistrées
   * @returns {string[]}
   */
  getRoutes() {
    return Object.keys(this.routes);
  }

  /**
   * Active/désactive le mode debug
   * @param {boolean} enabled
   */
  setDebug(enabled) {
    this.debug = enabled;
    if (enabled) {
      console.log('[Router] Mode debug activé');
    }
  }

  // =========================================================================
  // MÉTHODES PRIVÉES
  // =========================================================================

  /**
   * Initialise l'écoute des événements popstate (back/forward navigateur)
   * @private
   */
  _initHistoryListener() {
    window.addEventListener('popstate', (event) => {
      const route = event.state?.route || this._getRouteFromHash();

      if (route && this.routes[route]) {
        if (this.debug) {
          console.log(`[Router] Popstate: navigation vers "${route}"`);
        }

        this.previousRoute = this.currentRoute;
        this.currentRoute = route;

        try {
          this.routes[route]();
          this._notifyListeners(route);
        } catch (error) {
          console.error(`[Router] Erreur dans le handler de "${route}":`, error);
        }
      }
    });
  }

  /**
   * Récupère la route depuis le hash de l'URL
   * @private
   * @returns {string|null}
   */
  _getRouteFromHash() {
    const hash = window.location.hash.slice(1);
    return hash || null;
  }

  /**
   * Notifie tous les listeners du changement de route
   * @private
   * @param {string} route
   */
  _notifyListeners(route) {
    this.listeners.forEach(callback => {
      try {
        callback(route, this.previousRoute);
      } catch (error) {
        console.error('[Router] Erreur dans un listener:', error);
      }
    });
  }
}

// =========================================================================
// EXPORT - Instance singleton
// =========================================================================

/**
 * Instance unique du router
 * Utilisée dans toute l'application
 */
const router = new Router();

export default router;
