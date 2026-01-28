/**
 * ==========================================================================
 * REVIEWPAGE.JS - Page de Review du Sprint
 * ==========================================================================
 *
 * Page d'affichage des métriques du sprint :
 * - Sprint Goals et leur statut
 * - Story Points (committed vs delivered)
 * - Throughput
 * - Cycle Time
 * - Time in Status
 * - Bugs
 *
 * Conçue pour être présentée pendant le Sprint Review.
 *
 * ==========================================================================
 */

import Component from '../components/Component.js';
import MetricCard from '../components/MetricCard.js';
import SprintGoals from '../components/SprintGoals.js';
import { BarChart, TrendChart, DoughnutChart } from '../components/charts/index.js';
import store from '../core/store.js';
import eventBus from '../core/eventBus.js';
import config from '../core/config.js';
import metricsCalculator from '../services/metricsCalculator.js';
import pdfExporter from '../services/pdfExporter.js';
import { formatNumber, formatPercent, formatDays } from '../utils/formatters.js';

// =========================================================================
// CLASSE REVIEWPAGE
// =========================================================================

export default class ReviewPage extends Component {
  constructor(container, props = {}) {
    super(container, props);

    // Sous-composants
    this.components = {};
  }

  /**
   * Initialisation
   */
  init() {
    // Lire l'état actuel du store
    const currentState = store.getState();

    this.state = {
      sprintMetrics: currentState.sprintMetrics || null,
      manualInput: currentState.manualInput || null,
      sprintGoals: currentState.sprintGoals || [],
      isExporting: false,
      throughputMetric: 'tickets', // 'tickets' ou 'storyPoints'
      showPearson: false, // Carte corrélation cachée par défaut
      showExportMenu: false // Menu d'export dropdown
    };

    // Écouter le déverrouillage de la corrélation Pearson
    eventBus.on('secret:unlock:pearson', () => {
      this.setState({ showPearson: true });
    });

    // Écouter le masquage de tous les secrets
    eventBus.on('secret:hide-all', () => {
      this.setState({ showPearson: false });
    });

    // S'abonner aux changements du store
    this.subscribe(
      state => ({ metrics: state.sprintMetrics, manual: state.manualInput, goals: state.sprintGoals }),
      ({ metrics, manual, goals }) => {
        this.setState({
          sprintMetrics: metrics,
          manualInput: manual,
          sprintGoals: goals || []
        });
      }
    );
  }

  /**
   * Après montage
   */
  afterMount() {
    console.log('[ReviewPage] afterMount() appelé');

    // Rafraîchir l'état depuis le store (important si la page est en cache)
    const currentState = store.getState();
    const storeMetrics = currentState.sprintMetrics || null;
    const storeManual = currentState.manualInput || null;
    const storeGoals = currentState.sprintGoals || [];

    console.log('[ReviewPage] afterMount - state.sprintMetrics:', !!this.state.sprintMetrics);
    console.log('[ReviewPage] afterMount - store.sprintMetrics:', !!storeMetrics);

    const needsRerender =
      this.state.sprintMetrics !== storeMetrics ||
      this.state.manualInput !== storeManual ||
      this.state.sprintGoals !== storeGoals;

    if (needsRerender) {
      console.log('[ReviewPage] afterMount - needsRerender=true, mise à jour du state');
      this.state.sprintMetrics = storeMetrics;
      this.state.manualInput = storeManual;
      this.state.sprintGoals = storeGoals;
      this.forceUpdate();
      console.log('[ReviewPage] afterMount - forceUpdate() terminé');
    }

    // Vérifier que le DOM contient bien la section charts
    const chartSection = this.container?.querySelector('[data-chart="throughput"]');
    console.log('[ReviewPage] afterMount - DOM check [data-chart="throughput"]:', chartSection);

    // Toujours initialiser les composants après le montage/re-render
    this._initializeComponents();
  }

  /**
   * Avant démontage
   */
  beforeUnmount() {
    Object.values(this.components).forEach(component => {
      if (component && typeof component.destroy === 'function') {
        component.destroy(); // Chart.js
      } else if (component && typeof component.unmount === 'function') {
        component.unmount(); // Composants custom
      }
    });
    this.components = {};
  }

  /**
   * Après mise à jour
   */
  afterUpdate() {
    // Les sous-composants doivent être réinitialisés car le DOM a été remplacé
    this.components = {};
    this._initializeComponents();
  }

  /**
   * Initialise les sous-composants
   * @private
   */
  _initializeComponents() {
    // Utiliser les données du store directement pour éviter les problèmes de timing
    const storeState = store.getState();
    const sprintMetrics = storeState.sprintMetrics || this.state.sprintMetrics;
    const manualInput = storeState.manualInput || this.state.manualInput;
    const sprintGoals = storeState.sprintGoals || this.state.sprintGoals;

    // Sprint Goals (mode lecture seule)
    const goalsContainer = this.$('[data-component="sprint-goals"]');
    if (goalsContainer && !this.components.sprintGoals) {
      this.components.sprintGoals = new SprintGoals(goalsContainer, {
        editable: false,
        goals: sprintGoals,
        showStats: true
      });
      this.components.sprintGoals.mount();
    }

    // Graphiques (si données CSV disponibles)
    if (sprintMetrics) {
      this._initializeCharts(sprintMetrics);
    }
  }

