/**
 * ==========================================================================
 * FORECASTDATASERVICE.JS - Service de préparation des données Forecast
 * ==========================================================================
 *
 * Ce service prépare les données pour la page Forecast en utilisant
 * le parser CSV et le service Monte Carlo.
 *
 * Il est indépendant du dataTransformerV2 pour ne pas impacter la Review.
 *
 * ==========================================================================
 */

import { aggregateBySprint } from './csvParserV2.js';
import monteCarloService from './monteCarloService.js';

// =========================================================================
// CONFIGURATION
// =========================================================================

const CONFIG = {
  // Nombre de sprints à analyser pour le forecast
  SPRINTS_TO_ANALYZE: 6
};

// =========================================================================
// PRÉPARATION DES DONNÉES
// =========================================================================

/**
 * Détermine le sprint en cours (non terminé)
 * @param {Array} tickets
 * @returns {number|null}
 */
function getCurrentSprintNumber(tickets) {
  // Tickets non terminés avec le sprint le plus élevé
  const openTicketSprints = tickets
    .filter(t => !t.isFinished && t.sprint)
    .map(t => t.sprint);

  if (openTicketSprints.length > 0) {
    return Math.max(...openTicketSprints);
  }

  // Fallback: sprint max des tickets terminés + 1
  const finishedSprints = tickets
    .filter(t => t.isFinished && t.sprint)
    .map(t => t.sprint);

  if (finishedSprints.length > 0) {
    return Math.max(...finishedSprints) + 1;
  }

  return null;
}

/**
 * Obtient les N derniers sprints avec des tickets fermés
 *
 * RÈGLE MÉTIER : Un sprint est "complet" (disponible pour analyse) dès qu'il
 * a au moins 1 ticket fermé. Cela permet d'inclure le sprint en cours dans
 * les analyses dès que des tickets y sont terminés.
 *
 * @param {Array} tickets - Liste des tickets
 * @param {number} count - Nombre de sprints à récupérer (défaut: 6)
 * @returns {number[]} - Numéros de sprints (ordre croissant)
 */
function getLastCompletedSprints(tickets, count = CONFIG.SPRINTS_TO_ANALYZE) {
  // aggregateBySprint retourne uniquement les sprints avec des tickets fermés
  const sprintData = aggregateBySprint(tickets);

  // Prendre les N derniers sprints (triés par numéro décroissant, puis inversés)
  const completedSprints = sprintData
    .map(s => s.sprint)
    .sort((a, b) => b - a) // Décroissant
    .slice(0, count);

  // Retourner dans l'ordre croissant
  return completedSprints.reverse();
}

/**
 * Vérifie si les données ont les colonnes nécessaires pour le forecast
 * @param {Array} tickets
 * @returns {Object} - { hasAssignee, hasStoryPoints, isValid }
 */
export function validateForecastData(tickets) {
  if (!tickets || tickets.length === 0) {
    return { hasAssignee: false, hasStoryPoints: false, isValid: false };
  }

  const hasAssignee = tickets.some(t => t.assignee && t.assignee.trim() !== '');
  const hasStoryPoints = tickets.some(t => t.storyPoints > 0);

  return {
    hasAssignee,
    hasStoryPoints,
    isValid: hasAssignee, // Au minimum on a besoin des assignees
    message: !hasAssignee
      ? "Les données ne contiennent pas de colonne 'Assignee'. Ajoutez cette colonne dans votre export EazyBI."
      : !hasStoryPoints
        ? "Les données ne contiennent pas de Story Points. Le forecast sera basé uniquement sur le throughput."
        : null
  };
}

/**
 * Prépare toutes les données nécessaires pour la page Forecast
 * @param {Array} tickets - Tickets parsés depuis le CSV
 * @param {Object} options - Options (excludedContributors, reviewSprint, etc.)
 * @returns {Object} - Données complètes pour le forecast
 */
