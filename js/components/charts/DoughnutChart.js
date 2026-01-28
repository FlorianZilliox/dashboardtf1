/**
 * ==========================================================================
 * DOUGHNUTCHART.JS - Graphique en anneau
 * ==========================================================================
 *
 * Graphique en anneau pour afficher :
 * - Répartition du Time in Status
 * - Distribution des bugs par catégorie
 * - Ratios et pourcentages
 *
 * FEATURES :
 * - Texte central personnalisable
 * - Légende externe
 * - Animation d'apparition
 * - Hover effects
 *
 * ==========================================================================
 */

import BaseChart from './BaseChart.js';
import config from '../../core/config.js';

// =========================================================================
// CLASSE DOUGHNUTCHART
// =========================================================================

export default class DoughnutChart extends BaseChart {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {string} props.centerText - Texte au centre
   * @param {string} props.centerSubtext - Sous-texte au centre
   * @param {number} props.cutout - Pourcentage de découpe (défaut: 70%)
   * @param {boolean} props.showLegend - Afficher la légende
   * @param {string} props.legendPosition - Position de la légende
   */
  constructor(container, props = {}) {
    super(container, {
      type: 'doughnut',
      centerText: null,
      centerSubtext: null,
      cutout: '70%',
      showLegend: true,
      legendPosition: 'right',
      ...props
    });
  }

  /**
   * Options par défaut pour le doughnut chart
   */
  _getDefaultOptions() {
    const { cutout, showLegend, legendPosition, centerText, centerSubtext } = this.props;

    const options = {
      responsive: true,
      maintainAspectRatio: false,
      cutout,
      plugins: {
        legend: {
          display: showLegend,
          position: legendPosition,
          labels: {
            padding: 16,
            usePointStyle: true,
            pointStyle: 'circle',
            font: {
              family: config.chartDefaults.fontFamily,
              size: 12
            },
            color: config.colors.gray[700]
          }
        },
        tooltip: {
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          titleColor: '#fff',
          bodyColor: '#fff',
          padding: 12,
          cornerRadius: 8,
          callbacks: {
            label: (context) => {
              const label = context.label || '';
              const value = context.parsed;
              const total = context.dataset.data.reduce((a, b) => a + b, 0);
              const percentage = total > 0 ? Math.round((value / total) * 100) : 0;
              return `${label}: ${value} (${percentage}%)`;
            }
          }
        }
      }
    };

    return options;
  }

  /**
   * Traite les données pour le doughnut chart
   * @param {Object} data
   * @returns {Object}
   */
  _processData(data) {
    // Si pas de couleurs définies, utiliser les couleurs par défaut
    const backgroundColors = data.datasets[0]?.backgroundColor ||
      data.labels.map((_, i) => config.chartColors[i % config.chartColors.length]);

    const hoverColors = data.datasets[0]?.hoverBackgroundColor ||
      backgroundColors.map(color => this._adjustBrightness(color, -20));

    return {
      labels: data.labels,
      datasets: [{
        ...data.datasets[0],
        data: data.datasets[0]?.data || [],
        backgroundColor: backgroundColors,
        hoverBackgroundColor: hoverColors,
        borderWidth: data.datasets[0]?.borderWidth ?? 2,
        borderColor: data.datasets[0]?.borderColor ?? '#fff',
        hoverBorderColor: data.datasets[0]?.hoverBorderColor ?? '#fff'
      }]
    };
  }

