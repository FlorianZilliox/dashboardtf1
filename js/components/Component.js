/**
 * ==========================================================================
 * COMPONENT.JS - Classe de base pour tous les composants
 * ==========================================================================
 *
 * Fournit une architecture commune pour les composants :
 * - Cycle de vie (mount, update, unmount)
 * - Gestion du state local
 * - Abonnement au store
 * - Rendu déclaratif
 *
 * USAGE :
 *   class MyComponent extends Component {
 *     render() {
 *       return `<div>${this.state.value}</div>`;
 *     }
 *   }
 *
 *   const myComponent = new MyComponent('#container', { value: 'test' });
 *   myComponent.mount();
 *
 * ==========================================================================
 */

import eventBus from '../core/eventBus.js';
import store from '../core/store.js';

// =========================================================================
// CLASSE COMPONENT
// =========================================================================

export default class Component {
  /**
   * Crée une instance de composant
   * @param {string|HTMLElement} container - Sélecteur ou élément conteneur
   * @param {Object} props - Propriétés initiales
   */
  constructor(container, props = {}) {
    // Conteneur DOM
    this.container = typeof container === 'string'
      ? document.querySelector(container)
      : container;

    // Propriétés (immuables)
    this.props = Object.freeze({ ...props });

    // State local (mutable)
    this.state = {};

    // Abonnements au store
    this._storeUnsubscribers = [];

    // Abonnements aux événements
    this._eventUnsubscribers = [];

    // État du composant
    this._isMounted = false;

    // Références aux éléments internes
    this.refs = {};

    // Initialiser le state
    this.init();
  }

  // =========================================================================
  // MÉTHODES DE CYCLE DE VIE (à surcharger)
  // =========================================================================

  /**
   * Initialisation du composant (appelé dans le constructeur)
   * Surcharger pour définir le state initial
   */
  init() {
    // À surcharger
  }

  /**
   * Appelé après le premier rendu
   * Surcharger pour ajouter des event listeners
   */
  afterMount() {
    // À surcharger
  }

  /**
   * Appelé après chaque mise à jour
   * @param {Object} prevState - State précédent
   */
  afterUpdate(prevState) {
    // À surcharger
  }

  /**
   * Appelé avant le démontage
   * Surcharger pour nettoyer les ressources
   */
  beforeUnmount() {
    // À surcharger
  }

  /**
   * Retourne le HTML du composant
   * @returns {string} HTML
   */
  render() {
    return '';
  }

  // =========================================================================
  // MÉTHODES PRINCIPALES
  // =========================================================================

  /**
   * Monte le composant dans le DOM
   * @returns {Component} this (pour chaînage)
   */
  mount() {
    if (!this.container) {
      console.error('[Component] Conteneur non trouvé');
      return this;
    }

    // Effectuer le rendu
    this._render();

    // Marquer comme monté
    this._isMounted = true;

    // Lier les événements
    this._bindEvents();

    // Hook après montage
    this.afterMount();

    return this;
  }

  /**
   * Met à jour le state et re-rend le composant
   * @param {Object|Function} newState - Nouveau state ou fonction de mise à jour
   */
  setState(newState) {
    const prevState = { ...this.state };

    // Si fonction, l'appeler avec le state actuel
    if (typeof newState === 'function') {
      this.state = { ...this.state, ...newState(this.state) };
    } else {
      this.state = { ...this.state, ...newState };
    }

    // Re-rendre si monté
    if (this._isMounted) {
      this._render();
      this._bindEvents();
      this.afterUpdate(prevState);
    }
  }

  /**
   * Démonte le composant
   */
  unmount() {
    if (!this._isMounted) return;

    // Hook avant démontage
    this.beforeUnmount();

    // Désabonner du store
    this._storeUnsubscribers.forEach(unsub => unsub());
    this._storeUnsubscribers = [];

    // Désabonner des événements
    this._eventUnsubscribers.forEach(unsub => unsub());
    this._eventUnsubscribers = [];

    // Vider le conteneur
    if (this.container) {
      this.container.innerHTML = '';
    }

    // Marquer comme démonté
    this._isMounted = false;
  }

  /**
   * Force un re-rendu
   */
  forceUpdate() {
    if (this._isMounted) {
      this._render();
      this._bindEvents();
    }
  }

  // =========================================================================
  // ABONNEMENTS
  // =========================================================================

