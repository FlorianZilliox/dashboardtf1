/**
 * ==========================================================================
 * DATATRANSFORMERV2.JS - Transformation des données CSV V2 (ticket-level)
 * ==========================================================================
 *
 * Transforme les données ticket-level en format compatible avec les graphiques.
 * Utilise les données individuelles pour calculer médiane et percentiles réels.
 *
 * LOGIQUE SPRINT :
 * - Sprint = 2 semaines consécutives
 * - Les sprints commencent sur les semaines PAIRES (W2, W4, W6...)
 * - Sprint Review = le lundi suivant la fin du sprint
 * - On affiche les 6 derniers sprints COMPLETS
 *
 * ==========================================================================
 */

import { aggregateBySprint, calculateStats, aggregateTimeInStatus } from './csvParserV2.js';
import monteCarloService from './monteCarloService.js';

// =========================================================================
// PEARSON CORRELATION
// =========================================================================

/**
 * Calcule le coefficient de corrélation de Pearson entre deux séries
 * @param {number[]} x - Première série (ex: story points)
 * @param {number[]} y - Deuxième série (ex: cycle time)
 * @returns {number|null} - Coefficient entre -1 et 1, ou null si calcul impossible
 */
function calculatePearsonCorrelation(x, y) {
  if (!x || !y || x.length !== y.length || x.length < 2) {
    return null;
  }

  const n = x.length;

  // Moyennes
  const meanX = x.reduce((sum, val) => sum + val, 0) / n;
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  // Calcul des composantes
  let numerator = 0;
  let sumSquaredX = 0;
  let sumSquaredY = 0;

  for (let i = 0; i < n; i++) {
    const diffX = x[i] - meanX;
    const diffY = y[i] - meanY;
    numerator += diffX * diffY;
    sumSquaredX += diffX * diffX;
    sumSquaredY += diffY * diffY;
  }

  const denominator = Math.sqrt(sumSquaredX * sumSquaredY);

  if (denominator === 0) {
    return null; // Pas de variance, corrélation indéfinie
  }

  return numerator / denominator;
}

// =========================================================================
// UTILITAIRES SPRINT
// =========================================================================

/**
 * Détermine le sprint en cours (tickets non terminés avec le sprint le plus élevé)
 * @param {Array} tickets
 * @returns {number|null}
 */
function getCurrentSprintNumber(tickets) {
  // Tickets non terminés (en cours ou à faire)
  const openTicketSprints = tickets
    .filter(t => !t.isFinished && t.sprint)
    .map(t => t.sprint);

  if (openTicketSprints.length > 0) {
    return Math.max(...openTicketSprints);
  }

  // Fallback: prendre le sprint max des tickets terminés + 1
  const finishedSprints = tickets
    .filter(t => t.isFinished && t.sprint)
    .map(t => t.sprint);

  if (finishedSprints.length > 0) {
    return Math.max(...finishedSprints) + 1;
  }

  return null;
}

/**
 * Filtre les sprints pour ne garder que les 6 sprints jusqu'au sprint sélectionné
 * @param {Array} sprintData - Données agrégées par sprint
 * @param {number} targetSprint - Numéro du sprint cible (inclus)
 * @returns {Array}
 */
function filterSprintsUpTo(sprintData, targetSprint) {
  // Inclure le sprint cible et les 5 précédents
  const upToTarget = sprintData.filter(s => s.sprint <= targetSprint);

  // Prendre les 6 derniers
  return upToTarget.slice(-6);
}

/**
 * Retourne la liste des sprints disponibles (complets uniquement)
 * @param {Array} tickets
 * @returns {Array} - [{ sprint: number, label: string }]
 */
export function getAvailableSprints(tickets) {
  if (!tickets || tickets.length === 0) {
    return [];
  }

  const currentSprint = getCurrentSprintNumber(tickets);
  const sprintData = aggregateBySprint(tickets);

  // Exclure le sprint en cours
  const completed = sprintData
    .filter(s => s.sprint < currentSprint)
    .map(s => ({ sprint: s.sprint, label: s.label }));

  return completed;
}

// =========================================================================
// TRANSFORMATION PRINCIPALE
// =========================================================================

/**
 * Transforme toutes les données V2
 * @param {Object} rawData - { tickets, timeInStatus }
 * @param {number|null} selectedSprint - Numéro du sprint sélectionné (optionnel)
 * @param {string[]} selectedTeams - Équipes sélectionnées pour le filtrage Time in Status
 * @returns {Object} - Format compatible avec les graphiques V1
 */
