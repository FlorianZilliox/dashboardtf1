/**
 * ==========================================================================
 * MAIN.JS - Point d'entrée de l'application
 * ==========================================================================
 *
 * Initialise l'application Sprint Review Dashboard :
 * - Configuration initiale
 * - Chargement des composants
 * - Gestion de la navigation
 * - Notifications
 *
 * ==========================================================================
 */

// Core
import store from './core/store.js';
import eventBus from './core/eventBus.js';
import config from './core/config.js';
import router from './core/router.js';

// Components
import Navigation from './components/Navigation.js';

// Pages
import { AdminPage, ReviewPage, ForecastPage } from './pages/index.js';
import SharedContributorsPage from './pages/SharedContributorsPage.js';
import HowManyPage from './pages/HowManyPage.js';

// Services
import storageService from './services/storageService.js';

// =========================================================================
// APPLICATION CLASS
// =========================================================================

class App {
  constructor() {
    this.navigation = null;
    this.currentPage = null;
    this.pages = {};

    // Containers DOM
    this.containers = {
      header: null,
      nav: null,
      main: null,
      notifications: null
    };
  }

  /**
   * Initialise l'application
   */
  async init() {
    console.log('[App] Initialisation...');

    // Récupérer les containers DOM
    this._setupContainers();

    // Initialiser l'état par défaut
    this._initializeStore();

    // Configurer la navigation
    this._setupNavigation();

    // Configurer les routes
    this._setupRouter();

    // Écouter les événements globaux
    this._setupEventListeners();

    // Charger la page initiale
    this._loadInitialPage();

    // Afficher l'info de démarrage
    this._showStartupInfo();

    console.log('[App] Prêt !');
  }

  /**
   * Configure les containers DOM
   * @private
   */
  _setupContainers() {
    this.containers = {
      header: document.getElementById('app-header'),
      nav: document.getElementById('app-nav'),
      main: document.getElementById('app-main'),
      notifications: document.getElementById('app-notifications')
    };

    // Vérifier que tous les containers existent
    Object.entries(this.containers).forEach(([name, el]) => {
      if (!el) {
        console.warn(`[App] Container #app-${name} non trouvé`);
      }
    });
  }

  /**
   * Initialise le store avec les valeurs par défaut
   * @private
   */
  _initializeStore() {
    // État initial - toujours partir d'un état vierge
    store.dispatch({
      // Données CSV
      csvData: null,
      csvLoaded: false,

      // Métriques calculées
      sprintMetrics: null,

      // Saisie manuelle
      manualInput: {
        teamName: config.defaultTeamName || 'Data Tribe TF1',
        sprintName: 'Sprint 1',
        storyPointsCommitted: null,
        storyPointsDelivered: null
      },

      // Sprint Goals
      sprintGoals: [],

      // UI
      currentSection: 'admin',
      isLoading: false
    });

    // Note: On ne restaure plus l'état précédent automatiquement
    // L'utilisateur peut charger un snapshot manuellement si nécessaire
  }

  /**
   * Configure la navigation
   * @private
   */
  _setupNavigation() {
    if (!this.containers.nav) return;

    this.navigation = new Navigation(this.containers.nav, {
      sections: ['admin', 'review', 'forecast'],
      activeSection: 'admin'
    });

    this.navigation.mount();
  }

  /**
   * Configure le router
   * @private
   */
  _setupRouter() {
    // Définir les routes
    router.addRoute('/admin', () => this._showPage('admin'));
    router.addRoute('/review', () => this._showPage('review'));
    router.addRoute('/forecast', () => this._showPage('forecast'));
    router.addRoute('/shared', () => this._showPage('shared')); // Page secrète StarAc
    router.addRoute('/howmany', () => this._showPage('howmany')); // Page secrète How Many
    router.addRoute('/', () => this._showPage('admin'));

    // Initialiser le router
    router.init();
  }