export function prepareForecastData(tickets, options = {}) {
  const {
    excludedContributors = [],
    sprintsToAnalyze = CONFIG.SPRINTS_TO_ANALYZE,
    reviewSprint = null // Sprint actuellement affiché en Review
  } = options;

  // Valider les données
  const validation = validateForecastData(tickets);
  if (!validation.isValid) {
    return {
      isValid: false,
      error: validation.message,
      validation
    };
  }

  // Déterminer le sprint cible pour le forecast
  // Si reviewSprint est fourni, utiliser reviewSprint + 1 comme cible
  // Sinon, utiliser la détection automatique
  let targetSprint;
  if (reviewSprint) {
    targetSprint = reviewSprint + 1;
  } else {
    targetSprint = getCurrentSprintNumber(tickets);
  }

  // Obtenir les sprints à analyser (jusqu'au sprint précédent le targetSprint)
  const sprintData = aggregateBySprint(tickets);
  const completedSprints = sprintData
    .filter(s => s.sprint < targetSprint)
    .map(s => s.sprint)
    .sort((a, b) => b - a) // Décroissant
    .slice(0, sprintsToAnalyze);

  const sprintNumbers = completedSprints.reverse(); // Ordre croissant

  if (sprintNumbers.length === 0) {
    return {
      isValid: false,
      error: "Aucun sprint complet trouvé dans les données.",
      validation
    };
  }

  console.log('[ForecastDataService] reviewSprint:', reviewSprint);
  console.log('[ForecastDataService] targetSprint (next):', targetSprint);
  console.log('[ForecastDataService] sprintNumbers analysés:', sprintNumbers);

  // Exécuter l'analyse Monte Carlo
  const analysis = monteCarloService.analyzeForecast(
    tickets,
    sprintNumbers,
    { excludedContributors }
  );

  // Préparer les données pour les graphiques
  const chartData = prepareChartData(analysis, sprintNumbers);

  return {
    isValid: true,
    validation,
    sprintNumbers,
    reviewSprint: reviewSprint,
    nextSprint: targetSprint,

    // Données Monte Carlo
    contributors: analysis.contributors,
    scenarios: analysis.scenarios,
    simulation: analysis.simulation,
    teamMetrics: analysis.teamMetrics,
    hasEnoughData: analysis.hasEnoughData,

    // Données pour les graphiques
    charts: chartData,

    // Options utilisées
    excludedContributors
  };
}

/**
 * Prépare les données pour les graphiques Chart.js
 * @param {Object} analysis - Résultat de l'analyse Monte Carlo
 * @param {number[]} sprintNumbers - Sprints analysés
 * @returns {Object} - Données formatées pour Chart.js
 */
function prepareChartData(analysis, sprintNumbers) {
  const { contributors, simulation, teamMetrics } = analysis;

  // Labels pour les sprints
  const sprintLabels = sprintNumbers.map(n => `Sprint ${n}`);

  // 1. Graphique de vélocité d'équipe (throughput par sprint)
  const teamVelocityChart = {
    labels: sprintLabels,
    datasets: [{
      label: 'Throughput équipe',
      data: teamMetrics.throughput.values,
      type: 'bar'
    }],
    benchmark: teamMetrics.throughput.mean
  };

  // 2. Graphique de story points d'équipe
  const teamStoryPointsChart = {
    labels: sprintLabels,
    datasets: [{
      label: 'Story Points équipe',
      data: teamMetrics.storyPoints.values,
      type: 'bar'
    }],
    benchmark: teamMetrics.storyPoints.mean
  };

  // 3. Graphique par contributeur (stacked bar)
  const contributorChart = {
    labels: sprintLabels,
    datasets: contributors.map((contributor, idx) => ({
      label: contributor.name,
      data: contributor.throughput.values,
      stack: 'throughput'
    }))
  };

  // 4. Graphique de story points par contributeur
  const contributorSPChart = {
    labels: sprintLabels,
    datasets: contributors.map((contributor, idx) => ({
      label: contributor.name,
      data: contributor.storyPoints.values,
      stack: 'storyPoints'
    }))
  };

  // 5. Distribution Monte Carlo (histogramme)
  const distributionChart = {
    throughput: {
      labels: simulation.throughput.distribution.map(d => d.value),
      data: simulation.throughput.distribution.map(d => d.percentage),
      percentiles: {
        p15: simulation.throughput.p15,
        p50: simulation.throughput.p50,
        p85: simulation.throughput.p85
      }
    },
    storyPoints: {
      labels: simulation.storyPoints.distribution.map(d => d.value),
      data: simulation.storyPoints.distribution.map(d => d.percentage),
      percentiles: {
        p15: simulation.storyPoints.p15,
        p50: simulation.storyPoints.p50,
        p85: simulation.storyPoints.p85
      }
    }
  };

  return {
    teamVelocity: teamVelocityChart,
    teamStoryPoints: teamStoryPointsChart,
    contributorThroughput: contributorChart,
    contributorStoryPoints: contributorSPChart,
    distribution: distributionChart
  };
}

/**
 * Recalcule le forecast avec de nouveaux contributeurs exclus
 * @param {Array} tickets - Tickets parsés
 * @param {string[]} excludedContributors - Noms des contributeurs à exclure
 * @param {number[]} sprintNumbers - Sprints à analyser
 * @returns {Object} - Nouveau résultat de simulation
 */
export function recalculateWithExclusions(tickets, excludedContributors, sprintNumbers) {
  return prepareForecastData(tickets, {
    excludedContributors,
    sprintsToAnalyze: sprintNumbers.length
  });
}

// =========================================================================
// EXPORT
// =========================================================================

export default {
  validateForecastData,
  prepareForecastData,
  recalculateWithExclusions,
  getLastCompletedSprints,
  CONFIG
};