export function transformAllDataV2(rawData, selectedSprint = null, selectedTeams = []) {
  const result = {
    throughput: null,
    cycleTime: null,
    timeInStatus: null,
    bugs: null,
    storyPoints: null,  // Story Points calculés depuis le CSV
    wip: null,          // WIP individuel moyen
    correlation: null   // Corrélation Pearson SP/Cycle Time
  };

  if (!rawData.tickets || rawData.tickets.length === 0) {
    return result;
  }

  // Déterminer le sprint en cours (pour exclure les sprints incomplets)
  const currentSprint = getCurrentSprintNumber(rawData.tickets);

  // Agréger les tickets par sprint
  const sprintData = aggregateBySprint(rawData.tickets);

  // Déterminer le sprint cible (sélectionné ou dernier complet par défaut)
  const targetSprint = selectedSprint || (currentSprint - 1);

  // Filtrer pour ne garder que les 6 sprints jusqu'au sprint cible
  const displayedSprints = filterSprintsUpTo(sprintData, targetSprint);

  // Debug info
  console.log('[V2 Transformer] Sprint en cours:', currentSprint);
  console.log('[V2 Transformer] Sprint cible:', targetSprint);
  console.log('[V2 Transformer] Sprints disponibles:', sprintData.map(s => s.label));
  console.log('[V2 Transformer] Sprints affichés:', displayedSprints.map(s => s.label));

  // Throughput
  result.throughput = transformThroughputV2(displayedSprints);

  // Cycle Time
  result.cycleTime = transformCycleTimeV2(displayedSprints);

  // Bugs
  result.bugs = transformBugsV2(displayedSprints, rawData.tickets);

  // Story Points (calculés depuis le CSV avec Monte Carlo pour la vélocité recommandée)
  result.storyPoints = transformStoryPointsV2(displayedSprints, rawData.tickets);

  // Time in Status (nouveau format avec filtrage par équipe/sprint)
  if (rawData.timeInStatus) {
    result.timeInStatus = transformTimeInStatusV2(rawData.timeInStatus, selectedTeams, targetSprint);
  }

  // WIP individuel moyen
  result.wip = transformWipV2(displayedSprints, rawData.tickets);

  // Corrélation Pearson Story Points / Cycle Time
  result.correlation = transformCorrelationV2(displayedSprints, rawData.tickets);

  return result;
}

// =========================================================================
// THROUGHPUT
// =========================================================================

function transformThroughputV2(sprintData) {
  // Les données sont déjà agrégées par sprint
  const sprints = sprintData.map(s => ({
    label: s.label,
    value: s.closed,
    storyPoints: s.storyPointsDelivered || 0, // Story Points livrés
    totalTickets: s.totalTickets || 0, // Tous les tickets embarqués (fermés ou non)
    midSprintAdditions: s.midSprintAdditions || []
  }));

  // KPI: dernier sprint vs avant-dernier
  const currentSprintValue = sprints.length > 0 ? sprints[sprints.length - 1].value : 0;
  const previousSprintValue = sprints.length > 1 ? sprints[sprints.length - 2].value : 0;

  let trend = 0;
  if (previousSprintValue > 0) {
    trend = Math.round(((currentSprintValue - previousSprintValue) / previousSprintValue) * 100);
  }

  // Benchmark = moyenne par sprint sur la période affichée
  const totalClosedInPeriod = sprints.reduce((sum, s) => sum + s.value, 0);
  const sprintCount = sprints.length || 1;
  const benchmark = Math.round(totalClosedInPeriod / sprintCount);

  // Dernier sprint
  const lastSprint = sprints.length > 0 ? sprints[sprints.length - 1] : null;
  const lastSprintAdditions = lastSprint?.midSprintAdditions || [];
  const lastSprintTotalTickets = lastSprint?.totalTickets || 0;

  console.log('[V2 Throughput] Dernier sprint complet:', lastSprint?.label, '=', currentSprintValue, 'terminés /', lastSprintTotalTickets, 'embarqués');
  console.log('[V2 Throughput] Benchmark (moyenne sur', sprintCount, 'sprints):', benchmark);
  console.log('[V2 Throughput] Ajouts mid-sprint:', lastSprintAdditions.length, 'tickets');

  return {
    currentValue: currentSprintValue,
    previousValue: previousSprintValue,
    trend: trend,
    weeks: sprints.map(s => s.label),
    values: sprints.map(s => s.value),
    storyPointsValues: sprints.map(s => s.storyPoints), // Story Points par sprint
    benchmark: benchmark,
    history: sprints,
    midSprintAdditions: lastSprintAdditions,
    midSprintCount: lastSprintAdditions.length,
    totalTickets: lastSprintTotalTickets // Total tickets embarqués dans le sprint
  };
}

// =========================================================================
// CYCLE TIME
// =========================================================================

