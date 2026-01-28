/**
 * ==========================================================================
 * SPRINTCALCULATOR.JS - Calculs liés aux sprints
 * ==========================================================================
 *
 * Gère la logique de calcul des sprints :
 * - Détermination du sprint actuel
 * - Mapping semaines → sprints
 * - Calcul des dates de sprint
 * - Agrégation des données par sprint
 *
 * CONVENTION :
 * - Les sprints durent 2 semaines
 * - Les sprints commencent en semaine paire (W02, W04, W06...)
 * - Le sprint N correspond aux semaines 2N et 2N+1
 *
 * USAGE :
 *   import { getCurrentSprint, getSprintWeeks } from './sprintCalculator.js';
 *
 *   const sprint = getCurrentSprint(); // { number: 2, weeks: [2, 3], ... }
 *   const weeks = getSprintWeeks(5);   // [10, 11]
 *
 * ==========================================================================
 */

import config from '../core/config.js';

// =========================================================================
// CALCULS DE BASE
// =========================================================================

/**
 * Récupère le numéro de semaine ISO d'une date
 * @param {Date} date - Date à analyser
 * @returns {number} Numéro de semaine (1-53)
 *
 * @example
 * getWeekNumber(new Date('2026-01-15')); // 3
 */
export function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Récupère l'année ISO d'une date (peut différer de l'année calendaire)
 * @param {Date} date - Date à analyser
 * @returns {number} Année ISO
 */
export function getISOYear(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  return d.getUTCFullYear();
}

/**
 * Calcule le numéro de sprint à partir d'un numéro de semaine
 * @param {number} weekNumber - Numéro de semaine (1-53)
 * @returns {number} Numéro de sprint
 *
 * Logique :
 * - W01 → Sprint 1 (semaine partielle)
 * - W02-W03 → Sprint 1
 * - W04-W05 → Sprint 2
 * - etc.
 *
 * @example
 * getSprintFromWeek(2); // 1 (semaine 2 est dans le sprint 1)
 * getSprintFromWeek(3); // 1 (semaine 3 est aussi dans le sprint 1)
 * getSprintFromWeek(4); // 2 (semaine 4 est dans le sprint 2)
 */
export function getSprintFromWeek(weekNumber) {
  // W01 est souvent une semaine partielle, on la rattache au sprint 1
  if (weekNumber === 1) {
    return 1;
  }

  // Pour les autres semaines :
  // Sprint N = semaines 2N et 2N+1
  // Donc semaine W → Sprint = floor(W / 2)
  // W02-W03 → Sprint 1
  // W04-W05 → Sprint 2
  // etc.
  return Math.floor(weekNumber / 2);
}

/**
 * Récupère les deux semaines qui composent un sprint
 * @param {number} sprintNumber - Numéro du sprint
 * @returns {[number, number]} Tuple [semaineDebut, semaineFin]
 *
 * @example
 * getSprintWeeks(1);  // [2, 3]
 * getSprintWeeks(2);  // [4, 5]
 * getSprintWeeks(26); // [52, 1] (chevauchement d'année)
 */
export function getSprintWeeks(sprintNumber) {
  const startWeek = sprintNumber * 2;
  let endWeek = startWeek + 1;

  // Gérer le cas où on dépasse 52/53 semaines
  if (endWeek > 52) {
    endWeek = endWeek - 52;
  }

  return [startWeek, endWeek];
}

// =========================================================================
// SPRINT ACTUEL
// =========================================================================

/**
 * Détermine le sprint actuel basé sur la date du jour
 * @param {Date} [date=new Date()] - Date de référence
 * @returns {Object} Informations sur le sprint actuel
 *
 * @example
 * getCurrentSprint();
 * // {
 * //   number: 2,
 * //   name: 'Sprint 2',
 * //   weeks: [4, 5],
 * //   startDate: Date,
 * //   endDate: Date,
 * //   formatted: '20 janvier - 2 février 2026',
 * //   isStartWeek: false,
 * //   isEndWeek: true,
 * //   weekInSprint: 2
 * // }
 */
export function getCurrentSprint(date = new Date()) {
  const weekNumber = getWeekNumber(date);
  const year = getISOYear(date);
  const sprintNumber = getSprintFromWeek(weekNumber);
  const [startWeek, endWeek] = getSprintWeeks(sprintNumber);

  // Calculer les dates de début et fin
  const startDate = getDateFromWeek(startWeek, year);
  const endDate = new Date(getDateFromWeek(endWeek, year));
  endDate.setDate(endDate.getDate() + 6); // Fin de la semaine (dimanche)

  // Déterminer la position dans le sprint
  const isStartWeek = weekNumber === startWeek;
  const isEndWeek = weekNumber === endWeek;
  const weekInSprint = isStartWeek ? 1 : 2;

  return {
    number: sprintNumber,
    name: `Sprint ${sprintNumber}`,
    weeks: [startWeek, endWeek],
    startDate,
    endDate,
    year,
    formatted: formatSprintDates(startDate, endDate),
    isStartWeek,
    isEndWeek,
    weekInSprint,
    currentWeek: weekNumber
  };
}

/**
 * Récupère la date de début d'une semaine ISO
 * @param {number} weekNumber - Numéro de semaine
 * @param {number} year - Année
 * @returns {Date} Date du lundi de cette semaine
 */
export function getDateFromWeek(weekNumber, year) {
  // Le 4 janvier est toujours dans la semaine 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;

  // Trouver le lundi de la semaine 1
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - dayOfWeek + 1);

  // Ajouter les semaines
  const targetDate = new Date(week1Monday);
  targetDate.setDate(week1Monday.getDate() + (weekNumber - 1) * 7);

  return targetDate;
}

