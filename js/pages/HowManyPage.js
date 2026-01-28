/**
 * ==========================================================================
 * HOWMANYPAGE.JS - Page secrète "How Many" Monte Carlo
 * ==========================================================================
 *
 * Page cachée accessible via Konami code (←←→→)
 * Affiche le forecast "How Many" : combien d'items livrer sur X semaines
 *
 * Règles métier : /docs/MONTE-CARLO-HOWMANY.md
 *
 * ==========================================================================
 */

import Component from '../components/Component.js';
import store from '../core/store.js';
import {
  runSimulation,
  extractThroughputs,
  formatResults,
  HORIZONS_LABELS,
  CONFIG
} from '../services/howManyService.js';

// =========================================================================
// CLASSE HOWMANYPAGE
// =========================================================================

export default class HowManyPage extends Component {
  constructor(container, props = {}) {
    super(container, props);
  }

  /**
   * Initialisation
   */
  init() {
    this.state = {
      // Options de simulation (décochées par défaut)
      metric: 'tickets',
      useWeighting: false,
      excludeOutliers: false,

      // Données
      throughputs: [],
      sprints: [],
      simulation: null,
      teamName: '',

      // UI
      isLoading: true,
      error: null
    };
  }

  /**
   * Après montage
   */
  afterMount() {
    this._loadData();
  }

  /**
   * Charge les données et lance la simulation
   * @private
   */
  _loadData() {
    const currentState = store.getState();
    const csvData = currentState.csvData;

    if (!csvData || !csvData.tickets || csvData.tickets.length === 0) {
      this.setState({
        isLoading: false,
        error: 'Aucune donnée CSV chargée. Retournez sur la page Préparation.'
      });
      return;
    }

    const teamName = currentState.manualInput?.teamName || '';

    const { sprints, throughputs } = extractThroughputs(
      csvData.tickets,
      this.state.metric
    );

    if (throughputs.length < CONFIG.MIN_SPRINTS) {
      this.setState({
        isLoading: false,
        teamName,
        error: `Minimum ${CONFIG.MIN_SPRINTS} sprints requis (${CONFIG.MIN_SPRINTS * 2} semaines de données).`
      });
      return;
    }

    const simulation = runSimulation(throughputs, {
      useWeighting: this.state.useWeighting,
      excludeOutliers: this.state.excludeOutliers
    });

    this.setState({
      throughputs,
      sprints,
      simulation,
      teamName,
      isLoading: false,
      error: simulation.success ? null : simulation.error
    });
  }

  /**
   * Rendu du composant
   */
  render() {
    const { isLoading, error, simulation, teamName } = this.state;

    if (isLoading) {
      return this._renderLoading();
    }

    if (error) {
      return this._renderError(error);
    }

    if (!simulation || !simulation.success) {
      return this._renderEmptyState();
    }

    return `
      <div class="forecast-page howmany-page">
        ${this._renderHeader()}

        <div class="forecast-page__content">
          <!-- Options de simulation -->
          <section class="forecast-section">
            <div class="forecast-section__header">
              <h3 class="forecast-section__title">Options de simulation</h3>
              <p class="forecast-section__subtitle">
                Ajustez les paramètres pour affiner les prévisions
              </p>
            </div>
            <div class="forecast-section__content">
              ${this._renderOptions()}
            </div>
          </section>

          <!-- Projection -->
          <section class="forecast-section">
            <div class="forecast-section__header">
              <h3 class="forecast-section__title">Projection Monte Carlo</h3>
              <p class="forecast-section__subtitle">
                ${CONFIG.NUM_SIMULATIONS.toLocaleString()} simulations • Safety factors appliqués
              </p>
            </div>
            <div class="forecast-section__content">
              ${this._renderForecastTable()}
            </div>
          </section>

          <!-- Analyse -->
          <section class="forecast-section">
            <div class="forecast-section__header">
              <h3 class="forecast-section__title">Analyse</h3>
              <p class="forecast-section__subtitle">
                Tendance et stabilité des données
              </p>
            </div>
            <div class="forecast-section__content">
              ${this._renderAnalysis()}
            </div>
          </section>
        </div>

        <footer class="howmany-page__footer">
          <p>← ← → →</p>
        </footer>
      </div>
    `;
  }

