/**
 * ==========================================================================
 * FORECASTPAGE.JS - Page de Forecast avec Monte Carlo individuel
 * ==========================================================================
 *
 * Page d'affichage des projections et prévisions :
 * - Métriques individuelles par contributeur
 * - Simulation Monte Carlo
 * - Scénarios de sprint (Pessimiste, Réaliste, Optimiste)
 * - Graphiques de distribution
 *
 * ==========================================================================
 */

import Component from '../components/Component.js';
import { BarChart, TrendChart } from '../components/charts/index.js';
import store from '../core/store.js';
import eventBus from '../core/eventBus.js';
import config from '../core/config.js';
import forecastDataService from '../services/forecastDataService.js';
import pdfExporter from '../services/pdfExporter.js';
import { formatNumber, formatPercent } from '../utils/formatters.js';

// =========================================================================
// COULEURS POUR LES CONTRIBUTEURS
// =========================================================================

const CONTRIBUTOR_COLORS = [
  '#3B82F6', // blue
  '#10B981', // green
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // purple
  '#EC4899', // pink
  '#06B6D4', // cyan
  '#F97316', // orange
  '#84CC16', // lime
  '#6366F1'  // indigo
];

// =========================================================================
// CLASSE FORECASTPAGE
// =========================================================================

export default class ForecastPage extends Component {
  constructor(container, props = {}) {
    super(container, props);
    this.components = {};
  }

  /**
   * Initialisation
   */
  init() {
    // Lire l'état actuel du store
    const currentState = store.getState();
    const csvData = currentState.csvData;

    this.state = {
      forecastData: null,
      rawTickets: csvData?.tickets || null,
      excludedContributors: [],
      isExporting: false,
      isLoading: false,
      error: null,
      showIndividualSections: false // Caché par défaut (Konami: →→←←)
    };

    // Écouter le déverrouillage des sections individuelles
    eventBus.on('secret:unlock:individual', () => {
      this.setState({ showIndividualSections: true });
    });

    // Écouter le masquage de tous les secrets
    eventBus.on('secret:hide-all', () => {
      this.setState({ showIndividualSections: false });
    });

    // Charger les données si déjà présentes
    if (csvData && csvData.tickets && csvData.tickets.length > 0) {
      console.log('[ForecastPage] init - Données CSV déjà présentes, chargement...');
      this._loadForecastData(csvData.tickets);
    }

    // S'abonner aux changements du store (données CSV)
    this.subscribe(
      state => state.csvData,
      (csvData) => {
        console.log('[ForecastPage] subscribe - csvData changé:', !!csvData);
        if (csvData && csvData.tickets) {
          this._loadForecastData(csvData.tickets);
        }
      }
    );

    // S'abonner aux changements de manualInput (changement de sprint en Review)
    this.subscribe(
      state => state.manualInput?.sprintName,
      (sprintName) => {
        console.log('[ForecastPage] subscribe - sprintName changé:', sprintName);
        // Recalculer si on a déjà des tickets
        if (this.state.rawTickets && this.state.rawTickets.length > 0) {
          this._loadForecastData(this.state.rawTickets);
        }
      }
    );
  }

  /**
   * Extrait le numéro de sprint depuis un nom comme "Sprint 16"
   * @param {string} sprintName
   * @returns {number|null}
   * @private
   */
  _extractSprintNumber(sprintName) {
    if (!sprintName) return null;
    const match = sprintName.match(/Sprint\s*(\d+)/i);
    return match ? parseInt(match[1], 10) : null;
  }

  /**
   * Charge et calcule les données de forecast
   * @param {Array} tickets
   * @private
   */
  _loadForecastData(tickets) {
    this.setState({ isLoading: true, error: null, rawTickets: tickets });

    try {
      // Récupérer le sprint actuellement affiché en Review depuis manualInput
      const currentState = store.getState();
      const manualInput = currentState.manualInput;
      const reviewSprint = this._extractSprintNumber(manualInput?.sprintName);

      console.log('[ForecastPage] manualInput.sprintName:', manualInput?.sprintName);
      console.log('[ForecastPage] reviewSprint extrait:', reviewSprint);

      const forecastData = forecastDataService.prepareForecastData(tickets, {
        excludedContributors: this.state.excludedContributors,
        reviewSprint: reviewSprint
      });

      if (!forecastData.isValid) {
        this.setState({
          forecastData: null,
          error: forecastData.error,
          isLoading: false
        });
        return;
      }

      this.setState({
        forecastData,
        isLoading: false,
        error: null
      });
    } catch (error) {
      console.error('[ForecastPage] Erreur:', error);
      this.setState({
        forecastData: null,
        error: error.message,
        isLoading: false
      });
    }
  }

