/**
 * ==========================================================================
 * MONTECARLOSERVICE.JS - Simulation Monte Carlo pour les prévisions de sprint
 * ==========================================================================
 *
 * Ce service calcule les métriques individuelles par contributeur et exécute
 * des simulations Monte Carlo pour générer des scénarios de sprint réalistes.
 *
 * FONCTIONNALITÉS :
 * - Agrégation des performances par contributeur (throughput, story points)
 * - Calcul des distributions statistiques individuelles
 * - Simulation Monte Carlo avec N itérations
 * - Génération de scénarios avec intervalles de confiance (P15, P50, P85)
 *
 * ==========================================================================
 */

// =========================================================================
// CONFIGURATION
// =========================================================================

const CONFIG = {
  // Nombre d'itérations pour la simulation Monte Carlo
  ITERATIONS: 10000,
  // Nombre minimum de sprints pour avoir des statistiques fiables
  MIN_SPRINTS_FOR_STATS: 3,
  // Percentiles à calculer
  PERCENTILES: {
    pessimistic: 15,
    realistic: 50,
    optimistic: 85
  }
};

// =========================================================================
// UTILITAIRES STATISTIQUES
// =========================================================================

/**
 * Calcule la moyenne d'un tableau de valeurs
 * @param {number[]} values
 * @returns {number}
 */
