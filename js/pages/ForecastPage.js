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
      headcountAdjustment: 0, // 0 = effectif complet, -1 = 1 personne en moins, etc.
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
   * Retourne l'effectif original et ajusté
   * @returns {{ original: number, adjusted: number, ratio: number }}
   * @private
   */
  _getHeadcount() {
    const { forecastData, headcountAdjustment } = this.state;
    const original = forecastData?.contributors?.length || 1;
    const adjusted = Math.max(1, original + headcountAdjustment);
    return { original, adjusted, ratio: adjusted / original };
  }

  /**
   * Applique le ratio d'effectif à une valeur
   * @param {number} value
   * @returns {number}
   * @private
   */
  _adjustForHeadcount(value) {
    const { ratio } = this._getHeadcount();
    return Math.round(value * ratio);
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

    // Initialiser l'histogramme si les données sont prêtes
    this._initHistogram();
  }

  /**
   * Après mise à jour
   */
  afterUpdate() {
    this._initHistogram();
  }

  /**
   * Initialise l'histogramme de distribution Monte Carlo
   * @private
   */
  _initHistogram() {
    const { forecastData } = this.state;
    if (!forecastData || !forecastData.simulation) return;

    const canvas = this.container?.querySelector('#forecast-histo');
    if (!canvas) return;

    // Détruire l'ancien chart si existant
    if (this._histoChart) {
      this._histoChart.destroy();
      this._histoChart = null;
    }

    const distribution = forecastData.simulation.throughput.distribution;
    if (!distribution || distribution.length === 0) return;

    const p15 = forecastData.simulation.throughput.p15;
    const p50 = forecastData.simulation.throughput.p50;
    const p85 = forecastData.simulation.throughput.p85;

    const labels = distribution.map(d => d.value);
    const data = distribution.map(d => d.count);

    // Lire les couleurs CSS
    const cs = getComputedStyle(document.documentElement);
    const rustSoft = cs.getPropertyValue('--rust-soft').trim();
    const amberSoft = cs.getPropertyValue('--amber-soft').trim();
    const sageSoft = cs.getPropertyValue('--sage-soft').trim();
    const ink = cs.getPropertyValue('--ink').trim();
    const ink3 = cs.getPropertyValue('--ink-3').trim();
    const lineHair = cs.getPropertyValue('--line-hair').trim();

    // Couleur par barre selon percentile
    const colors = labels.map(v => {
      if (v === p50) return ink;
      if (v <= p15) return rustSoft;
      if (v >= p85) return sageSoft;
      return amberSoft;
    });

    this._histoChart = new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: colors,
          barPercentage: 0.95,
          categoryPercentage: 0.95
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: ink,
            titleFont: { family: 'JetBrains Mono', size: 10 },
            bodyFont: { family: 'Inter', size: 12 },
            padding: 8,
            cornerRadius: 4,
            callbacks: {
              title: (items) => `${items[0].label} tickets`,
              label: (item) => `${item.raw.toLocaleString()} simulations`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { color: ink3 },
            ticks: {
              color: ink3,
              font: { family: 'JetBrains Mono', size: 10 },
              callback: (value, index) => index % 4 === 0 ? labels[index] : ''
            }
          },
          y: { display: false }
        }
      }
    });
  }

  /**
   * Avant démontage
   */
  beforeUnmount() {
    // Détruire l'histogramme
    if (this._histoChart) {
      this._histoChart.destroy();
      this._histoChart = null;
    }

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

    const sprintNumbers = forecastData.sprintNumbers;
    const sprintRange = sprintNumbers.length > 0
      ? `Sprints ${sprintNumbers[0]} → ${sprintNumbers[sprintNumbers.length - 1]}`
      : '';

    return `
      <div class="forecast-page" id="section-forecast">
        ${this._renderHeader()}

        <div class="forecast-page__content">
          <!-- Section 1 : Scenarios -->
          <div class="section--editorial" style="border-top:0;padding-top:0;margin-top:0">
            <div class="section__head">
              <div class="section__title">
                <span class="section__num">§ 01 — Trois scénarios</span>
                <h2 class="h-section">Pessimiste · Réaliste · Optimiste</h2>
              </div>
              <span class="dek section__deck">
                P15 / P50 / P85 — ${forecastData.simulation.iterations.toLocaleString()} simulations Monte Carlo.
                <button class="help-btn" data-action="show-monte-carlo-help" title="Qu'est-ce que Monte Carlo ?">?</button>
                ${excludedContributors.length > 0 ? `<span class="pill pill--warn" style="margin-left:8px">${excludedContributors.length} absence(s)</span>` : ''}
              </span>
            </div>
            ${this._renderScenarios()}
          </div>

          <!-- Section 2 : Distribution -->
          <div class="section--editorial">
            <div class="section__head">
              <div class="section__title">
                <span class="section__num">§ 02 — Distribution</span>
                <h2 class="h-section">Probabilités de livraison</h2>
              </div>
              <span class="dek section__deck">Chaque barre = nombre de simulations ayant terminé à ce throughput.</span>
            </div>
            <div class="dist">
              <div style="height:280px"><canvas id="forecast-histo"></canvas></div>
              <div class="legend" style="margin-top:12px">
                <span class="legend__item"><span class="legend__sw" style="background:var(--rust-soft)"></span>≤ P15 — pessimiste</span>
                <span class="legend__item"><span class="legend__sw" style="background:var(--amber-soft)"></span>P15 → P85 — zone de confiance</span>
                <span class="legend__item"><span class="legend__sw" style="background:var(--sage-soft)"></span>≥ P85 — optimiste</span>
                <span class="legend__item"><span class="legend__sw" style="background:var(--ink)"></span>P50 — médiane</span>
              </div>
            </div>
          </div>

          ${showIndividualSections ? `
          <!-- Section 3 : Absences (secrete) -->
          <div class="section--editorial">
            <div class="section__head">
              <div class="section__title">
                <span class="section__num">§ 03 — Absences</span>
                <h2 class="h-section">Simuler des absences</h2>
              </div>
              <span class="dek section__deck">Cochez les contributeurs absents pour recalculer.</span>
            </div>
            ${this._renderAbsenceSelector()}
          </div>

          <!-- Section 4 : Contributeurs (secrete) -->
          <div class="section--editorial">
            <div class="section__head">
              <div class="section__title">
                <span class="section__num">§ 04 — Contributeurs</span>
                <h2 class="h-section">Simulation individuelle</h2>
              </div>
              <span class="dek section__deck">Basée sur les ${sprintRange}</span>
            </div>
            ${this._renderContributorsTable()}
          </div>
          ` : ''}

        </div>

        ${isExporting ? '<div class="forecast-page__overlay"><div class="loader"></div></div>' : ''}

        <!-- Modal explicative Monte Carlo -->
        <div class="modal-overlay" data-modal="monte-carlo-help">
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
              <button class="btn btn--primary" data-action="close-modal">Compris !</button>
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
    const { isExporting, forecastData, excludedContributors } = this.state;
    const currentState = store.getState();
    const teamName = currentState.manualInput?.teamName || 'Équipe';
    const nextSprint = forecastData?.nextSprint || '';
    const sprintNumbers = forecastData?.sprintNumbers || [];
    const contributors = forecastData?.contributors || [];
    const hc = this._getHeadcount();

    return `
      <div class="cover">
        <div>
          <div class="eyebrow" style="margin-bottom:12px">§ 00 — Projection · ${forecastData?.simulation?.iterations?.toLocaleString() || '10 000'} simulations</div>
          <h1 class="h-display">Ce que <em>Sprint ${nextSprint}</em> pourrait livrer.</h1>
          <p class="lede" style="margin-top:18px">Approche Monte Carlo : pour chaque membre de ${teamName}, on tire au hasard une performance passée, puis on lit la distribution.</p>
          <div style="display:flex;gap:10px;margin-top:18px;flex-wrap:wrap;align-items:center">
            ${sprintNumbers.length > 0 ? `<span class="pill pill--ghost">Basé sur Sprints ${sprintNumbers[0]} → ${sprintNumbers[sprintNumbers.length - 1]}</span>` : ''}
            <span class="pill pill--ghost" style="display:inline-flex;align-items:center;gap:6px">
              <button class="headcount-btn" data-action="headcount-minus" ${hc.adjusted <= 1 ? 'disabled' : ''}>−</button>
              <span class="tnum">${hc.adjusted}</span> contributeur${hc.adjusted > 1 ? 's' : ''}
              <button class="headcount-btn" data-action="headcount-plus" ${hc.adjusted >= hc.original ? 'disabled' : ''}>+</button>
            </span>
            ${hc.adjusted < hc.original ? `<span class="pill pill--warn">${hc.original - hc.adjusted} absence${hc.original - hc.adjusted > 1 ? 's' : ''} simulée${hc.original - hc.adjusted > 1 ? 's' : ''}</span>` : ''}
            ${excludedContributors.length > 0 ? `<span class="pill pill--warn">${excludedContributors.length} exclu(s)</span>` : ''}
          </div>
        </div>
        <div style="text-align:right">
          <div class="cover__sprintno"><sup>S</sup>${nextSprint}</div>
          <div style="margin-top:18px;display:flex;gap:8px;justify-content:flex-end">
            <button class="btn--editorial-ghost btn--editorial-small"
                    data-action="export-md"
                    ${isExporting ? 'disabled' : ''}>
              ${isExporting ? 'Export...' : 'Exporter Markdown'}
            </button>
          </div>
        </div>
      </div>
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
    const hc = this._getHeadcount();

    // Map existing scenario IDs to editorial class names
    const kindMap = { pessimistic: 'p15', realistic: 'p50', optimistic: 'p85' };

    return `
      <div class="scenarios">
        ${scenarios.map(scenario => {
          const kind = kindMap[scenario.id] || 'p50';
          const adjThroughput = this._adjustForHeadcount(scenario.throughput);
          const adjSP = this._adjustForHeadcount(scenario.storyPoints);
          return `
            <div class="scenario scenario--${kind}">
              <div class="scenario__head">
                <span class="scenario__name">${scenario.label}</span>
                <span class="scenario__conf">${scenario.confidence}% de chances</span>
              </div>
              <div>
                <div class="scenario__big tnum">${adjThroughput}</div>
                <div class="scenario__sub">
                  <span>tickets</span>
                  ${forecastData.validation.hasStoryPoints ? `
                    <span>·</span>
                    <b>${adjSP}</b>
                    <span>story points</span>
                  ` : ''}
                </div>
              </div>
              <p class="scenario__desc">${scenario.description}${hc.adjusted < hc.original ? ` (ajusté pour ${hc.adjusted}/${hc.original} contributeurs)` : ''}</p>
            </div>
          `;
        }).join('')}
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
      'click .modal-overlay': this._handleOverlayClick,
      'click [data-action="headcount-minus"]': this._handleHeadcountMinus,
      'click [data-action="headcount-plus"]': this._handleHeadcountPlus
    };
  }

  /**
   * Affiche la modal d'aide Monte Carlo
   * @private
   */
  _handleShowHelp() {
    const modal = this.container?.querySelector('[data-modal="monte-carlo-help"]');
    if (modal) {
      modal.classList.add('modal-overlay--visible');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Ferme la modal
   * @private
   */
  _handleCloseModal() {
    const modal = this.container?.querySelector('[data-modal="monte-carlo-help"]');
    if (modal) {
      modal.classList.remove('modal-overlay--visible');
      document.body.style.overflow = '';
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

  /**
   * Diminue l'effectif simulé
   * @private
   */
  _handleHeadcountMinus() {
    const { original } = this._getHeadcount();
    const newAdj = this.state.headcountAdjustment - 1;
    if (original + newAdj >= 1) {
      this.setState({ headcountAdjustment: newAdj });
    }
  }

  /**
   * Augmente l'effectif simulé (jusqu'à l'original)
   * @private
   */
  _handleHeadcountPlus() {
    if (this.state.headcountAdjustment < 0) {
      this.setState({ headcountAdjustment: this.state.headcountAdjustment + 1 });
    }
  }
}
