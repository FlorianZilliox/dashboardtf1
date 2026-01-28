/**
 * ==========================================================================
 * STORYPOINTSGAUGE.JS - Jauge Story Points
 * ==========================================================================
 *
 * Composant spécialisé pour afficher les Story Points :
 * - Points engagés vs livrés
 * - Jauge avec marqueur d'engagement
 * - Indicateur de vélocité
 *
 * USAGE :
 *   const gauge = new StoryPointsGauge('#container', {
 *     committed: 45,
 *     delivered: 38
 *   });
 *
 * ==========================================================================
 */

import Component from './Component.js';
import config from '../core/config.js';
import { formatNumber, formatPercent } from '../utils/formatters.js';

// =========================================================================
// CLASSE STORYPOINTSGAUGE
// =========================================================================

export default class StoryPointsGauge extends Component {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {number} props.committed - Points engagés
   * @param {number} props.delivered - Points livrés
   * @param {number} props.maxCapacity - Capacité maximale (optionnel)
   * @param {boolean} props.showDetails - Afficher les détails
   */
  constructor(container, props = {}) {
    super(container, {
      committed: 0,
      delivered: 0,
      maxCapacity: null,
      showDetails: true,
      animated: true,
      ...props
    });
  }

  /**
   * Calcule les métriques
   * @returns {Object}
   */
  _calculateMetrics() {
    const { committed, delivered, maxCapacity } = this.props;

    // Pourcentage de livraison
    const deliveryRate = committed > 0
      ? Math.round((delivered / committed) * 100)
      : 0;

    // Déterminer le maximum pour la jauge
    const max = maxCapacity || Math.max(committed, delivered) * 1.2;

    // Pourcentages pour la jauge
    const committedPercent = max > 0 ? (committed / max) * 100 : 0;
    const deliveredPercent = max > 0 ? (delivered / max) * 100 : 0;

    // Status basé sur le taux de livraison
    let status;
    if (deliveryRate >= 90) status = 'excellent';
    else if (deliveryRate >= 75) status = 'good';
    else if (deliveryRate >= 50) status = 'warning';
    else status = 'danger';

    return {
      deliveryRate,
      max,
      committedPercent,
      deliveredPercent,
      status,
      delta: delivered - committed
    };
  }

  /**
   * Récupère la couleur selon le status
   * @param {string} status
   * @returns {string}
   */
  _getStatusColor(status) {
    const colors = {
      excellent: config.colors.success[500],
      good: config.colors.success[400],
      warning: config.colors.warning[500],
      danger: config.colors.danger[500]
    };
    return colors[status] || config.colors.primary[500];
  }

  /**
   * Rendu du composant
   */
  render() {
    const { committed, delivered, showDetails, animated } = this.props;
    const metrics = this._calculateMetrics();
    const statusColor = this._getStatusColor(metrics.status);

    return `
      <div class="story-points-gauge">
        <div class="story-points-gauge__header">
          <h4 class="story-points-gauge__title">Story Points</h4>
          <span class="story-points-gauge__rate story-points-gauge__rate--${metrics.status}">
            ${metrics.deliveryRate}%
          </span>
        </div>

        <div class="story-points-gauge__visual">
          <!-- Jauge principale -->
          <div class="story-points-gauge__track">
            <!-- Barre des points livrés -->
            <div class="story-points-gauge__delivered ${animated ? 'story-points-gauge__delivered--animated' : ''}"
                 style="width: ${metrics.deliveredPercent}%; background-color: ${statusColor};">
            </div>

            <!-- Marqueur d'engagement -->
            <div class="story-points-gauge__marker"
                 style="left: ${metrics.committedPercent}%;"
                 title="Engagé: ${committed} SP">
              <div class="story-points-gauge__marker-line"></div>
              <div class="story-points-gauge__marker-label">${committed}</div>
            </div>
          </div>

          <!-- Légende -->
          <div class="story-points-gauge__legend">
            <div class="story-points-gauge__legend-item">
              <span class="story-points-gauge__legend-color" style="background-color: ${statusColor};"></span>
              <span>Livré: <strong>${delivered} SP</strong></span>
            </div>
            <div class="story-points-gauge__legend-item">
              <span class="story-points-gauge__legend-color story-points-gauge__legend-color--committed"></span>
              <span>Engagé: <strong>${committed} SP</strong></span>
            </div>
          </div>
        </div>

        ${showDetails ? this._renderDetails(metrics) : ''}
      </div>
    `;
  }

  /**
   * Rendu des détails
   * @param {Object} metrics
   * @returns {string}
   * @private
   */
  _renderDetails(metrics) {
    const { committed, delivered } = this.props;
    const deltaClass = metrics.delta >= 0 ? 'positive' : 'negative';
    const deltaSign = metrics.delta >= 0 ? '+' : '';

    return `
      <div class="story-points-gauge__details">
        <div class="story-points-gauge__detail">
          <span class="story-points-gauge__detail-label">Delta</span>
          <span class="story-points-gauge__detail-value story-points-gauge__detail-value--${deltaClass}">
            ${deltaSign}${metrics.delta} SP
          </span>
        </div>
        <div class="story-points-gauge__detail">
          <span class="story-points-gauge__detail-label">Taux</span>
          <span class="story-points-gauge__detail-value">
            ${metrics.deliveryRate}%
          </span>
        </div>
      </div>
    `;
  }

  /**
   * Met à jour les valeurs
   * @param {number} committed
   * @param {number} delivered
   */
  updateValues(committed, delivered) {
    this.props = { ...this.props, committed, delivered };
    this.forceUpdate();
  }

  /**
   * Anime vers de nouvelles valeurs
   * @param {number} committed
   * @param {number} delivered
   * @param {number} duration
   */
  animateTo(committed, delivered, duration = 500) {
    const startCommitted = this.props.committed;
    const startDelivered = this.props.delivered;
    const startTime = performance.now();

    const animate = (currentTime) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);

      // Easing function (ease-out)
      const eased = 1 - Math.pow(1 - progress, 3);

      const currentCommitted = Math.round(startCommitted + (committed - startCommitted) * eased);
      const currentDelivered = Math.round(startDelivered + (delivered - startDelivered) * eased);

      this.updateValues(currentCommitted, currentDelivered);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }
}