function transformCycleTimeV2(sprintData) {
  // Calculer les stats pour chaque sprint
  const sprints = sprintData.map(s => {
    const stats = calculateStats(s.cycleTimes, s.label);
    return {
      label: s.label,
      value: stats.avg,  // Utiliser la moyenne (plus représentatif pour le management)
      median: stats.median,
      avg: stats.avg,
      p85: stats.p85,
      cycleTimes: s.cycleTimes
    };
  });

  // Stats du dernier sprint
  const lastSprint = sprints[sprints.length - 1];
  const sprintMedian = lastSprint?.median || 0;
  const sprintAvg = lastSprint?.avg || 0;

  // KPI: dernier sprint vs avant-dernier (utiliser la moyenne)
  const currentValue = sprints.length > 0 ? sprints[sprints.length - 1].avg : 0;
  const previousValue = sprints.length > 1 ? sprints[sprints.length - 2].avg : 0;

  // Benchmarks sur les 6 sprints affichés
  const allSprintCycleTimes = sprints.flatMap(s => s.cycleTimes || []);
  const periodStats = calculateStats(allSprintCycleTimes);

  // Trend (%) - pour cycle time, positif = détérioration
  let trend = 0;
  if (previousValue > 0) {
    trend = Math.round(((currentValue - previousValue) / previousValue) * 100);
  }

  console.log('[V2 CycleTime] Dernier sprint complet:', lastSprint?.label, '- avg:', sprintAvg, 'jours, médiane:', sprintMedian, 'jours');
  console.log('[V2 CycleTime] Sur', sprints.length, 'sprints - avg:', periodStats.avg, 'median:', periodStats.median, 'p85:', periodStats.p85);
  console.log('[V2 CycleTime] Cycle times par sprint:', sprints.map(s => ({ label: s.label, count: s.cycleTimes?.length || 0, avg: s.avg, median: s.median })));

  return {
    currentValue: currentValue,  // Maintenant c'est la moyenne
    sprintAvg: sprintAvg,
    sprintMedian: sprintMedian,
    previousValue: previousValue,
    trend: trend,
    weeks: sprints.map(s => s.label),
    values: sprints.map(s => s.value),
    benchmarkAvg: periodStats.avg,
    benchmarkMedian: periodStats.median,
    benchmarkP85: periodStats.p85,
    history: sprints
  };
}

// =========================================================================
// BUGS
// =========================================================================

/**
 * Détermine dans quel sprint un bug a été créé selon sa date de création
 * @param {Date} createdDate - Date de création du bug
 * @param {Array} sprintData - Données des sprints avec plages de dates
 * @returns {number|null} - Numéro du sprint ou null
 */
function findSprintForDate(createdDate, sprintData) {
  if (!createdDate) return null;

  for (const sprint of sprintData) {
    // Un bug est créé dans un sprint si sa date est entre minDate et maxDate du sprint
    // On étend légèrement la plage pour inclure les bugs créés juste avant le premier ticket fermé
    const sprintStart = new Date(sprint.minDate);
    sprintStart.setDate(sprintStart.getDate() - 14); // 2 semaines avant

    if (createdDate >= sprintStart && createdDate <= sprint.maxDate) {
      return sprint.sprint;
    }
  }

  return null;
}

