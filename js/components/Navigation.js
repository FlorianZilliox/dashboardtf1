/**
 * ==========================================================================
 * NAVIGATION.JS - Composant de navigation (Masthead horizontal)
 * ==========================================================================
 *
 * Gere la navigation entre les sections via des tabs horizontaux :
 * - Admin (preparation)
 * - Review (presentation)
 * - Forecast (projection)
 * - Pages secretes (StarAc, HowMany)
 * - Bouton RGPD
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
    label: 'Préparation',
    num: '§ 01'
  },
  review: {
    id: 'review',
    label: 'Review',
    num: '§ 02'
  },
  forecast: {
    id: 'forecast',
    label: 'Forecast',
    num: '§ 03'
  },
  shared: {
    id: 'shared',
    label: 'StarAc',
    num: '§ ★',
    secret: 'starac'
  },
  howmany: {
    id: 'howmany',
    label: 'How Many',
    num: '§ #',
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
   * @param {Array} props.sections - Sections a afficher
   * @param {string} props.activeSection - Section active
   */
  constructor(container, props = {}) {
    super(container, {
      sections: ['admin', 'review', 'forecast'],
      activeSection: 'admin',
      ...props
    });
  }

  /**
   * Initialisation
   */
  init() {
    this.state = {
      activeSection: this.props.activeSection,
      unlockedSecrets: new Set()
    };

    // Ecouter les changements de route
    this.on('route:changed', ({ route }) => {
      const section = route.replace('/', '') || 'admin';
      if (section !== this.state.activeSection) {
        this.setState({ activeSection: section });
      }
    });

    // Ecouter les evenements de deverrouillage
    eventBus.on('secret:unlock:starac', () => {
      this.unlockSecret('starac');
    });

    eventBus.on('secret:unlock:howmany', () => {
      this.unlockSecret('howmany');
    });

    // Ecouter l'evenement pour cacher tous les secrets
    eventBus.on('secret:hide-all', () => {
      this.hideAllSecrets();
    });
  }

  /**
   * Deverrouille une section secrete
   * @param {string} secretId
   */
  unlockSecret(secretId) {
    if (!this.state.unlockedSecrets.has(secretId)) {
      const newUnlocked = new Set(this.state.unlockedSecrets);
      newUnlocked.add(secretId);
      this.setState({ unlockedSecrets: newUnlocked });
    }
  }

  /**
   * Verifie si un secret est deverrouille
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
    const secretSections = ['shared', 'howmany'];
    if (secretSections.includes(this.state.activeSection)) {
      this.navigateTo('admin');
    }
    this.setState({ unlockedSecrets: new Set() });
  }

  /**
   * Change de section
   * @param {string} sectionId
   */
  navigateTo(sectionId) {
    if (sectionId === this.state.activeSection) return;

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
   * Recupere la section active
   * @returns {string}
   */
  getActiveSection() {
    return this.state.activeSection;
  }

  /**
   * Rendu du composant — tabs horizontaux style masthead
   */
  render() {
    const { sections } = this.props;
    const { activeSection, unlockedSecrets } = this.state;

    // Construire la liste des sections visibles
    const visibleSections = [...sections];

    if (unlockedSecrets.has('starac')) {
      visibleSections.push('shared');
    }
    if (unlockedSecrets.has('howmany')) {
      visibleSections.push('howmany');
    }

    const tabs = visibleSections.map(sectionId => {
      const section = SECTIONS_CONFIG[sectionId];
      if (!section) return '';

      const isActive = activeSection === sectionId;
      const secretClass = section.secret === 'starac' ? 'tab--secret' : '';

      return `
        <button class="tab ${secretClass}"
                data-section="${sectionId}"
                data-action="navigate"
                role="tab"
                aria-selected="${isActive}">
          <span class="tab__num">${section.num}</span>
          ${section.label}
        </button>
      `;
    }).join('');

    return `
      <div class="navigation" role="navigation" aria-label="Navigation principale">
        ${tabs}
        <button class="tab tab--right"
                data-action="show-rgpd"
                title="RGPD">
          <span class="tab__num">¶</span>
          RGPD
        </button>
      </div>
    `;
  }

  /**
   * Definition des evenements
   */
  events() {
    return {
      'click [data-action="navigate"]': this._handleNavigate,
      'click [data-action="show-rgpd"]': this._handleShowRgpd
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
   * Gestionnaire RGPD
   * @private
   */
  _handleShowRgpd() {
    const modal = document.getElementById('rgpd-modal');
    if (modal) {
      modal.classList.add('modal-overlay--visible');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Definit la section active sans navigation
   * @param {string} sectionId
   */
  setActiveSection(sectionId) {
    if (SECTIONS_CONFIG[sectionId]) {
      this.setState({ activeSection: sectionId });
    }
  }

  /**
   * Verifie si toutes les conditions sont remplies pour acceder a une section
   * @param {string} sectionId
   * @returns {boolean}
   */
  canAccessSection(sectionId) {
    if (sectionId === 'review' || sectionId === 'forecast') {
      const state = this.getStoreState();
      return state.csvLoaded || state.manualInput;
    }
    return true;
  }
}
