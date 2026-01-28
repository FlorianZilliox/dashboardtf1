/**
 * ==========================================================================
 * HOWMANYSERVICE.JS - Service Monte Carlo "How Many"
 * ==========================================================================
 *
 * Implémente l'algorithme Monte Carlo pour répondre à la question :
 * "Combien d'items pourrons-nous livrer sur une période donnée ?"
 *
 * Règles métier documentées dans /docs/MONTE-CARLO-HOWMANY.md
 *
 * ==========================================================================
 */

// =========================================================================
// CONFIGURATION
// =========================================================================

const CONFIG = {
  // Simulation
  NUM_SIMULATIONS: 10000,
  HORIZONS_SPRINTS: [1, 2, 3, 4, 6], // En sprints (équivalent à 2, 4, 6, 8, 12 semaines)
  PERCENTILES: [50, 85, 95],

  // Safety factors
  SAFETY_FACTORS: {
    50: 1.00,
    85: 0.95,
    95: 0.90
  },

  // Échantillonnage pondéré
  RECENT_SPRINTS_COUNT: 2, // 4 semaines = 2 sprints
  RECENT_WEIGHT_RATIO: 0.50,

  // Outliers (IQR)
  IQR_MULTIPLIER: 1.5, // Standard IQR multiplier
  MEDIAN_LOW_THRESHOLD: 0.50, // 50% de la médiane = vraiment bas

  // Tendance
  TREND_MODERATE_THRESHOLD: 0.05,
  TREND_STRONG_THRESHOLD: 0.10,

  // Stabilité (CV)
  CV_HIGH_STABILITY: 0.30,
  CV_MODERATE_STABILITY: 0.50,

  // Validation
  MIN_SPRINTS: 2 // Minimum 4 semaines = 2 sprints
};

// =========================================================================
// VALIDATION
// =========================================================================

/**
 * Valide les données d'entrée
 * @param {number[]} throughputs - Throughputs par sprint
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateData(throughputs) {
  if (!throughputs || !Array.isArray(throughputs)) {
    return { valid: false, error: 'Données invalides' };
  }

  if (throughputs.length < CONFIG.MIN_SPRINTS) {
    return {
      valid: false,
      error: `Minimum ${CONFIG.MIN_SPRINTS} sprints requis (${CONFIG.MIN_SPRINTS * 2} semaines)`
    };
  }

  if (throughputs.some(t => t < 0)) {
    return { valid: false, error: 'Les throughputs ne peuvent pas être négatifs' };
  }

  return { valid: true };
}

// =========================================================================
// OUTLIERS - Méthode IQR
// =========================================================================

/**
 * Calcule les quartiles
 * @param {number[]} values - Valeurs triées
 * @returns {{ q1: number, median: number, q3: number }}
 */
function calculateQuartiles(values) {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;

  const median = n % 2 === 0
    ? (sorted[n / 2 - 1] + sorted[n / 2]) / 2
    : sorted[Math.floor(n / 2)];

  const lowerHalf = sorted.slice(0, Math.floor(n / 2));
  const upperHalf = sorted.slice(Math.ceil(n / 2));

  const q1 = lowerHalf.length > 0
    ? lowerHalf.reduce((a, b) => a + b, 0) / lowerHalf.length
    : sorted[0];

  const q3 = upperHalf.length > 0
    ? upperHalf.reduce((a, b) => a + b, 0) / upperHalf.length
    : sorted[n - 1];

  // Utiliser vraie médiane pour quartiles
  const q1Idx = Math.floor(lowerHalf.length / 2);
  const q3Idx = Math.floor(upperHalf.length / 2);

  return {
    q1: lowerHalf.length % 2 === 0 && lowerHalf.length > 1
      ? (lowerHalf[q1Idx - 1] + lowerHalf[q1Idx]) / 2
      : lowerHalf[q1Idx] || sorted[0],
    median,
    q3: upperHalf.length % 2 === 0 && upperHalf.length > 1
      ? (upperHalf[q3Idx - 1] + upperHalf[q3Idx]) / 2
      : upperHalf[q3Idx] || sorted[n - 1]
  };
}

/**
 * Détecte les outliers bas avec la méthode IQR
 * @param {number[]} values - Throughputs
 * @returns {{ cleanedValues: number[], outliers: number[], outlierIndices: number[] }}
 */
