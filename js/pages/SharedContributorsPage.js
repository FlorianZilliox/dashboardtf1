/**
 * ==========================================================================
 * SHAREDCONTRIBUTORSPAGE.JS - Page secrète des contributeurs partagés
 * ==========================================================================
 *
 * Page cachée accessible via Konami code (↑↑↓↓)
 * Affiche le forecast individuel des contributeurs travaillant sur
 * plusieurs équipes.
 *
 * ==========================================================================
 */

import Component from '../components/Component.js';
import store from '../core/store.js';
import { aggregateByContributor, calculateContributorStats } from '../services/monteCarloService.js';
import { formatNumber } from '../utils/formatters.js';

// =========================================================================
// CLASSE SHAREDCONTRIBUTORSPAGE
// =========================================================================

export default class SharedContributorsPage extends Component {
  constructor(container, props = {}) {
    super(container, props);
  }

  /**
   * Initialisation
   */
  init() {
    this.state = {
      sharedContributors: [],
      nextSprint: null,
      isLoading: true,
      error: null
    };
  }

  /**
   * Après montage
   */
  afterMount() {
    this._loadSharedContributors();
  }

  /**
   * Identifie les contributeurs partagés entre équipes
   * @private
   */
  _loadSharedContributors() {
    const currentState = store.getState();

    // Utiliser les données brutes du store (toutes équipes confondues)
    const rawCsvData = currentState.rawCsvData;

    if (!rawCsvData || !rawCsvData.tickets || rawCsvData.tickets.length === 0) {
      this.setState({
        isLoading: false,
        error: 'Aucune donnée CSV chargée. Retournez sur la page Préparation.'
      });
      return;
    }

    const allTickets = rawCsvData.tickets;

    // Trouver les contributeurs et leurs équipes
    const contributorTeams = new Map(); // assignee -> Set<team>

    allTickets.forEach(ticket => {
      if (!ticket.assignee || !ticket.team) return;

      if (!contributorTeams.has(ticket.assignee)) {
        contributorTeams.set(ticket.assignee, new Set());
      }
      contributorTeams.get(ticket.assignee).add(ticket.team);
    });

    // Filtrer ceux qui ont plusieurs équipes
    const sharedAssignees = [];
    contributorTeams.forEach((teams, assignee) => {
      if (teams.size > 1) {
        sharedAssignees.push({
          name: assignee,
          teams: [...teams].sort()
        });
      }
    });

    if (sharedAssignees.length === 0) {
      this.setState({
        isLoading: false,
        sharedContributors: [],
        error: 'Aucun contributeur partagé trouvé entre les équipes.'
      });
      return;
    }

    // Calculer le forecast pour chaque contributeur partagé
    // On utilise les 6 derniers sprints complets
    const allSprints = [...new Set(
      allTickets
        .filter(t => t.isFinished && t.sprint)
        .map(t => t.sprint)
    )].sort((a, b) => a - b);

    const lastSprints = allSprints.slice(-6);
    const nextSprint = allSprints.length > 0 ? Math.max(...allSprints) + 1 : null;

    // Calculer les stats par contributeur (sur tous les tickets)
    const contributorMap = aggregateByContributor(allTickets, lastSprints);
    const contributorStats = calculateContributorStats(contributorMap, lastSprints);

    // Enrichir les contributeurs partagés avec leurs stats
    const sharedContributorsWithStats = sharedAssignees.map(shared => {
      const stats = contributorStats.find(s => s.name === shared.name);

      if (!stats) {
        return {
          ...shared,
          forecast: null
        };
      }

      return {
        ...shared,
        forecast: {
          // Throughput (nb tickets)
          ticketsP15: Math.round(stats.throughput.p15),
          ticketsP50: Math.round(stats.throughput.p50),
          ticketsP85: Math.round(stats.throughput.p85),
          ticketsMean: stats.throughput.mean,
          // Story Points
          spP15: Math.round(stats.storyPoints.p15),
          spP50: Math.round(stats.storyPoints.p50),
          spP85: Math.round(stats.storyPoints.p85),
          spMean: stats.storyPoints.mean,
          // Historique
          sprintsActive: stats.sprintsActive,
          sprintsAnalyzed: stats.sprintsAnalyzed,
          isReliable: stats.isReliable,
          totalTickets: stats.totalTickets,
          totalStoryPoints: stats.totalStoryPoints
        }
      };
    });

    // Trier par nombre de SP P50 décroissant
    sharedContributorsWithStats.sort((a, b) => {
      const spA = a.forecast?.spP50 || 0;
      const spB = b.forecast?.spP50 || 0;
      return spB - spA;
    });

    this.setState({
      isLoading: false,
      sharedContributors: sharedContributorsWithStats,
      nextSprint,
      error: null
    });
  }

  /**
   * Rendu du composant
   */
  render() {
    const { sharedContributors, nextSprint, isLoading, error } = this.state;

    return `
      <div class="shared-page">
        <header class="shared-page__header">
          <div class="shared-page__title-row">
            <h1 class="shared-page__title">StarAc</h1>
            <span class="shared-page__badge">SECRET</span>
          </div>
          <p class="shared-page__subtitle">
            Les stars qui brillent sur plusieurs équipes
            ${nextSprint ? `— Forecast <strong>Sprint ${nextSprint}</strong>` : ''}
          </p>
        </header>

        <main class="shared-page__content">
          ${isLoading ? this._renderLoading() : ''}
          ${error ? this._renderError(error) : ''}
          ${!isLoading && !error ? this._renderTable(sharedContributors) : ''}
        </main>

        <footer class="shared-page__footer">
          <p>↑ ↑ ↓ ↓</p>
        </footer>
      </div>
    `;
  }