/**
 * Formate les dates d'un sprint pour affichage
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @returns {string} Dates formatées "6 - 19 janvier 2026" ou "23 déc - 5 jan 2026"
 */
export function formatSprintDates(startDate, endDate) {
  const locale = config.locale || 'fr-FR';

  const startDay = startDate.getDate();
  const endDay = endDate.getDate();

  const startMonth = startDate.toLocaleDateString(locale, { month: 'long' });
  const endMonth = endDate.toLocaleDateString(locale, { month: 'long' });

  const startYear = startDate.getFullYear();
  const endYear = endDate.getFullYear();

  // Même mois
  if (startDate.getMonth() === endDate.getMonth() && startYear === endYear) {
    return `${startDay} - ${endDay} ${startMonth} ${startYear}`;
  }

  // Même année
  if (startYear === endYear) {
    return `${startDay} ${startMonth} - ${endDay} ${endMonth} ${endYear}`;
  }

  // Années différentes
  return `${startDay} ${startMonth} ${startYear} - ${endDay} ${endMonth} ${endYear}`;
}

// =========================================================================
// HISTORIQUE DES SPRINTS
// =========================================================================

/**
 * Génère l'historique des N derniers sprints
 * @param {number} count - Nombre de sprints à générer
 * @param {Date} [fromDate=new Date()] - Date de référence
 * @returns {Array<Object>} Liste des sprints
 *
 * @example
 * getSprintHistory(6);
 * // [{ number: 2, year: 2026, ... }, { number: 1, year: 2026, ... }, { number: 26, year: 2025, ... }, ...]
 */
export function getSprintHistory(count = 6, fromDate = new Date()) {
  const current = getCurrentSprint(fromDate);
  const sprints = [];

  let currentSprintNum = current.number;
  let currentYear = current.year;
  const maxSprintsPerYear = 26; // ~52 semaines / 2

  for (let i = 0; i < count; i++) {
    const sprintNumber = currentSprintNum - i;
    let year = currentYear;

    // Calculer le sprint réel en tenant compte du passage d'année
    let actualSprintNumber = sprintNumber;
    if (sprintNumber < 1) {
      // Passage à l'année précédente
      const yearsBack = Math.ceil(Math.abs(sprintNumber - 1) / maxSprintsPerYear) + (sprintNumber <= 0 ? 1 : 0);
      year = currentYear - yearsBack;
      actualSprintNumber = maxSprintsPerYear + sprintNumber + ((yearsBack - 1) * maxSprintsPerYear);
      if (actualSprintNumber <= 0) {
        actualSprintNumber = maxSprintsPerYear + actualSprintNumber;
      }
    }

    const [startWeek, endWeek] = getSprintWeeks(actualSprintNumber);

    const startDate = getDateFromWeek(startWeek, year);
    const endDate = new Date(getDateFromWeek(endWeek, year));
    endDate.setDate(endDate.getDate() + 6);

    sprints.push({
      number: actualSprintNumber,
      name: `Sprint ${actualSprintNumber}`,
      weeks: [startWeek, endWeek],
      startDate,
      endDate,
      year,
      formatted: formatSprintDates(startDate, endDate),
      isCurrent: actualSprintNumber === current.number && year === current.year
    });
  }

  return sprints;
}