export function detectOutliers(values) {
  if (values.length < 4) {
    return { cleanedValues: values, outliers: [], outlierIndices: [] };
  }

  const { q1, median, q3 } = calculateQuartiles(values);
  const iqr = q3 - q1;
  const lowerBound = q1 - (iqr * CONFIG.IQR_MULTIPLIER);
  const medianThreshold = median * CONFIG.MEDIAN_LOW_THRESHOLD;

  const outliers = [];
  const outlierIndices = [];
  const cleanedValues = [];

  values.forEach((value, index) => {
    // Seulement les outliers BAS (pas les hauts)
    // Simple : valeur significativement sous la médiane (< 50%)
    // ET en dessous de Q1 pour éviter les faux positifs
    const isLowOutlier = value < medianThreshold && value <= q1;

    if (isLowOutlier) {
      outliers.push(value);
      outlierIndices.push(index);
    } else {
      cleanedValues.push(value);
    }
  });

  return { cleanedValues, outliers, outlierIndices };
}

// =========================================================================
// ÉCHANTILLONNAGE PONDÉRÉ
// =========================================================================

/**
 * Calcule les poids d'échantillonnage
 * Les sprints récents ont plus de poids
 * @param {number} count - Nombre de sprints
 * @param {boolean} useWeighting - Activer la pondération
 * @returns {number[]} - Poids normalisés
 */
export function calculateWeights(count, useWeighting = true) {
  if (!useWeighting || count <= CONFIG.RECENT_SPRINTS_COUNT) {
    // Poids uniformes
    return Array(count).fill(1 / count);
  }

  const recentCount = Math.min(CONFIG.RECENT_SPRINTS_COUNT, count);
  const olderCount = count - recentCount;

  const recentWeight = CONFIG.RECENT_WEIGHT_RATIO / recentCount;
  const olderWeight = (1 - CONFIG.RECENT_WEIGHT_RATIO) / olderCount;

  const weights = [];

  // Sprints anciens (début du tableau)
  for (let i = 0; i < olderCount; i++) {
    weights.push(olderWeight);
  }

  // Sprints récents (fin du tableau)
  for (let i = 0; i < recentCount; i++) {
    weights.push(recentWeight);
  }

  return weights;
}

/**
 * Tire une valeur selon les poids
 * @param {number[]} values - Valeurs possibles
 * @param {number[]} weights - Poids correspondants
 * @returns {number}
 */
function weightedSample(values, weights) {
  const random = Math.random();
  let cumulative = 0;

  for (let i = 0; i < values.length; i++) {
    cumulative += weights[i];
    if (random < cumulative) {
      return values[i];
    }
  }

  return values[values.length - 1];
}

// =========================================================================
// DÉTECTION DE TENDANCE
// =========================================================================

/**
 * Calcule la tendance par régression linéaire
 * @param {number[]} values - Throughputs chronologiques
 * @returns {{ slope: number, relativeChange: number, direction: string, strength: string }}
 */
