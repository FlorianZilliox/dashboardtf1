/**
 * ==========================================================================
 * SPRINTDATES.JS - Utilitaire de calcul des dates de sprint
 * ==========================================================================
 *
 * Convention :
 * - Les sprints commencent le lundi des semaines paires
 * - Ils durent 2 semaines (14 jours)
 * - Référence : Sprint 18 commence le 2 février 2026
 *
 * ==========================================================================
 */

// =========================================================================
// CONFIGURATION
// =========================================================================

/**
 * Sprint de référence pour le calcul des dates
 * Sprint 18 commence le lundi 2 février 2026 (semaine 6)
 */
const SPRINT_REF = {
  number: 18,
  start: new Date(2026, 1, 2) // mois 0-indexed : 1 = février
};

/**
 * Durée d'un sprint en jours
 */
const SPRINT_DURATION = 14;

// =========================================================================
// FONCTIONS PRINCIPALES
// =========================================================================

/**
 * Calcule les dates de début et fin d'un sprint
 * @param {number} sprintNumber - Numéro du sprint
 * @returns {Object} - { start: Date, end: Date }
 */
export function getSprintDates(sprintNumber) {
  const diffSprints = SPRINT_REF.number - sprintNumber;

  const startDate = new Date(SPRINT_REF.start);
  startDate.setDate(startDate.getDate() - (diffSprints * SPRINT_DURATION));

  const endDate = new Date(startDate);
  endDate.setDate(endDate.getDate() + SPRINT_DURATION - 1);

  return { start: startDate, end: endDate };
}

/**
 * Retourne un array de toutes les dates du sprint (14 jours)
 * @param {number} sprintNumber - Numéro du sprint
 * @returns {Date[]} - Array de 14 dates
 */
export function getSprintDays(sprintNumber) {
  const { start } = getSprintDates(sprintNumber);
  const days = [];

  for (let i = 0; i < SPRINT_DURATION; i++) {
    const day = new Date(start);
    day.setDate(day.getDate() + i);
    days.push(day);
  }

  return days;
}

/**
 * Formate les jours du sprint en labels pour l'axe X
 * @param {number} sprintNumber - Numéro du sprint
 * @returns {string[]} - Array de labels formatés (ex: "19/01", "20/01", ...)
 */
export function getSprintDayLabels(sprintNumber) {
  const days = getSprintDays(sprintNumber);
  return days.map(d =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  );
}

/**
 * Vérifie si une date est dans les bornes d'un sprint
 * @param {Date} date - Date à vérifier
 * @param {number} sprintNumber - Numéro du sprint
 * @returns {boolean}
 */
export function isDateInSprint(date, sprintNumber) {
  const { start, end } = getSprintDates(sprintNumber);

  // Normaliser les dates à minuit pour comparaison
  const normalizedDate = new Date(date);
  normalizedDate.setHours(0, 0, 0, 0);

  const normalizedStart = new Date(start);
  normalizedStart.setHours(0, 0, 0, 0);

  const normalizedEnd = new Date(end);
  normalizedEnd.setHours(23, 59, 59, 999);

  return normalizedDate >= normalizedStart && normalizedDate <= normalizedEnd;
}

/**
 * Trouve le numéro de sprint pour une date donnée
 * @param {Date} date - Date à analyser
 * @returns {number} - Numéro du sprint
 */
export function getSprintNumberForDate(date) {
  const refStart = new Date(SPRINT_REF.start);
  refStart.setHours(0, 0, 0, 0);

  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const diffDays = Math.floor((targetDate - refStart) / (1000 * 60 * 60 * 24));
  const diffSprints = Math.floor(diffDays / SPRINT_DURATION);

  return SPRINT_REF.number + diffSprints;
}

// =========================================================================
// EXPORT
// =========================================================================

export default {
  getSprintDates,
  getSprintDays,
  getSprintDayLabels,
  isDateInSprint,
  getSprintNumberForDate,
  SPRINT_REF,
  SPRINT_DURATION
};