/**
 * Récupère le sprint précédent
 * @param {Date} [fromDate=new Date()] - Date de référence
 * @returns {Object} Informations sur le sprint précédent
 */
export function getPreviousSprint(fromDate = new Date()) {
  const current = getCurrentSprint(fromDate);
  const previousNumber = current.number - 1;

  if (previousNumber < 1) {
    // Retourner le dernier sprint de l'année précédente
    // Simplifié pour l'instant
    return null;
  }

  const [startWeek, endWeek] = getSprintWeeks(previousNumber);
  const startDate = getDateFromWeek(startWeek, current.year);
  const endDate = new Date(getDateFromWeek(endWeek, current.year));
  endDate.setDate(endDate.getDate() + 6);

  return {
    number: previousNumber,
    name: `Sprint ${previousNumber}`,
    weeks: [startWeek, endWeek],
    startDate,
    endDate,
    year: current.year,
    formatted: formatSprintDates(startDate, endDate)
  };
}

// =========================================================================
// AGRÉGATION DES DONNÉES
// =========================================================================

/**
 * Agrège des données hebdomadaires en données de sprint
 * @param {Array<Object>} weeklyData - Données par semaine (avec propriété week.weekNumber et week.year)
 * @param {number} sprintNumber - Numéro du sprint
 * @param {Function} aggregator - Fonction d'agrégation
 * @param {number} [year] - Année du sprint (optionnel, si non fourni ignore l'année)
 * @returns {Object|null} Données agrégées ou null si pas de données
 *
 * @example
 * aggregateWeeklyToSprint(throughputData, 2, (items) => {
 *   return items.reduce((sum, i) => sum + i.issuesClosed, 0);
 * }, 2025);
 */
export function aggregateWeeklyToSprint(weeklyData, sprintNumber, aggregator, year = null) {
  const [week1, week2] = getSprintWeeks(sprintNumber);

  // Filtrer les données des deux semaines du sprint
  const sprintData = weeklyData.filter(item => {
    if (!item.week) return false;
    const weekNum = item.week.weekNumber;
    const weekYear = item.week.year;

    const weekMatches = weekNum === week1 || weekNum === week2;

    // Si une année est spécifiée, vérifier aussi l'année
    if (year !== null && weekYear) {
      return weekMatches && weekYear === year;
    }

    return weekMatches;
  });

  if (sprintData.length === 0) {
    return null;
  }

  return aggregator(sprintData);
}

/**
 * Agrège des données pour plusieurs sprints
 * @param {Array<Object>} weeklyData - Données par semaine
 * @param {Array<number>} sprintNumbers - Numéros des sprints
 * @param {Function} aggregator - Fonction d'agrégation
 * @returns {Array<Object>} Données agrégées par sprint
 */
export function aggregateMultipleSprints(weeklyData, sprintNumbers, aggregator) {
  return sprintNumbers.map(sprintNumber => ({
    sprint: sprintNumber,
    data: aggregateWeeklyToSprint(weeklyData, sprintNumber, aggregator)
  })).filter(item => item.data !== null);
}

// =========================================================================
// FONCTIONS UTILITAIRES SIMPLIFIÉES
// =========================================================================

/**
 * Récupère le numéro du sprint actuel
 * @returns {number}
 */
export function getCurrentSprintNumber() {
  return getCurrentSprint().number;
}

/**
 * Récupère les dates d'un sprint par son numéro
 * @param {number} sprintNumber
 * @returns {Object} { startDate, endDate, startFormatted, endFormatted }
 */
