/**
 * ==========================================================================
 * NAVIGATION.JS - Composant de navigation
 * ==========================================================================
 *
 * Gère la navigation entre les sections :
 * - Admin (préparation)
 * - Review (présentation)
 * - Forecast (projection)
 *
 * USAGE :
 *   const nav = new Navigation('#nav-container', {
 *     sections: ['admin', 'review', 'forecast'],
 *     activeSection: 'admin'
 *   });
 *
 * ==========================================================================
 */

import Component from './Component.js';
import router from '../core/router.js';
import eventBus from '../core/eventBus.js';

// =========================================================================
// CONFIGURATION DES SECTIONS
// =========================================================================

const SECTIONS_CONFIG = {
  admin: {
    id: 'admin',
    label: 'Préparation'
  },
  review: {
    id: 'review',
    label: 'Review'
  },
  forecast: {
    id: 'forecast',
    label: 'Forecast'
  },
  shared: {
    id: 'shared',
    label: 'StarAc',
    secret: 'starac'
  },
  howmany: {
    id: 'howmany',
    label: 'How Many',
    secret: 'howmany'
  }
};

// =========================================================================
// CLASSE NAVIGATION
// =========================================================================

export default class Navigation extends Component {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {Array} props.sections - Sections à afficher
   * @param {string} props.activeSection - Section active
   * @param {boolean} props.showIcons - Afficher les icônes
   * @param {boolean} props.showDescriptions - Afficher les descriptions (mobile: non)
   */
  constructor(container, props = {}) {
    super(container, {
      sections: ['admin', 'review', 'forecast'],
      activeSection: 'admin',
      showIcons: true,
      showDescriptions: false,
      ...props
    });
  }

  /**
   * Initialisation
   */
  init() {
    this.state = {
      activeSection: this.props.activeSection,
      unlockedSecrets: new Set() // Tracks which secrets are unlocked
    };

    // Écouter les changements de route
    this.on('route:changed', ({ route }) => {
      const section = route.replace('/', '') || 'admin';
      if (section !== this.state.activeSection) {
        this.setState({ activeSection: section });
      }
    });

    // Écouter les événements de déverrouillage (un par page secrète)
    eventBus.on('secret:unlock:starac', () => {
      this.unlockSecret('starac');
    });

    eventBus.on('secret:unlock:howmany', () => {
      this.unlockSecret('howmany');
    });

    // Écouter l'événement pour cacher tous les secrets
    eventBus.on('secret:hide-all', () => {
      this.hideAllSecrets();
    });
  }

  /**
   * Déverrouille une section secrète
   * @param {string} secretId - Identifiant du secret ('starac', 'howmany')
   */
  unlockSecret(secretId) {
    if (!this.state.unlockedSecrets.has(secretId)) {
      const newUnlocked = new Set(this.state.unlockedSecrets);
      newUnlocked.add(secretId);
      this.setState({ unlockedSecrets: newUnlocked });
    }
  }

  /**
   * Vérifie si un secret est déverrouillé
   * @param {string} secretId
   * @returns {boolean}
   */
  isSecretUnlocked(secretId) {
    return this.state.unlockedSecrets.has(secretId);
  }

  /**
   * Cache tous les onglets secrets
   */
  hideAllSecrets() {
    // Si on est sur une page secrète, naviguer vers admin
    const secretSections = ['shared', 'howmany'];
    if (secretSections.includes(this.state.activeSection)) {
      this.navigateTo('admin');
    }

    // Vider les secrets déverrouillés
    this.setState({ unlockedSecrets: new Set() });
  }

  /**
   * Change de section
   * @param {string} sectionId
   */
  navigateTo(sectionId) {
    if (sectionId === this.state.activeSection) return;

    // Vérifier si la section existe
    if (!SECTIONS_CONFIG[sectionId]) {
      console.warn(`[Navigation] Section inconnue: ${sectionId}`);
      return;
    }

    this.setState({ activeSection: sectionId });
    router.navigate(`/${sectionId}`);

    eventBus.emit('navigation:changed', {
      section: sectionId,
      config: SECTIONS_CONFIG[sectionId]
    });
  }

  /**
   * Récupère la section active
   * @returns {string}
   */
  getActiveSection() {
    return this.state.activeSection;
  }

  /**
   * Rendu du composant
   */
  render() {
    const { sections } = this.props;
    const { activeSection, unlockedSecrets } = this.state;

    // Construire la liste des sections visibles
    const visibleSections = [...sections];

    // Ajouter les sections secrètes déverrouillées
    if (unlockedSecrets.has('starac')) {
      visibleSections.push('shared');
    }
    if (unlockedSecrets.has('howmany')) {
      visibleSections.push('howmany');
    }

    return `
      <div class="navigation" role="navigation" aria-label="Navigation principale">
        <div class="navigation__tabs">
          ${visibleSections.map(sectionId => {
            const section = SECTIONS_CONFIG[sectionId];
            if (!section) return '';

            const isActive = activeSection === sectionId;
            const secretType = section.secret; // 'starac', 'howmany', ou undefined

            // StarAc garde son style spécial, How Many reste normal
            const secretClass = secretType === 'starac' ? 'navigation__tab--secret' : '';

            return `
              <button class="navigation__tab ${isActive ? 'navigation__tab--active' : ''} ${secretClass}"
                      data-section="${sectionId}"
                      data-action="navigate"
                      role="tab"
                      aria-selected="${isActive}">
                ${section.label}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  }

  /**
   * Définition des événements
   */
  events() {
    return {
      'click [data-action="navigate"]': this._handleNavigate
    };
  }

  /**
   * Gestionnaire de navigation
   * @param {Event} e
   * @private
   */
  _handleNavigate(e) {
    const section = e.currentTarget.dataset.section;
    if (section) {
      this.navigateTo(section);
    }
  }

  /**
   * Définit la section active sans navigation
   * @param {string} sectionId
   */
  setActiveSection(sectionId) {
    if (SECTIONS_CONFIG[sectionId]) {
      this.setState({ activeSection: sectionId });
    }
  }

  /**
   * Vérifie si toutes les conditions sont remplies pour accéder à une section
   * @param {string} sectionId
   * @returns {boolean}
   */
  canAccessSection(sectionId) {
    // Pour review et forecast, les données doivent être chargées
    if (sectionId === 'review' || sectionId === 'forecast') {
      const state = this.getStoreState();
      return state.csvLoaded || state.manualInput;
    }
    return true;
  }
}
