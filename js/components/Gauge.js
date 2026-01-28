/**
 * ==========================================================================
 * GAUGE.JS - Composant jauge
 * ==========================================================================
 *
 * Affiche une jauge de progression :
 * - Jauge linéaire (barre)
 * - Jauge circulaire (ring)
 * - Avec seuils colorés
 *
 * USAGE :
 *   const gauge = new Gauge('#container', {
 *     value: 75,
 *     max: 100,
 *     type: 'linear',
 *     thresholds: { warning: 50, danger: 25 }
 *   });
 *
 * ==========================================================================
 */

import Component from './Component.js';
import config from '../core/config.js';
import { formatNumber, formatPercent } from '../utils/formatters.js';

// =========================================================================
// CLASSE GAUGE
// =========================================================================

export default class Gauge extends Component {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {number} props.value - Valeur actuelle
   * @param {number} props.max - Valeur maximale
   * @param {number} props.min - Valeur minimale (défaut: 0)
   * @param {string} props.type - 'linear' | 'ring'
   * @param {string} props.label - Label
   * @param {string} props.unit - Unité
   * @param {Object} props.thresholds - Seuils {good, warning, danger}
   * @param {boolean} props.showValue - Afficher la valeur
   * @param {string} props.size - 'small' | 'medium' | 'large'
   */
  constructor(container, props = {}) {
    super(container, {
      value: 0,
      max: 100,
      min: 0,
      type: 'linear',
      label: '',
      unit: '',
      thresholds: { good: 80, warning: 50, danger: 25 },
      showValue: true,
      showPercent: false,
      size: 'medium',
      animated: true,
      ...props
    });
  }

  /**
   * Calcule le pourcentage
   * @returns {number}
   */
  _calculatePercent() {
    const { value, min, max } = this.props;
    const range = max - min;
    if (range === 0) return 0;
    return Math.min(100, Math.max(0, ((value - min) / range) * 100));
  }

  /**
   * Détermine le statut basé sur les seuils
   * @returns {string} 'good' | 'warning' | 'danger'
   */
  _getStatus() {
    const percent = this._calculatePercent();
    const { thresholds } = this.props;

    if (percent >= thresholds.good) return 'good';
    if (percent >= thresholds.warning) return 'warning';
    return 'danger';
  }

  /**
   * Récupère la couleur selon le statut
   * @returns {string}
   */
  _getColor() {
    const status = this._getStatus();
    const colorMap = {
      good: config.colors.success[500],
      warning: config.colors.warning[500],
      danger: config.colors.danger[500]
    };
    return colorMap[status] || config.colors.primary[500];
  }

  /**
   * Rendu du composant
   */
  render() {
    const { type } = this.props;

    return type === 'ring'
      ? this._renderRingGauge()
      : this._renderLinearGauge();
  }

  /**
   * Rendu de la jauge linéaire
   * @returns {string}
   * @private
   */
  _renderLinearGauge() {
    const { label, unit, showValue, showPercent, size, animated } = this.props;
    const percent = this._calculatePercent();
    const status = this._getStatus();
    const color = this._getColor();
    const { value } = this.props;

    return `
      <div class="gauge gauge--linear gauge--${size} gauge--${status}">
        ${label || showValue ? `
          <div class="gauge__header">
            ${label ? `<span class="gauge__label">${this.escapeHtml(label)}</span>` : ''}
            ${showValue ? `
              <span class="gauge__value">
                ${formatNumber(value, 1)}${unit ? ` ${unit}` : ''}
                ${showPercent ? ` (${formatPercent(percent / 100)})` : ''}
              </span>
            ` : ''}
          </div>
        ` : ''}

        <div class="gauge__track">
          <div class="gauge__fill ${animated ? 'gauge__fill--animated' : ''}"
               style="width: ${percent}%; background-color: ${color};">
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Rendu de la jauge circulaire (ring)
   * @returns {string}
   * @private
   */
  _renderRingGauge() {
    const { label, unit, showValue, size, animated } = this.props;
    const percent = this._calculatePercent();
    const status = this._getStatus();
    const color = this._getColor();
    const { value } = this.props;

    // Paramètres SVG
    const radius = 45;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (percent / 100) * circumference;

    // Taille selon le prop size
    const sizeMap = { small: 80, medium: 120, large: 160 };
    const svgSize = sizeMap[size] || 120;

    return `
      <div class="gauge gauge--ring gauge--${size} gauge--${status}">
        <div class="gauge__ring-container" style="width: ${svgSize}px; height: ${svgSize}px;">
          <svg viewBox="0 0 100 100" class="gauge__svg">
            <!-- Track -->
            <circle
              class="gauge__ring-track"
              cx="50"
              cy="50"
              r="${radius}"
              fill="none"
              stroke-width="8"
            />
            <!-- Fill -->
            <circle
              class="gauge__ring-fill ${animated ? 'gauge__ring-fill--animated' : ''}"
              cx="50"
              cy="50"
              r="${radius}"
              fill="none"
              stroke="${color}"
              stroke-width="8"
              stroke-linecap="round"
              stroke-dasharray="${circumference}"
              stroke-dashoffset="${offset}"
              transform="rotate(-90 50 50)"
            />
          </svg>

          ${showValue ? `
            <div class="gauge__ring-content">
              <span class="gauge__ring-value">${formatNumber(value, 1)}</span>
              ${unit ? `<span class="gauge__ring-unit">${unit}</span>` : ''}
            </div>
          ` : ''}
        </div>

        ${label ? `<span class="gauge__ring-label">${this.escapeHtml(label)}</span>` : ''}
      </div>
    `;
  }

  /**
   * Met à jour la valeur
   * @param {number} newValue
   */
  setValue(newValue) {
    this.props = { ...this.props, value: newValue };
    this.forceUpdate();
  }

  /**
   * Met à jour les seuils
   * @param {Object} thresholds
   */
  setThresholds(thresholds) {
    this.props = { ...this.props, thresholds: { ...this.props.thresholds, ...thresholds } };
    this.forceUpdate();
  }

  /**
   * Anime vers une nouvelle valeur
   * @param {number} targetValue
   * @param {number} duration - Durée en ms
   */
  animateTo(targetValue, duration = 500) {
    const startValue = this.props.value;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentValue = startValue + (targetValue - startValue) * eased;
      this.setValue(currentValue);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }
}