export function getSprintDates(sprintNumber) {
  const year = new Date().getFullYear();
  const [startWeek, endWeek] = getSprintWeeks(sprintNumber);

  const startDate = getDateFromWeek(startWeek, year);
  const endDate = new Date(getDateFromWeek(endWeek, year));
  endDate.setDate(endDate.getDate() + 6);

  const locale = config.locale || 'fr-FR';

  return {
    startDate,
    endDate,
    startFormatted: startDate.toLocaleDateString(locale, { day: 'numeric', month: 'long' }),
    endFormatted: endDate.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
  };
}

// =========================================================================
// EXTRACTION DE SPRINTS DEPUIS LES DONNÉES
// =========================================================================

/**
 * Extrait les sprints uniques présents dans les données hebdomadaires
 * @param {Array<Object>} weeklyData - Données par semaine (avec propriété week)
 * @returns {Array<Object>} Liste des sprints triés par date décroissante
 */
export function extractSprintsFromData(weeklyData) {
  console.log('[sprintCalculator] extractSprintsFromData appelé avec', weeklyData?.length, 'items');

  if (!weeklyData || !Array.isArray(weeklyData)) {
    console.warn('[sprintCalculator] weeklyData invalide:', weeklyData);
    return [];
  }

  const sprintsMap = new Map();

  weeklyData.forEach((item, index) => {
    if (!item.week) {
      console.log(`[sprintCalculator] Item ${index} sans week:`, item);
      return;
    }

    const weekNum = item.week.weekNumber;
    const year = item.week.year;

    if (!weekNum || !year) {
      console.log(`[sprintCalculator] Item ${index} week invalide:`, item.week);
      return;
    }

    const sprintNumber = getSprintFromWeek(weekNum);
    const key = `${year}-${sprintNumber}`;

    console.log(`[sprintCalculator] W${weekNum} ${year} → Sprint ${sprintNumber}`);

    if (!sprintsMap.has(key)) {
      const [startWeek, endWeek] = getSprintWeeks(sprintNumber);
      const startDate = getDateFromWeek(startWeek, year);
      const endDate = new Date(getDateFromWeek(endWeek, year));
      endDate.setDate(endDate.getDate() + 6);

      sprintsMap.set(key, {
        number: sprintNumber,
        name: `Sprint ${sprintNumber}`,
        weeks: [startWeek, endWeek],
        startDate,
        endDate,
        year,
        formatted: formatSprintDates(startDate, endDate),
        isCurrent: false
      });
    }
  });

  // Convertir en tableau et trier par date décroissante
  const result = Array.from(sprintsMap.values()).sort((a, b) => {
    if (a.year !== b.year) return b.year - a.year;
    return b.number - a.number;
  });

  console.log('[sprintCalculator] Sprints extraits:', result.map(s => `${s.name} (${s.year})`));
  return result;
}

/**
 * Génère un historique de sprints basé sur les données disponibles
 * Combine les sprints extraits des données avec un minimum de sprints récents
 * @param {Array<Object>} weeklyData - Données par semaine
 * @param {number} minCount - Nombre minimum de sprints à retourner
 * @param {Date} [fromDate=new Date()] - Date de référence
 * @returns {Array<Object>} Liste des sprints
 */
export function getSprintHistoryFromData(weeklyData, minCount = 6, fromDate = new Date()) {
  // Extraire les sprints des données
  const dataSprintsArray = extractSprintsFromData(weeklyData);

  // Si pas de données, utiliser l'historique standard
  if (dataSprintsArray.length === 0) {
    return getSprintHistory(minCount, fromDate);
  }

  // Limiter au nombre demandé
  return dataSprintsArray.slice(0, minCount);
}

// =========================================================================
// EXPORT GLOBAL
// =========================================================================

export default {
  getWeekNumber,
  getISOYear,
  getSprintFromWeek,
  getSprintWeeks,
  getCurrentSprint,
  getCurrentSprintNumber,
  getSprintDates,
  getDateFromWeek,
  formatSprintDates,
  getSprintHistory,
  getSprintHistoryFromData,
  extractSprintsFromData,
  getPreviousSprint,
  aggregateWeeklyToSprint,
  aggregateMultipleSprints
};