function transformBugsV2(sprintData, allTickets) {
  // Compter les bugs créés par sprint selon leur date de création
  const bugsCreatedBySprint = new Map();

  allTickets
    .filter(t => t.type === 'Bug' && t.createdDate)
    .forEach(bug => {
      const sprintNum = findSprintForDate(bug.createdDate, sprintData);
      if (sprintNum !== null) {
        bugsCreatedBySprint.set(sprintNum, (bugsCreatedBySprint.get(sprintNum) || 0) + 1);
      }
    });

  // Construire les données par sprint
  const sprints = sprintData.map(s => {
    const created = bugsCreatedBySprint.get(s.sprint) || 0;
    const bugStats = calculateStats(s.bugs.cycleTimes || []);
    return {
      label: s.label,
      created: created,
      closed: s.bugs.closed,
      net: created - s.bugs.closed,
      avgResolutionTime: bugStats.avg,
      medianResolutionTime: bugStats.median
    };
  });

  // Stock total de bugs (créés - fermés sur toute la période)
  const totalBugs = allTickets.filter(t => t.type === 'Bug');
  const totalCreated = totalBugs.filter(t => t.createdDate).length;
  const totalClosed = totalBugs.filter(t => t.closedDate).length;
  const stock = totalCreated - totalClosed;

  // Temps de résolution moyen sur tous les sprints affichés
  const allBugCycleTimes = sprintData.flatMap(s => s.bugs.cycleTimes || []);
  const periodBugStats = calculateStats(allBugCycleTimes);

  // Bugs du dernier sprint
  const lastSprint = sprints[sprints.length - 1] || { created: 0, closed: 0, avgResolutionTime: 0 };

  console.log('[V2 Bugs] Dernier sprint:', lastSprint.label || 'N/A', '- créés:', lastSprint.created, 'fermés:', lastSprint.closed, 'résolution moy:', lastSprint.avgResolutionTime, 'jours');
  console.log('[V2 Bugs] Stock total:', stock, '| Résolution moyenne sur période:', periodBugStats.avg, 'jours');

  // DORA Metrics
  // MTTR = temps moyen de résolution des bugs (déjà calculé)
  const mttr = lastSprint.avgResolutionTime || 0;
  const mttrMedian = lastSprint.medianResolutionTime || 0;
  const mttrPeriod = periodBugStats.avg || 0;

  // Change Failure Rate = bugs créés / items livrés (sur le sprint)
  // On prend les items livrés du dernier sprint (propriété "closed")
  const lastSprintData = sprintData[sprintData.length - 1];
  const itemsDelivered = lastSprintData ? lastSprintData.closed : 0;
  const changeFailureRate = itemsDelivered > 0
    ? (lastSprint.created / itemsDelivered) * 100
    : 0;

  // Change Failure Rate sur la période (moyenne)
  const totalItemsDelivered = sprintData.reduce((sum, s) => sum + s.closed, 0);
  const totalBugsCreated = sprints.reduce((sum, s) => sum + s.created, 0);
  const changeFailureRatePeriod = totalItemsDelivered > 0
    ? (totalBugsCreated / totalItemsDelivered) * 100
    : 0;

  console.log('[V2 DORA] MTTR sprint:', mttr, 'jours | MTTR période:', mttrPeriod, 'jours');
  console.log('[V2 DORA] Change Failure Rate sprint:', changeFailureRate.toFixed(1), '% | période:', changeFailureRatePeriod.toFixed(1), '%');

  return {
    weeks: sprints.map(s => s.label),
    created: sprints.map(s => s.created),
    closed: sprints.map(s => s.closed),
    stock: stock,
    sprintCreated: lastSprint.created,
    sprintClosed: lastSprint.closed,
    sprintAvgResolutionTime: lastSprint.avgResolutionTime,
    sprintMedianResolutionTime: lastSprint.medianResolutionTime,
    periodAvgResolutionTime: periodBugStats.avg,
    periodMedianResolutionTime: periodBugStats.median,
    history: sprints,
    // DORA Metrics
    mttr: mttr,
    mttrMedian: mttrMedian,
    mttrPeriod: mttrPeriod,
    changeFailureRate: changeFailureRate,
    changeFailureRatePeriod: changeFailureRatePeriod,
    itemsDelivered: itemsDelivered
  };
}

// =========================================================================
// STORY POINTS (calculés depuis le CSV)
// =========================================================================

/**
 * Transforme les données Story Points par sprint
 * @param {Array} sprintData - Données agrégées par sprint
 * @param {Array} tickets - Tous les tickets pour Monte Carlo
 * @returns {Object} - Données Story Points formatées
 */