  /**
   * Rendu du header
   * @private
   */
  _renderHeader() {
    const { teamName } = this.state;

    return `
      <header class="forecast-page__header">
        <div class="forecast-page__header-main">
          <h1 class="forecast-page__title">
            ${teamName ? this.escapeHtml(teamName) : 'Équipe'}
          </h1>
          <p class="forecast-page__subtitle">Simulation longue durée</p>
        </div>
      </header>
    `;
  }

  /**
   * Rendu du loader
   * @private
   */
  _renderLoading() {
    return `
      <div class="forecast-page forecast-page--loading">
        <div class="loader"></div>
        <p>Simulation Monte Carlo en cours...</p>
      </div>
    `;
  }

  /**
   * Rendu d'une erreur
   * @private
   */
  _renderError(message) {
    return `
      <div class="forecast-page forecast-page--error">
        <div class="empty-state">
          <div class="empty-state__icon">⚠️</div>
          <h3 class="empty-state__title">Erreur</h3>
          <p class="empty-state__text">${message}</p>
          <a href="#admin" class="btn btn--primary">Retour à la préparation</a>
        </div>
      </div>
    `;
  }

  /**
   * Rendu état vide
   * @private
   */
  _renderEmptyState() {
    return `
      <div class="forecast-page forecast-page--empty">
        <div class="empty-state">
          <div class="empty-state__icon">📊</div>
          <h3 class="empty-state__title">Pas de données</h3>
          <p class="empty-state__text">Chargez vos fichiers CSV pour voir les projections.</p>
          <a href="#admin" class="btn btn--primary">Aller à la préparation</a>
        </div>
      </div>
    `;
  }

  /**
   * Rendu des options
   * @private
   */
  _renderOptions() {
    const { metric, useWeighting, excludeOutliers } = this.state;

    return `
      <div class="howmany-options">
        <div class="howmany-options__group">
          <div class="toggle-group">
            <button class="toggle-group__btn ${metric === 'tickets' ? 'toggle-group__btn--active' : ''}"
                    data-action="set-metric" data-value="tickets">
              Tickets
            </button>
            <button class="toggle-group__btn ${metric === 'storyPoints' ? 'toggle-group__btn--active' : ''}"
                    data-action="set-metric" data-value="storyPoints">
              Story Points
            </button>
          </div>
        </div>

        <label class="checkbox-label">
          <input type="checkbox" class="checkbox" ${useWeighting ? 'checked' : ''}
                 data-action="toggle-weighting">
          <span class="checkbox-text">Pondérer les sprints récents</span>
        </label>

        <label class="checkbox-label">
          <input type="checkbox" class="checkbox" ${excludeOutliers ? 'checked' : ''}
                 data-action="toggle-outliers">
          <span class="checkbox-text">Exclure les outliers bas</span>
        </label>
      </div>
    `;
  }

