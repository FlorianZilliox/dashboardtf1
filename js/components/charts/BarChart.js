/**
 * ==========================================================================
 * BARCHART.JS - Graphique en barres
 * ==========================================================================
 *
 * Graphique en barres pour afficher :
 * - Throughput par semaine
 * - Story Points committed/delivered
 * - Comparaisons de métriques
 *
 * FEATURES :
 * - Barres groupées ou empilées
 * - Ligne de moyenne/benchmark
 * - Couleurs conditionnelles
 * - Tooltips personnalisés
 *
 * ==========================================================================
 */

import BaseChart from './BaseChart.js';
import config from '../../core/config.js';

// =========================================================================
// CLASSE BARCHART
// =========================================================================

export default class BarChart extends BaseChart {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {boolean} props.stacked - Barres empilées
   * @param {number} props.benchmark - Ligne de référence
   * @param {string} props.benchmarkLabel - Label de la ligne
   * @param {boolean} props.horizontal - Barres horizontales
   */
  constructor(container, props = {}) {
    super(container, {
      type: props.horizontal ? 'bar' : 'bar',
      stacked: false,
      benchmark: null,
      benchmarkLabel: 'Benchmark',
      horizontal: false,
      barThickness: 'flex',
      borderRadius: 4,
      ...props
    });
  }

  /**
   * Options par défaut pour le bar chart
   */
  _getDefaultOptions() {
    const baseOptions = super._getDefaultOptions();
    const { stacked, benchmark, benchmarkLabel, horizontal } = this.props;

    const options = {
      ...baseOptions,
      indexAxis: horizontal ? 'y' : 'x',
      scales: {
        x: {
          ...baseOptions.scales.x,
          stacked
        },
        y: {
          ...baseOptions.scales.y,
          stacked
        }
      },
      plugins: {
        ...baseOptions.plugins,
        tooltip: {
          ...baseOptions.plugins.tooltip,
          callbacks: {
            label: (context) => {
              const label = context.dataset.label || '';
              const value = context.parsed.y ?? context.parsed.x;
              return `${label}: ${value}`;
            }
          }
        }
      }
    };

    // Ajouter l'annotation de benchmark si définie
    if (benchmark !== null && benchmark !== undefined) {
      options.plugins.annotation = {
        annotations: {
          benchmarkLine: {
            type: 'line',
            yMin: benchmark,
            yMax: benchmark,
            borderColor: config.colors.gray[400],
            borderWidth: 2,
            borderDash: [5, 5],
            label: {
              display: true,
              content: benchmarkLabel,
              position: 'end',
              backgroundColor: config.colors.gray[600],
              color: '#fff',
              font: {
                size: 11
              }
            }
          }
        }
      };
    }

    return options;
  }

  /**
   * Traite les données pour le bar chart
   * @param {Object} data
   * @returns {Object}
   */
  _processData(data) {
    const { borderRadius, barThickness } = this.props;

    // Appliquer les styles par défaut aux datasets
    const datasets = data.datasets.map((dataset, index) => {
      const color = dataset.backgroundColor || config.chartColors[index % config.chartColors.length];

      return {
        ...dataset,
        backgroundColor: dataset.backgroundColor || color,
        borderColor: dataset.borderColor || 'transparent',
        borderWidth: dataset.borderWidth || 0,
        borderRadius: dataset.borderRadius ?? borderRadius,
        barThickness: dataset.barThickness || barThickness
      };
    });

    return {
      labels: data.labels,
      datasets
    };
  }

  /**
   * Met à jour avec des données de sprint (format simplifié)
   * @param {Object} sprintData
   * @param {Array} sprintData.weeks - Semaines
   * @param {Array} sprintData.values - Valeurs
   * @param {string} sprintData.label - Label
   */
  updateWithSprintData({ weeks, values, label = 'Valeur' }) {
    this.updateData({
      labels: weeks,
      datasets: [{
        label,
        data: values
      }]
    });
  }

  /**
   * Met à jour avec des données de comparaison (committed vs delivered)
   * @param {Object} comparisonData
   */
  updateWithComparisonData({ labels, committed, delivered }) {
    this.updateData({
      labels,
      datasets: [
        {
          label: 'Engagé',
          data: committed,
          backgroundColor: config.colors.gray[300]
        },
        {
          label: 'Livré',
          data: delivered,
          backgroundColor: config.colors.primary[500]
        }
      ]
    });
  }

  /**
   * Applique des couleurs conditionnelles aux barres
   * @param {Function} colorFn - Fonction (value, index) => color
   */
  applyConditionalColors(colorFn) {
    if (!this.chart || !this.chart.data.datasets[0]) return;

    const dataset = this.chart.data.datasets[0];
    const colors = dataset.data.map((value, index) => colorFn(value, index));

    dataset.backgroundColor = colors;
    this.chart.update('none');
  }

  /**
   * Met à jour le benchmark
   * @param {number} value
   * @param {string} label
   */
  updateBenchmark(value, label = 'Benchmark') {
    if (!this.chart) return;

    if (!this.chart.options.plugins.annotation) {
      this.chart.options.plugins.annotation = { annotations: {} };
    }

    this.chart.options.plugins.annotation.annotations.benchmarkLine = {
      type: 'line',
      yMin: value,
      yMax: value,
      borderColor: config.colors.gray[400],
      borderWidth: 2,
      borderDash: [5, 5],
      label: {
        display: true,
        content: label,
        position: 'end'
      }
    };

    this.chart.update();
  }
}