function average(values) {
  if (!values || values.length === 0) return 0;
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

/**
 * Calcule l'écart-type d'un tableau de valeurs
 * @param {number[]} values
 * @returns {number}
 */
function standardDeviation(values) {
  if (!values || values.length < 2) return 0;
  const avg = average(values);
  const squareDiffs = values.map(v => Math.pow(v - avg, 2));
  return Math.sqrt(average(squareDiffs));
}

/**
 * Calcule un percentile d'un tableau de valeurs
 * @param {number[]} values - Tableau de valeurs
 * @param {number} p - Percentile (0-100)
 * @returns {number}
 */
function percentile(values, p) {
  if (!values || values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * Génère un nombre aléatoire selon une distribution normale (Box-Muller)
 * @param {number} mean - Moyenne
 * @param {number} stdDev - Écart-type
 * @returns {number}
 */
function randomNormal(mean, stdDev) {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Génère un nombre aléatoire basé sur l'historique (échantillonnage)
 * @param {number[]} historicalValues - Valeurs historiques
 * @returns {number}
 */
function sampleFromHistory(historicalValues) {
  if (!historicalValues || historicalValues.length === 0) return 0;
  const index = Math.floor(Math.random() * historicalValues.length);
  return historicalValues[index];
}

// =========================================================================
// AGRÉGATION PAR CONTRIBUTEUR
// =========================================================================

/**
 * Agrège les performances par contributeur sur les sprints donnés
 * @param {Array} tickets - Tickets parsés avec assignee et storyPoints
 * @param {number[]} sprintNumbers - Numéros de sprints à considérer
 * @returns {Map} - Map<assignee, ContributorStats>
 */
export function aggregateByContributor(tickets, sprintNumbers) {
  const contributorMap = new Map();

  // Filtrer les tickets terminés dans les sprints sélectionnés
  const relevantTickets = tickets.filter(t =>
    t.isFinished &&
    t.sprint &&
    sprintNumbers.includes(t.sprint) &&
    t.assignee // Exclure les tickets sans assignee
  );

  // Grouper par contributeur et par sprint
  relevantTickets.forEach(ticket => {
    const assignee = ticket.assignee;

    if (!contributorMap.has(assignee)) {
      contributorMap.set(assignee, {
        name: assignee,
        sprintData: new Map(), // Map<sprintNum, { tickets: [], storyPoints: 0 }>
        totalTickets: 0,
        totalStoryPoints: 0
      });
    }

    const contributor = contributorMap.get(assignee);
    const sprintNum = ticket.sprint;

    if (!contributor.sprintData.has(sprintNum)) {
      contributor.sprintData.set(sprintNum, {
        tickets: [],
        throughput: 0,
        storyPoints: 0
      });
    }

    const sprintStats = contributor.sprintData.get(sprintNum);
    sprintStats.tickets.push(ticket);
    sprintStats.throughput++;
    sprintStats.storyPoints += ticket.storyPoints || 0;

    contributor.totalTickets++;
    contributor.totalStoryPoints += ticket.storyPoints || 0;
  });

  return contributorMap;
}

/**
 * Calcule les statistiques détaillées pour chaque contributeur
 * @param {Map} contributorMap - Résultat de aggregateByContributor
 * @param {number[]} sprintNumbers - Numéros de sprints analysés
 * @returns {Array} - Tableau de ContributorStatistics
 */
export function calculateContributorStats(contributorMap, sprintNumbers) {
  const stats = [];

  contributorMap.forEach((data, name) => {
    // Extraire les valeurs par sprint
    const throughputPerSprint = [];
    const storyPointsPerSprint = [];

    sprintNumbers.forEach(sprintNum => {
      const sprintData = data.sprintData.get(sprintNum);
      if (sprintData) {
        throughputPerSprint.push(sprintData.throughput);
        storyPointsPerSprint.push(sprintData.storyPoints);
      } else {
        // Sprint où le contributeur n'a rien livré
        throughputPerSprint.push(0);
        storyPointsPerSprint.push(0);
      }
    });

    // Calculer les statistiques
    // Filtrer les valeurs non-nulles pour les percentiles (sprints actifs seulement)
    const activeThroughput = throughputPerSprint.filter(v => v > 0);
    const activeStoryPoints = storyPointsPerSprint.filter(v => v > 0);

    const contributorStats = {
      name,
      sprintsAnalyzed: sprintNumbers.length,
      sprintsActive: data.sprintData.size,

      // Throughput (nombre de tickets)
      throughput: {
        total: data.totalTickets,
        values: throughputPerSprint,
        mean: average(throughputPerSprint),
        stdDev: standardDeviation(throughputPerSprint),
        min: Math.min(...throughputPerSprint),
        max: Math.max(...throughputPerSprint),
        // Scénarios individuels basés sur l'historique actif
        p15: activeThroughput.length > 0 ? Math.round(percentile(activeThroughput, 15)) : 0,
        p50: activeThroughput.length > 0 ? Math.round(percentile(activeThroughput, 50)) : 0,
        p85: activeThroughput.length > 0 ? Math.round(percentile(activeThroughput, 85)) : 0
      },

      // Story Points
      storyPoints: {
        total: data.totalStoryPoints,
        values: storyPointsPerSprint,
        mean: average(storyPointsPerSprint),
        stdDev: standardDeviation(storyPointsPerSprint),
        min: Math.min(...storyPointsPerSprint),
        max: Math.max(...storyPointsPerSprint),
        // Scénarios individuels basés sur l'historique actif
        p15: activeStoryPoints.length > 0 ? Math.round(percentile(activeStoryPoints, 15)) : 0,
        p50: activeStoryPoints.length > 0 ? Math.round(percentile(activeStoryPoints, 50)) : 0,
        p85: activeStoryPoints.length > 0 ? Math.round(percentile(activeStoryPoints, 85)) : 0
      },

      // Ratio SP/ticket moyen
      avgPointsPerTicket: data.totalTickets > 0
        ? Math.round((data.totalStoryPoints / data.totalTickets) * 10) / 10
        : 0,

      // Flag si assez de données pour être fiable
      isReliable: data.sprintData.size >= CONFIG.MIN_SPRINTS_FOR_STATS
    };

    stats.push(contributorStats);
  });

  // Trier par throughput total décroissant
  stats.sort((a, b) => b.throughput.total - a.throughput.total);

  return stats;
}

// =========================================================================
// SIMULATION MONTE CARLO
// =========================================================================

/**
 * Exécute une simulation Monte Carlo pour prédire les performances d'équipe
 * @param {Array} contributorStats - Statistiques par contributeur
 * @param {Object} options - Options de simulation
 * @returns {Object} - Résultats de la simulation
 */
export function runMonteCarloSimulation(contributorStats, options = {}) {
  const {
    iterations = CONFIG.ITERATIONS,
    excludedContributors = [], // Contributeurs à exclure (absences)
    useHistoricalSampling = true // Utiliser l'échantillonnage vs distribution normale
  } = options;

  // Filtrer les contributeurs actifs
  const activeContributors = contributorStats.filter(
    c => !excludedContributors.includes(c.name) && c.sprintsActive > 0
  );

  if (activeContributors.length === 0) {
    return {
      throughput: { p15: 0, p50: 0, p85: 0, distribution: [] },
      storyPoints: { p15: 0, p50: 0, p85: 0, distribution: [] },
      contributors: [],
      iterations: 0
    };
  }

  // Tableaux pour stocker les résultats de chaque itération
  const throughputResults = [];
  const storyPointsResults = [];

  // Exécuter N itérations
  for (let i = 0; i < iterations; i++) {
    let iterationThroughput = 0;
    let iterationStoryPoints = 0;

    // Pour chaque contributeur, simuler sa performance
    activeContributors.forEach(contributor => {
      let simThroughput, simStoryPoints;

      if (useHistoricalSampling && contributor.throughput.values.length > 0) {
        // Méthode 1: Échantillonnage depuis l'historique (plus réaliste)
        simThroughput = sampleFromHistory(contributor.throughput.values);
        simStoryPoints = sampleFromHistory(contributor.storyPoints.values);
      } else {
        // Méthode 2: Distribution normale basée sur moyenne/écart-type
        simThroughput = Math.max(0, Math.round(
          randomNormal(contributor.throughput.mean, contributor.throughput.stdDev)
        ));
        simStoryPoints = Math.max(0, Math.round(
          randomNormal(contributor.storyPoints.mean, contributor.storyPoints.stdDev)
        ));
      }

      iterationThroughput += simThroughput;
      iterationStoryPoints += simStoryPoints;
    });

    throughputResults.push(iterationThroughput);
    storyPointsResults.push(iterationStoryPoints);
  }

  // Calculer les percentiles
  const result = {
    throughput: {
      p15: Math.round(percentile(throughputResults, CONFIG.PERCENTILES.pessimistic)),
      p50: Math.round(percentile(throughputResults, CONFIG.PERCENTILES.realistic)),
      p85: Math.round(percentile(throughputResults, CONFIG.PERCENTILES.optimistic)),
      mean: Math.round(average(throughputResults)),
      stdDev: Math.round(standardDeviation(throughputResults) * 10) / 10,
      distribution: buildDistribution(throughputResults)
    },
    storyPoints: {
      p15: Math.round(percentile(storyPointsResults, CONFIG.PERCENTILES.pessimistic)),
      p50: Math.round(percentile(storyPointsResults, CONFIG.PERCENTILES.realistic)),
      p85: Math.round(percentile(storyPointsResults, CONFIG.PERCENTILES.optimistic)),
      mean: Math.round(average(storyPointsResults)),
      stdDev: Math.round(standardDeviation(storyPointsResults) * 10) / 10,
      distribution: buildDistribution(storyPointsResults)
    },
    contributors: activeContributors.map(c => c.name),
    iterations,
    excludedContributors
  };

  return result;
}

/**
 * Construit une distribution pour l'histogramme
 * @param {number[]} values - Valeurs simulées
 * @returns {Array} - [{ value, count, percentage }]
 */
function buildDistribution(values) {
  if (!values || values.length === 0) return [];

  const countMap = new Map();
  values.forEach(v => {
    countMap.set(v, (countMap.get(v) || 0) + 1);
  });

  const distribution = [];
  const total = values.length;

  // Trier par valeur
  const sortedValues = [...countMap.keys()].sort((a, b) => a - b);

  sortedValues.forEach(value => {
    const count = countMap.get(value);
    distribution.push({
      value,
      count,
      percentage: Math.round((count / total) * 1000) / 10
    });
  });

  return distribution;
}

// =========================================================================
// GÉNÉRATION DE SCÉNARIOS
// =========================================================================

/**
 * Génère des scénarios de sprint basés sur la simulation Monte Carlo
 * @param {Object} simulationResult - Résultat de runMonteCarloSimulation
 * @returns {Array} - Tableau de scénarios
 */
export function generateScenarios(simulationResult) {
  const { throughput, storyPoints } = simulationResult;

  return [
    {
      id: 'pessimistic',
      label: 'Pessimiste (P15)',
      description: "85% de chances de faire mieux",
      throughput: throughput.p15,
      storyPoints: storyPoints.p15,
      confidence: 85,
      color: 'warning'
    },
    {
      id: 'realistic',
      label: 'Réaliste (P50)',
      description: "Objectif médian basé sur l'historique",
      throughput: throughput.p50,
      storyPoints: storyPoints.p50,
      confidence: 50,
      color: 'primary'
    },
    {
      id: 'optimistic',
      label: 'Optimiste (P85)',
      description: "15% de chances de faire mieux",
      throughput: throughput.p85,
      storyPoints: storyPoints.p85,
      confidence: 15,
      color: 'success'
    }
  ];
}

/**
 * Calcule les métriques d'équipe globales
 * @param {Array} contributorStats - Statistiques par contributeur
 * @param {number[]} sprintNumbers - Sprints analysés
 * @returns {Object} - Métriques d'équipe
 */
export function calculateTeamMetrics(contributorStats, sprintNumbers) {
  // Agréger les totaux par sprint
  const sprintTotals = sprintNumbers.map(sprintNum => {
    let throughput = 0;
    let storyPoints = 0;

    contributorStats.forEach(contributor => {
      const sprintIndex = sprintNumbers.indexOf(sprintNum);
      if (sprintIndex !== -1) {
        throughput += contributor.throughput.values[sprintIndex] || 0;
        storyPoints += contributor.storyPoints.values[sprintIndex] || 0;
      }
    });

    return { sprint: sprintNum, throughput, storyPoints };
  });

  const throughputValues = sprintTotals.map(s => s.throughput);
  const storyPointsValues = sprintTotals.map(s => s.storyPoints);

  return {
    sprints: sprintNumbers,
    sprintTotals,
    throughput: {
      values: throughputValues,
      mean: average(throughputValues),
      stdDev: standardDeviation(throughputValues),
      trend: calculateTrend(throughputValues)
    },
    storyPoints: {
      values: storyPointsValues,
      mean: average(storyPointsValues),
      stdDev: standardDeviation(storyPointsValues),
      trend: calculateTrend(storyPointsValues)
    },
    teamSize: contributorStats.length,
    activeContributors: contributorStats.filter(c => c.sprintsActive > 0).length
  };
}

/**
 * Calcule la tendance (pourcentage d'évolution)
 * @param {number[]} values
 * @returns {number} - Pourcentage de tendance
 */
function calculateTrend(values) {
  if (!values || values.length < 2) return 0;
  const recent = values.slice(-2);
  if (recent[0] === 0) return 0;
  return Math.round(((recent[1] - recent[0]) / recent[0]) * 100);
}

// =========================================================================
// API PRINCIPALE
// =========================================================================

/**
 * Point d'entrée principal : analyse complète pour le forecast
 * @param {Array} tickets - Tickets parsés
 * @param {number[]} sprintNumbers - Sprints à analyser (ex: les 6 derniers)
 * @param {Object} options - Options (excludedContributors, etc.)
 * @returns {Object} - Analyse complète pour le forecast
 */
export function analyzeForecast(tickets, sprintNumbers, options = {}) {
  // 1. Agréger par contributeur
  const contributorMap = aggregateByContributor(tickets, sprintNumbers);

  // 2. Calculer les stats par contributeur
  const contributorStats = calculateContributorStats(contributorMap, sprintNumbers);

  // 3. Exécuter la simulation Monte Carlo
  const simulation = runMonteCarloSimulation(contributorStats, options);

  // 4. Générer les scénarios
  const scenarios = generateScenarios(simulation);

  // 5. Calculer les métriques d'équipe
  const teamMetrics = calculateTeamMetrics(contributorStats, sprintNumbers);

  return {
    contributors: contributorStats,
    simulation,
    scenarios,
    teamMetrics,
    sprintsAnalyzed: sprintNumbers,
    hasEnoughData: contributorStats.some(c => c.isReliable)
  };
}

// =========================================================================
// EXPORT
// =========================================================================

export default {
  aggregateByContributor,
  calculateContributorStats,
  runMonteCarloSimulation,
  generateScenarios,
  calculateTeamMetrics,
  analyzeForecast,
  CONFIG
};