  /**
   * Rendu du tableau de forecast
   * @private
   */
  _renderForecastTable() {
    const { simulation, metric } = this.state;
    const results = formatResults(simulation);
    const metricLabel = metric === 'storyPoints' ? 'SP' : 'tickets';

    return `
      <div class="howmany-forecast">
        <table class="data-table">
          <thead>
            <tr>
              <th>Horizon</th>
              <th class="text-center">Réaliste</th>
              <th class="text-center">Optimiste</th>
              <th class="text-center">Très optimiste</th>
            </tr>
          </thead>
          <tbody>
            ${results.map(row => `
              <tr>
                <td><strong>${HORIZONS_LABELS[row.weeks]}</strong></td>
                <td class="text-center">
                  <span class="value-highlight value-highlight--primary">${row.p50}</span>
                  <span class="value-unit">${metricLabel}</span>
                </td>
                <td class="text-center">
                  <span class="value-highlight value-highlight--success">${row.p85}</span>
                  <span class="value-unit">${metricLabel}</span>
                </td>
                <td class="text-center">
                  <span class="value-highlight">${row.p95}</span>
                  <span class="value-unit">${metricLabel}</span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  /**
   * Rendu de l'analyse (tendance + stabilité)
   * @private
   */
  _renderAnalysis() {
    const { simulation } = this.state;
    const { trend, stability } = simulation.metadata;

    // Tendance
    const trendConfig = {
      up: { icon: '↗', label: 'Haussière', class: 'success', message: 'L\'équipe accélère. Les prévisions pourraient être conservatrices.' },
      down: { icon: '↘', label: 'Baissière', class: 'warning', message: 'La vélocité diminue. Les prévisions pourraient être optimistes.' },
      stable: { icon: '→', label: 'Stable', class: 'primary', message: 'La vélocité est stable. Les prévisions sont fiables.' }
    };

    const trendInfo = trendConfig[trend.direction];
    const changePercent = Math.abs(trend.relativeChange * 100).toFixed(1);
    const showTrendMessage = trend.strength !== 'none';

    // Stabilité
    const stabilityConfig = {
      high: { label: 'Haute', class: 'success', desc: 'Données très prévisibles' },
      moderate: { label: 'Modérée', class: 'warning', desc: 'Variabilité normale' },
      low: { label: 'Basse', class: 'danger', desc: 'Forte incertitude' }
    };

    const stabInfo = stabilityConfig[stability.stability] || stabilityConfig.moderate;

    return `
      <div class="howmany-analysis">
        <div class="analysis-card">
          <div class="analysis-card__header">
            <span class="analysis-card__icon">${trendInfo.icon}</span>
            <span class="analysis-card__title">Tendance ${trendInfo.label}</span>
            ${trend.strength !== 'none' ? `<span class="badge badge--${trendInfo.class}">${trend.strength === 'strong' ? 'Forte' : 'Modérée'} (${changePercent}%/sprint)</span>` : ''}
          </div>
          ${showTrendMessage ? `<p class="analysis-card__message">${trendInfo.message}</p>` : ''}
        </div>

        <div class="analysis-card">
          <div class="analysis-card__header">
            <span class="analysis-card__icon">📊</span>
            <span class="analysis-card__title">Stabilité ${stabInfo.label}</span>
            <span class="badge badge--${stabInfo.class}">CV: ${(stability.cv * 100).toFixed(0)}%</span>
          </div>
          <p class="analysis-card__message">${stabInfo.desc}</p>
        </div>
      </div>
    `;
  }

  /**
   * Définition des événements
   */
  events() {
    return {
      'click [data-action="set-metric"]': this._handleSetMetric,
      'change [data-action="toggle-weighting"]': this._handleToggleWeighting,
      'change [data-action="toggle-outliers"]': this._handleToggleOutliers
    };
  }

  /**
   * Gestionnaire changement de métrique
   * @private
   */
  _handleSetMetric(e) {
    const value = e.currentTarget.dataset.value;
    if (value && value !== this.state.metric) {
      this.state.metric = value;
      this._loadData();
    }
  }

  /**
   * Gestionnaire toggle pondération
   * @private
   */
  _handleToggleWeighting(e) {
    const useWeighting = e.target.checked;
    const { throughputs } = this.state;

    if (throughputs.length === 0) return;

    const simulation = runSimulation(throughputs, {
      useWeighting,
      excludeOutliers: this.state.excludeOutliers
    });

    this.setState({
      useWeighting,
      simulation,
      error: simulation.success ? null : simulation.error
    });
  }

  /**
   * Gestionnaire toggle outliers
   * @private
   */
  _handleToggleOutliers(e) {
    const excludeOutliers = e.target.checked;
    const { throughputs } = this.state;

    if (throughputs.length === 0) return;

    const simulation = runSimulation(throughputs, {
      useWeighting: this.state.useWeighting,
      excludeOutliers
    });

    this.setState({
      excludeOutliers,
      simulation,
      error: simulation.success ? null : simulation.error
    });
  }
}