  /**
   * Configure les event listeners globaux
   * @private
   */
  _setupEventListeners() {
    // Notifications
    eventBus.on('notification:show', (data) => {
      this._showNotification(data);
    });

    // Demande de navigation
    eventBus.on('navigation:request', ({ section }) => {
      this.navigation?.navigateTo(section);
    });

    // Changement de navigation
    eventBus.on('navigation:changed', ({ section }) => {
      store.dispatch({ currentSection: section });
    });

    // Export PDF en cours
    eventBus.on('pdf:generating', () => {
      this._showNotification({ type: 'info', message: 'Génération du PDF...' });
    });

    eventBus.on('pdf:generated', ({ filename }) => {
      this._showNotification({ type: 'success', message: `PDF généré: ${filename}` });
    });

    // Note: On ne sauvegarde plus automatiquement l'état
    // L'utilisateur utilise les snapshots pour sauvegarder explicitement

    // Gestion du redimensionnement
    window.addEventListener('resize', this._handleResize.bind(this));

    // Konami Codes pour pages secrètes
    this._setupSecretCodes();
  }

  /**
   * Configure les codes secrets pour les pages cachées
   * @private
   */
  _setupSecretCodes() {
    // Définir les séquences secrètes
    const secretCodes = [
      {
        name: 'starac',
        sequence: ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown'],
        message: 'StarAc débloqué !',
        event: 'secret:unlock:starac'
      },
      {
        name: 'howmany',
        sequence: ['ArrowLeft', 'ArrowLeft', 'ArrowRight', 'ArrowRight'],
        message: 'How Many débloqué !',
        event: 'secret:unlock:howmany'
      },
      {
        name: 'hide-secrets',
        sequence: ['ArrowDown', 'ArrowDown', 'ArrowUp', 'ArrowUp'],
        message: 'Onglets secrets masqués',
        event: 'secret:hide-all'
      },
      {
        name: 'individual',
        sequence: ['ArrowRight', 'ArrowRight', 'ArrowLeft', 'ArrowLeft'],
        message: 'Simulation individuelle débloquée !',
        event: 'secret:unlock:individual'
      },
      {
        name: 'pearson',
        sequence: ['p', 'e', 'a', 'r'],
        message: 'Corrélation Pearson débloquée !',
        event: 'secret:unlock:pearson'
      },
      {
        name: 'burndown',
        sequence: ['b', 'u', 'r', 'n'],
        message: 'Burndown Chart débloqué !',
        event: 'secret:unlock:burndown'
      }
    ];

    // Trouver la longueur max pour le buffer
    const maxLength = Math.max(...secretCodes.map(c => c.sequence.length));
    let inputBuffer = [];

    document.addEventListener('keydown', (e) => {
      // Ignorer si focus dans un input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        return;
      }

      inputBuffer.push(e.key);

      // Garder seulement les dernières touches nécessaires
      if (inputBuffer.length > maxLength) {
        inputBuffer.shift();
      }

      // Vérifier chaque code secret
      for (const code of secretCodes) {
        const bufferEnd = inputBuffer.slice(-code.sequence.length);

        if (bufferEnd.length === code.sequence.length &&
            bufferEnd.every((key, i) => key === code.sequence[i])) {
          console.log(`[App] Code secret "${code.name}" activé !`);
          this._showNotification({
            type: 'success',
            message: code.message
          });
          eventBus.emit(code.event);
          inputBuffer = []; // Reset après activation
          break;
        }
      }
    });
  }

  /**
   * Charge la page initiale
   * @private
   */
  _loadInitialPage() {
    // Vérifier l'URL actuelle
    const hash = window.location.hash.slice(1) || '/admin';
    const section = hash.replace('/', '') || 'admin';

    // Mettre à jour la navigation
    if (this.navigation) {
      this.navigation.setActiveSection(section);
    }

    // Afficher la page
    this._showPage(section);
  }

  /**
   * Affiche une page
   * @param {string} pageId
   * @private
   */
  _showPage(pageId) {
    if (!this.containers.main) return;

    // Démonter la page actuelle
    if (this.currentPage) {
      this.currentPage.unmount();
      this.currentPage = null;
    }

    // Créer la nouvelle page si nécessaire
    if (!this.pages[pageId]) {
      const PageClass = this._getPageClass(pageId);
      if (PageClass) {
        this.pages[pageId] = new PageClass(this.containers.main);
      }
    }

    // Monter la nouvelle page
    this.currentPage = this.pages[pageId];
    if (this.currentPage) {
      this.currentPage.mount();
    }

    // Mettre à jour le store
    store.dispatch({ currentSection: pageId });

    console.log(`[App] Page affichée: ${pageId}`);
  }

  /**
   * Récupère la classe de page correspondante
   * @param {string} pageId
   * @returns {Class}
   * @private
   */
  _getPageClass(pageId) {
    const pageClasses = {
      admin: AdminPage,
      review: ReviewPage,
      forecast: ForecastPage,
      shared: SharedContributorsPage,
      howmany: HowManyPage
    };

    return pageClasses[pageId] || null;
  }

  /**
   * Affiche une notification
   * @param {Object} data
   * @param {string} data.type - 'success' | 'error' | 'warning' | 'info'
   * @param {string} data.message
   * @param {number} data.duration - Durée en ms (défaut: 3000)
   * @private
   */
  _showNotification({ type = 'info', message, duration = 3000 }) {
    if (!this.containers.notifications) return;

    // Créer l'élément notification
    const notification = document.createElement('div');
    notification.className = `notification notification--${type}`;

    const icons = {
      success: '✓',
      error: '✕',
      warning: '⚠',
      info: 'ℹ'
    };

    notification.innerHTML = `
      <span class="notification__icon">${icons[type]}</span>
      <span class="notification__message">${message}</span>
      <button class="notification__close" aria-label="Fermer">✕</button>
    `;

    // Ajouter au container
    this.containers.notifications.appendChild(notification);

    // Animation d'entrée
    requestAnimationFrame(() => {
      notification.classList.add('notification--visible');
    });

    // Gestionnaire de fermeture
    const closeBtn = notification.querySelector('.notification__close');
    const close = () => {
      notification.classList.remove('notification--visible');
      setTimeout(() => notification.remove(), 300);
    };

    closeBtn.addEventListener('click', close);

    // Auto-fermeture
    if (duration > 0) {
      setTimeout(close, duration);
    }
  }

  /**
   * Gère le redimensionnement
   * @private
   */
  _handleResize() {
    // Émettre un événement pour les composants qui en ont besoin
    eventBus.emit('window:resize', {
      width: window.innerWidth,
      height: window.innerHeight
    });
  }

  /**
   * Affiche les informations de démarrage
   * @private
   */
  _showStartupInfo() {
    const state = store.getState();
    const { manualInput } = state;

    console.log('═══════════════════════════════════════════════');
    console.log('  Sprint Review Dashboard');
    console.log('═══════════════════════════════════════════════');
    console.log(`  Sprint: ${manualInput?.sprintName || 'Non défini'}`);
    console.log(`  Équipe: ${manualInput?.teamName || 'Non définie'}`);
    console.log('═══════════════════════════════════════════════');
  }

  /**
   * Navigue vers une section
   * @param {string} section
   */
  navigateTo(section) {
    this.navigation?.navigateTo(section);
  }

  /**
   * Récupère l'état actuel
   * @returns {Object}
   */
  getState() {
    return store.getState();
  }
}

// =========================================================================
// INITIALISATION
// =========================================================================

// Créer l'instance de l'application
const app = new App();

// Initialiser quand le DOM est prêt
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => app.init());
} else {
  app.init();
}

// Exposer globalement pour le debug
window.SprintReviewApp = app;
window.SprintReviewStore = store;
window.SprintReviewEventBus = eventBus;

export default app;
