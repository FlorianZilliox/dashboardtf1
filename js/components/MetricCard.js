/**
 * ==========================================================================
 * METRICCARD.JS - Composant carte métrique
 * ==========================================================================
 *
 * Affiche une métrique avec :
 * - Valeur principale
 * - Label
 * - Tendance (optionnel)
 * - Icône (optionnel)
 * - Statut (good, warning, danger)
 *
 * USAGE :
 *   const card = new MetricCard('#container', {
 *     label: 'Cycle Time',
 *     value: 3.2,
 *     unit: 'jours',
 *     trend: -5,
 *     trendIsGood: 'down',
 *     status: 'good'
 *   });
 *
 * ==========================================================================
 */

import Component from './Component.js';
import { formatNumber, formatPercent, formatTrend } from '../utils/formatters.js';

// =========================================================================
// CLASSE METRICCARD
// =========================================================================

export default class MetricCard extends Component {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {string} props.label - Libellé de la métrique
   * @param {number} props.value - Valeur
   * @param {string} props.unit - Unité (optionnel)
   * @param {number} props.trend - Tendance en % (optionnel)
   * @param {string} props.trendIsGood - 'up' | 'down' | 'stable' (quand la tendance est positive)
   * @param {string} props.status - 'good' | 'warning' | 'danger' | 'neutral'
   * @param {string} props.icon - Icône (optionnel)
   * @param {string} props.subtitle - Sous-titre (optionnel)
   * @param {number} props.decimals - Nombre de décimales
   * @param {string} props.size - 'small' | 'medium' | 'large'
   */
  constructor(container, props = {}) {
    super(container, {
      label: '',
      value: 0,
      unit: '',
      trend: null,
      trendIsGood: 'up',
      status: 'neutral',
      icon: null,
      subtitle: null,
      decimals: 1,
      size: 'medium',
      ...props
    });
  }

  /**
   * Calcule le statut visuel de la tendance
   * @returns {Object} { className, isPositive }
   */
  _getTrendStatus() {
    const { trend, trendIsGood } = this.props;

    if (trend === null || trend === undefined) {
      return { className: '', isPositive: null };
    }

    const isUp = trend > 0;
    const isDown = trend < 0;

    // Déterminer si la direction est positive pour la métrique
    let isPositive;
    if (trendIsGood === 'up') {
      isPositive = isUp;
    } else if (trendIsGood === 'down') {
      isPositive = isDown;
    } else {
      isPositive = Math.abs(trend) < 5; // Stable si variation < 5%
    }

    const direction = isUp ? 'up' : isDown ? 'down' : 'stable';

    return {
      className: `metric-card__trend--${direction}`,
      isPositive,
      direction
    };
  }

  /**
   * Formate la valeur selon le type
   * @returns {string}
   */
  _formatValue() {
    const { value, unit, decimals } = this.props;

    if (unit === '%') {
      return formatPercent(value, false, decimals);
    }

    return formatNumber(value, decimals);
  }

  /**
   * Rendu du composant
   */
  render() {
    const { label, unit, trend, status, icon, subtitle, size } = this.props;
    const formattedValue = this._formatValue();
    const trendStatus = this._getTrendStatus();
    const trendInfo = formatTrend(trend);

    const statusClass = status !== 'neutral' ? `metric-card--${status}` : '';
    const sizeClass = size !== 'medium' ? `metric-card--${size}` : '';

    return `
      <div class="metric-card ${statusClass} ${sizeClass}">
        <div class="metric-card__header">
          ${icon ? `<span class="metric-card__icon">${icon}</span>` : ''}
          <span class="metric-card__label">${this.escapeHtml(label)}</span>
        </div>

        <div class="metric-card__body">
          <span class="metric-card__value">${formattedValue}</span>
          ${unit && unit !== '%' ? `<span class="metric-card__unit">${this.escapeHtml(unit)}</span>` : ''}
        </div>

        ${trend !== null ? `
          <div class="metric-card__footer">
            <span class="metric-card__trend ${trendStatus.className}"
                  data-positive="${trendStatus.isPositive}">
              ${trendInfo.text}
            </span>
            ${subtitle ? `<span class="metric-card__subtitle">${this.escapeHtml(subtitle)}</span>` : ''}
          </div>
        ` : ''}

        ${subtitle && trend === null ? `
          <div class="metric-card__footer">
            <span class="metric-card__subtitle">${this.escapeHtml(subtitle)}</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Met à jour les propriétés et re-rend
   * @param {Object} newProps
   */
  updateProps(newProps) {
    this.props = Object.freeze({ ...this.props, ...newProps });
    this.forceUpdate();
  }
}