  /**
   * Recalcule avec les exclusions
   * @private
   */
  _recalculateForecast() {
    if (this.state.rawTickets) {
      this._loadForecastData(this.state.rawTickets);
    }
  }

  /**
   * Après montage
   */
  afterMount() {
    console.log('[ForecastPage] afterMount() appelé');

    // Rafraîchir l'état depuis le store (important si la page est en cache)
    const currentState = store.getState();
    const csvData = currentState.csvData;

    console.log('[ForecastPage] afterMount - state.forecastData:', !!this.state.forecastData);
    console.log('[ForecastPage] afterMount - store.csvData:', !!csvData);

    // Si on a des données CSV mais pas encore de forecastData, charger
    if (csvData && csvData.tickets && csvData.tickets.length > 0) {
      console.log('[ForecastPage] afterMount - Chargement des données forecast...');
      this._loadForecastData(csvData.tickets);
    }
  }

  /**
   * Avant démontage
   */
  beforeUnmount() {
    Object.values(this.components).forEach(component => {
      if (component && typeof component.unmount === 'function') {
        component.unmount();
      }
    });
    this.components = {};
  }



  /**
   * Rendu du composant
   */
  render() {
    const { forecastData, isLoading, error, isExporting, excludedContributors, showIndividualSections } = this.state;

    if (isLoading) {
      return this._renderLoading();
    }

    if (error) {
      return this._renderError(error);
    }

    if (!forecastData || !forecastData.isValid) {
      return this._renderEmptyState();
    }

    return `
      <div class="forecast-page" id="section-forecast">
        ${this._renderHeader()}

        <div class="forecast-page__content">
          <!-- Scénarios Monte Carlo -->
          <section class="forecast-section forecast-section--scenarios">
            <div class="forecast-section__header">
              <h3 class="forecast-section__title">Vélocité Sprint ${forecastData.nextSprint}</h3>
              <p class="forecast-section__subtitle">
                Basée sur ${forecastData.simulation.iterations.toLocaleString()} simulations Monte Carlo
                <button class="help-btn" data-action="show-monte-carlo-help" title="Qu'est-ce que Monte Carlo ?">?</button>
                ${excludedContributors.length > 0 ? `<span class="subtitle-warning">(${excludedContributors.length} absence(s) simulée(s))</span>` : ''}
              </p>
            </div>
            <div class="forecast-section__content">
              ${this._renderScenarios()}
            </div>
          </section>

          ${showIndividualSections ? `
          <!-- Gestion des absences (section secrète) -->
          <section class="forecast-section forecast-section--absences">
            <div class="forecast-section__header">
              <h3 class="forecast-section__title">Simuler des absences</h3>
              <p class="forecast-section__subtitle">
                Cochez les contributeurs absents pour recalculer automatiquement les prévisions
              </p>
            </div>
            <div class="forecast-section__content">
              ${this._renderAbsenceSelector()}
            </div>
          </section>

          <!-- Contributeurs (section secrète) -->
          <section class="forecast-section forecast-section--contributors">
            <div class="forecast-section__header">
              <h3 class="forecast-section__title">Simulation par contributeur</h3>
              <p class="forecast-section__subtitle">
                Basée sur les Sprints ${forecastData.sprintNumbers[0]} à ${forecastData.sprintNumbers[forecastData.sprintNumbers.length - 1]}
              </p>
            </div>
            <div class="forecast-section__content">
              ${this._renderContributorsTable()}
            </div>
          </section>
          ` : ''}

        </div>

        ${isExporting ? '<div class="forecast-page__overlay"><div class="loader"></div></div>' : ''}

        <!-- Modal explicative Monte Carlo -->
        <div class="modal-overlay" data-modal="monte-carlo-help" style="display: none;">
          <div class="modal">
            <div class="modal__header">
              <h3 class="modal__title">Simulation Monte Carlo</h3>
              <button class="modal__close" data-action="close-modal">&times;</button>
            </div>
            <div class="modal__body">
              <p><strong>Comment ça fonctionne ?</strong></p>
              <p>La méthode Monte Carlo simule <strong>${forecastData.simulation.iterations.toLocaleString()} sprints virtuels</strong> en piochant aléatoirement dans l'historique de chaque contributeur.</p>

              <p><strong>Pour chaque simulation :</strong></p>
              <ol>
                <li>Pour chaque membre de l'équipe, on pioche au hasard une de ses performances passées</li>
                <li>On additionne les contributions de tous les membres</li>
                <li>On obtient un total équipe pour ce sprint simulé</li>
              </ol>

              <p><strong>Résultat :</strong></p>
              <p>Après ${forecastData.simulation.iterations.toLocaleString()} tirages, on obtient une distribution de probabilité :</p>
              <ul>
                <li><strong class="text-warning">Pessimiste (P15)</strong> : 85% des simulations ont fait mieux</li>
                <li><strong class="text-primary">Réaliste (P50)</strong> : la médiane - 50% au-dessus, 50% en-dessous</li>
                <li><strong class="text-success">Optimiste (P85)</strong> : seulement 15% des simulations ont fait mieux</li>
              </ul>

              <p><strong>Pourquoi c'est utile ?</strong></p>
              <p>Plutôt que de fixer un objectif unique basé sur une moyenne, cette approche permet de définir des objectifs réalistes avec un niveau de confiance connu.</p>
            </div>
            <div class="modal__footer">
              <button class="btn btn--primary" data-action="close-modal">Merci, bonne histoire pour la machine à café ça !</button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Rendu du header (style harmonisé avec ReviewPage)
   * @returns {string}
   * @private
   */
  _renderHeader() {
    const { isExporting, forecastData } = this.state;
    const currentState = store.getState();
    const teamName = currentState.manualInput?.teamName || 'Équipe';

    return `
      <header class="forecast-page__header">
        <div class="forecast-page__header-info">
          <h2 class="forecast-page__title">${teamName}</h2>
          <p class="forecast-page__team">Forecast Sprint ${forecastData?.nextSprint || ''}</p>
        </div>

        <div class="forecast-page__header-actions">
          <button class="btn btn--primary"
                  data-action="export-md"
                  ${isExporting ? 'disabled' : ''}>
            ${isExporting ? 'Export...' : 'Exporter'}
          </button>
        </div>
      </header>
    `;
  }

  /**
   * Rendu des scénarios Monte Carlo
   * @returns {string}
   * @private
   */
  _renderScenarios() {
    const { forecastData } = this.state;
    const scenarios = forecastData.scenarios;

    return `
      <div class="scenarios-grid">
        ${scenarios.map(scenario => `
          <div class="scenario-card scenario-card--${scenario.color}">
            <div class="scenario-card__header">
              <span class="scenario-card__label">${scenario.label}</span>
              <span class="scenario-card__confidence">${scenario.confidence}% de chances</span>
            </div>
            <div class="scenario-card__body">
              <div class="scenario-card__metric">
                <span class="scenario-card__value">${scenario.throughput}</span>
                <span class="scenario-card__unit">tickets</span>
              </div>
              ${forecastData.validation.hasStoryPoints ? `
                <div class="scenario-card__metric">
                  <span class="scenario-card__value">${scenario.storyPoints}</span>
                  <span class="scenario-card__unit">story points</span>
                </div>
              ` : ''}
            </div>
            <div class="scenario-card__footer">
              <span class="scenario-card__description">${scenario.description}</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Rendu du tableau des contributeurs avec scénarios individuels
   * @returns {string}
   * @private
   */
  _renderContributorsTable() {
    const { forecastData, excludedContributors } = this.state;
    const contributors = forecastData.contributors;
    const hasStoryPoints = forecastData.validation.hasStoryPoints;

    return `
      <div class="contributors-table-wrapper">
        <table class="contributors-table contributors-table--scenarios">
          <thead>
            <tr>
              <th rowspan="2">Contributeur</th>
              <th colspan="3" class="th-group">Tickets</th>
              ${hasStoryPoints ? '<th colspan="3" class="th-group">Story Points</th>' : ''}
              <th rowspan="2">Fiabilité</th>
            </tr>
            <tr>
              <th class="th-scenario th-scenario--warning">Pessimiste</th>
              <th class="th-scenario th-scenario--primary">Réaliste</th>
              <th class="th-scenario th-scenario--success">Optimiste</th>
              ${hasStoryPoints ? `
                <th class="th-scenario th-scenario--warning">Pessimiste</th>
                <th class="th-scenario th-scenario--primary">Réaliste</th>
                <th class="th-scenario th-scenario--success">Optimiste</th>
              ` : ''}
            </tr>
          </thead>
          <tbody>
            ${contributors.map((c, idx) => `
              <tr class="${excludedContributors.includes(c.name) ? 'excluded' : ''}">
                <td class="contributor-cell">
                  <span class="contributor-color" style="background-color: ${CONTRIBUTOR_COLORS[idx % CONTRIBUTOR_COLORS.length]}"></span>
                  <span class="contributor-name">${c.name}</span>
                  <span class="contributor-sprints">${c.sprintsActive}/${c.sprintsAnalyzed} sprints</span>
                </td>
                <td class="scenario-cell scenario-cell--warning">${c.throughput.p15}</td>
                <td class="scenario-cell scenario-cell--primary"><strong>${c.throughput.p50}</strong></td>
                <td class="scenario-cell scenario-cell--success">${c.throughput.p85}</td>
                ${hasStoryPoints ? `
                  <td class="scenario-cell scenario-cell--warning">${c.storyPoints.p15}</td>
                  <td class="scenario-cell scenario-cell--primary"><strong>${c.storyPoints.p50}</strong></td>
                  <td class="scenario-cell scenario-cell--success">${c.storyPoints.p85}</td>
                ` : ''}
                <td class="fiability-cell">
                  <span class="badge badge--${c.isReliable ? 'success' : 'warning'}">
                    ${c.isReliable ? 'Fiable' : 'Limité'}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr>
              <td><strong>ÉQUIPE</strong></td>
              <td class="scenario-cell scenario-cell--warning">${forecastData.simulation.throughput.p15}</td>
              <td class="scenario-cell scenario-cell--primary"><strong>${forecastData.simulation.throughput.p50}</strong></td>
              <td class="scenario-cell scenario-cell--success">${forecastData.simulation.throughput.p85}</td>
              ${hasStoryPoints ? `
                <td class="scenario-cell scenario-cell--warning">${forecastData.simulation.storyPoints.p15}</td>
                <td class="scenario-cell scenario-cell--primary"><strong>${forecastData.simulation.storyPoints.p50}</strong></td>
                <td class="scenario-cell scenario-cell--success">${forecastData.simulation.storyPoints.p85}</td>
              ` : ''}
              <td>-</td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  }

  /**
   * Rendu du sélecteur d'absences
   * @returns {string}
   * @private
   */
  _renderAbsenceSelector() {
    const { forecastData, excludedContributors } = this.state;
    const contributors = forecastData.contributors;

    return `
      <div class="absence-selector">
        <div class="absence-selector__list">
          ${contributors.map(c => `
            <label class="absence-selector__item">
              <input type="checkbox"
                     data-action="toggle-absence"
                     data-contributor="${c.name}"
                     ${excludedContributors.includes(c.name) ? 'checked' : ''}>
              <span>${c.name}</span>
            </label>
          `).join('')}
        </div>
        ${excludedContributors.length > 0 ? `
          <div class="absence-selector__summary">
            <strong>${excludedContributors.length}</strong> contributeur(s) exclu(s)
            <button class="btn btn--link" data-action="clear-absences">
              Réinitialiser
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Rendu de l'état de chargement
   * @returns {string}
   * @private
   */
  _renderLoading() {
    return `
      <div class="forecast-page forecast-page--loading">
        <div class="loader"></div>
        <p>Calcul des prévisions en cours...</p>
      </div>
    `;
  }

  /**
   * Rendu de l'erreur
   * @param {string} error
   * @returns {string}
   * @private
   */
  _renderError(error) {
    return `
      <div class="forecast-page forecast-page--error">
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <h3 class="empty-state__title">Données insuffisantes</h3>
          <p class="empty-state__text">${error}</p>
          <button class="btn btn--primary" data-action="go-to-admin">
            Configurer les données
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Rendu de l'état vide
   * @returns {string}
   * @private
   */
  _renderEmptyState() {
    return `
      <div class="forecast-page forecast-page--empty">
        <div class="empty-state">
          <div class="empty-state__icon">📊</div>
          <h3 class="empty-state__title">Aucune donnée de forecast</h3>
          <p class="empty-state__text">
            Chargez un fichier CSV contenant les colonnes <strong>Assignee</strong>
            et <strong>Story Points</strong> pour voir les prévisions Monte Carlo.
          </p>
          <button class="btn btn--primary" data-action="go-to-admin">
            Aller à la préparation
          </button>
        </div>
      </div>
    `;
  }

  /**
   * Définition des événements
   */
  events() {
    return {
      'click [data-action="export-md"]': this._handleExportMarkdown,
      'click [data-action="go-to-admin"]': this._handleGoToAdmin,
      'change [data-action="toggle-absence"]': this._handleToggleAbsence,
      'click [data-action="clear-absences"]': this._handleClearAbsences,
      'click [data-action="show-monte-carlo-help"]': this._handleShowHelp,
      'click [data-action="close-modal"]': this._handleCloseModal,
      'click .modal-overlay': this._handleOverlayClick
    };
  }

  /**
   * Affiche la modal d'aide Monte Carlo
   * @private
   */
  _handleShowHelp() {
    const modal = this.container?.querySelector('[data-modal="monte-carlo-help"]');
    if (modal) {
      modal.style.display = 'flex';
    }
  }

  /**
   * Ferme la modal
   * @private
   */
  _handleCloseModal() {
    const modal = this.container?.querySelector('[data-modal="monte-carlo-help"]');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  /**
   * Ferme la modal si on clique sur l'overlay
   * @param {Event} e
   * @private
   */
  _handleOverlayClick(e) {
    if (e.target.classList.contains('modal-overlay')) {
      this._handleCloseModal();
    }
  }

  /**
   * Gestionnaire export Markdown
   * @private
   */
  _handleExportMarkdown() {
    const { forecastData, excludedContributors } = this.state;
    if (!forecastData) return;

    const currentState = store.getState();
    const teamName = currentState.manualInput?.teamName || 'Équipe';

    // Générer le contenu Markdown
    let md = `# Forecast Sprint ${forecastData.nextSprint}\n\n`;
    md += `**Équipe:** ${teamName}\n`;
    md += `**Date:** ${new Date().toLocaleDateString('fr-FR')}\n`;
    md += `**Basé sur:** Sprints ${forecastData.sprintNumbers[0]} à ${forecastData.sprintNumbers[forecastData.sprintNumbers.length - 1]}\n\n`;

    if (excludedContributors.length > 0) {
      md += `> ⚠️ **Absences simulées:** ${excludedContributors.join(', ')}\n\n`;
    }

    // Vélocité
    md += `## Vélocité estimée\n\n`;
    md += `| Scénario | Tickets | Story Points |\n`;
    md += `|----------|---------|---------------|\n`;
    forecastData.scenarios.forEach(s => {
      md += `| ${s.label} | ${s.throughput} | ${s.storyPoints} |\n`;
    });
    md += `\n`;

    // Simulation par contributeur
    md += `## Simulation par contributeur\n\n`;
    md += `| Contributeur | Sprints | Tickets (P15/P50/P85) | SP (P15/P50/P85) | Fiabilité |\n`;
    md += `|--------------|---------|----------------------|------------------|----------|\n`;
    forecastData.contributors.forEach(c => {
      const excluded = excludedContributors.includes(c.name) ? ' *(absent)*' : '';
      md += `| ${c.name}${excluded} | ${c.sprintsActive}/${c.sprintsAnalyzed} | ${c.throughput.p15} / **${c.throughput.p50}** / ${c.throughput.p85} | ${c.storyPoints.p15} / **${c.storyPoints.p50}** / ${c.storyPoints.p85} | ${c.isReliable ? '✅' : '⚠️'} |\n`;
    });
    md += `| **ÉQUIPE** | - | ${forecastData.simulation.throughput.p15} / **${forecastData.simulation.throughput.p50}** / ${forecastData.simulation.throughput.p85} | ${forecastData.simulation.storyPoints.p15} / **${forecastData.simulation.storyPoints.p50}** / ${forecastData.simulation.storyPoints.p85} | - |\n`;
    md += `\n`;

    // Méthode
    md += `---\n`;
    md += `*Généré par simulation Monte Carlo (${forecastData.simulation.iterations.toLocaleString()} itérations)*\n`;

    // Télécharger le fichier
    const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `forecast-sprint-${forecastData.nextSprint}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    eventBus.emit('notification:show', {
      type: 'success',
      message: 'Fichier Markdown exporté'
    });
  }

  /**
   * Gestionnaire navigation vers admin
   * @private
   */
  _handleGoToAdmin() {
    eventBus.emit('navigation:request', { section: 'admin' });
  }

  /**
   * Gestionnaire toggle absence d'un contributeur
   * @param {Event} e
   * @private
   */
  _handleToggleAbsence(e) {
    const contributor = e.target.dataset.contributor;
    const isExcluded = e.target.checked;

    let newExcluded;
    if (isExcluded) {
      newExcluded = [...this.state.excludedContributors, contributor];
    } else {
      newExcluded = this.state.excludedContributors.filter(c => c !== contributor);
    }

    // Mettre à jour l'état ET recalculer immédiatement
    this.state.excludedContributors = newExcluded;
    this._recalculateForecast();
  }

  /**
   * Gestionnaire réinitialisation des absences
   * @private
   */
  _handleClearAbsences() {
    this.state.excludedContributors = [];
    this._recalculateForecast();
  }
}
