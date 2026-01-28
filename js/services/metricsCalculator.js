/**
 * ==========================================================================
 * METRICSCALCULATOR.JS - Calculs statistiques et métriques
 * ==========================================================================
 *
 * Fonctions de calcul pour les métriques du dashboard :
 * - Moyenne, médiane, écart-type
 * - Tendances et variations
 * - Pourcentages et ratios
 *
 * USAGE :
 *   import { average, median, trend } from './metricsCalculator.js';
 *
 *   const avg = average([1, 2, 3, 4, 5]); // 3
 *   const med = median([1, 2, 3, 4, 5]); // 3
 *   const pct = trend(10, 8);            // 25 (augmentation de 25%)
 *
 * ==========================================================================
 */

// =========================================================================
// STATISTIQUES DE BASE
// =========================================================================

/**
 * Calcule la moyenne d'un tableau de nombres
 * @param {number[]} values - Tableau de valeurs
 * @returns {number} Moyenne (0 si tableau vide)
 *
 * @example
 * average([1, 2, 3, 4, 5]); // 3
 * average([]);              // 0
 */
export function average(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (validValues.length === 0) {
    return 0;
  }

  const sum = validValues.reduce((acc, val) => acc + val, 0);
  return sum / validValues.length;
}

/**
 * Calcule la médiane d'un tableau de nombres
 * @param {number[]} values - Tableau de valeurs
 * @returns {number} Médiane (0 si tableau vide)
 *
 * @example
 * median([1, 2, 3, 4, 5]);    // 3
 * median([1, 2, 3, 4, 5, 6]); // 3.5
 */
export function median(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  const validValues = values
    .filter(v => typeof v === 'number' && !isNaN(v))
    .sort((a, b) => a - b);

  if (validValues.length === 0) {
    return 0;
  }

  const mid = Math.floor(validValues.length / 2);

  if (validValues.length % 2 === 0) {
    return (validValues[mid - 1] + validValues[mid]) / 2;
  }

  return validValues[mid];
}

/**
 * Calcule l'écart-type d'un tableau de nombres
 * @param {number[]} values - Tableau de valeurs
 * @returns {number} Écart-type (0 si tableau vide ou un seul élément)
 *
 * @example
 * standardDeviation([2, 4, 4, 4, 5, 5, 7, 9]); // 2
 */
export function standardDeviation(values) {
  if (!values || values.length < 2) {
    return 0;
  }

  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  if (validValues.length < 2) {
    return 0;
  }

  const avg = average(validValues);
  const squaredDiffs = validValues.map(val => Math.pow(val - avg, 2));
  const avgSquaredDiff = average(squaredDiffs);

  return Math.sqrt(avgSquaredDiff);
}

/**
 * Calcule le minimum d'un tableau de nombres
 * @param {number[]} values - Tableau de valeurs
 * @returns {number} Minimum (0 si tableau vide)
 */
export function min(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  return validValues.length > 0 ? Math.min(...validValues) : 0;
}

/**
 * Calcule le maximum d'un tableau de nombres
 * @param {number[]} values - Tableau de valeurs
 * @returns {number} Maximum (0 si tableau vide)
 */
export function max(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  const validValues = values.filter(v => typeof v === 'number' && !isNaN(v));
  return validValues.length > 0 ? Math.max(...validValues) : 0;
}

/**
 * Calcule la somme d'un tableau de nombres
 * @param {number[]} values - Tableau de valeurs
 * @returns {number} Somme (0 si tableau vide)
 */
export function sum(values) {
  if (!values || values.length === 0) {
    return 0;
  }

  return values
    .filter(v => typeof v === 'number' && !isNaN(v))
    .reduce((acc, val) => acc + val, 0);
}

// =========================================================================
// TENDANCES ET VARIATIONS
// =========================================================================

/**
 * Calcule le pourcentage de variation entre deux valeurs
 * @param {number} current - Valeur actuelle
 * @param {number} previous - Valeur précédente
 * @returns {number} Pourcentage de variation (-100 à +∞)
 *
 * @example
 * trend(120, 100); //  20 (augmentation de 20%)
 * trend(80, 100);  // -20 (diminution de 20%)
 * trend(100, 0);   //  0  (division par zéro évitée)
 */
export function trend(current, previous) {
  if (previous === 0) {
    return current > 0 ? 100 : 0;
  }

  return ((current - previous) / previous) * 100;
}

/**
 * Détermine la direction de la tendance
 * @param {number} current - Valeur actuelle
 * @param {number} previous - Valeur précédente
 * @param {number} [threshold=0] - Seuil pour considérer stable
 * @returns {'up' | 'down' | 'stable'} Direction
 *
 * @example
 * trendDirection(120, 100);      // 'up'
 * trendDirection(80, 100);       // 'down'
 * trendDirection(101, 100, 5);   // 'stable' (variation < 5%)
 */
