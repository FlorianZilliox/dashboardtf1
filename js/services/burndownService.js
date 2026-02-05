/**
 * ==========================================================================
 * BURNDOWNSERVICE.JS - Service de calcul du Burndown Chart
 * ==========================================================================
 *
 * Calcule les données nécessaires pour afficher un burndown chart :
 * - SP restants jour par jour
 * - Ligne idéale (progression linéaire)
 *
 * ==========================================================================
 */

import { getSprintDates } from '../utils/sprintDates.js';

// =========================================================================
// CALCUL DU BURNDOWN
// =========================================================================

/**
 * Calcule les données du burndown chart pour un sprint
 * Prend en compte les ajouts mid-sprint (bosses vers le haut)
 * @param {Array} tickets - Liste des tickets parsés
 * @param {number} sprintNumber - Numéro du sprint
 * @returns {Object} - Données pour le graphique
 */
export function calculateBurndown(tickets, sprintNumber) {
  if (!tickets || tickets.length === 0 || !sprintNumber) {
    return null;
  }

  // 1. Filtrer les tickets embarqués dans ce sprint
  const sprintTickets = tickets.filter(t =>
    t.sprints && t.sprints.includes(sprintNumber)
  );

  if (sprintTickets.length === 0) {
    return null;
  }

  // 2. Obtenir les dates du sprint depuis la convention fixe (sprintDates.js)
  const { start: sprintStart, end: sprintEnd } = getSprintDates(sprintNumber);

  // Générer les 14 jours du sprint
  const SPRINT_DURATION = 14;
  const days = [];
  for (let i = 0; i < SPRINT_DURATION; i++) {
    const day = new Date(sprintStart);
    day.setDate(day.getDate() + i);
    days.push(day);
  }

  // Générer les labels (format dd/mm)
  const labels = days.map(d =>
    d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' })
  );

  // 3. Séparer tickets initiaux vs ajouts mid-sprint
  // RÈGLE (alignée sur csvParserV2) :
  // - Un ticket est "mid-sprint" s'il est dans UN SEUL sprint (isSingleSprint)
  //   ET créé APRÈS le début du sprint
  // - Tous les autres tickets sont considérés comme "initiaux"
  //   (même si créés pendant le sprint mais venant d'autres sprints)
  const initialTickets = [];
  const midSprintAdditions = [];

  sprintTickets.forEach(t => {
    const createdDate = t.createdDate ? new Date(t.createdDate) : null;
    if (createdDate) {
      createdDate.setHours(0, 0, 0, 0);
    }

    // Mid-sprint = ticket single-sprint créé APRÈS le début du sprint
    const isSingleSprint = t.isSingleSprint || (t.sprints && t.sprints.length === 1);
    const isCreatedAfterStart = createdDate && createdDate > sprintStart;

    if (isSingleSprint && isCreatedAfterStart) {
      midSprintAdditions.push(t);
    } else {
      initialTickets.push(t);
    }
  });

  // 3. SP initiaux (engagement au début du sprint)
  const initialSP = initialTickets.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const totalSP = sprintTickets.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const totalTickets = sprintTickets.length;

  // 4. Calculer SP restants jour par jour avec ajouts mid-sprint
  const burndownSP = days.map((day, dayIndex) => {
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);

    // SP ajoutés jusqu'à ce jour (cumulatif)
    const addedSP = midSprintAdditions
      .filter(t => {
        if (!t.createdDate) return false;
        const created = new Date(t.createdDate);
        created.setHours(0, 0, 0, 0);
        return created <= startOfDay;
      })
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    // SP fermés jusqu'à ce jour (cumulatif)
    const closedSP = sprintTickets
      .filter(t => {
        if (!t.isFinished || !t.closedDate) return false;
        const closed = new Date(t.closedDate);
        return closed <= endOfDay;
      })
      .reduce((sum, t) => sum + (t.storyPoints || 0), 0);

    // SP restants = Initial + Ajouts - Fermés
    return initialSP + addedSP - closedSP;
  });

  // 5. Calculer tickets restants jour par jour
  const initialTicketCount = initialTickets.length;
  const burndownTickets = days.map((day) => {
    const endOfDay = new Date(day);
    endOfDay.setHours(23, 59, 59, 999);

    const startOfDay = new Date(day);
    startOfDay.setHours(0, 0, 0, 0);

    // Tickets ajoutés jusqu'à ce jour
    const addedCount = midSprintAdditions.filter(t => {
      if (!t.createdDate) return false;
      const created = new Date(t.createdDate);
      created.setHours(0, 0, 0, 0);
      return created <= startOfDay;
    }).length;

    // Tickets fermés jusqu'à ce jour
    const closedCount = sprintTickets.filter(t => {
      if (!t.isFinished || !t.closedDate) return false;
      const closed = new Date(t.closedDate);
      return closed <= endOfDay;
    }).length;

    return initialTicketCount + addedCount - closedCount;
  });

  // 6. Ligne idéale (basée sur l'engagement initial, pas le total final)
  const idealSP = days.map((_, i) =>
    Math.round(initialSP * (1 - i / (days.length - 1)) * 10) / 10
  );

  const idealTickets = days.map((_, i) =>
    Math.round(initialTicketCount * (1 - i / (days.length - 1)) * 10) / 10
  );

  // 7. Statistiques
  const spDelivered = totalSP - burndownSP[burndownSP.length - 1];
  const ticketsDelivered = totalTickets - burndownTickets[burndownTickets.length - 1];
  const completionRate = totalSP > 0 ? Math.round((spDelivered / totalSP) * 100) : 0;

  // SP ajoutés mid-sprint
  const midSprintSP = midSprintAdditions.reduce((sum, t) => sum + (t.storyPoints || 0), 0);

  console.log(`[BurndownService] Sprint ${sprintNumber}: ${labels[0]} → ${labels[labels.length - 1]} | ${initialSP} SP initiaux + ${midSprintSP} mid-sprint → ${spDelivered} livrés (${completionRate}%)`);

  return {
    sprintNumber,
    labels,
    days,  // Array de Date pour identifier les weekends
    startDate: sprintStart,
    endDate: sprintEnd,

    // Données SP
    actualSP: burndownSP,
    idealSP: idealSP,
    initialSP,
    totalSP,
    spDelivered,
    midSprintSP,

    // Données Tickets
    actualTickets: burndownTickets,
    idealTickets: idealTickets,
    initialTicketCount,
    totalTickets,
    ticketsDelivered,
    midSprintAdditions: midSprintAdditions.length,

    // Stats
    completionRate
  };
}

// =========================================================================
// EXPORT
// =========================================================================

export default {
  calculateBurndown
};