function transformStoryPointsV2(sprintData, tickets) {
  // Vérifier si on a des story points dans les données
  const hasStoryPoints = sprintData.some(s => s.storyPointsCommitted > 0 || s.storyPointsDelivered > 0);

  if (!hasStoryPoints) {
    console.log('[V2 StoryPoints] Aucun story point trouvé dans les données CSV');
    return null;
  }

  // Construire les données par sprint (format compatible avec le tableau existant)
  const sprints = sprintData.map(s => ({
    label: s.label,
    sprint: s.sprint,
    committed: s.storyPointsCommitted || 0,
    delivered: s.storyPointsDelivered || 0,
    completion: s.storyPointsCommitted > 0
      ? Math.round((s.storyPointsDelivered / s.storyPointsCommitted) * 100)
      : 0
  }));

  // Sprint actuel (dernier)
  const currentSprint = sprints[sprints.length - 1];
  const currentCommitted = currentSprint?.committed || 0;
  const currentDelivered = currentSprint?.delivered || 0;
  const currentCompletion = currentCommitted > 0
    ? Math.round((currentDelivered / currentCommitted) * 100)
    : 0;

  // Sprints précédents (tous sauf le dernier)
  const previousSprints = sprints.slice(0, -1).filter(s => s.committed > 0);

  let avgCommitted = 0;
  let avgDelivered = 0;
  let avgCompletion = 0;

  if (previousSprints.length > 0) {
    avgCommitted = previousSprints.reduce((sum, s) => sum + s.committed, 0) / previousSprints.length;
    avgDelivered = previousSprints.reduce((sum, s) => sum + s.delivered, 0) / previousSprints.length;
    avgCompletion = avgCommitted > 0 ? Math.round((avgDelivered / avgCommitted) * 100) : 0;
  }

  // Vélocité recommandée = P50 Monte Carlo (cohérent avec page Forecast)
  let recommendedVelocity = Math.round(avgDelivered); // Fallback sur moyenne
  let monteCarloP50 = null;

  // Exécuter Monte Carlo si on a assez de données
  const sprintNumbers = sprintData.map(s => s.sprint);
  if (sprintNumbers.length >= 2 && tickets && tickets.length > 0) {
    try {
      const mcAnalysis = monteCarloService.analyzeForecast(tickets, sprintNumbers, {});
      if (mcAnalysis.simulation?.storyPoints?.p50) {
        monteCarloP50 = mcAnalysis.simulation.storyPoints.p50;
        recommendedVelocity = monteCarloP50;
        console.log('[V2 StoryPoints] Monte Carlo P50 story points:', monteCarloP50);
      }
    } catch (error) {
      console.warn('[V2 StoryPoints] Erreur Monte Carlo, fallback sur moyenne:', error.message);
    }
  }

  console.log('[V2 StoryPoints] Sprint actuel:', currentSprint?.label, '- engagés:', currentCommitted, 'livrés:', currentDelivered, 'completion:', currentCompletion + '%');
  console.log('[V2 StoryPoints] Moyenne sur', previousSprints.length, 'sprints précédents - engagés:', avgCommitted.toFixed(1), 'livrés:', avgDelivered.toFixed(1));
  console.log('[V2 StoryPoints] Vélocité recommandée (P50):', recommendedVelocity);

  return {
    // Données brutes par sprint
    sprints,
    weeks: sprints.map(s => s.label),
    committed: sprints.map(s => s.committed),
    delivered: sprints.map(s => s.delivered),

    // Sprint actuel
    currentCommitted,
    currentDelivered,
    currentCompletion,
    currentSprintLabel: currentSprint?.label || '',

    // Moyennes historiques
    avgCommitted,
    avgDelivered,
    avgCompletion,
    previousSprintsCount: previousSprints.length,

    // Vélocité recommandée (P50 Monte Carlo)
    recommendedVelocity,
    isMonteCarloP50: monteCarloP50 !== null,

    // Flag indiquant que les données viennent du CSV
    isFromCSV: true
  };
}

// =========================================================================
// WIP INDIVIDUEL MOYEN (calculé jour par jour pendant le sprint)
// =========================================================================

/**
 * Soustrait N jours ouvrés d'une date (ignore weekends)
 * @param {Date} date - Date de départ
 * @param {number} workdays - Nombre de jours ouvrés à soustraire
 * @returns {Date} - Date résultante
 */