export function detectTrend(values) {
  if (values.length < 2) {
    return { slope: 0, relativeChange: 0, direction: 'stable', strength: 'none' };
  }

  const n = values.length;
  const xMean = (n + 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;

  let numerator = 0;
  let denominator = 0;

  for (let i = 0; i < n; i++) {
    const x = i + 1;
    const xDiff = x - xMean;
    const yDiff = values[i] - yMean;
    numerator += xDiff * yDiff;
    denominator += xDiff * xDiff;
  }

  const slope = denominator !== 0 ? numerator / denominator : 0;
  const relativeChange = yMean !== 0 ? slope / yMean : 0;

  // Classification
  let direction = 'stable';
  let strength = 'none';

  if (Math.abs(relativeChange) >= CONFIG.TREND_STRONG_THRESHOLD) {
    strength = 'strong';
    direction = relativeChange > 0 ? 'up' : 'down';
  } else if (Math.abs(relativeChange) >= CONFIG.TREND_MODERATE_THRESHOLD) {
    strength = 'moderate';
    direction = relativeChange > 0 ? 'up' : 'down';
  }

  return { slope, relativeChange, direction, strength };
}

// =========================================================================
// STABILITÉ (Coefficient de Variation)
// =========================================================================

/**
 * Calcule le coefficient de variation et la stabilité
 * @param {number[]} values - Throughputs
 * @returns {{ cv: number, stability: string }}
 */
export function calculateStability(values) {
  if (values.length < 2) {
    return { cv: 0, stability: 'unknown' };
  }

  const mean = values.reduce((a, b) => a + b, 0) / values.length;

  if (mean === 0) {
    return { cv: 0, stability: 'low' };
  }

  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  const stdDev = Math.sqrt(variance);
  const cv = stdDev / mean;

  let stability;
  if (cv < CONFIG.CV_HIGH_STABILITY) {
    stability = 'high';
  } else if (cv < CONFIG.CV_MODERATE_STABILITY) {
    stability = 'moderate';
  } else {
    stability = 'low';
  }

  return { cv, stability };
}

// =========================================================================
// SIMULATION MONTE CARLO
// =========================================================================

/**
 * Calcule moyenne et écart-type pondérés
 * @param {number[]} values - Valeurs
 * @param {number[]} weights - Poids (optionnel)
 * @returns {{ mean: number, stdDev: number }}
 */
function calculateWeightedStats(values, weights = null) {
  const n = values.length;

  if (!weights) {
    weights = Array(n).fill(1 / n);
  }

  // Moyenne pondérée
  let mean = 0;
  for (let i = 0; i < n; i++) {
    mean += values[i] * weights[i];
  }

  // Variance pondérée
  let variance = 0;
  for (let i = 0; i < n; i++) {
    variance += weights[i] * Math.pow(values[i] - mean, 2);
  }

  // Correction de Bessel pour petit échantillon
  const effectiveN = 1 / weights.reduce((sum, w) => sum + w * w, 0);
  if (effectiveN > 1) {
    variance = variance * effectiveN / (effectiveN - 1);
  }

  return { mean, stdDev: Math.sqrt(variance) };
}

/**
 * Calcule un percentile avec z-score (distribution normale)
 * @param {number} mean - Moyenne
 * @param {number} stdDev - Écart-type
 * @param {number} percentile - Percentile (0-100)
 * @returns {number}
 */
function calculateNormalPercentile(mean, stdDev, percentile) {
  // Z-scores pour percentiles courants
  const zScores = {
    50: 0,
    85: 1.036,
    95: 1.645
  };

  const z = zScores[percentile] || 0;
  return mean + z * stdDev;
}

/**
 * Exécute la simulation Monte Carlo "How Many"
 * @param {number[]} throughputs - Throughputs par sprint (chronologiques)
 * @param {Object} options - Options de simulation
 * @param {boolean} options.useWeighting - Pondérer les sprints récents
 * @param {boolean} options.excludeOutliers - Exclure les outliers
 * @returns {Object} - Résultats de simulation
 */
export function runSimulation(throughputs, options = {}) {
  const { useWeighting = false, excludeOutliers = false } = options;

  // Validation
  const validation = validateData(throughputs);
  if (!validation.valid) {
    return { success: false, error: validation.error };
  }

  // Détection des outliers
  let dataToUse = [...throughputs];
  let outlierInfo = { outliers: [], outlierIndices: [] };

  if (excludeOutliers) {
    const detection = detectOutliers(throughputs);
    dataToUse = detection.cleanedValues;
    outlierInfo = detection;

    // Revérifier après exclusion
    if (dataToUse.length < CONFIG.MIN_SPRINTS) {
      return {
        success: false,
        error: 'Pas assez de données après exclusion des outliers'
      };
    }
  }

  // Calcul des poids
  const weights = calculateWeights(dataToUse.length, useWeighting);

  // Analyse de tendance (sur données originales pour info)
  const trend = detectTrend(throughputs);

  // Calcul de stabilité
  const stability = calculateStability(dataToUse);

  // Statistiques de base (pondérées si activé)
  const stats = calculateWeightedStats(dataToUse, useWeighting ? weights : null);

  // Calcul pour chaque horizon (approche analytique, pas Monte Carlo discret)
  const results = {};

  // Ajustement de tendance haussière avec rendements décroissants
  // Si la tendance est à la hausse, on ajoute un bonus qui s'atténue dans le temps
  // Le facteur de décroissance (0.85) fait que le gain diminue à chaque sprint
  const trendBoostFactor = trend.direction === 'up'
    ? (trend.strength === 'strong' ? 0.75 : trend.strength === 'moderate' ? 0.5 : 0)
    : 0; // Pas de boost si tendance stable ou baissière

  const TREND_DECAY = 0.85; // Facteur de décroissance par sprint

  for (const horizonSprints of CONFIG.HORIZONS_SPRINTS) {
    // Pour n sprints : moyenne de base = n * μ, écart-type = √n * σ
    let horizonMean = horizonSprints * stats.mean;

    // Ajouter le boost de tendance haussière avec rendements décroissants
    // Au lieu de slope × (1+2+...+N), on utilise slope × (1 + decay + decay² + ...)
    // Série géométrique : sum = (1 - decay^N) / (1 - decay)
    if (trendBoostFactor > 0 && trend.slope > 0) {
      const decaySum = (1 - Math.pow(TREND_DECAY, horizonSprints)) / (1 - TREND_DECAY);
      const trendBonus = trendBoostFactor * trend.slope * decaySum;
      horizonMean += trendBonus;
    }

    const horizonStdDev = Math.sqrt(horizonSprints) * stats.stdDev;

    const horizonWeeks = horizonSprints * 2;
    results[horizonWeeks] = {};

    for (const p of CONFIG.PERCENTILES) {
      const rawValue = calculateNormalPercentile(horizonMean, horizonStdDev, p);
      const safetyFactor = CONFIG.SAFETY_FACTORS[p];
      // Arrondir et s'assurer qu'on ne dépasse pas le max théorique
      results[horizonWeeks][`p${p}`] = Math.round(Math.max(0, rawValue * safetyFactor));
    }

    results[horizonWeeks].mean = Math.round(horizonMean);
  }

  return {
    success: true,
    results,
    metadata: {
      sprintsAnalyzed: throughputs.length,
      sprintsUsed: dataToUse.length,
      outliers: outlierInfo.outliers,
      outlierIndices: outlierInfo.outlierIndices,
      trend,
      stability,
      stats: {
        mean: Math.round(stats.mean * 10) / 10,
        stdDev: Math.round(stats.stdDev * 10) / 10
      },
      options: { useWeighting, excludeOutliers }
    }
  };
}

// =========================================================================
// PRÉPARATION DES DONNÉES
// =========================================================================

/**
 * Extrait les throughputs par sprint depuis les tickets
 * @param {Object[]} tickets - Tickets du CSV
 * @param {string} metric - 'tickets' ou 'storyPoints'
 * @returns {{ sprints: number[], throughputs: number[] }}
 */
export function extractThroughputs(tickets, metric = 'tickets') {
  // Grouper par sprint (tickets terminés uniquement)
  const sprintMap = new Map();

  tickets.forEach(ticket => {
    if (!ticket.isFinished || !ticket.sprint) return;

    const sprint = ticket.sprint;
    if (!sprintMap.has(sprint)) {
      sprintMap.set(sprint, { tickets: 0, storyPoints: 0 });
    }

    const data = sprintMap.get(sprint);
    data.tickets += 1;
    data.storyPoints += ticket.storyPoints || 0;
  });

  // Trier par sprint et extraire
  const sortedSprints = [...sprintMap.keys()].sort((a, b) => a - b);
  const throughputs = sortedSprints.map(sprint => {
    const data = sprintMap.get(sprint);
    return metric === 'storyPoints' ? data.storyPoints : data.tickets;
  });

  return { sprints: sortedSprints, throughputs };
}

/**
 * Formate les résultats pour l'affichage
 * @param {Object} simulation - Résultat de runSimulation
 * @returns {Object[]} - Données formatées par horizon
 */
export function formatResults(simulation) {
  if (!simulation.success) {
    return [];
  }

  const horizons = Object.keys(simulation.results)
    .map(Number)
    .sort((a, b) => a - b);

  return horizons.map(weeks => {
    const data = simulation.results[weeks];
    return {
      weeks,
      sprints: weeks / 2,
      p50: data.p50,
      p85: data.p85,
      p95: data.p95,
      mean: data.mean
    };
  });
}

// =========================================================================
// EXPORT CONFIG POUR UI
// =========================================================================

export const HORIZONS_LABELS = {
  2: '2 sem. (1 sprint)',
  4: '4 sem. (2 sprints)',
  6: '6 sem. (3 sprints)',
  8: '8 sem. (4 sprints)',
  12: '12 sem. (6 sprints)'
};

export { CONFIG };
