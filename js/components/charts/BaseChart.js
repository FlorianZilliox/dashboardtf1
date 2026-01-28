/**
 * ==========================================================================
 * BASECHART.JS - Classe de base pour les graphiques
 * ==========================================================================
 *
 * Fournit une base commune pour tous les graphiques Chart.js :
 * - Initialisation de Chart.js
 * - Configuration par défaut
 * - Méthodes de mise à jour
 * - Destruction propre
 *
 * ==========================================================================
 */

import Component from '../Component.js';
import config from '../../core/config.js';

// =========================================================================
// CLASSE BASECHART
// =========================================================================

export default class BaseChart extends Component {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {string} props.type - Type de graphique ('bar', 'line', 'doughnut', etc.)
   * @param {Object} props.data - Données du graphique
   * @param {Object} props.options - Options Chart.js
   */
  constructor(container, props = {}) {
    super(container, {
      type: 'bar',
      data: { labels: [], datasets: [] },
      options: {},
      height: 300,
      responsive: true,
      maintainAspectRatio: false,
      ...props
    });

    this.chart = null;
  }

  /**
   * Initialisation
   */
  init() {
    this.state = {
      isReady: false,
      error: null
    };
  }

  /**
   * Après montage : créer le graphique
   */
  afterMount() {
    this._createChart();
  }

  /**
   * Avant démontage : détruire le graphique
   */
  beforeUnmount() {
    this._destroyChart();
  }

  /**
   * Récupère les options par défaut selon le type
   * @returns {Object}
   * @protected
   */
  _getDefaultOptions() {
    const { responsive, maintainAspectRatio } = this.props;

    return {
      responsive,
      maintainAspectRatio,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
          displayColors: false
        }
      },
      scales: this._getDefaultScales()
    };
  }

  /**
   * Récupère les échelles par défaut
   * @returns {Object}
   * @protected
   */
  _getDefaultScales() {
    const { type } = this.props;

    if (type === 'doughnut' || type === 'pie') {
      return {};
    }

    return {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: config.colors.gray[500],
          font: {
            family: config.chartDefaults.fontFamily,
            size: 11
          }
        }
      },
      y: {
        beginAtZero: true,
        grid: {
          color: config.colors.gray[200]
        },
        ticks: {
          color: config.colors.gray[500],
          font: {
            family: config.chartDefaults.fontFamily,
            size: 11
          }
        }
      }
    };
  }

  /**
   * Fusionne les options par défaut avec les options personnalisées
   * @returns {Object}
   * @protected
   */
  _mergeOptions() {
    const defaultOptions = this._getDefaultOptions();
    const customOptions = this.props.options;

    return this._deepMerge(defaultOptions, customOptions);
  }

  /**
   * Fusion profonde de deux objets
   * @param {Object} target
   * @param {Object} source
   * @returns {Object}
   * @private
   */
  _deepMerge(target, source) {
    const output = { ...target };

    Object.keys(source).forEach(key => {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (target[key] && typeof target[key] === 'object') {
          output[key] = this._deepMerge(target[key], source[key]);
        } else {
          output[key] = { ...source[key] };
        }
      } else {
        output[key] = source[key];
      }
    });

    return output;
  }

  /**
   * Crée le graphique Chart.js
   * @protected
   */
  _createChart() {
    console.log('[BaseChart] _createChart appelé');
    console.log('[BaseChart] Container:', this.container);

    const canvas = this.$('canvas');
    console.log('[BaseChart] Canvas trouvé:', canvas);

    if (!canvas) {
      console.error('[BaseChart] Canvas non trouvé');
      this.setState({ error: 'Canvas non trouvé' });
      return;
    }

    if (!window.Chart) {
      console.error('[BaseChart] Chart.js non chargé');
      this.setState({ error: 'Chart.js non chargé' });
      return;
    }

    try {
      const ctx = canvas.getContext('2d');
      const { type, data } = this.props;
      const options = this._mergeOptions();

      console.log('[BaseChart] Création Chart.js avec:', { type, data: this._processData(data) });

      this.chart = new window.Chart(ctx, {
        type,
        data: this._processData(data),
        options
      });

      console.log('[BaseChart] Chart créé:', this.chart);
      this.setState({ isReady: true, error: null });

    } catch (error) {
      console.error('[BaseChart] Erreur création:', error);
      this.setState({ error: error.message });
    }
  }

  /**
   * Traite les données avant de les passer à Chart.js
   * @param {Object} data
   * @returns {Object}
   * @protected
   */
  _processData(data) {
    // À surcharger dans les sous-classes si nécessaire
    return data;
  }

  /**
   * Détruit le graphique
   * @protected
   */
  _destroyChart() {
    if (this.chart) {
      this.chart.destroy();
      this.chart = null;
    }
  }

  /**
   * Met à jour les données du graphique
   * @param {Object} newData
   */
  updateData(newData) {
    if (!this.chart) return;

    this.chart.data = this._processData(newData);
    this.chart.update('none'); // Pas d'animation pour la mise à jour
  }

  /**
   * Met à jour les options du graphique
   * @param {Object} newOptions
   */
  updateOptions(newOptions) {
    if (!this.chart) return;

    this.chart.options = this._deepMerge(this.chart.options, newOptions);
    this.chart.update();
  }

  /**
   * Redimensionne le graphique
   */
  resize() {
    if (this.chart) {
      this.chart.resize();
    }
  }

  /**
   * Rendu du composant
   */
  render() {
    const { height } = this.props;
    const { error } = this.state;

    if (error) {
      return `
        <div class="chart-container chart-container--error">
          <p class="chart-error">${this.escapeHtml(error)}</p>
        </div>
      `;
    }

    return `
      <div class="chart-container" style="height: ${height}px;">
        <canvas data-ref="canvas"></canvas>
      </div>
    `;
  }

  /**
   * Exporte le graphique en image
   * @param {string} filename
   * @returns {string} Data URL
   */
  toImage(filename = 'chart') {
    if (!this.chart) return null;

    const dataUrl = this.chart.toBase64Image();

    if (filename) {
      const link = document.createElement('a');
      link.download = `${filename}.png`;
      link.href = dataUrl;
      link.click();
    }

    return dataUrl;
  }
}
