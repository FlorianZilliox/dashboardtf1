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
import { BarChart, TrendChart, DoughnutChart } from '../components/charts/index.js';
import store from '../core/store.js';
import eventBus from '../core/eventBus.js';
import config from '../core/config.js';
import metricsCalculator from '../services/metricsCalculator.js';
import pdfExporter from '../services/pdfExporter.js';
import { formatNumber, formatPercent, formatDays } from '../utils/formatters.js';
import { sanitize } from '../utils/validators.js';

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
      isExporting: false,
      throughputMetric: 'tickets', // 'tickets' ou 'storyPoints'
      showPearson: false, // Carte corrélation cachée par défaut
      showBurndown: false, // Burndown chart caché par défaut
      showExportMenu: false, // Menu d'export dropdown
      excludedSprintsThroughput: [],  // Indices des sprints exclus du calcul Throughput
      excludedSprintsCycleTime: []    // Indices des sprints exclus du calcul Cycle Time
    };

    // Écouter le déverrouillage de la corrélation Pearson
    eventBus.on('secret:unlock:pearson', () => {
      this.setState({ showPearson: true });
    });

    // Écouter le déverrouillage du Burndown
    eventBus.on('secret:unlock:burndown', () => {
      this.setState({ showBurndown: true });
    });

    // Écouter le masquage de tous les secrets
    eventBus.on('secret:hide-all', () => {
      this.setState({ showPearson: false, showBurndown: false });
    });

    // S'abonner aux changements du store
    this.subscribe(
      state => ({ metrics: state.sprintMetrics, manual: state.manualInput }),
      ({ metrics, manual }) => {
        this.setState({
          sprintMetrics: metrics,
          manualInput: manual
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
    console.log('[ReviewPage] afterMount - state.sprintMetrics:', !!this.state.sprintMetrics);
    console.log('[ReviewPage] afterMount - store.sprintMetrics:', !!storeMetrics);

    const needsRerender =
      this.state.sprintMetrics !== storeMetrics ||
      this.state.manualInput !== storeManual;

    if (needsRerender) {
      console.log('[ReviewPage] afterMount - needsRerender=true, mise à jour du state');
      this.state.sprintMetrics = storeMetrics;
      this.state.manualInput = storeManual;
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
    // Helper : lire les CSS vars pour les couleurs
    const cs = getComputedStyle(document.documentElement);
    const v = (name) => cs.getPropertyValue(name).trim();
    const p = {
      ink: v('--ink'), ink3: v('--ink-3'), inkMute: v('--ink-mute'),
      sage: v('--sage'), sageSoft: v('--sage-soft'),
      amber: v('--amber'), amberSoft: v('--amber-soft'),
      rust: v('--rust'), rustSoft: v('--rust-soft'),
      plum: v('--plum'), plumSoft: v('--plum-soft'),
      sky: v('--sky'), skySoft: v('--sky-soft'),
      line: v('--line-hair'), paper: v('--paper')
    };

    // Options communes (style editorial)
    const commonOpts = () => ({
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          backgroundColor: p.ink, titleColor: p.paper, bodyColor: p.paper,
          titleFont: { family: 'JetBrains Mono', size: 10 },
          bodyFont: { family: 'Inter', size: 12 },
          padding: 8, cornerRadius: 4, borderWidth: 0
        }
      },
      scales: {
        x: { grid: { display: false }, border: { color: p.ink3 }, ticks: { color: p.ink3, font: { family: 'JetBrains Mono', size: 10 } } },
        y: { grid: { color: p.line, drawBorder: false }, border: { display: false }, ticks: { color: p.ink3, font: { family: 'JetBrains Mono', size: 10 } } }
      }
    });

    // === THROUGHPUT ===
    const throughputCanvas = document.getElementById('throughput-chart');
    if (throughputCanvas && metrics.throughput?.values?.length) {
      if (this.components.throughputChart) this.components.throughputChart.destroy();

      const isStoryPoints = this.state.throughputMetric === 'storyPoints';
      const chartData = isStoryPoints ? (metrics.throughput.storyPointsValues || []) : metrics.throughput.values;

      this.components.throughputChart = new Chart(throughputCanvas, {
        type: 'bar',
        data: {
          labels: metrics.throughput.weeks,
          datasets: [{
            data: chartData,
            backgroundColor: chartData.map((_, i) => i === chartData.length - 1 ? p.sage : p.sageSoft),
            borderRadius: 2, borderSkipped: false, barPercentage: 0.7
          }]
        },
        options: {
          ...commonOpts(),
          onClick: (event, elements) => {
            if (elements.length > 0) this._handleToggleSprintExclusion('throughput', elements[0].index);
          }
        }
      });
    }

    // === CYCLE TIME ===
    const cycleTimeCanvas = document.getElementById('cycletime-chart');
    if (cycleTimeCanvas && metrics.cycleTime?.values?.length) {
      if (this.components.cycleTimeChart) this.components.cycleTimeChart.destroy();

      this.components.cycleTimeChart = new Chart(cycleTimeCanvas, {
        type: 'bar',
        data: {
          labels: metrics.cycleTime.weeks,
          datasets: [{
            data: metrics.cycleTime.values,
            backgroundColor: metrics.cycleTime.values.map((_, i) => i === metrics.cycleTime.values.length - 1 ? p.amber : p.amberSoft),
            borderRadius: 2, borderSkipped: false, barPercentage: 0.7
          }]
        },
        options: {
          ...commonOpts(),
          onClick: (event, elements) => {
            if (elements.length > 0) this._handleToggleSprintExclusion('cycleTime', elements[0].index);
          }
        }
      });
    }

    // === TIME IN STATUS (2 doughnuts) ===
    const tisSprintCanvas = document.getElementById('timeinstatus-chart-sprint');
    const tisPeriodCanvas = document.getElementById('timeinstatus-chart-period');

    if (metrics.timeInStatus?.labels?.length) {
      const tis = metrics.timeInStatus;
      const donutPalette = [p.sage, p.amber, p.rust, p.plum, p.sky, p.sageSoft, p.amberSoft, p.rustSoft, p.plumSoft];
      const donutOpts = {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: c => `${c.label}: ${c.raw}%` } }
        }
      };

      if (tisSprintCanvas) {
        if (this.components.tisChartSprint) this.components.tisChartSprint.destroy();
        this.components.tisChartSprint = new Chart(tisSprintCanvas, {
          type: 'doughnut',
          data: { labels: tis.labels, datasets: [{ data: tis.pct2w, backgroundColor: donutPalette.slice(0, tis.labels.length), borderColor: p.paper, borderWidth: 2 }] },
          options: donutOpts
        });
      }

      if (tisPeriodCanvas) {
        if (this.components.tisChartPeriod) this.components.tisChartPeriod.destroy();
        this.components.tisChartPeriod = new Chart(tisPeriodCanvas, {
          type: 'doughnut',
          data: { labels: tis.labels, datasets: [{ data: tis.pct12w, backgroundColor: donutPalette.slice(0, tis.labels.length), borderColor: p.paper, borderWidth: 2 }] },
          options: donutOpts
        });
      }

      // Legende editorial
      const legendContainer = document.getElementById('timeinstatus-legend');
      if (legendContainer) {
        legendContainer.innerHTML = tis.labels.map((label, idx) =>
          `<span class="legend__item"><span class="legend__sw" style="background:${donutPalette[idx]}"></span>${label} — ${tis.pct2w[idx]}%</span>`
        ).join('');
      }
    }

    // === BUGS ===
    const bugsCanvas = document.getElementById('bugs-chart');
    if (bugsCanvas && metrics.bugs?.created?.length && metrics.bugs?.closed?.length) {
      if (this.components.bugsChart) this.components.bugsChart.destroy();

      this.components.bugsChart = new Chart(bugsCanvas, {
        type: 'bar',
        data: {
          labels: metrics.bugs.weeks,
          datasets: [
            { data: metrics.bugs.created, backgroundColor: p.rust, borderRadius: 2, borderSkipped: false, barPercentage: 0.85 },
            { data: metrics.bugs.closed, backgroundColor: p.sage, borderRadius: 2, borderSkipped: false, barPercentage: 0.85 }
          ]
        },
        options: commonOpts()
      });
    }

    // === WIP ===
    const wipCanvas = document.getElementById('wip-chart');
    if (wipCanvas && metrics.wip?.values?.length) {
      if (this.components.wipChart) this.components.wipChart.destroy();

      this.components.wipChart = new Chart(wipCanvas, {
        type: 'line',
        data: {
          labels: metrics.wip.sprints,
          datasets: [{
            data: metrics.wip.values,
            borderColor: p.plum,
            backgroundColor: p.plumSoft + '80',
            borderWidth: 2, tension: 0.35, fill: true,
            pointRadius: 3, pointBackgroundColor: p.plum, pointBorderColor: p.paper, pointBorderWidth: 1.5
          }]
        },
        options: commonOpts()
      });
    }

    // === BURNDOWN (secret) ===
    const burndownCanvas = document.getElementById('burndown-chart');
    if (burndownCanvas && metrics.burndown?.actualSP?.length) {
      if (this.components.burndownChart) this.components.burndownChart.destroy();

      const burndown = metrics.burndown;
      const weekendAnnotations = {};
      if (burndown.days) {
        let weekendStart = null, weekendStartIndex = null;
        burndown.days.forEach((day, index) => {
          const isWeekend = day.getDay() === 0 || day.getDay() === 6;
          if (isWeekend && weekendStart === null) { weekendStart = burndown.labels[index]; weekendStartIndex = index; }
          else if (!isWeekend && weekendStart !== null) {
            weekendAnnotations[`weekend_${weekendStartIndex}`] = { type: 'box', xMin: weekendStartIndex - 0.5, xMax: index - 0.5, yMin: 0, yMax: Math.max(...burndown.actualSP, ...burndown.idealSP) * 1.1, backgroundColor: p.sageSoft + '40', borderWidth: 0, drawTime: 'beforeDatasetsDraw' };
            weekendStart = null; weekendStartIndex = null;
          }
        });
        if (weekendStart !== null) {
          weekendAnnotations[`weekend_${weekendStartIndex}`] = { type: 'box', xMin: weekendStartIndex - 0.5, xMax: burndown.days.length - 0.5, yMin: 0, yMax: Math.max(...burndown.actualSP, ...burndown.idealSP) * 1.1, backgroundColor: p.sageSoft + '40', borderWidth: 0, drawTime: 'beforeDatasetsDraw' };
        }
      }

      this.components.burndownChart = new Chart(burndownCanvas, {
        type: 'line',
        data: {
          labels: burndown.labels,
          datasets: [
            { label: 'SP restants', data: burndown.actualSP, borderColor: p.sage, backgroundColor: p.sageSoft + '40', borderWidth: 2, tension: 0, fill: true, pointRadius: 3, pointBackgroundColor: p.sage },
            { label: 'Idéal', data: burndown.idealSP, borderColor: p.inkMute, borderWidth: 1.5, borderDash: [5, 5], tension: 0, fill: false, pointRadius: 0 }
          ]
        },
        options: {
          ...commonOpts(),
          plugins: {
            ...commonOpts().plugins,
            annotation: { annotations: weekendAnnotations }
          }
        }
      });
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
   * Retourne le sous-titre du graphique Burndown
   * @returns {string}
   * @private
   */
  _getBurndownSubtitle() {
    const { sprintMetrics } = this.state;
    const burndown = sprintMetrics?.burndown;

    if (!burndown) {
      return 'Progression du sprint';
    }

    const { initialSP, midSprintSP, spDelivered, completionRate } = burndown;

    if (midSprintSP > 0) {
      return `${initialSP} SP initiaux + ${midSprintSP} SP ajoutés mid-sprint → ${spDelivered} livrés (${completionRate}%)`;
    }

    return `${initialSP} SP engagés → ${spDelivered} livrés (${completionRate}%)`;
  }

  /**
   * Rendu du composant
   */
  render() {
    const { sprintMetrics, manualInput, isExporting } = this.state;

    // Afficher l'état vide si pas de données CSV chargées
    if (!sprintMetrics) {
      return this._renderEmptyState();
    }

    const storyPointsHtml = this._renderStoryPointsSectionAuto();
    const teamName = manualInput?.teamName || '';
    const sprintName = manualInput?.sprintName || '';
    const sprintNumber = sprintName.match(/\d+/)?.[0] || '';

    return `
      <div class="review-page" id="section-review">
        ${this._renderHeader()}

        <!-- § 01 — Story Points -->
        ${storyPointsHtml ? `
          <div class="section--editorial" style="border-top:0;padding-top:0;margin-top:0">
            <div class="section__head">
              <div class="section__title">
                <span class="section__num">§ 01 — Story points</span>
                <h2 class="h-section">Engagement et livraison</h2>
              </div>
            </div>
            ${storyPointsHtml}
          </div>
        ` : ''}

        <!-- § 02 — Indicateurs -->
        <div class="section--editorial">
          <div class="section__head">
            <div class="section__title">
              <span class="section__num">§ 02 — Indicateurs</span>
              <h2 class="h-section">Six chiffres pour résumer le sprint</h2>
            </div>
            <span class="dek section__deck">Comparé à la médiane des six derniers sprints.</span>
          </div>
          ${this._renderKPISection()}
        </div>

        <!-- § 03 — Tendances -->
        <div class="section--editorial">
          <div class="section__head">
            <div class="section__title">
              <span class="section__num">§ 03 — Tendances</span>
              <h2 class="h-section">Six sprints en perspective</h2>
            </div>
          </div>
          ${this._renderChartsSection()}
        </div>

        <div class="fineprint">Sprint Review · ${teamName} — ${sprintName} · 100 % local · Aucune donnée transmise</div>

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
    const sprintName = manualInput?.sprintName || 'Sprint';
    const sprintNumber = sprintName.match(/\d+/)?.[0] || '';

    return `
      <div class="cover">
        <div style="display:flex;align-items:flex-end">
          <h1 class="h-display">${manualInput?.teamName || 'Sprint Review'}</h1>
        </div>
        <div style="text-align:right">
          <div class="cover__sprintno"><sup>N°</sup>${sprintNumber}</div>
          <div style="margin-top:18px;display:flex;gap:8px;justify-content:flex-end">
            <div class="export-dropdown" style="position:relative">
              <button class="btn--editorial-ghost btn--editorial-small"
                      data-action="toggle-export-menu"
                      ${isExporting ? 'disabled' : ''}>
                ${isExporting ? 'Export...' : 'Exporter ▾'}
              </button>
              <div class="export-dropdown__menu ${showExportMenu ? 'export-dropdown__menu--visible' : ''}" data-component="export-menu">
                <button class="export-dropdown__item" data-action="export-pdf-radial">
                  <span class="export-dropdown__label">PDF Radial</span>
                </button>
                <button class="export-dropdown__item" data-action="export-pdf-infographic">
                  <span class="export-dropdown__label">PDF Classique</span>
                </button>
                <button class="export-dropdown__item" data-action="export-md">
                  <span class="export-dropdown__label">Markdown</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Rendu de la section métriques
   * @returns {string}
   * @private
   */
  _renderMetricsSection() {
    // Legacy - redirige vers les nouvelles méthodes
    return this._renderKPISection() + this._renderChartsSection();
  }

  /**
   * Rendu de la grille KPI (3×2)
   * @returns {string}
   * @private
   */
  _renderKPISection() {
    return `
      <div class="kpi-grid">
        ${this._renderKPICards()}
      </div>
    `;
  }

  /**
   * Rendu de la grille des graphiques (2 col + full-width)
   * @returns {string}
   * @private
   */
  _renderChartsSection() {
    const throughputLabel = this.state.throughputMetric === 'storyPoints'
      ? 'Story Points livrés par sprint — sprint courant en pleine teinte'
      : 'Tickets fermés par sprint — sprint courant en pleine teinte';

    return `
      <div class="grid-2">
        <!-- Throughput -->
        <div class="grid-cell">
          <div class="cell__head">
            <div class="cell__title">
              <h3 class="h-card">Throughput</h3>
              <span class="dek" id="trend-label">${throughputLabel}</span>
            </div>
            <div class="toggle">
              <button data-action="set-throughput-metric" data-value="tickets"
                      aria-pressed="${this.state.throughputMetric === 'tickets'}">Tickets</button>
              <button data-action="set-throughput-metric" data-value="storyPoints"
                      aria-pressed="${this.state.throughputMetric === 'storyPoints'}">SP</button>
            </div>
          </div>
          <div class="cell__chart"><canvas id="throughput-chart"></canvas></div>
        </div>

        <!-- Cycle Time -->
        <div class="grid-cell">
          <div class="cell__head">
            <div class="cell__title">
              <h3 class="h-card">Cycle Time</h3>
              <span class="dek">Temps moyen, en jours, par sprint</span>
            </div>
          </div>
          <div class="cell__chart"><canvas id="cycletime-chart"></canvas></div>
        </div>

        <!-- Time in Status -->
        <div class="grid-cell">
          <div class="cell__head">
            <div class="cell__title">
              <h3 class="h-card">Répartition du cycle</h3>
              <span class="dek">Sprint courant vs 6 sprints</span>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
            <div style="text-align:center">
              <div class="eyebrow" style="margin-bottom:8px">Sprint</div>
              <div style="height:160px"><canvas id="timeinstatus-chart-sprint"></canvas></div>
            </div>
            <div style="text-align:center">
              <div class="eyebrow" style="margin-bottom:8px">6 sprints</div>
              <div style="height:160px"><canvas id="timeinstatus-chart-period"></canvas></div>
            </div>
          </div>
          <div class="legend" id="timeinstatus-legend"></div>
        </div>

        <!-- Bugs -->
        <div class="grid-cell">
          <div class="cell__head">
            <div class="cell__title">
              <h3 class="h-card">Bugs — créés vs résolus</h3>
              <span class="dek">Solde net du stock par sprint</span>
            </div>
            <div class="legend" style="margin:0;gap:12px">
              <span class="legend__item"><span class="legend__sw" style="background:var(--rust)"></span>Créés</span>
              <span class="legend__item"><span class="legend__sw" style="background:var(--sage)"></span>Résolus</span>
            </div>
          </div>
          <div class="cell__chart"><canvas id="bugs-chart"></canvas></div>
        </div>

        <!-- WIP (full width) -->
        <div class="grid-cell grid-cell--span2">
          <div class="cell__head">
            <div class="cell__title">
              <h3 class="h-card">WIP individuel moyen</h3>
              <span class="dek">${this._getWipSubtitle()}</span>
            </div>
          </div>
          <div class="cell__chart"><canvas id="wip-chart"></canvas></div>
        </div>

        <!-- Burndown (secret: "burn", full width) -->
        ${this.state.showBurndown ? `
        <div class="grid-cell grid-cell--span2">
          <div class="cell__head">
            <div class="cell__title">
              <h3 class="h-card">Burndown*</h3>
              <span class="dek">${this._getBurndownSubtitle()}</span>
            </div>
          </div>
          <div class="cell__chart"><canvas id="burndown-chart"></canvas></div>
          <p class="dek" style="font-size:11px;margin-top:8px">*Approximatif : basé sur les dates de fermeture Jira, pas sur les daily updates</p>
        </div>
        ` : ''}
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

    // === LIGNE 1 : Throughput, Cycle Time, Stock Bugs ===

    // Throughput du sprint
    if (sprintMetrics?.throughput?.currentValue !== undefined) {
      cardsRow1.push({
        label: 'Throughput',
        value: sprintMetrics.throughput.currentValue,
        benchmark: sprintMetrics.throughput.benchmarkMedian,
        trend: sprintMetrics.throughput.trend,
        trendIsGood: 'up',
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

    // Stock Bugs (déplacé de row2 vers row1)
    if (sprintMetrics?.bugs) {
      cardsRow1.push({
        label: 'Stock Bugs',
        value: sprintMetrics.bugs.stock || 0,
        unit: 'bugs ouverts',
        sprintCreated: sprintMetrics.bugs.sprintCreated || 0,
        sprintClosed: sprintMetrics.bugs.sprintClosed || 0,
        showBugDetails: true,
        decimals: 0
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

    // === LIGNE 2 : Mid-Sprint, MTTR, CFR ===

    // Ajouts mid-sprint (déplacé de row1 vers row2)
    if (sprintMetrics?.throughput?.midSprintCount !== undefined) {
      cardsRow2.push({
        label: 'Ajouts mid-sprint',
        value: sprintMetrics.throughput.midSprintCount,
        throughputValue: sprintMetrics.throughput.currentValue,
        midSprintAdditions: sprintMetrics.throughput.midSprintAdditions || [],
        showMidSprint: true,
        decimals: 0
      });
    }

    if (sprintMetrics?.bugs) {

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
        bugsClosed: sprintMetrics.bugs.sprintClosed || 0,
        itemsDelivered: sprintMetrics.bugs.itemsDelivered || 0,
        showCFR: true,
        decimals: 1
      });
    }

    const cards = [...cardsRow1, ...cardsRow2];

    return cards.map(card => {
      // Determiner la direction du trend
      const trendArrow = card.trend > 0 ? '↑' : card.trend < 0 ? '↓' : '→';
      let trendClass = '';
      if (card.trend > 0) {
        trendClass = card.trendIsGood === 'up' ? 'kpi__delta--up' : 'kpi__delta--down';
      } else if (card.trend < 0) {
        trendClass = card.trendIsGood === 'down' ? 'kpi__delta--up' : 'kpi__delta--down';
      }

      // === Throughput ===
      if (!card.showAvgMedian && !card.showMidSprint && !card.showBugDetails && !card.showMTTR && !card.showCFR && !card.showCorrelation) {
        return `
          <div class="kpi kpi--feat">
            <div class="kpi__label">Throughput</div>
            <div class="kpi__num"><span class="tnum">${formatNumber(card.value, card.decimals)}</span></div>
            <div class="kpi__hint">Méd. 6 sprints : ${card.benchmark || '—'}</div>
            ${card.trend !== null && card.trend !== undefined ? `
              <div class="kpi__foot"><span class="kpi__delta ${trendClass}">${trendArrow} ${formatPercent(Math.abs(card.trend))}</span><span>vs sprint précédent</span></div>
            ` : ''}
          </div>
        `;
      }

      // === Cycle Time ===
      if (card.showAvgMedian) {
        return `
          <div class="kpi">
            <div class="kpi__label">Cycle time<sup style="font-size:9px;margin-left:3px">★</sup></div>
            <div class="kpi__num"><span class="tnum">${formatNumber(card.value, card.decimals)}</span><em>j</em></div>
            <div class="kpi__sub">
              <span><b>${formatNumber(card.median, card.decimals)}j</b> médiane</span>
              <span><b>${formatNumber(card.value, card.decimals)}j</b> moyenne</span>
            </div>
            ${card.trend !== null ? `
              <div class="kpi__foot"><span class="kpi__delta ${trendClass}">${trendArrow} ${formatPercent(Math.abs(card.trend))}</span><span>★ hors bugs</span></div>
            ` : ''}
          </div>
        `;
      }

      // === Stock Bugs ===
      if (card.showBugDetails) {
        const netBugs = card.sprintCreated - card.sprintClosed;
        const netArrow = netBugs > 0 ? '↑' : netBugs < 0 ? '↓' : '→';
        const netClass = netBugs <= 0 ? 'kpi__delta--up' : 'kpi__delta--down';
        return `
          <div class="kpi">
            <div class="kpi__label">Stock de bugs</div>
            <div class="kpi__num"><span class="tnum">${formatNumber(card.value, card.decimals)}</span></div>
            <div class="tagrow">
              <span class="tag" style="color:var(--bad)"><b>+${card.sprintCreated}</b> créés</span>
              <span class="tag" style="color:var(--ok)"><b>−${card.sprintClosed}</b> résolus</span>
            </div>
            <div class="kpi__foot"><span class="kpi__delta ${netClass}">${netArrow} ${Math.abs(netBugs)}</span><span>net cette quinzaine</span></div>
          </div>
        `;
      }

      // === Mid-Sprint ===
      if (card.showMidSprint) {
        const additions = card.midSprintAdditions || [];
        const byType = {};
        additions.forEach(t => { byType[t.type] = (byType[t.type] || 0) + 1; });
        const typeBreakdown = Object.entries(byType).sort((a, b) => b[1] - a[1]);
        const pct = card.throughputValue ? Math.round(card.value / card.throughputValue * 100) : 0;
        const hasAdditions = additions.length > 0;

        return `
          <div class="kpi${hasAdditions ? ' kpi--has-popover' : ''}"${hasAdditions ? ' tabindex="0" aria-describedby="midsprint-popover"' : ''}>
            <div class="kpi__label">Ajouts mid‑sprint</div>
            <div class="kpi__num"><span class="tnum">${formatNumber(card.value, card.decimals)}</span></div>
            ${typeBreakdown.length > 0 ? `
              <div class="tagrow">${typeBreakdown.map(([type, count]) =>
                `<span class="tag"><b>${count}</b> ${type}</span>`
              ).join('')}</div>
            ` : `<div class="kpi__hint" style="color:var(--ok)">Scope préservé</div>`}
            <div class="kpi__foot"><span>Sur ${card.throughputValue || '—'} tickets — soit ${pct} % du scope</span></div>
            ${hasAdditions ? this._renderMidSprintPopover(additions) : ''}
          </div>
        `;
      }

      // === MTTR ===
      if (card.showMTTR) {
        return `
          <div class="kpi">
            <div class="kpi__label">MTTR</div>
            ${card.value > 0 ? `
              <div class="kpi__num"><span class="tnum">${formatNumber(card.value, card.decimals)}</span><em>j</em></div>
              <div class="kpi__sub">
                <span><b>${formatNumber(card.value, card.decimals)}j</b> moy.</span>
                <span><b>${formatNumber(card.median, card.decimals)}j</b> médiane</span>
              </div>
              <div class="kpi__foot"><span>Moy. 6 sprints : ${formatNumber(card.periodAvg, 1)} j</span></div>
            ` : `
              <div class="kpi__hint">Aucun bug résolu</div>
            `}
          </div>
        `;
      }

      // === Change Failure Rate ===
      if (card.showCFR) {
        const cfrColor = card.value < 15 ? 'var(--ok)' : card.value < 30 ? 'var(--warn)' : 'var(--bad)';
        const cfrDelta = card.periodAvg ? Math.round(card.value - card.periodAvg) : null;
        const cfrDeltaArrow = cfrDelta > 0 ? '↑' : cfrDelta < 0 ? '↓' : '→';
        const cfrDeltaClass = cfrDelta <= 0 ? 'kpi__delta--up' : 'kpi__delta--down';
        return `
          <div class="kpi">
            <div class="kpi__label">Change failure rate</div>
            <div class="kpi__num" style="color:${cfrColor}"><span class="tnum">${formatNumber(card.value, card.decimals)}</span><em>%</em></div>
            <div class="kpi__sub">
              <span><b>${card.bugsClosed}</b> bugs</span>
              <span><b>${card.itemsDelivered}</b> items livrés</span>
            </div>
            <div class="kpi__foot">${cfrDelta !== null ? `<span class="kpi__delta ${cfrDeltaClass}">${cfrDeltaArrow} ${Math.abs(cfrDelta)} pts</span>` : ''}<span>cible &lt; 15 %</span></div>
          </div>
        `;
      }

      // === Correlation Pearson (secret) ===
      if (card.showCorrelation) {
        const formatCorr = (r) => r !== null ? r.toFixed(2) : 'N/A';
        const corrColor = card.current !== null
          ? (Math.abs(card.current) >= 0.7 ? 'var(--ok)' : Math.abs(card.current) >= 0.4 ? 'var(--warn)' : 'var(--bad)')
          : 'var(--ink-3)';
        return `
          <div class="kpi">
            <div class="kpi__label">Corrélation SP/CT</div>
            ${card.current !== null ? `
              <div class="kpi__num" style="color:${corrColor}"><span class="tnum">${formatCorr(card.current)}</span></div>
              <div class="kpi__hint">${card.currentInterpretation?.label || ''} · ${card.currentSampleSize} tickets</div>
            ` : `
              <div class="kpi__hint">Données insuffisantes</div>
            `}
          </div>
        `;
      }

      // === Fallback ===
      return `
        <div class="kpi">
          <div class="kpi__label">${card.label}</div>
          <div class="kpi__num"><span class="tnum">${formatNumber(card.value, card.decimals)}</span></div>
          <div class="kpi__hint">${card.unit || ''}</div>
        </div>
      `;
    }).join('');
  }

  /**
   * Rendu du panneau listant les tickets ajoutés en cours de sprint
   * (affiché au survol ou au focus de la carte KPI)
   * @param {Array} additions - Tickets mid-sprint { key, summary, type, storyPoints, isFinished }
   * @returns {string}
   * @private
   */
  _renderMidSprintPopover(additions) {
    const sorted = [...additions].sort((a, b) =>
      String(a.key).localeCompare(String(b.key), undefined, { numeric: true })
    );

    return `
      <div class="kpi-popover" id="midsprint-popover" role="tooltip">
        <div class="kpi-popover__head">
          <span class="kpi-popover__title">Tickets ajoutés en cours de sprint</span>
          <span class="kpi-popover__count">${sorted.length}</span>
        </div>
        <ul class="kpi-popover__list">
          ${sorted.map(t => `
            <li class="kpi-popover__item">
              <span class="kpi-popover__key">${sanitize(t.key)}</span>
              <span class="kpi-popover__meta">${sanitize(t.type || '')}${t.storyPoints ? ` · ${t.storyPoints} SP` : ''}${t.isFinished ? ' · <span class="kpi-popover__done">terminé</span>' : ''}</span>
              ${t.summary ? `<span class="kpi-popover__summary">${sanitize(t.summary)}</span>` : ''}
            </li>
          `).join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Place le panneau mid-sprint là où il y a de la place (dessous/dessus, gauche/droite)
   * @param {Event} e
   * @private
   */
  _handlePopoverPlacement(e) {
    const anchor = e.currentTarget;
    const popover = anchor.querySelector('.kpi-popover');
    if (!popover) return;

    popover.classList.remove('kpi-popover--up', 'kpi-popover--end');
    popover.style.maxHeight = '';
    const rect = anchor.getBoundingClientRect();
    const { offsetHeight: height, offsetWidth: width } = popover;

    // Place disponible sous la carte et au-dessus (sous l'en-tête collant)
    const margin = 16;
    const inset = 12; // décalage du panneau par rapport au bord de la carte (cf. .kpi-popover)
    const headerBottom = document.querySelector('.masthead')?.getBoundingClientRect().bottom || 0;
    const spaceBelow = window.innerHeight - rect.bottom + inset - margin;
    const spaceAbove = rect.top + inset - Math.max(headerBottom, 0) - margin;

    const openUp = height > spaceBelow && spaceAbove > spaceBelow;
    popover.classList.toggle('kpi-popover--up', openUp);
    const room = openUp ? spaceAbove : spaceBelow;
    if (height > room) {
      popover.style.maxHeight = `${Math.max(room, 160)}px`;
    }

    if (rect.left + inset + width > window.innerWidth) {
      popover.classList.add('kpi-popover--end');
    }
  }

  /**
   * Ferme le panneau mid-sprint avec Échap (retire le focus de la carte)
   * @param {KeyboardEvent} e
   * @private
   */
  _handlePopoverKeydown(e) {
    if (e.key === 'Escape') e.currentTarget.blur();
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
      initialCommitted,
      initialDelivered,
      initialCompletion,
      midSprintSP,
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

    const pillClass = (cls) => cls === 'success' ? 'ok' : cls === 'danger' ? 'bad' : 'warn';
    const initialClass = getCompletionClass(initialCompletion);
    const totalClass = getCompletionClass(currentCompletion);
    const hasMidSprint = midSprintSP > 0;

    return `
      <div class="sp" style="border:1px solid var(--line)">
        <div>
          <div class="eyebrow">Story points livrés</div>
          <div class="sp__hero">
            <span class="v tnum">${currentDelivered}</span>
            <span class="frac">/ ${currentCommitted} engagés</span>
          </div>
        </div>
        <div class="sp__bar"><div class="sp__bar-fill" style="width:${currentCompletion}%"></div></div>
        <div class="sp__completion-cards">
          <div class="kpi kpi--completion">
            <div class="kpi__label">Engagement initial</div>
            <div class="kpi__num"><span class="tnum">${initialCompletion}</span><em>%</em></div>
            <div class="kpi__hint">${initialDelivered} / ${initialCommitted} sp</div>
            <div class="kpi__foot">
              <span class="pill pill--${pillClass(initialClass)}" style="font-size:10px;padding:2px 8px">${hasMidSprint ? 'Hors ' + midSprintSP + ' sp ajoutés' : 'Scope préservé'}</span>
            </div>
          </div>
          <div class="kpi kpi--completion">
            <div class="kpi__label">Complétion totale</div>
            <div class="kpi__num"><span class="tnum">${currentCompletion}</span><em>%</em></div>
            <div class="kpi__hint">${currentDelivered} / ${currentCommitted} sp</div>
            <div class="kpi__foot">
              <span class="pill pill--${pillClass(totalClass)}" style="font-size:10px;padding:2px 8px">${currentSprintLabel || 'Sprint actuel'}</span>
            </div>
          </div>
        </div>
        <div class="sp__rows">
          ${previousSprintsCount > 0 ? `
            <div class="sp__row">
              <span>Moyenne ${previousSprintsCount} sprints précédents</span>
              <b>${formatNumber(avgDelivered, 1)} sp</b>
              <span class="dek">${avgCompletion}%</span>
            </div>
            <div class="sp__row">
              <span>Vélocité recommandée</span>
              <b class="velocity-value" data-component="velocity-card" style="filter:blur(6px);cursor:pointer" data-action="reveal-velocity">${recommendedVelocity} sp</b>
              <span class="kicker">— suggéré</span>
            </div>
          ` : ''}
        </div>
      </div>
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
      <div class="sp" style="border:1px solid var(--line)">
        <div>
          <div class="eyebrow">Story points livrés</div>
          <div class="sp__hero">
            <span class="v tnum">${currentDelivered}</span>
            <span class="frac">/ ${currentCommitted} engagés</span>
          </div>
        </div>
        <div class="sp__bar"><div class="sp__bar-fill" style="width:${currentCompletion}%"></div></div>
        <div class="sp__rows">
          <div class="sp__row">
            <span>Complétion sprint</span>
            <b>${currentCompletion}%</b>
            <span class="dek">Sprint actuel</span>
          </div>
          ${previousSprints.length > 0 ? `
            <div class="sp__row">
              <span>Moyenne ${previousSprints.length} sprints précédents</span>
              <b>${formatNumber(avgDelivered, 1)} sp</b>
              <span class="dek">${avgCompletion}%</span>
            </div>
            <div class="sp__row">
              <span>Vélocité recommandée</span>
              <b class="velocity-value" data-component="velocity-card" style="filter:blur(6px);cursor:pointer" data-action="reveal-velocity">${recommendedVelocity} sp</b>
              <span class="kicker">— suggéré</span>
            </div>
          ` : ''}
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
      'click [data-tooltip]': this._handleToggleTooltip,
      'mouseenter .kpi--has-popover': this._handlePopoverPlacement,
      'focusin .kpi--has-popover': this._handlePopoverPlacement,
      'keydown .kpi--has-popover': this._handlePopoverKeydown
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
    // New editorial style: just remove blur
    const el = e.target.closest('[data-action="reveal-velocity"]') || e.target;
    if (el) {
      el.style.filter = 'none';
      el.style.cursor = 'default';
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

      // Réinitialiser les exclusions et recréer le graphique
      this.state.excludedSprintsThroughput = [];
      if (this.state.sprintMetrics) {
        this._initializeCharts(this.state.sprintMetrics);
      }
    }
  }

  /**
   * Toggle l'exclusion d'un sprint du calcul des benchmarks
   * @param {string} chartType - 'throughput' ou 'cycleTime'
   * @param {number} index - Index de la barre cliquée
   * @private
   */
  _handleToggleSprintExclusion(chartType, index) {
    const stateKey = chartType === 'throughput' ? 'excludedSprintsThroughput' : 'excludedSprintsCycleTime';
    const excluded = [...this.state[stateKey]];

    const pos = excluded.indexOf(index);
    if (pos > -1) {
      excluded.splice(pos, 1);  // Réinclure
    } else {
      excluded.push(index);     // Exclure
    }

    this.state[stateKey] = excluded;
    this._updateChartWithExclusions(chartType);
  }

  /**
   * Met à jour le graphique avec les exclusions (recalcul moyenne/médiane)
   * @param {string} chartType - 'throughput' ou 'cycleTime'
   * @private
   */
  _updateChartWithExclusions(chartType) {
    const metrics = this.state.sprintMetrics;
    const chart = chartType === 'throughput'
      ? this.components.throughputChart
      : this.components.cycleTimeChart;

    if (!chart || !metrics) return;

    const excluded = chartType === 'throughput'
      ? this.state.excludedSprintsThroughput
      : this.state.excludedSprintsCycleTime;

    // Pour Throughput, utiliser les bonnes données selon la métrique sélectionnée
    let values;
    if (chartType === 'throughput') {
      const isStoryPoints = this.state.throughputMetric === 'storyPoints';
      values = isStoryPoints
        ? (metrics.throughput.storyPointsValues || [])
        : metrics.throughput.values;
    } else {
      values = metrics.cycleTime.values;
    }

    // Filtrer les valeurs non exclues
    const includedValues = values.filter((_, i) => !excluded.includes(i));

    if (includedValues.length === 0) return;

    // Recalculer moyenne et médiane
    const avg = includedValues.reduce((a, b) => a + b, 0) / includedValues.length;
    const sorted = [...includedValues].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const median = sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];

    // Arrondir
    const avgRounded = Math.round(avg * 10) / 10;
    const medianRounded = Math.round(median * 10) / 10;

    // Mettre à jour les annotations
    const suffix = chartType === 'cycleTime' ? 'j' : '';
    const avgLabel = chartType === 'cycleTime' ? 'Moy. globale' : 'Moy';
    const medLabel = chartType === 'cycleTime' ? 'Méd. globale' : 'Méd';

    chart.options.plugins.annotation.annotations.avgLine.yMin = avgRounded;
    chart.options.plugins.annotation.annotations.avgLine.yMax = avgRounded;
    chart.options.plugins.annotation.annotations.avgLine.label.content = `${avgLabel}: ${avgRounded}${suffix}`;

    chart.options.plugins.annotation.annotations.medianLine.yMin = medianRounded;
    chart.options.plugins.annotation.annotations.medianLine.yMax = medianRounded;
    chart.options.plugins.annotation.annotations.medianLine.label.content = `${medLabel}: ${medianRounded}${suffix}`;

    // Mise à jour visuelle des barres exclues (grisées)
    const defaultColor = chartType === 'throughput'
      ? 'rgba(84, 95, 115, 0.2)'
      : 'rgba(87, 95, 117, 0.2)';
    const excludedColor = 'rgba(200, 200, 200, 0.4)';

    chart.data.datasets[0].backgroundColor = values.map((_, i) =>
      excluded.includes(i) ? excludedColor : defaultColor
    );

    chart.update();
  }
}