  /**
   * Rendu du loader
   * @private
   */
  _renderLoading() {
    return `
      <div class="shared-page__loading">
        <div class="loader"></div>
        <p>Analyse des contributeurs partagés...</p>
      </div>
    `;
  }

  /**
   * Rendu d'une erreur
   * @param {string} message
   * @private
   */
  _renderError(message) {
    return `
      <div class="shared-page__error">
        <p>${message}</p>
        <a href="#admin" class="btn btn--primary">Retour à la préparation</a>
      </div>
    `;
  }

  /**
   * Rendu du tableau des contributeurs
   * @param {Array} contributors
   * @private
   */
  _renderTable(contributors) {
    if (contributors.length === 0) {
      return `
        <div class="shared-page__empty">
          <p>Aucun contributeur partagé détecté.</p>
        </div>
      `;
    }

    // Calculer les totaux
    const totals = contributors.reduce((acc, c) => {
      if (c.forecast) {
        acc.ticketsP50 += c.forecast.ticketsP50;
        acc.spP50 += c.forecast.spP50;
      }
      return acc;
    }, { ticketsP50: 0, spP50: 0 });

    return `
      <div class="shared-page__summary">
        <div class="shared-page__stat">
          <span class="shared-page__stat-value">${contributors.length}</span>
          <span class="shared-page__stat-label">Contributeurs partagés</span>
        </div>
        <div class="shared-page__stat">
          <span class="shared-page__stat-value">${totals.ticketsP50}</span>
          <span class="shared-page__stat-label">Tickets P50 cumulés</span>
        </div>
        <div class="shared-page__stat">
          <span class="shared-page__stat-value">${totals.spP50}</span>
          <span class="shared-page__stat-label">Story Points P50 cumulés</span>
        </div>
      </div>

      <table class="shared-table">
        <thead>
          <tr>
            <th>Contributeur</th>
            <th>Équipes</th>
            <th class="text-center" colspan="3">Tickets (prochain sprint)</th>
            <th class="text-center" colspan="3">Story Points (prochain sprint)</th>
            <th class="text-center">Fiabilité</th>
          </tr>
          <tr class="shared-table__subheader">
            <th></th>
            <th></th>
            <th class="text-center">P15</th>
            <th class="text-center">P50</th>
            <th class="text-center">P85</th>
            <th class="text-center">P15</th>
            <th class="text-center">P50</th>
            <th class="text-center">P85</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${contributors.map(c => this._renderContributorRow(c)).join('')}
        </tbody>
        <tfoot>
          <tr class="shared-table__total">
            <td><strong>Total</strong></td>
            <td></td>
            <td class="text-center">-</td>
            <td class="text-center"><strong>${totals.ticketsP50}</strong></td>
            <td class="text-center">-</td>
            <td class="text-center">-</td>
            <td class="text-center"><strong>${totals.spP50}</strong></td>
            <td class="text-center">-</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    `;
  }

  /**
   * Rendu d'une ligne contributeur
   * @param {Object} contributor
   * @private
   */
  _renderContributorRow(contributor) {
    const { name, teams, forecast } = contributor;

    if (!forecast) {
      return `
        <tr class="shared-table__row shared-table__row--no-data">
          <td>${this.escapeHtml(name)}</td>
          <td>${teams.map(t => `<span class="team-tag">${this.escapeHtml(t)}</span>`).join(' ')}</td>
          <td colspan="6" class="text-center text-muted">Pas de données</td>
          <td></td>
        </tr>
      `;
    }

    const reliabilityClass = forecast.isReliable ? 'reliable' : 'unreliable';
    const reliabilityLabel = forecast.isReliable ? 'Fiable' : 'Incertain';
    const reliabilityPercent = Math.round((forecast.sprintsActive / forecast.sprintsAnalyzed) * 100);

    return `
      <tr class="shared-table__row">
        <td class="shared-table__name">${this.escapeHtml(name)}</td>
        <td class="shared-table__teams">
          ${teams.map(t => `<span class="team-tag">${this.escapeHtml(t)}</span>`).join(' ')}
        </td>
        <td class="text-center text-muted">${forecast.ticketsP15}</td>
        <td class="text-center"><strong>${forecast.ticketsP50}</strong></td>
        <td class="text-center text-muted">${forecast.ticketsP85}</td>
        <td class="text-center text-muted">${forecast.spP15}</td>
        <td class="text-center"><strong>${forecast.spP50}</strong></td>
        <td class="text-center text-muted">${forecast.spP85}</td>
        <td class="text-center">
          <span class="reliability-badge reliability-badge--${reliabilityClass}"
                title="${forecast.sprintsActive}/${forecast.sprintsAnalyzed} sprints actifs">
            ${reliabilityPercent}%
          </span>
        </td>
      </tr>
    `;
  }
}