export function trendDirection(current, previous, threshold = 0) {
  const change = trend(current, previous);

  if (Math.abs(change) <= threshold) {
    return 'stable';
  }

  return change > 0 ? 'up' : 'down';
}

/**
 * Calcule la variation par rapport à un benchmark
 * @param {number} value - Valeur actuelle
 * @param {number} benchmark - Valeur de référence
 * @returns {Object} { difference, percentage, isAbove, isBelow }
 *
 * @example
 * compareToBenchmark(12, 10);
 * // { difference: 2, percentage: 20, isAbove: true, isBelow: false }
 */
export function compareToBenchmark(value, benchmark) {
  const difference = value - benchmark;
  const percentage = benchmark !== 0 ? (difference / benchmark) * 100 : 0;

  return {
    difference,
    percentage,
    isAbove: value > benchmark,
    isBelow: value < benchmark,
    isEqual: value === benchmark
  };
}

// =========================================================================
// POURCENTAGES ET RATIOS
// =========================================================================

/**
 * Calcule un pourcentage
 * @param {number} part - Partie
 * @param {number} total - Total
 * @returns {number} Pourcentage (0-100)
 *
 * @example
 * percentage(25, 100); // 25
 * percentage(3, 4);    // 75
 */
export function percentage(part, total) {
  if (total === 0) {
    return 0;
  }

  return (part / total) * 100;
}

/**
 * Calcule le taux de réalisation (Story Points)
 * @param {number} delivered - Points livrés
 * @param {number} committed - Points engagés
 * @returns {Object} { rate, status, formatted }
 *
 * @example
 * completionRate(28, 34);
 * // { rate: 82.35, status: 'warning', formatted: '82%' }
 */
export function completionRate(delivered, committed) {
  if (committed === 0) {
    return {
      rate: 0,
      status: 'neutral',
      formatted: '0%'
    };
  }

  const rate = (delivered / committed) * 100;

  let status;
  if (rate >= 90) {
    status = 'success';
  } else if (rate >= 70) {
    status = 'warning';
  } else {
    status = 'danger';
  }

  return {
    rate,
    status,
    formatted: `${Math.round(rate)}%`
  };
}

/**
 * Calcule le ratio créés/résolus (Bugs)
 * @param {number} created - Bugs créés
 * @param {number} resolved - Bugs résolus
 * @returns {Object} { ratio, status, healthy }
 */
export function bugRatio(created, resolved) {
  if (resolved === 0 && created === 0) {
    return { ratio: 0, status: 'neutral', healthy: true };
  }

  if (resolved === 0) {
    return { ratio: Infinity, status: 'danger', healthy: false };
  }

  const ratio = created / resolved;

  let status;
  let healthy;

  if (ratio <= 1) {
    status = 'success';
    healthy = true;
  } else if (ratio <= 1.5) {
    status = 'warning';
    healthy = false;
  } else {
    status = 'danger';
    healthy = false;
  }

  return { ratio, status, healthy };
}

// =========================================================================
// CALCULS SPÉCIFIQUES MÉTRIQUES
// =========================================================================

/**
 * Calcule les métriques de throughput pour un sprint
 * @param {Array} weekData - Données des semaines du sprint
 * @param {Object} benchmarks - { average, median }
 * @param {string} statsMode - 'average' | 'median'
 * @returns {Object} Métriques calculées
 */
export function calculateThroughputMetrics(weekData, benchmarks, statsMode = 'average') {
  const values = weekData.map(w => w.issuesClosed);
  const total = sum(values);
  const benchmark = statsMode === 'median' ? benchmarks.median : benchmarks.average;

  // Comparer avec un sprint de 2 semaines de benchmark
  const expectedForSprint = benchmark * 2;
  const comparison = compareToBenchmark(total, expectedForSprint);

  return {
    total,
    perWeek: values,
    average: average(values),
    benchmark,
    expectedForSprint,
    comparison,
    vsExpected: comparison.percentage
  };
}

/**
 * Calcule les métriques de cycle time pour un sprint
 * @param {Array} weekData - Données des semaines du sprint
 * @param {Object} benchmarks - { average, median }
 * @param {string} statsMode - 'average' | 'median'
 * @returns {Object} Métriques calculées
 */