  /**
   * Initialise les graphiques
   * @param {Object} metrics
   * @private
   */
  _initializeCharts(metrics) {

    // Throughput - création directe du graphique Chart.js
    const throughputCanvas = document.getElementById('throughput-chart');
    if (throughputCanvas && metrics.throughput && metrics.throughput.values?.length) {
      console.log('[ReviewPage] Création du graphique Throughput');

      // Détruire l'ancien graphique s'il existe
      if (this.components.throughputChart) {
        this.components.throughputChart.destroy();
      }

      // Choisir les données selon la métrique sélectionnée
      const isStoryPoints = this.state.throughputMetric === 'storyPoints';
      const chartData = isStoryPoints
        ? (metrics.throughput.storyPointsValues || [])
        : metrics.throughput.values;
      const chartLabel = isStoryPoints ? 'Story Points livrés' : 'Tickets fermés';
      const yAxisLabel = isStoryPoints ? 'Story Points' : 'Tickets';

      const ctx = throughputCanvas.getContext('2d');
      this.components.throughputChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: metrics.throughput.weeks,
          datasets: [{
            label: chartLabel,
            data: chartData,
            backgroundColor: 'rgba(37, 99, 235, 0.8)',
            borderColor: 'rgba(37, 99, 235, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: yAxisLabel }
            }
          },
          plugins: {
            legend: { display: false }
          }
        }
      });
      console.log('[ReviewPage] Graphique Throughput créé');
    }

    // Cycle Time - création directe du graphique Chart.js
    const cycleTimeCanvas = document.getElementById('cycletime-chart');
    if (cycleTimeCanvas && metrics.cycleTime && metrics.cycleTime.values?.length) {
      if (this.components.cycleTimeChart) {
        this.components.cycleTimeChart.destroy();
      }

      const ctx = cycleTimeCanvas.getContext('2d');
      this.components.cycleTimeChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: metrics.cycleTime.weeks,
          datasets: [{
            label: 'Cycle Time (jours)',
            data: metrics.cycleTime.values,
            backgroundColor: 'rgba(20, 184, 166, 0.8)',
            borderColor: 'rgba(20, 184, 166, 1)',
            borderWidth: 1
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              title: { display: true, text: 'Jours' }
            }
          },
          plugins: {
            legend: { display: false },
            annotation: {
              annotations: {
                avgLine: {
                  type: 'line',
                  yMin: metrics.cycleTime.benchmarkAvg,
                  yMax: metrics.cycleTime.benchmarkAvg,
                  borderColor: 'rgba(239, 68, 68, 0.8)',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  label: {
                    display: true,
                    content: `Moy. globale: ${metrics.cycleTime.benchmarkAvg}j`,
                    position: 'start',
                    backgroundColor: 'rgba(239, 68, 68, 0.8)'
                  }
                },
                medianLine: {
                  type: 'line',
                  yMin: metrics.cycleTime.benchmarkMedian,
                  yMax: metrics.cycleTime.benchmarkMedian,
                  borderColor: 'rgba(139, 92, 246, 0.8)',
                  borderWidth: 2,
                  borderDash: [5, 5],
                  label: {
                    display: true,
                    content: `Méd. globale: ${metrics.cycleTime.benchmarkMedian}j`,
                    position: 'end',
                    backgroundColor: 'rgba(139, 92, 246, 0.8)'
                  }
                }
              }
            }
          }
        }
      });
    }

    // Time in Status - deux camemberts (dernier sprint + 6 sprints)
    const tisSprintCanvas = document.getElementById('timeinstatus-chart-sprint');
    const tisPeriodCanvas = document.getElementById('timeinstatus-chart-period');

    if (metrics.timeInStatus && metrics.timeInStatus.labels?.length) {
      const tis = metrics.timeInStatus;

      // Couleurs pour chaque statut
      const colors = [
        'rgba(99, 102, 241, 0.8)',   // Indigo
        'rgba(139, 92, 246, 0.8)',   // Violet
        'rgba(236, 72, 153, 0.8)',   // Pink
        'rgba(248, 113, 113, 0.8)', // Red
        'rgba(251, 146, 60, 0.8)',  // Orange
        'rgba(250, 204, 21, 0.8)',  // Yellow
        'rgba(74, 222, 128, 0.8)',  // Green
        'rgba(45, 212, 191, 0.8)',  // Teal
        'rgba(56, 189, 248, 0.8)'   // Sky
      ];

      const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || '';
                const value = context.raw || 0;
                return `${label}: ${value.toFixed(1)}%`;
              }
            }
          }
        }
      };

      // Chart dernier sprint (pct2w)
      if (tisSprintCanvas) {
        if (this.components.tisChartSprint) {
          this.components.tisChartSprint.destroy();
        }
        const ctx = tisSprintCanvas.getContext('2d');
        this.components.tisChartSprint = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: tis.labels,
            datasets: [{
              data: tis.pct2w,
              backgroundColor: colors.slice(0, tis.labels.length),
              borderColor: '#ffffff',
              borderWidth: 2
            }]
          },
          options: chartOptions
        });
      }

      // Chart 6 derniers sprints (pct12w)
      if (tisPeriodCanvas) {
        if (this.components.tisChartPeriod) {
          this.components.tisChartPeriod.destroy();
        }
        const ctx = tisPeriodCanvas.getContext('2d');
        this.components.tisChartPeriod = new Chart(ctx, {
          type: 'doughnut',
          data: {
            labels: tis.labels,
            datasets: [{
              data: tis.pct12w,
              backgroundColor: colors.slice(0, tis.labels.length),
              borderColor: '#ffffff',
              borderWidth: 2
            }]
          },
          options: chartOptions
        });
      }

      // Légende horizontale en bas
      const legendContainer = document.getElementById('timeinstatus-legend');
      if (legendContainer) {
        legendContainer.innerHTML = tis.labels.map((label, idx) => `
          <div class="chart-legend__item">
            <span class="chart-legend__color" style="background-color: ${colors[idx]}"></span>
            <span class="chart-legend__label">${label}</span>
          </div>
        `).join('');
      }
    }

    // Bugs Chart - bar chart avec Chart.js directement
    const bugsCanvas = document.getElementById('bugs-chart');
    if (bugsCanvas && metrics.bugs && metrics.bugs.created?.length && metrics.bugs.closed?.length) {
      if (this.components.bugsChart) {
        this.components.bugsChart.destroy();
      }

      const ctx = bugsCanvas.getContext('2d');
      this.components.bugsChart = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: metrics.bugs.weeks,
          datasets: [
            {
              label: 'Créés',
              data: metrics.bugs.created,
              backgroundColor: 'rgba(236, 72, 153, 0.8)',  // Pink (comme "À déployer en prod")
              borderColor: 'rgba(236, 72, 153, 1)',
              borderWidth: 1
            },
            {
              label: 'Résolus',
              data: metrics.bugs.closed,
              backgroundColor: 'rgba(99, 102, 241, 0.8)',  // Indigo (comme "En cours")
              borderColor: 'rgba(99, 102, 241, 1)',
              borderWidth: 1
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: {
              beginAtZero: true,
              ticks: { stepSize: 1 }
            }
          },
          plugins: {
            legend: { display: true, position: 'top' },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const val = context.raw;
                  const unit = val <= 1 ? 'bug' : 'bugs';
                  return `${context.dataset.label}: ${val} ${unit}`;
                }
              }
            }
          }
        }
      });
      console.log('[ReviewPage] Bugs chart créé avec:', metrics.bugs.weeks, metrics.bugs.created, metrics.bugs.closed);
    }

    // WIP Chart - line chart
    const wipCanvas = document.getElementById('wip-chart');
    if (wipCanvas && metrics.wip && metrics.wip.values?.length) {
      if (this.components.wipChart) {
        this.components.wipChart.destroy();
      }

      const ctx = wipCanvas.getContext('2d');
      const avgWip = metrics.wip.avgWip;
      const medianWip = metrics.wip.medianWip;

      this.components.wipChart = new Chart(ctx, {
        type: 'line',
        data: {
          labels: metrics.wip.sprints,
          datasets: [
            {
              label: 'WIP moyen / personne',
              data: metrics.wip.values,
              borderColor: '#8B5CF6',
              backgroundColor: 'rgba(139, 92, 246, 0.1)',
              borderWidth: 3,
              tension: 0.4,
              fill: true,
              pointRadius: 6,
              pointHoverRadius: 8,
              pointBackgroundColor: '#8B5CF6'
            },
            {
              label: 'Médiane',
              data: metrics.wip.sprints.map(() => medianWip),
              borderColor: '#F59E0B',
              borderWidth: 2,
              borderDash: [8, 4],
              pointRadius: 0,
              fill: false
            },
            {
              label: 'Moyenne',
              data: metrics.wip.sprints.map(() => avgWip),
              borderColor: '#94A3B8',
              borderWidth: 2,
              borderDash: [5, 5],
              pointRadius: 0,
              fill: false
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              display: true,
              position: 'top'
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const value = context.parsed.y;
                  if (context.datasetIndex === 0) {
                    return `${value.toFixed(1)} tickets en moyenne par personne`;
                  } else if (context.datasetIndex === 1) {
                    return `Médiane: ${value.toFixed(1)} tickets`;
                  }
                  return `Moyenne: ${value.toFixed(1)} tickets`;
                }
              }
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: 'Tickets en cours'
              },
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
      console.log('[ReviewPage] WIP chart créé avec:', metrics.wip.sprints, metrics.wip.values);
    }
  }

  /**
   * Retourne le sous-titre du graphique WIP
   * @returns {string}
   * @private
   */
  _getWipSubtitle() {
    const { sprintMetrics, manualInput } = this.state;
    const teamName = manualInput?.teamName || 'l\'équipe';
    const avgWip = sprintMetrics?.wip?.avgWip || 0;

    return `1 membre de ${teamName} a en moyenne ${avgWip.toFixed(1)} tickets entre In Progress et Terminé`;
  }

  /**
   * Rendu du composant
   */
  render() {
    const { sprintMetrics, manualInput, sprintGoals, isExporting } = this.state;

    // Afficher l'état vide si pas de données CSV chargées
    if (!sprintMetrics) {
      return this._renderEmptyState();
    }

    return `
      <div class="review-page" id="section-review">
        ${this._renderHeader()}

        <div class="review-page__content">
          <!-- Section Sprint Goals -->
          <section class="review-section review-section--goals">
            <div data-component="sprint-goals"></div>
          </section>

          <!-- Section Story Points (priorité aux données CSV, fallback sur saisie manuelle) -->
          ${this._renderStoryPointsSectionAuto()}

          <!-- Métriques CSV -->
          ${sprintMetrics ? this._renderMetricsSection() : ''}
        </div>

        ${isExporting ? '<div class="review-page__overlay"><div class="loader"></div><p>Export en cours...</p></div>' : ''}
      </div>
    `;
  }

  /**
   * Rendu du header
   * @returns {string}
   * @private
   */
  _renderHeader() {
    const { manualInput, isExporting, showExportMenu } = this.state;

    return `
      <header class="review-page__header">
        <div class="review-page__header-info">
          <h2 class="review-page__title">
            ${manualInput?.teamName || 'Équipe'}
          </h2>
          <p class="review-page__team">${manualInput?.sprintName || 'Sprint'}</p>
        </div>

        <div class="review-page__header-actions">
          <div class="export-dropdown">
            <button class="btn btn--primary"
                    data-action="toggle-export-menu"
                    ${isExporting ? 'disabled' : ''}>
              ${isExporting ? 'Export...' : 'Exporter ▾'}
            </button>
            <div class="export-dropdown__menu ${showExportMenu ? 'export-dropdown__menu--visible' : ''}" data-component="export-menu">
              <button class="export-dropdown__item" data-action="export-pdf-radial">
                <span class="export-dropdown__label">PDF Radial</span>
                <span class="export-dropdown__desc">Design circulaire</span>
              </button>
              <button class="export-dropdown__item" data-action="export-pdf-infographic">
                <span class="export-dropdown__label">PDF Classique</span>
                <span class="export-dropdown__desc">Grille de KPIs</span>
              </button>
              <button class="export-dropdown__item" data-action="export-md">
                <span class="export-dropdown__label">Markdown</span>
                <span class="export-dropdown__desc">Pour Confluence</span>
              </button>
            </div>
          </div>
        </div>
      </header>
    `;
  }

  /**
   * Rendu de la section métriques
   * @returns {string}
   * @private
   */
  _renderMetricsSection() {
    const { sprintMetrics } = this.state;
    console.log('[ReviewPage] _renderMetricsSection() appelé, sprintMetrics:', !!sprintMetrics);

    const gridClass = this.state.showPearson ? 'review-metrics__cards--four-cols' : 'review-metrics__cards--three-cols';

    return `
      <div class="review-metrics">
        <!-- Cartes KPI -->
        <div class="review-metrics__cards ${gridClass}">
          ${this._renderKPICards()}
        </div>

        <!-- Graphiques -->
        <div class="review-metrics__charts">
          <!-- Throughput -->
          <section class="chart-section">
            <div class="chart-section__header">
              <div>
                <h4 class="chart-section__title">Throughput</h4>
                <p class="chart-section__subtitle">${this.state.throughputMetric === 'storyPoints' ? 'Story Points livrés' : 'Tickets fermés'} par sprint</p>
              </div>
              <div class="toggle-group toggle-group--small">
                <button class="toggle-group__btn ${this.state.throughputMetric === 'tickets' ? 'toggle-group__btn--active' : ''}"
                        data-action="set-throughput-metric" data-value="tickets">
                  Tickets
                </button>
                <button class="toggle-group__btn ${this.state.throughputMetric === 'storyPoints' ? 'toggle-group__btn--active' : ''}"
                        data-action="set-throughput-metric" data-value="storyPoints">
                  SP
                </button>
              </div>
            </div>
            <div class="chart-section__chart" style="height: 250px;">
              <canvas id="throughput-chart"></canvas>
            </div>
          </section>

          <!-- Cycle Time -->
          <section class="chart-section">
            <h4 class="chart-section__title">Cycle Time</h4>
            <p class="chart-section__subtitle">Temps moyen par sprint (jours)</p>
            <div class="chart-section__chart" style="height: 250px;">
              <canvas id="cycletime-chart"></canvas>
            </div>
          </section>

          <!-- Time in Status -->
          <section class="chart-section">
            <h4 class="chart-section__title">Répartition du Cycle Time</h4>
            <p class="chart-section__subtitle">Part de chaque étape dans le temps de traitement</p>
            <div class="chart-section__dual-charts">
              <div class="chart-section__chart-item">
                <span class="chart-section__chart-label">Dernier sprint</span>
                <div style="height: 180px; width: 180px;">
                  <canvas id="timeinstatus-chart-sprint"></canvas>
                </div>
              </div>
              <div class="chart-section__chart-item">
                <span class="chart-section__chart-label">6 sprints</span>
                <div style="height: 180px; width: 180px;">
                  <canvas id="timeinstatus-chart-period"></canvas>
                </div>
              </div>
            </div>
            <div class="chart-section__legend" id="timeinstatus-legend"></div>
          </section>

          <!-- Bugs -->
          <section class="chart-section">
            <h4 class="chart-section__title">Bugs par sprint</h4>
            <p class="chart-section__subtitle">Création vs résolution</p>
            <div class="chart-section__chart" style="height: 250px;">
              <canvas id="bugs-chart"></canvas>
            </div>
          </section>

          <!-- WIP Individuel -->
          <section class="chart-section">
            <h4 class="chart-section__title">WIP Individuel Moyen</h4>
            <p class="chart-section__subtitle">${this._getWipSubtitle()}</p>
            <div class="chart-section__chart" style="height: 250px;">
              <canvas id="wip-chart"></canvas>
            </div>
          </section>
        </div>
      </div>
    `;
  }

  /**
   * Rendu des cartes KPI
   * @returns {string}
   * @private
   */
  _renderKPICards() {
    const { sprintMetrics } = this.state;
    const cardsRow1 = [];
    const cardsRow2 = [];

    // === LIGNE 1 ===

    // Throughput du sprint
    if (sprintMetrics?.throughput?.currentValue !== undefined) {
      cardsRow1.push({
        label: 'Throughput du sprint',
        value: sprintMetrics.throughput.currentValue,
        unit: 'tickets terminés',
        trend: sprintMetrics.throughput.trend,
        trendIsGood: 'up',
        decimals: 0
      });
    }

    // Ajouts mid-sprint (scope changes)
    if (sprintMetrics?.throughput?.midSprintCount !== undefined) {
      cardsRow1.push({
        label: 'Ajouts mid-sprint',
        value: sprintMetrics.throughput.midSprintCount,
        totalTickets: sprintMetrics.throughput.totalTickets,
        midSprintAdditions: sprintMetrics.throughput.midSprintAdditions || [],
        showMidSprint: true,
        decimals: 0
      });
    }

    // Cycle Time du sprint
    if (sprintMetrics?.cycleTime?.currentValue !== undefined) {
      cardsRow1.push({
        label: 'Cycle Time*',
        value: sprintMetrics.cycleTime.currentValue,
        median: sprintMetrics.cycleTime.sprintMedian,
        trend: sprintMetrics.cycleTime.trend,
        trendIsGood: 'down',
        decimals: 1,
        showAvgMedian: true,
        footnote: '*hors bugs'
      });
    }

    // Corrélation Pearson (SP/Cycle Time) - visible uniquement après code secret "pear"
    if (this.state.showPearson && sprintMetrics?.correlation?.hasEnoughData) {
      cardsRow1.push({
        label: 'Corrélation SP/CT',
        current: sprintMetrics.correlation.current,
        previous: sprintMetrics.correlation.previous,
        currentSampleSize: sprintMetrics.correlation.currentSampleSize,
        previousSampleSize: sprintMetrics.correlation.previousSampleSize,
        previousSprintCount: sprintMetrics.correlation.previousSprintCount,
        currentInterpretation: sprintMetrics.correlation.currentInterpretation,
        previousInterpretation: sprintMetrics.correlation.previousInterpretation,
        trend: sprintMetrics.correlation.trend,
        showCorrelation: true
      });
    }

    // === LIGNE 2 (DORA) ===

    // Stock Bugs
    if (sprintMetrics?.bugs) {
      cardsRow2.push({
        label: 'Stock Bugs',
        value: sprintMetrics.bugs.stock || 0,
        unit: 'bugs ouverts',
        sprintCreated: sprintMetrics.bugs.sprintCreated || 0,
        sprintClosed: sprintMetrics.bugs.sprintClosed || 0,
        showBugDetails: true,
        decimals: 0
      });

      // MTTR (Mean Time To Recovery)
      cardsRow2.push({
        label: 'MTTR',
        value: sprintMetrics.bugs.mttr || 0,
        median: sprintMetrics.bugs.mttrMedian || 0,
        periodAvg: sprintMetrics.bugs.mttrPeriod || 0,
        showMTTR: true,
        decimals: 1
      });

      // Change Failure Rate
      cardsRow2.push({
        label: 'Change Failure Rate',
        value: sprintMetrics.bugs.changeFailureRate || 0,
        periodAvg: sprintMetrics.bugs.changeFailureRatePeriod || 0,
        bugsCreated: sprintMetrics.bugs.sprintCreated || 0,
        itemsDelivered: sprintMetrics.bugs.itemsDelivered || 0,
        showCFR: true,
        decimals: 1
      });
    }

    const cards = [...cardsRow1, ...cardsRow2];

    return cards.map(card => {
      // Déterminer la couleur du trend selon trendIsGood
      let trendClass = 'stable';
      if (card.trend > 0) {
        trendClass = card.trendIsGood === 'up' ? 'up' : 'down';
      } else if (card.trend < 0) {
        trendClass = card.trendIsGood === 'down' ? 'up' : 'down';
      }

      // Format spécial pour Cycle Time (Moyenne + Médiane du sprint)
      if (card.showAvgMedian) {
        return `
          <div class="kpi-card">
            <div class="kpi-card__label">${card.label}</div>
            <div class="kpi-card__stats">
              <div class="kpi-card__stat">
                <span class="kpi-card__stat-label">Moyenne</span>
                <span class="kpi-card__stat-value">${formatDays(card.value, card.decimals, true)}</span>
              </div>
              <div class="kpi-card__stat">
                <span class="kpi-card__stat-label">Médiane</span>
                <span class="kpi-card__stat-value">${formatDays(card.median, card.decimals, true)}</span>
              </div>
            </div>
            ${card.trend !== null ? `
              <div class="kpi-card__trend kpi-card__trend--${trendClass}">
                ${card.trend > 0 ? '↑' : card.trend < 0 ? '↓' : '→'}
                ${formatPercent(Math.abs(card.trend))}
              </div>
            ` : ''}
            ${card.footnote ? `<div class="kpi-card__footnote">${card.footnote}</div>` : ''}
          </div>
        `;
      }

      // Format spécial pour Ajouts mid-sprint
      if (card.showMidSprint) {
        const additions = card.midSprintAdditions || [];
        const hasAdditions = additions.length > 0;

        // Ventilation par type de ticket
        const byType = {};
        additions.forEach(t => {
          byType[t.type] = (byType[t.type] || 0) + 1;
        });
        const typeBreakdown = Object.entries(byType)
          .sort((a, b) => b[1] - a[1]) // Trier par count décroissant
          .map(([type, count]) => ({ type, count }));

        return `
          <div class="kpi-card">
            <div class="kpi-card__label">${card.label}</div>
            <div class="kpi-card__value">
              ${formatNumber(card.value, card.decimals)}
              <span class="kpi-card__unit">tickets</span>
            </div>
            ${hasAdditions ? `
              <div class="kpi-card__type-breakdown">
                ${typeBreakdown.map(({ type, count }) => `
                  <div class="kpi-card__type-item">
                    <span class="kpi-card__type-count">${count}</span>
                    <span class="kpi-card__type-label">${type}</span>
                  </div>
                `).join('')}
              </div>
            ` : `
              <div class="kpi-card__detail kpi-card__detail--success">Scope préservé</div>
            `}
          </div>
        `;
      }

      // Format spécial pour Stock Bugs (simplifié)
      if (card.showBugDetails) {
        return `
          <div class="kpi-card">
            <div class="kpi-card__label">${card.label}</div>
            <div class="kpi-card__value">
              ${formatNumber(card.value, card.decimals)}
              <span class="kpi-card__unit">${card.unit}</span>
            </div>
            <div class="kpi-card__details">
              <span class="kpi-card__detail kpi-card__detail--danger">+${card.sprintCreated} créés</span>
              <span class="kpi-card__detail kpi-card__detail--success">-${card.sprintClosed} résolus</span>
            </div>
          </div>
        `;
      }

      // Format MTTR (Mean Time To Recovery)
      if (card.showMTTR) {
        const hasMTTR = card.value > 0;
        return `
          <div class="kpi-card">
            <div class="kpi-card__label">
              ${card.label}
              <button class="help-btn help-btn--inline" data-tooltip="mttr" title="Qu'est-ce que le MTTR ?">?</button>
              <div class="kpi-card__tooltip" data-tooltip-content="mttr">
                <strong>Mean Time To Recovery</strong><br>
                Temps moyen pour résoudre un bug.<br><br>
                <em>Plus bas = meilleure réactivité</em><br><br>
                Élite : < 1h | Haute : < 1j | Moyenne : < 1 sem
              </div>
            </div>
            ${hasMTTR ? `
              <div class="kpi-card__stats">
                <div class="kpi-card__stat">
                  <span class="kpi-card__stat-label">Moyenne</span>
                  <span class="kpi-card__stat-value">${formatDays(card.value, card.decimals, true)}</span>
                </div>
                <div class="kpi-card__stat">
                  <span class="kpi-card__stat-label">Médiane</span>
                  <span class="kpi-card__stat-value">${formatDays(card.median, card.decimals, true)}</span>
                </div>
              </div>
              <div class="kpi-card__comparison">
                <span class="kpi-card__comparison-label">Moy. 6 sprints</span>
                <span class="kpi-card__comparison-value">${formatDays(card.periodAvg, 1, true)}</span>
              </div>
            ` : `
              <div class="kpi-card__empty">Aucun bug résolu</div>
            `}
          </div>
        `;
      }

      // Format Change Failure Rate
      if (card.showCFR) {
        const isGood = card.value < 15;
        const isMedium = card.value >= 15 && card.value < 30;
        const statusClass = isGood ? 'success' : (isMedium ? 'warning' : 'danger');
        return `
          <div class="kpi-card">
            <div class="kpi-card__label">
              ${card.label}
              <button class="help-btn help-btn--inline" data-tooltip="cfr" title="Qu'est-ce que le CFR ?">?</button>
              <div class="kpi-card__tooltip" data-tooltip-content="cfr">
                <strong>Change Failure Rate</strong><br>
                % de changements causant un bug.<br><br>
                <span style="color: var(--color-status-success)">< 15% Excellent</span><br>
                <span style="color: var(--color-status-warning)">15-30% Moyen</span><br>
                <span style="color: var(--color-status-danger)">> 30% À améliorer</span>
              </div>
            </div>
            <div class="kpi-card__value kpi-card__value--${statusClass}">
              ${formatNumber(card.value, card.decimals)}
              <span class="kpi-card__unit">%</span>
            </div>
            <div class="kpi-card__detail-small">
              ${card.bugsCreated} bugs / ${card.itemsDelivered} items livrés
            </div>
            <div class="kpi-card__comparison">
              <span class="kpi-card__comparison-label">Moy. 6 sprints</span>
              <span class="kpi-card__comparison-value">${formatNumber(card.periodAvg, 1)}%</span>
            </div>
          </div>
        `;
      }

      // Format Corrélation Pearson (SP/Cycle Time)
      if (card.showCorrelation) {
        const hasCurrent = card.current !== null;
        const hasPrevious = card.previous !== null;

        // Déterminer la couleur selon la force de la corrélation
        const getCorrelationClass = (r) => {
          if (r === null) return '';
          const absR = Math.abs(r);
          if (absR >= 0.7) return 'success';
          if (absR >= 0.4) return 'warning';
          return 'danger';
        };

        const currentClass = getCorrelationClass(card.current);
        const formatCorr = (r) => r !== null ? r.toFixed(2) : 'N/A';

        // Tendance
        let trendIcon = '';
        let trendLabel = '';
        if (card.trend !== null) {
          if (card.trend > 0.05) {
            trendIcon = '↑';
            trendLabel = 'En amélioration';
          } else if (card.trend < -0.05) {
            trendIcon = '↓';
            trendLabel = 'En baisse';
          } else {
            trendIcon = '→';
            trendLabel = 'Stable';
          }
        }

        return `
          <div class="kpi-card">
            <div class="kpi-card__label">
              ${card.label}
              <button class="help-btn help-btn--inline" data-tooltip="correlation" title="Qu'est-ce que cette corrélation ?">?</button>
              <div class="kpi-card__tooltip" data-tooltip-content="correlation">
                <strong>Corrélation Story Points / Cycle Time</strong><br><br>
                Mesure si le sizing relatif est cohérent avec l'effort réel.<br><br>
                <span style="color: var(--color-status-success)">0.7 - 1.0 : Forte → sizing fiable pour la prédictibilité</span><br>
                <span style="color: var(--color-status-warning)">0.4 - 0.7 : Modérée → sizing partiellement utile</span><br>
                <span style="color: var(--color-status-danger)">0.0 - 0.4 : Faible → sizing peu utile pour planifier</span><br><br>
                <em>Une corrélation proche de 0 suggère que les story points n'aident pas à la prédictibilité.</em>
              </div>
            </div>
            ${hasCurrent ? `
              <div class="kpi-card__value kpi-card__value--${currentClass}">
                ${formatCorr(card.current)}
                <span class="kpi-card__unit">${card.currentInterpretation?.label || ''}</span>
              </div>
              <div class="kpi-card__detail-small">
                ${card.currentSampleSize} tickets (hors bugs)
              </div>
            ` : `
              <div class="kpi-card__empty">Données insuffisantes</div>
            `}
          </div>
        `;
      }

      return `
        <div class="kpi-card">
          <div class="kpi-card__label">${card.label}</div>
          <div class="kpi-card__value">
            ${formatNumber(card.value, card.decimals)}
            <span class="kpi-card__unit">${card.unit}</span>
          </div>
          ${card.trend !== null && card.trend !== undefined ? `
            <div class="kpi-card__trend kpi-card__trend--${trendClass}">
              ${card.trend > 0 ? '↑' : card.trend < 0 ? '↓' : '→'}
              ${card.trendLabel || formatPercent(Math.abs(card.trend))}
            </div>
          ` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Vérifie si des données Story Points sont disponibles (manuelles)
   * @param {Object} manualInput
   * @returns {boolean}
   * @private
   */
  _hasStoryPointsData(manualInput) {
    if (!manualInput?.storyPoints) return false;
    return manualInput.storyPoints.some(sp =>
      sp.committed !== null || sp.delivered !== null
    );
  }

  /**
   * Rendu automatique de la section Story Points
   * Priorité aux données CSV, fallback sur saisie manuelle
   * @returns {string}
   * @private
   */
  _renderStoryPointsSectionAuto() {
    const { sprintMetrics, manualInput } = this.state;

    // Priorité 1 : Données CSV (calculées automatiquement)
    if (sprintMetrics?.storyPoints?.isFromCSV) {
      return this._renderStoryPointsSectionFromCSV(sprintMetrics.storyPoints);
    }

    // Priorité 2 : Saisie manuelle
    if (this._hasStoryPointsData(manualInput)) {
      return this._renderStoryPointsSection(manualInput);
    }

    // Aucune donnée disponible
    return '';
  }

  /**
   * Rendu de la section Story Points depuis les données CSV
   * @param {Object} storyPointsData - Données formatées depuis dataTransformerV2
   * @returns {string}
   * @private
   */
  _renderStoryPointsSectionFromCSV(storyPointsData) {
    const {
      currentCommitted,
      currentDelivered,
      currentCompletion,
      currentSprintLabel,
      avgCommitted,
      avgDelivered,
      avgCompletion,
      previousSprintsCount,
      recommendedVelocity
    } = storyPointsData;

    // Classe pour le % completion
    const getCompletionClass = (pct) => {
      if (pct >= 90) return 'success';
      if (pct < 70) return 'danger';
      return 'warning';
    };

    return `
      <section class="review-section review-section--story-points">
        <h4 class="review-section__title">Story Points</h4>
        <div class="sp-layout">
          <!-- Lignes + Carte vélocité -->
          <div class="sp-layout__content">
            <div class="sp-layout__rows">
              <!-- Header du tableau -->
              <div class="sp-table__header">
                <span></span>
                <span>Engagés</span>
                <span>Livrés</span>
                <span>Complétion</span>
              </div>
              <div class="sp-table__row sp-table__row--current">
                <span class="sp-table__label">${currentSprintLabel || 'Sprint actuel'}</span>
                <span class="sp-table__value">${currentCommitted}</span>
                <span class="sp-table__value">${currentDelivered}</span>
                <span class="sp-table__badge sp-table__badge--${getCompletionClass(currentCompletion)}">${currentCompletion}%</span>
              </div>
              ${previousSprintsCount > 0 ? `
                <div class="sp-table__row sp-table__row--avg">
                  <span class="sp-table__label">Moyenne (${previousSprintsCount} sprints)</span>
                  <span class="sp-table__value">${formatNumber(avgCommitted, 1)}</span>
                  <span class="sp-table__value">${formatNumber(avgDelivered, 1)}</span>
                  <span class="sp-table__badge sp-table__badge--${getCompletionClass(avgCompletion)}">${avgCompletion}%</span>
                </div>
              ` : ''}
            </div>

            <!-- Carte Vélocité Recommandée -->
            ${previousSprintsCount > 0 ? `
              <div class="velocity-card velocity-card--hidden" data-component="velocity-card">
                <div class="velocity-card__label">Vélocité recommandée</div>
                <div class="velocity-card__value">${recommendedVelocity}</div>
                <div class="velocity-card__unit">story points</div>
                <div class="velocity-card__hint">pour le prochain sprint</div>
                <button class="velocity-card__reveal-btn" data-action="reveal-velocity">Révéler</button>
              </div>
            ` : ''}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Rendu de la section Story Points (saisie manuelle - fallback)
   * @param {Object} manualInput
   * @returns {string}
   * @private
   */
  _renderStoryPointsSection(manualInput) {
    const storyPoints = manualInput.storyPoints;

    // Sprint actuel (index 0)
    const current = storyPoints[0];
    const currentCommitted = current.committed || 0;
    const currentDelivered = current.delivered || 0;
    const currentCompletion = currentCommitted > 0
      ? Math.round((currentDelivered / currentCommitted) * 100)
      : 0;

    // Sprints précédents (index 1 à 5)
    const previousSprints = storyPoints.slice(1).filter(sp =>
      sp.committed !== null && sp.committed > 0
    );

    let avgCommitted = 0;
    let avgDelivered = 0;
    let avgCompletion = 0;

    if (previousSprints.length > 0) {
      avgCommitted = previousSprints.reduce((sum, sp) => sum + (sp.committed || 0), 0) / previousSprints.length;
      avgDelivered = previousSprints.reduce((sum, sp) => sum + (sp.delivered || 0), 0) / previousSprints.length;
      avgCompletion = avgCommitted > 0 ? Math.round((avgDelivered / avgCommitted) * 100) : 0;
    }

    // Classe pour le % completion
    const getCompletionClass = (pct) => {
      if (pct >= 90) return 'success';
      if (pct < 70) return 'danger';
      return 'warning';
    };

    // Vélocité recommandée = moyenne des livrés des sprints précédents
    const recommendedVelocity = Math.round(avgDelivered);

    return `
      <section class="review-section review-section--story-points">
        <h4 class="review-section__title">Story Points</h4>
        <div class="sp-layout">
          <!-- Lignes + Carte vélocité -->
          <div class="sp-layout__content">
            <div class="sp-layout__rows">
              <!-- Header du tableau -->
              <div class="sp-table__header">
                <span></span>
                <span>Engagés</span>
                <span>Livrés</span>
                <span>Complétion</span>
              </div>
              <div class="sp-table__row sp-table__row--current">
                <span class="sp-table__label">Sprint actuel</span>
                <span class="sp-table__value">${currentCommitted}</span>
                <span class="sp-table__value">${currentDelivered}</span>
                <span class="sp-table__badge sp-table__badge--${getCompletionClass(currentCompletion)}">${currentCompletion}%</span>
              </div>
              ${previousSprints.length > 0 ? `
                <div class="sp-table__row sp-table__row--avg">
                  <span class="sp-table__label">Moyenne (${previousSprints.length} sprints)</span>
                  <span class="sp-table__value">${formatNumber(avgCommitted, 1)}</span>
                  <span class="sp-table__value">${formatNumber(avgDelivered, 1)}</span>
                  <span class="sp-table__badge sp-table__badge--${getCompletionClass(avgCompletion)}">${avgCompletion}%</span>
                </div>
              ` : ''}
            </div>

            <!-- Carte Vélocité Recommandée -->
            ${previousSprints.length > 0 ? `
              <div class="velocity-card velocity-card--hidden" data-component="velocity-card">
                <div class="velocity-card__label">Vélocité recommandée</div>
                <div class="velocity-card__value">${recommendedVelocity}</div>
                <div class="velocity-card__unit">story points</div>
                <div class="velocity-card__hint">pour le prochain sprint</div>
                <button class="velocity-card__reveal-btn" data-action="reveal-velocity">Révéler</button>
              </div>
            ` : ''}
          </div>
        </div>
      </section>
    `;
  }

  /**
   * Rendu de l'état vide
   * @returns {string}
   * @private
   */
  _renderEmptyState() {
    return `
      <div class="review-page review-page--empty">
        <div class="empty-state">
          <div class="empty-state__icon">📊</div>
          <h3 class="empty-state__title">Pas encore de données</h3>
          <p class="empty-state__text">
            Commencez par charger vos fichiers CSV.
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
      'click [data-action="toggle-export-menu"]': this._handleToggleExportMenu,
      'click [data-action="export-pdf-radial"]': this._handleExportPDFRadial,
      'click [data-action="export-pdf-infographic"]': this._handleExportPDFInfographic,
      'click [data-action="export-md"]': this._handleExportMD,
      'click [data-action="go-to-admin"]': this._handleGoToAdmin,
      'click [data-action="reveal-velocity"]': this._handleRevealVelocity,
      'click [data-action="set-throughput-metric"]': this._handleSetThroughputMetric,
      'click [data-tooltip]': this._handleToggleTooltip
    };
  }

  /**
   * Gestionnaire toggle tooltip DORA
   * @param {Event} e
   * @private
   */
  _handleToggleTooltip(e) {
    e.stopPropagation();
    const tooltipId = e.currentTarget.dataset.tooltip;
    const label = e.currentTarget.closest('.kpi-card__label');
    const tooltip = label?.querySelector(`[data-tooltip-content="${tooltipId}"]`);

    if (!tooltip) return;

    // Fermer tous les autres tooltips
    document.querySelectorAll('.kpi-card__tooltip.is-visible').forEach(t => {
      if (t !== tooltip) t.classList.remove('is-visible');
    });

    // Toggle le tooltip actuel
    tooltip.classList.toggle('is-visible');

    // Fermer au clic ailleurs
    const closeOnClickOutside = (event) => {
      if (!label.contains(event.target)) {
        tooltip.classList.remove('is-visible');
        document.removeEventListener('click', closeOnClickOutside);
      }
    };

    if (tooltip.classList.contains('is-visible')) {
      setTimeout(() => {
        document.addEventListener('click', closeOnClickOutside);
      }, 0);
    }
  }

  /**
   * Gestionnaire toggle menu export
   * @private
   */
  _handleToggleExportMenu(e) {
    e.stopPropagation();
    const newState = !this.state.showExportMenu;
    this.state.showExportMenu = newState;

    // Mettre à jour le menu sans re-render complet
    const menu = this.container?.querySelector('[data-component="export-menu"]');
    if (menu) {
      menu.classList.toggle('export-dropdown__menu--visible', newState);
    }

    // Fermer au clic ailleurs
    if (newState) {
      const closeMenu = (event) => {
        if (!event.target.closest('.export-dropdown')) {
          this.state.showExportMenu = false;
          const menuEl = this.container?.querySelector('[data-component="export-menu"]');
          if (menuEl) {
            menuEl.classList.remove('export-dropdown__menu--visible');
          }
          document.removeEventListener('click', closeMenu);
        }
      };
      setTimeout(() => document.addEventListener('click', closeMenu), 0);
    }
  }

  /**
   * Gestionnaire export PDF Radial
   * @private
   */
  async _handleExportPDFRadial() {
    this.state.showExportMenu = false;
    this.setState({ isExporting: true });

    try {
      const { manualInput } = this.state;
      const filename = `sprint-review-radial-${manualInput?.sprintName?.replace(/\s+/g, '-') || 'export'}`;

      await pdfExporter.exportRadial(filename);

      eventBus.emit('notification:show', {
        type: 'success',
        message: 'PDF Radial exporté avec succès'
      });
    } catch (error) {
      eventBus.emit('notification:show', {
        type: 'error',
        message: `Erreur export: ${error.message}`
      });
    } finally {
      this.setState({ isExporting: false });
    }
  }

  /**
   * Gestionnaire export PDF Infographique
   * @private
   */
  async _handleExportPDFInfographic() {
    this.state.showExportMenu = false;
    this.setState({ isExporting: true });

    try {
      const { manualInput } = this.state;
      const filename = `sprint-review-${manualInput?.sprintName?.replace(/\s+/g, '-') || 'export'}`;

      await pdfExporter.exportInfographic(filename);

      eventBus.emit('notification:show', {
        type: 'success',
        message: 'PDF infographie exporté avec succès'
      });
    } catch (error) {
      eventBus.emit('notification:show', {
        type: 'error',
        message: `Erreur export: ${error.message}`
      });
    } finally {
      this.setState({ isExporting: false });
    }
  }

  /**
   * Gestionnaire export Markdown
   * @private
   */
  async _handleExportMD() {
    this.state.showExportMenu = false;
    this.setState({ isExporting: true });

    try {
      const { manualInput } = this.state;
      const filename = `sprint-review-${manualInput?.sprintName?.replace(/\s+/g, '-') || 'export'}`;

      await pdfExporter.export(filename);

      eventBus.emit('notification:show', {
        type: 'success',
        message: 'Markdown exporté avec succès'
      });
    } catch (error) {
      eventBus.emit('notification:show', {
        type: 'error',
        message: `Erreur export: ${error.message}`
      });
    } finally {
      this.setState({ isExporting: false });
    }
  }

  /**
   * Gestionnaire navigation vers admin
   * @private
   */
  _handleGoToAdmin() {
    eventBus.emit('navigation:request', { section: 'admin' });
  }

  /**
   * Gestionnaire révélation vélocité
   * @private
   */
  _handleRevealVelocity(e) {
    const card = e.target.closest('.velocity-card');
    if (card) {
      card.classList.remove('velocity-card--hidden');
      card.classList.add('velocity-card--revealed');
    }
  }

  /**
   * Gestionnaire changement de métrique throughput
   * @private
   */
  _handleSetThroughputMetric(e) {
    const value = e.currentTarget.dataset.value;
    if (value && value !== this.state.throughputMetric) {
      this.state.throughputMetric = value;

      // Mettre à jour le toggle visuellement
      const toggleBtns = this.container.querySelectorAll('[data-action="set-throughput-metric"]');
      toggleBtns.forEach(btn => {
        btn.classList.toggle('toggle-group__btn--active', btn.dataset.value === value);
      });

      // Mettre à jour le sous-titre
      const subtitle = this.container.querySelector('.chart-section__subtitle');
      if (subtitle) {
        subtitle.textContent = value === 'storyPoints'
          ? 'Story Points livrés par sprint'
          : 'Tickets fermés par sprint';
      }

      // Recréer le graphique avec les nouvelles données
      if (this.state.sprintMetrics) {
        this._initializeCharts(this.state.sprintMetrics);
      }
    }
  }
}