function subtractWorkdays(date, workdays) {
  const result = new Date(date);
  let remaining = workdays;

  while (remaining > 0) {
    result.setDate(result.getDate() - 1);
    const dayOfWeek = result.getDay();
    // Ignorer samedi (6) et dimanche (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }

  return result;
}

/**
 * Vérifie si une date est un jour ouvré (lundi-vendredi)
 * @param {Date} date
 * @returns {boolean}
 */
function isWorkday(date) {
  const day = date.getDay();
  return day !== 0 && day !== 6;
}

/**
 * Génère la liste des jours ouvrés dans une période
 * @param {Date} startDate - Date de début (incluse)
 * @param {Date} endDate - Date de fin (incluse)
 * @returns {Date[]} - Liste des jours ouvrés
 */
function getWorkdaysInRange(startDate, endDate) {
  const workdays = [];
  const current = new Date(startDate);
  current.setHours(0, 0, 0, 0);

  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  while (current <= end) {
    if (isWorkday(current)) {
      workdays.push(new Date(current));
    }
    current.setDate(current.getDate() + 1);
  }

  return workdays;
}

/**
 * Calcule le WIP (Work In Progress) individuel moyen par sprint
 * NOUVELLE MÉTHODE: mesure jour par jour le nombre de tickets en cours par personne
 *
 * @param {Array} sprintData - Données agrégées par sprint
 * @param {Array} allTickets - Tous les tickets
 * @returns {Object} - Données WIP formatées
 */
function transformWipV2(sprintData, allTickets) {
  // Calculer le WIP pour chaque sprint
  const wipBySprint = sprintData.map(sprint => {
    // Déterminer la période du sprint (2 semaines = 10 jours ouvrés)
    // On utilise maxDate comme fin de sprint, et on remonte de 10 jours ouvrés
    const sprintEnd = sprint.maxDate ? new Date(sprint.maxDate) : new Date();
    const sprintStart = subtractWorkdays(sprintEnd, 9); // 10 jours = jour 0 à jour 9

    // Générer tous les jours ouvrés du sprint
    const workdays = getWorkdaysInRange(sprintStart, sprintEnd);

    if (workdays.length === 0) {
      return {
        label: sprint.label,
        sprint: sprint.sprint,
        totalWip: 0,
        contributorCount: 1,
        avgWipPerPerson: 0,
        workdaysAnalyzed: 0
      };
    }

    // Tickets qui ont été travaillés pendant ce sprint
    // = tickets fermés pendant ou après le sprint OU tickets encore ouverts
    // ET qui ont été assignés au sprint
    const relevantTickets = allTickets.filter(t => {
      // Doit être assigné à ce sprint
      if (!t.sprints || !t.sprints.includes(sprint.sprint)) return false;

      // Doit avoir un assigné
      if (!t.assignee) return false;

      return true;
    });

    // Collecter tous les contributeurs actifs du sprint
    const activeContributors = new Set(
      relevantTickets
        .filter(t => t.assignee)
        .map(t => t.assignee)
    );
    const contributorCount = Math.max(activeContributors.size, 1);

    // Pour chaque jour, calculer le WIP par personne
    const dailyWipByPerson = new Map(); // Map<date, Map<person, count>>

    for (const day of workdays) {
      const dayKey = day.toISOString().split('T')[0];
      const wipByPerson = new Map();

      for (const ticket of relevantTickets) {
        // Estimer quand le travail a commencé sur ce ticket
        // workStartDate = closedDate - cycleTime (en jours ouvrés)
        let workStartDate = null;
        let workEndDate = null;

        if (ticket.closedDate && ticket.cycleTime > 0) {
          // Ticket fermé : on connait exactement la période de travail
          workEndDate = new Date(ticket.closedDate);
          workStartDate = subtractWorkdays(workEndDate, Math.ceil(ticket.cycleTime));
        } else if (ticket.closedDate) {
          // Ticket fermé sans cycleTime : on estime à 1 jour
          workEndDate = new Date(ticket.closedDate);
          workStartDate = subtractWorkdays(workEndDate, 1);
        } else if (ticket.createdDate) {
          // Ticket non fermé : en cours depuis sa création (approximation)
          // On utilise la date de création comme début de travail
          workStartDate = new Date(ticket.createdDate);
          workEndDate = new Date(); // Aujourd'hui
        }

        if (!workStartDate || !workEndDate) continue;

        // Normaliser pour comparaison de dates
        const dayTime = day.getTime();
        const startTime = workStartDate.setHours(0, 0, 0, 0);
        const endTime = workEndDate.setHours(23, 59, 59, 999);

        // Le ticket était en WIP ce jour si : startDate <= day <= endDate
        if (dayTime >= startTime && dayTime <= endTime) {
          const person = ticket.assignee;
          wipByPerson.set(person, (wipByPerson.get(person) || 0) + 1);
        }
      }

      dailyWipByPerson.set(dayKey, wipByPerson);
    }

    // Calculer le WIP moyen par personne sur tout le sprint
    let totalWipPersonDays = 0;
    let personDaysCount = 0;

    for (const [dayKey, wipByPerson] of dailyWipByPerson) {
      for (const [person, wip] of wipByPerson) {
        totalWipPersonDays += wip;
        personDaysCount++;
      }
    }

    // WIP moyen = total des WIP / (nb jours * nb personnes actives ce jour)
    // Ou simplement : moyenne du WIP par jour pour l'ensemble de l'équipe
    const avgWipPerPersonPerDay = personDaysCount > 0
      ? totalWipPersonDays / personDaysCount
      : 0;

    // Debug log pour ce sprint
    console.log(`[V2 WIP] ${sprint.label}: ${workdays.length} jours analysés, ${contributorCount} contributeurs, WIP moyen: ${avgWipPerPersonPerDay.toFixed(2)}`);

    return {
      label: sprint.label,
      sprint: sprint.sprint,
      totalWip: Math.round(totalWipPersonDays / workdays.length), // WIP moyen équipe/jour
      contributorCount,
      avgWipPerPerson: Math.round(avgWipPerPersonPerDay * 10) / 10,
      workdaysAnalyzed: workdays.length
    };
  });

  // Moyennes sur la période
  const avgWip = wipBySprint.reduce((sum, s) => sum + s.avgWipPerPerson, 0) / wipBySprint.length;

  // Médiane sur la période
  const sortedWipValues = [...wipBySprint.map(s => s.avgWipPerPerson)].sort((a, b) => a - b);
  const midIndex = Math.floor(sortedWipValues.length / 2);
  const medianWip = sortedWipValues.length % 2 === 0
    ? (sortedWipValues[midIndex - 1] + sortedWipValues[midIndex]) / 2
    : sortedWipValues[midIndex];

  // Tendance (dernier sprint vs moyenne des précédents)
  const lastSprint = wipBySprint[wipBySprint.length - 1];
  const previousAvg = wipBySprint.slice(0, -1).reduce((sum, s) => sum + s.avgWipPerPerson, 0) / Math.max(wipBySprint.length - 1, 1);
  const trend = previousAvg > 0 ? ((lastSprint.avgWipPerPerson - previousAvg) / previousAvg) : 0;

  console.log('[V2 WIP] Par sprint:', wipBySprint.map(s => `${s.label}: ${s.avgWipPerPerson}`).join(', '));
  console.log('[V2 WIP] Moyenne période:', avgWip.toFixed(1), '| Médiane:', medianWip.toFixed(1), '| Dernier sprint:', lastSprint.avgWipPerPerson, '| Tendance:', (trend * 100).toFixed(1) + '%');

  return {
    sprints: wipBySprint.map(s => s.label),
    values: wipBySprint.map(s => s.avgWipPerPerson),
    avgWip: Math.round(avgWip * 10) / 10,
    medianWip: Math.round(medianWip * 10) / 10,
    currentWip: lastSprint.avgWipPerPerson,
    currentContributors: lastSprint.contributorCount,
    trend,
    history: wipBySprint
  };
}

// =========================================================================
// CORRELATION PEARSON (Story Points vs Cycle Time)
// =========================================================================

/**
 * Calcule la corrélation entre Story Points et Cycle Time par sprint
 * Une corrélation proche de 0 suggère que l'estimation ne prédit pas le temps réel
 * @param {Array} sprintData - Données agrégées par sprint
 * @param {Array} allTickets - Tous les tickets
 * @returns {Object} - Données de corrélation
 */
function transformCorrelationV2(sprintData, allTickets) {
  // Identifier le dernier sprint (sprint actuel/sélectionné)
  const lastSprintNum = sprintData.length > 0
    ? sprintData[sprintData.length - 1].sprint
    : null;

  // Sprints précédents affichés
  const previousSprintNums = sprintData.slice(0, -1).map(s => s.sprint);
  const allDisplayedSprintNums = sprintData.map(s => s.sprint);

  // Filtrer les tickets avec la MÊME logique que aggregateBySprint:
  // - isFinished ET closedDate (ticket fermé)
  // - sprint dans les sprints affichés
  // - storyPoints > 0 ET cycleTime > 0 (données nécessaires pour corrélation)
  // - Exclure les bugs (pas de SP généralement)
  const validTickets = allTickets.filter(t =>
    t.isFinished &&
    t.closedDate &&
    t.sprint &&
    allDisplayedSprintNums.includes(t.sprint) &&
    t.storyPoints > 0 &&
    t.cycleTime > 0 &&
    t.type !== 'Bug'
  );

  if (validTickets.length < 3) {
    console.log('[V2 Correlation] Pas assez de données (min 3 tickets avec SP et CT)');
    return null;
  }

  // Tickets du sprint actuel (même logique que throughput)
  const currentSprintTickets = validTickets.filter(t => t.sprint === lastSprintNum);

  // Tickets des sprints précédents
  const previousSprintsTickets = validTickets.filter(t => previousSprintNums.includes(t.sprint));

  // Corrélation du sprint actuel
  let currentCorrelation = null;
  let currentSampleSize = 0;
  if (currentSprintTickets.length >= 3) {
    const spCurrent = currentSprintTickets.map(t => t.storyPoints);
    const ctCurrent = currentSprintTickets.map(t => t.cycleTime);
    currentCorrelation = calculatePearsonCorrelation(spCurrent, ctCurrent);
    currentSampleSize = currentSprintTickets.length;
  }

  // Corrélation des sprints précédents (moyenne des corrélations par sprint)
  let previousCorrelation = null;
  let previousSampleSize = 0;
  const sprintCorrelations = [];

  // Calculer la corrélation pour chaque sprint précédent
  for (const sprintNum of previousSprintNums) {
    const sprintTickets = validTickets.filter(t => t.sprint === sprintNum);
    if (sprintTickets.length >= 3) {
      const sp = sprintTickets.map(t => t.storyPoints);
      const ct = sprintTickets.map(t => t.cycleTime);
      const r = calculatePearsonCorrelation(sp, ct);
      if (r !== null) {
        sprintCorrelations.push({
          sprint: sprintNum,
          correlation: r,
          sampleSize: sprintTickets.length
        });
        previousSampleSize += sprintTickets.length;
      }
    }
  }

  // Moyenne des corrélations (si au moins un sprint a assez de données)
  if (sprintCorrelations.length > 0) {
    const sumCorr = sprintCorrelations.reduce((sum, s) => sum + s.correlation, 0);
    previousCorrelation = sumCorr / sprintCorrelations.length;
    console.log('[V2 Correlation] Corrélations par sprint:', sprintCorrelations.map(s => `Sprint ${s.sprint}: ${s.correlation.toFixed(2)} (${s.sampleSize})`).join(', '));
  }

  // Corrélation globale (tous les tickets)
  const spAll = validTickets.map(t => t.storyPoints);
  const ctAll = validTickets.map(t => t.cycleTime);
  const globalCorrelation = calculatePearsonCorrelation(spAll, ctAll);

  // Interpréter la force de la corrélation
  const interpretCorrelation = (r) => {
    if (r === null) return { level: 'N/A', label: 'Données insuffisantes' };
    const absR = Math.abs(r);
    if (absR >= 0.7) return { level: 'strong', label: 'Forte' };
    if (absR >= 0.4) return { level: 'moderate', label: 'Modérée' };
    if (absR >= 0.2) return { level: 'weak', label: 'Faible' };
    return { level: 'none', label: 'Très faible' };
  };

  const currentInterpretation = interpretCorrelation(currentCorrelation);
  const previousInterpretation = interpretCorrelation(previousCorrelation);

  // Tendance : la corrélation s'améliore-t-elle ?
  let trend = null;
  if (currentCorrelation !== null && previousCorrelation !== null) {
    trend = currentCorrelation - previousCorrelation;
  }

  const lastSprintLabel = sprintData.length > 0 ? sprintData[sprintData.length - 1].label : lastSprintNum;
  console.log('[V2 Correlation] Sprint actuel:', lastSprintLabel, '- r:', currentCorrelation?.toFixed(3) || 'N/A', `(${currentSampleSize} tickets avec SP+CT sur ${sprintData[sprintData.length - 1]?.closed || '?'} fermés)`);
  console.log('[V2 Correlation] Sprints précédents (moyenne):', previousCorrelation?.toFixed(3) || 'N/A', `(${sprintCorrelations.length} sprints avec données, ${previousSampleSize} tickets total)`);
  console.log('[V2 Correlation] Total tickets valides (SP+CT, hors bugs, terminés):', validTickets.length);

  return {
    // Valeurs brutes
    current: currentCorrelation,
    previous: previousCorrelation,
    global: globalCorrelation,

    // Tailles d'échantillon
    currentSampleSize,
    previousSampleSize,
    previousSprintCount: sprintCorrelations.length, // Nombre de sprints avec données
    globalSampleSize: validTickets.length,

    // Détails par sprint (pour debug ou affichage futur)
    sprintCorrelations,

    // Interprétations
    currentInterpretation,
    previousInterpretation,

    // Tendance
    trend,

    // Flag indiquant si on a assez de données
    hasEnoughData: currentCorrelation !== null || previousCorrelation !== null
  };
}

// =========================================================================
// TIME IN STATUS (nouveau format avec filtrage par équipe/sprint)
// =========================================================================

/**
 * Transforme les données Time in Status avec filtrage par équipe et sprint
 * @param {Object} data - Données parsées { tickets, teams, statuses, summary }
 * @param {string[]} selectedTeams - Équipes sélectionnées
 * @param {number} targetSprint - Sprint cible
 * @returns {Object} - Données formatées pour les graphiques
 */
function transformTimeInStatusV2(data, selectedTeams = [], targetSprint = null) {
  // Gérer l'ancien format (array) pour rétrocompatibilité
  if (Array.isArray(data)) {
    console.log('[TimeInStatus V2] Ancien format détecté, conversion...');
    return {
      labels: data.map(s => s.status),
      values12w: data.map(s => s.days12w || 0),
      values2w: data.map(s => s.days2w || 0),
      pct12w: data.map(s => s.pct12w || 0),
      pct2w: data.map(s => s.pct2w || 0)
    };
  }

  // Nouveau format avec tickets individuels
  if (!data || !data.tickets || data.tickets.length === 0) {
    console.log('[TimeInStatus V2] Pas de données Time in Status');
    return null;
  }

  // Agréger avec filtrage par équipe et sprint
  // Pour "6 sprints" = utiliser targetSprint avec range 6
  // Pour "dernier sprint" = utiliser targetSprint avec range 1
  const aggregated6Sprints = aggregateTimeInStatus(data, selectedTeams, targetSprint, 6);
  const aggregatedLastSprint = aggregateTimeInStatus(data, selectedTeams, targetSprint, 1);

  console.log('[TimeInStatus V2] Agrégation 6 sprints:', aggregated6Sprints);
  console.log('[TimeInStatus V2] Agrégation dernier sprint:', aggregatedLastSprint);

  return {
    labels: aggregated6Sprints.labels,
    // 12w = 6 derniers sprints (équivalent)
    values12w: aggregated6Sprints.values,
    pct12w: aggregated6Sprints.pct,
    // 2w = dernier sprint uniquement
    values2w: aggregatedLastSprint.values,
    pct2w: aggregatedLastSprint.pct
  };
}

// =========================================================================
// EXPORT
// =========================================================================

export const transformAllV2 = transformAllDataV2;

export default {
  transformAllDataV2,
  transformAllV2,
  getAvailableSprints
};