  /**
   * S'abonne à une partie du store
   * @param {Function} selector - Fonction de sélection (state => value)
   * @param {Function} callback - Callback appelé lors des changements
   * @returns {Function} Fonction de désabonnement
   */
  subscribe(selector, callback) {
    const unsubscribe = store.subscribe(selector, (value, state) => {
      callback(value, state);
    });

    this._storeUnsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  /**
   * S'abonne à un événement
   * @param {string} event - Nom de l'événement
   * @param {Function} callback - Callback
   * @returns {Function} Fonction de désabonnement
   */
  on(event, callback) {
    const unsubscribe = eventBus.on(event, callback);
    this._eventUnsubscribers.push(unsubscribe);
    return unsubscribe;
  }

  // =========================================================================
  // MÉTHODES DOM
  // =========================================================================

  /**
   * Sélectionne un élément dans le composant
   * @param {string} selector - Sélecteur CSS
   * @returns {HTMLElement|null}
   */
  $(selector) {
    return this.container?.querySelector(selector) || null;
  }

  /**
   * Sélectionne tous les éléments correspondants
   * @param {string} selector - Sélecteur CSS
   * @returns {HTMLElement[]}
   */
  $$(selector) {
    return Array.from(this.container?.querySelectorAll(selector) || []);
  }

  /**
   * Récupère un élément par data-ref
   * @param {string} refName - Nom de la référence
   * @returns {HTMLElement|null}
   */
  getRef(refName) {
    return this.$(`[data-ref="${refName}"]`);
  }

  /**
   * Met à jour les références (éléments avec data-ref)
   * @private
   */
  _updateRefs() {
    this.refs = {};
    this.$$('[data-ref]').forEach(el => {
      this.refs[el.dataset.ref] = el;
    });
  }

  // =========================================================================
  // MÉTHODES PRIVÉES
  // =========================================================================

  /**
   * Effectue le rendu dans le conteneur
   * @private
   */
  _render() {
    if (!this.container) return;

    const html = this.render();
    this.container.innerHTML = html;

    // Mettre à jour les références
    this._updateRefs();
  }

  /**
   * Lie les événements (à surcharger ou utiliser events())
   * @private
   */
  _bindEvents() {
    // Récupérer la map des événements
    const eventsMap = this.events();

    Object.entries(eventsMap).forEach(([key, handler]) => {
      // Format: "click .selector" ou "click"
      const [eventType, selector] = key.split(' ');

      if (selector) {
        // Délégation d'événement
        this.$$(selector).forEach(el => {
          el.addEventListener(eventType, handler.bind(this));
        });
      } else {
        // Événement sur le conteneur
        this.container?.addEventListener(eventType, handler.bind(this));
      }
    });
  }

  /**
   * Retourne la map des événements
   * Format: { 'click .btn': this.handleClick }
   * @returns {Object}
   */
  events() {
    return {};
  }

  // =========================================================================
  // UTILITAIRES
  // =========================================================================

  /**
   * Émet un événement depuis le composant
   * @param {string} event - Nom de l'événement
   * @param {*} data - Données
   */
  emit(event, data) {
    eventBus.emit(event, data);
  }

  /**
   * Dispatch une action au store
   * @param {Object} changes - Changements à appliquer
   */
  dispatch(changes) {
    store.dispatch(changes);
  }

  /**
   * Récupère l'état actuel du store
   * @returns {Object}
   */
  getStoreState() {
    return store.getState();
  }

  /**
   * Crée un élément DOM
   * @param {string} tag - Tag HTML
   * @param {Object} attrs - Attributs
   * @param {string|HTMLElement|Array} children - Contenu
   * @returns {HTMLElement}
   */
  createElement(tag, attrs = {}, children = null) {
    const element = document.createElement(tag);

    Object.entries(attrs).forEach(([key, value]) => {
      if (key === 'class' || key === 'className') {
        element.className = Array.isArray(value) ? value.join(' ') : value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(element.style, value);
      } else if (key.startsWith('on') && typeof value === 'function') {
        const event = key.slice(2).toLowerCase();
        element.addEventListener(event, value);
      } else if (value !== undefined && value !== null) {
        element.setAttribute(key, value);
      }
    });

    if (children !== null) {
      if (Array.isArray(children)) {
        children.forEach(child => {
          if (typeof child === 'string') {
            element.appendChild(document.createTextNode(child));
          } else if (child instanceof HTMLElement) {
            element.appendChild(child);
          }
        });
      } else if (typeof children === 'string') {
        element.textContent = children;
      } else if (children instanceof HTMLElement) {
        element.appendChild(children);
      }
    }

    return element;
  }

  /**
   * Escape HTML pour éviter XSS
   * @param {string} str - Chaîne à échapper
   * @returns {string}
   */
  escapeHtml(str) {
    if (typeof str !== 'string') return '';
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;'
    };
    return str.replace(/[&<>"']/g, char => map[char]);
  }
}