  /**
   * Ajuste la luminosité d'une couleur hex
   * @param {string} hex
   * @param {number} amount
   * @returns {string}
   * @private
   */
  _adjustBrightness(hex, amount) {
    if (!hex.startsWith('#')) return hex;

    const num = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, (num >> 16) + amount));
    const g = Math.min(255, Math.max(0, ((num >> 8) & 0x00FF) + amount));
    const b = Math.min(255, Math.max(0, (num & 0x0000FF) + amount));

    return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
  }

  /**
   * Crée le graphique avec le texte central
   */
  _createChart() {
    super._createChart();

    // Ajouter le plugin pour le texte central
    if (this.chart && (this.props.centerText || this.props.centerSubtext)) {
      this._addCenterTextPlugin();
    }
  }

  /**
   * Ajoute le plugin pour afficher du texte au centre
   * @private
   */
  _addCenterTextPlugin() {
    const { centerText, centerSubtext } = this.props;

    // Plugin personnalisé pour le texte central
    const centerTextPlugin = {
      id: 'centerText',
      afterDraw: (chart) => {
        const { ctx, chartArea: { width, height, top } } = chart;

        ctx.save();

        // Texte principal
        if (centerText) {
          ctx.font = `bold 24px ${config.chartDefaults.fontFamily}`;
          ctx.fillStyle = config.colors.gray[800];
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(centerText, width / 2, top + height / 2 - (centerSubtext ? 10 : 0));
        }

        // Sous-texte
        if (centerSubtext) {
          ctx.font = `12px ${config.chartDefaults.fontFamily}`;
          ctx.fillStyle = config.colors.gray[500];
          ctx.fillText(centerSubtext, width / 2, top + height / 2 + 15);
        }

        ctx.restore();
      }
    };

    // Ajouter le plugin
    if (!this.chart.config.plugins) {
      this.chart.config.plugins = [];
    }
    this.chart.config.plugins.push(centerTextPlugin);
    this.chart.update();
  }

  /**
   * Met à jour le texte central
   * @param {string} text
   * @param {string} subtext
   */
  updateCenterText(text, subtext = null) {
    this.props = { ...this.props, centerText: text, centerSubtext: subtext };

    if (this.chart) {
      this.chart.update();
    }
  }

  /**
   * Met à jour avec des données de distribution
   * @param {Object} distributionData
   * @param {Array} distributionData.labels - Labels
   * @param {Array} distributionData.values - Valeurs
   * @param {Array} distributionData.colors - Couleurs (optionnel)
   */
  updateWithDistributionData({ labels, values, colors = null }) {
    this.updateData({
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors
      }]
    });
  }

  /**
   * Met à jour avec des données de Time in Status
   * @param {Array} statusData - [{status, value, color}]
   */
  updateWithTimeInStatus(statusData) {
    const labels = statusData.map(s => s.status);
    const values = statusData.map(s => s.value);
    const colors = statusData.map(s => s.color || config.chartColors[statusData.indexOf(s)]);

    // Calculer le total pour le texte central
    const total = values.reduce((a, b) => a + b, 0);

    this.updateCenterText(`${total.toFixed(1)}j`, 'Cycle Time');

    this.updateData({
      labels,
      datasets: [{
        data: values,
        backgroundColor: colors
      }]
    });
  }

  /**
   * Anime vers de nouvelles données
   * @param {Object} newData
   */
  animateToData(newData) {
    if (!this.chart) return;

    this.chart.data = this._processData(newData);
    this.chart.update('default'); // Avec animation
  }

  /**
   * Met en surbrillance un segment
   * @param {number} index - Index du segment
   */
  highlightSegment(index) {
    if (!this.chart) return;

    const dataset = this.chart.data.datasets[0];
    const meta = this.chart.getDatasetMeta(0);

    if (meta.data[index]) {
      // Réinitialiser tous les segments
      meta.data.forEach((arc, i) => {
        arc.outerRadius = this.chart.outerRadius;
      });

      // Agrandir le segment ciblé
      meta.data[index].outerRadius = this.chart.outerRadius + 10;
      this.chart.update('none');
    }
  }

  /**
   * Réinitialise les surbrillances
   */
  resetHighlight() {
    if (!this.chart) return;

    const meta = this.chart.getDatasetMeta(0);
    meta.data.forEach(arc => {
      arc.outerRadius = this.chart.outerRadius;
    });
    this.chart.update('none');
  }
}