export function calculateCycleTimeMetrics(weekData, benchmarks, statsMode = 'average') {
  const values = weekData.map(w => w.avgProgressWorkdays);
  const avgValue = average(values);
  const benchmark = statsMode === 'median' ? benchmarks.median : benchmarks.average;
  const comparison = compareToBenchmark(avgValue, benchmark);

  return {
    value: avgValue,
    perWeek: values,
    benchmark,
    comparison,
    // Pour Cycle Time, être en dessous du benchmark est positif
    isGood: comparison.isBelow,
    vsBenchmark: comparison.percentage
  };
}

/**
 * Calcule les métriques de bugs pour un sprint
 * @param {Array} weekData - Données des semaines du sprint
 * @returns {Object} Métriques calculées
 */
export function calculateBugsMetrics(weekData) {
  const created = sum(weekData.map(w => w.issuesCreated));
  const closed = sum(weekData.map(w => w.issuesClosed));
  const avgClosingDays = average(weekData.map(w => w.avgClosingDays).filter(v => v > 0));
  const ratio = bugRatio(created, closed);

  return {
    created,
    closed,
    avgClosingDays,
    ratio: ratio.ratio,
    status: ratio.status,
    healthy: ratio.healthy,
    delta: closed - created
  };
}

/**
 * Calcule la capacité estimée basée sur l'historique
 * @param {Array<Object>} history - Historique des sprints { delivered }
 * @param {number} [count=3] - Nombre de sprints à considérer
 * @returns {Object} Estimation de capacité
 */
export function calculateCapacity(history, count = 3) {
  if (!history || history.length === 0) {
    return {
      min: 0,
      max: 0,
      average: 0,
      median: 0,
      recommended: 0,
      range: '0 - 0'
    };
  }

  // Prendre les N derniers sprints
  const recent = history.slice(0, count);
  const delivered = recent.map(s => s.delivered || s.storyPointsDelivered || 0);

  const avgValue = average(delivered);
  const medianValue = median(delivered);
  const minValue = min(delivered);
  const maxValue = max(delivered);
  const stdDev = standardDeviation(delivered);

  // Recommandation : médiane ± écart-type / 2
  const recommendedMin = Math.max(0, Math.round(medianValue - stdDev / 2));
  const recommendedMax = Math.round(medianValue + stdDev / 2);

  return {
    min: minValue,
    max: maxValue,
    average: Math.round(avgValue),
    median: Math.round(medianValue),
    recommended: Math.round(medianValue),
    range: `${recommendedMin} - ${recommendedMax}`,
    stdDev: Math.round(stdDev),
    basedOn: recent.length
  };
}

// =========================================================================
// FORMATAGE
// =========================================================================

/**
 * Formate un nombre avec précision
 * @param {number} value - Valeur à formater
 * @param {number} [decimals=1] - Nombre de décimales
 * @returns {string} Nombre formaté
 */
export function formatNumber(value, decimals = 1) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }

  return value.toFixed(decimals).replace(/\.0+$/, '');
}

/**
 * Formate un pourcentage
 * @param {number} value - Valeur (0-100)
 * @param {boolean} [showSign=false] - Afficher le signe +/-
 * @returns {string} Pourcentage formaté
 */
export function formatPercentage(value, showSign = false) {
  const rounded = Math.round(value);
  const sign = showSign && rounded > 0 ? '+' : '';
  return `${sign}${rounded}%`;
}

/**
 * Formate une tendance avec flèche
 * @param {number} value - Pourcentage de variation
 * @returns {Object} { icon, text, direction }
 */
export function formatTrend(value) {
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'stable';
  const icon = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const text = `${icon} ${formatPercentage(Math.abs(value))}`;

  return { icon, text, direction, value };
}

/**
 * Calcule le pourcentage de tendance d'un tableau de valeurs
 * Compare la dernière valeur avec la moyenne des précédentes
 * @param {number[]} values - Tableau de valeurs chronologiques
 * @returns {number} Pourcentage de variation
 */
export function trendPercentage(values) {
  if (!values || values.length < 2) {
    return 0;
  }

  const lastValue = values[values.length - 1];
  const previousValues = values.slice(0, -1);
  const previousAvg = average(previousValues);

  return trend(lastValue, previousAvg);
}

// =========================================================================
// EXPORT GLOBAL
// =========================================================================

export default {
  // Stats de base
  average,
  median,
  standardDeviation,
  min,
  max,
  sum,

  // Tendances
  trend,
  trendDirection,
  compareToBenchmark,

  // Pourcentages
  percentage,
  completionRate,
  bugRatio,

  // Calculs spécifiques
  calculateThroughputMetrics,
  calculateCycleTimeMetrics,
  calculateBugsMetrics,
  calculateCapacity,

  // Formatage
  formatNumber,
  formatPercentage,
  formatTrend,
  trendPercentage
};
