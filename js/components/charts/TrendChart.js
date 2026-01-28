/**
 * ==========================================================================
 * TRENDCHART.JS - Graphique de tendance (ligne)
 * ==========================================================================
 *
 * Graphique en lignes pour afficher :
 * - Évolution du Cycle Time
 * - Tendances de vélocité
 * - Historique des métriques
 *
 * FEATURES :
 * - Lignes multiples
 * - Zone de remplissage
 * - Points de données
 * - Lignes de référence
 * - Tooltip avec position verticale
 *
 * ==========================================================================
 */

import BaseChart from './BaseChart.js';
import config from '../../core/config.js';

// =========================================================================
// CLASSE TRENDCHART
// =========================================================================

export default class TrendChart extends BaseChart {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {boolean} props.fill - Remplir sous la ligne
   * @param {boolean} props.smooth - Courbe lissée
   * @param {boolean} props.showPoints - Afficher les points
   * @param {Array} props.thresholds - Lignes de seuil [{value, label, color}]
   */
  constructor(container, props = {}) {
    super(container, {
      type: 'line',
      fill: false,
      smooth: true,
      showPoints: true,
      pointRadius: 4,
      pointHoverRadius: 6,
      lineWidth: 2,
      thresholds: [],
      ...props
    });
  }

  /**
   * Options par défaut pour le trend chart
   */
  _getDefaultOptions() {
    const baseOptions = super._getDefaultOptions();
    const { thresholds } = this.props;

    const options = {
      ...baseOptions,
      interaction: {
        mode: 'index',
        intersect: false
      },
      plugins: {
        ...baseOptions.plugins,
        tooltip: {
          ...baseOptions.plugins.tooltip,
          mode: 'index',
          intersect: false,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y;
              const unit = context.dataset.unit || '';
              return `${label}: ${value}${unit ? ' ' + unit : ''}`;
            }
          }
        }
      }
    };

    // Ajouter les lignes de seuil
    if (thresholds && thresholds.length > 0) {
      options.plugins.annotation = {
        annotations: this._createThresholdAnnotations(thresholds)
      };
    }

    return options;
  }

  /**
   * Crée les annotations de seuil
   * @param {Array} thresholds
   * @returns {Object}
   * @private
   */
  _createThresholdAnnotations(thresholds) {
    const annotations = {};

    thresholds.forEach((threshold, index) => {
      annotations[`threshold${index}`] = {
        type: 'line',
        yMin: threshold.value,
        yMax: threshold.value,
        borderColor: threshold.color || config.colors.warning[500],
        borderWidth: 1,
        borderDash: [5, 5],
        label: {
          display: !!threshold.label,
          content: threshold.label || '',
          position: 'start',
          backgroundColor: threshold.color || config.colors.warning[500],
          color: '#fff',
          font: {
            size: 10
          }
        }
      };
    });

    return annotations;
  }

  /**
   * Traite les données pour le trend chart
   * @param {Object} data
   * @returns {Object}
   */
  _processData(data) {
    const { fill, smooth, showPoints, pointRadius, pointHoverRadius, lineWidth } = this.props;

    const datasets = data.datasets.map((dataset, index) => {
      const color = dataset.borderColor ||
                    dataset.backgroundColor ||
                    config.chartColors[index % config.chartColors.length];

      return {
        ...dataset,
        borderColor: color,
        backgroundColor: fill ? this._hexToRgba(color, 0.1) : 'transparent',
        fill: dataset.fill ?? fill,
        tension: smooth ? 0.4 : 0,
        pointRadius: showPoints ? (dataset.pointRadius ?? pointRadius) : 0,
        pointHoverRadius: dataset.pointHoverRadius ?? pointHoverRadius,
        pointBackgroundColor: dataset.pointBackgroundColor || color,
        pointBorderColor: dataset.pointBorderColor || '#fff',
        pointBorderWidth: 2,
        borderWidth: dataset.borderWidth ?? lineWidth
      };
    });

    return {
      labels: data.labels,
      datasets
    };
  }

  /**
   * Convertit une couleur hex en rgba
   * @param {string} hex
   * @param {number} alpha
   * @returns {string}
   * @private
   */
  _hexToRgba(hex, alpha = 1) {
    // Si c'est déjà rgba, retourner tel quel
    if (hex.startsWith('rgba')) return hex;
    if (hex.startsWith('rgb')) {
      return hex.replace('rgb', 'rgba').replace(')', `, ${alpha})`);
    }

    // Convertir hex en rgb
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!result) return hex;

    const r = parseInt(result[1], 16);
    const g = parseInt(result[2], 16);
    const b = parseInt(result[3], 16);

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  /**
   * Met à jour avec des données de tendance simple
   * @param {Object} trendData
   * @param {Array} trendData.labels - Labels (ex: semaines)
   * @param {Array} trendData.values - Valeurs
   * @param {string} trendData.label - Label de la série
   * @param {string} trendData.color - Couleur
   */
  updateWithTrendData({ labels, values, label = 'Valeur', color = null }) {
    this.updateData({
      labels,
      datasets: [{
        label,
        data: values,
        borderColor: color || config.colors.primary[500]
      }]
    });
  }

  /**
   * Met à jour avec des données multi-séries
   * @param {Object} multiData
   * @param {Array} multiData.labels - Labels
   * @param {Array} multiData.series - Séries [{label, values, color}]
   */
  updateWithMultiSeries({ labels, series }) {
    const datasets = series.map((s, index) => ({
      label: s.label,
      data: s.values,
      borderColor: s.color || config.chartColors[index % config.chartColors.length]
    }));

    this.updateData({ labels, datasets });
  }

  /**
   * Ajoute un point de données
   * @param {string} label - Label du nouveau point
   * @param {number|Array} values - Valeur(s) pour chaque dataset
   */
  addDataPoint(label, values) {
    if (!this.chart) return;

    // Ajouter le label
    this.chart.data.labels.push(label);

    // Ajouter les valeurs
    const valuesArray = Array.isArray(values) ? values : [values];
    this.chart.data.datasets.forEach((dataset, index) => {
      dataset.data.push(valuesArray[index] ?? null);
    });

    this.chart.update('none');
  }

  /**
   * Met à jour les seuils
   * @param {Array} thresholds
   */
  updateThresholds(thresholds) {
    if (!this.chart) return;

    this.chart.options.plugins.annotation = {
      annotations: this._createThresholdAnnotations(thresholds)
    };

    this.chart.update();
  }

  /**
   * Affiche/masque le remplissage
   * @param {boolean} show
   */
  toggleFill(show) {
    if (!this.chart) return;

    this.chart.data.datasets.forEach(dataset => {
      dataset.fill = show;
      if (show) {
        dataset.backgroundColor = this._hexToRgba(dataset.borderColor, 0.1);
      }
    });

    this.chart.update();
  }
}
