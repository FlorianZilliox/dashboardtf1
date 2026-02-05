/**
 * ==========================================================================
 * CSVPARSERV2.JS - Parser pour le format ticket-level (V2)
 * ==========================================================================
 *
 * Parse le fichier CSV unifié exporté d'EazyBI avec les données au niveau ticket.
 *
 * FORMATS SUPPORTÉS :
 * - Issue Sprint (singulier) : "Sprint 16" ou "Sprint 16 IAML – 05/01"
 * - Issue Sprints (pluriel) : "Sprint 15,Sprint 16" ou "Sprint 12 IAML – 10/11,Sprint 13 IAML – 24/11"
 * - Les deux colonnes peuvent être présentes, le parser fusionne intelligemment
 * - La valeur "(no sprint)" est ignorée
 *
 * Le parser détecte automatiquement les colonnes et priorise :
 * 1. Issue Sprints (pluriel) - contient l'historique complet
 * 2. Issue Sprint (singulier) - fallback si pluriel vide/absent
 *
 * ==========================================================================
 */

import { getSprintDates } from '../utils/sprintDates.js';

// =========================================================================
// PARSING DU FICHIER UNIFIÉ
// =========================================================================

/**
 * Extrait le numéro de sprint depuis une chaîne comme "Sprint 16" ou "Sprint 16 IAML – 05/01"
 * @param {string} sprintStr
 * @returns {number|null}
 */
function parseSprintNumber(sprintStr) {
  if (!sprintStr || sprintStr.toLowerCase().includes('no sprint')) return null;
  const match = sprintStr.match(/Sprint\s*(\d+)/i);
  return match ? parseInt(match[1], 10) : null;
}

/**
 * Extrait tous les numéros de sprint depuis une chaîne
 * Supporte les formats :
 * - "Sprint 15,Sprint 16"
 * - "Sprint 12 IAML – 10/11,Sprint 13 IAML – 24/11"
 * @param {string} sprintsStr
 * @returns {number[]}
 */
function parseSprintNumbers(sprintsStr) {
  if (!sprintsStr || sprintsStr.toLowerCase().includes('no sprint')) return [];
  const matches = sprintsStr.matchAll(/Sprint\s*(\d+)/gi);
  return [...matches].map(m => parseInt(m[1], 10));
}

/**
 * Détecte les indices des colonnes à partir du header
 * @param {string[]} headerRow - Ligne d'en-tête parsée
 * @returns {Object} - Mapping des colonnes
 */
function detectColumnIndices(headerRow) {
  const indices = {
    key: -1,
    type: -1,
    createdDate: -1,
    status: -1,
    cycleTime: -1,
    closedDate: -1,
    // Support pour les deux formats de colonnes sprint
    sprintsPlural: -1,   // "Issue Sprints" (historique complet)
    sprintSingular: -1,  // "Issue Sprint" (sprint unique)
    // Nouvelles colonnes pour le forecast (optionnelles)
    storyPoints: -1,
    assignee: -1
  };

  headerRow.forEach((col, idx) => {
    const lowerCol = col.toLowerCase().trim();
    if (lowerCol === 'issue key') indices.key = idx;
    else if (lowerCol === 'issue type') indices.type = idx;
    else if (lowerCol.includes('created date')) indices.createdDate = idx;
    else if (lowerCol === 'issue status') indices.status = idx;
    else if (lowerCol.includes('progress workdays')) indices.cycleTime = idx;
    else if (lowerCol.includes('closed date')) indices.closedDate = idx;
    // Colonnes sprint : détecter les deux variantes
    else if (lowerCol === 'issue sprints' || lowerCol === 'sprints') indices.sprintsPlural = idx;
    else if (lowerCol === 'issue sprint' || lowerCol === 'sprint') indices.sprintSingular = idx;
    // Nouvelles colonnes pour le forecast
    else if (lowerCol === 'issue story points' || lowerCol === 'story points') indices.storyPoints = idx;
    else if (lowerCol === 'issue assignee' || lowerCol === 'assignee') indices.assignee = idx;
  });

  console.log('[CSV Parser] Colonnes détectées:', indices);
  console.log('[CSV Parser] Sprint plural idx:', indices.sprintsPlural, '| Sprint singular idx:', indices.sprintSingular);
  return indices;
}

/**
 * Récupère la valeur sprint depuis les deux colonnes possibles
 * Priorité : sprintsPlural > sprintSingular
 * Ignore les valeurs "(no sprint)"
 * @param {string[]} row - Ligne du CSV
 * @param {Object} cols - Indices des colonnes
 * @returns {string} - Valeur sprint fusionnée
 */
function getSprintValue(row, cols) {
  const NO_SPRINT = '(no sprint)';

  // Essayer d'abord la colonne plurielle (historique complet)
  if (cols.sprintsPlural !== -1) {
    const val = (row[cols.sprintsPlural] || '').trim();
    if (val && val.toLowerCase() !== NO_SPRINT) {
      return val;
    }
  }

  // Fallback sur la colonne singulière
  if (cols.sprintSingular !== -1) {
    const val = (row[cols.sprintSingular] || '').trim();
    if (val && val.toLowerCase() !== NO_SPRINT) {
      return val;
    }
  }

  return '';
}

/**
 * Extrait le nom d'équipe depuis une ligne de résumé
 * Ex: "DATECH - Monétiser" → "Monétiser"
 * Ex: "Team Alpha" → "Team Alpha"
 * @param {string} value - Valeur de la première colonne
 * @returns {string|null} - Nom d'équipe ou null si pas une ligne équipe
 */
function extractTeamName(value) {
  if (!value) return null;
  const trimmed = value.trim();

  // Ignorer "All Issues" et lignes vides
  if (!trimmed || trimmed.toLowerCase() === 'all issues') {
    return null;
  }

  // Pattern "DATECH - NomEquipe" → extraire "NomEquipe"
  const datechMatch = trimmed.match(/^DATECH\s*-\s*(.+)$/i);
  if (datechMatch) {
    return datechMatch[1].trim();
  }

  // Pattern "Projet - NomEquipe" générique
  const genericMatch = trimmed.match(/^.+\s*-\s*(.+)$/);
  if (genericMatch) {
    return genericMatch[1].trim();
  }

  // Sinon, utiliser la valeur telle quelle si c'est potentiellement un nom d'équipe
  // (pas de Issue key, pas un nombre seul)
  if (!trimmed.match(/^[A-Z]+-\d+$/) && !trimmed.match(/^\d+$/)) {
    return trimmed;
  }

  return null;
}

/**
 * Parse le fichier CSV unifié (niveau ticket)
 * @param {string} csvContent - Contenu brut du CSV
 * @returns {Object} - { tickets, summary, teams }
 */
export function parseUnifiedCSV(csvContent) {
  const lines = csvContent.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());

  if (lines.length < 2) {
    return { tickets: [], summary: null, teams: [] };
  }

  // Détecter les colonnes depuis le header
  const headerRow = parseCSVRow(lines[0]);
  const cols = detectColumnIndices(headerRow);

  // Vérifier que les colonnes essentielles sont présentes
  if (cols.key === -1) {
    console.error('[CSV Parser] Colonne "Issue key" non trouvée !');
    return { tickets: [], summary: null, teams: [] };
  }

  const tickets = [];
  const teamsSet = new Set();
  let currentTeam = null;

  // Parser chaque ligne (skip header)
  for (let i = 1; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    const issueKey = row[cols.key] || '';
    const firstCol = row[0] || '';

    // Vérifier si c'est une ligne de résumé d'équipe
    if (!issueKey.match(/^[A-Z]+-\d+$/)) {
      const teamName = extractTeamName(firstCol);
      if (teamName) {
        currentTeam = teamName;
        teamsSet.add(teamName);
        console.log('[CSV Parser] Équipe détectée:', teamName);
      }
      continue;
    }

    // Parser les sprints depuis les colonnes disponibles (plural ou singular)
    const sprintsValue = getSprintValue(row, cols);
    const allSprints = parseSprintNumbers(sprintsValue);

    // Le sprint de fermeture = le dernier sprint de la liste
    const closureSprint = allSprints.length > 0 ? allSprints[allSprints.length - 1] : null;

    const status = cols.status !== -1 ? (row[cols.status] || '') : '';
    const closedDate = cols.closedDate !== -1 ? parseDate(row[cols.closedDate]) : null;

    // Déterminer si le ticket est terminé (status contient "Terminé", "Done", "Fini", etc.)
    const isFinished = /termin|done|fini|résolu|closed/i.test(status);

    // Cycle time : utiliser la valeur ou 1 jour par défaut pour les tickets terminés sans valeur
    let cycleTime = cols.cycleTime !== -1 ? (parseFloat(row[cols.cycleTime]) || 0) : 0;
    if (isFinished && cycleTime === 0 && closedDate) {
      // Ticket terminé mais sans cycle time (passé directement à Done) = 1 jour
      cycleTime = 1;
    }

    const ticket = {
      summary: row[0] || '',
      key: issueKey,
      type: cols.type !== -1 ? (row[cols.type] || 'Unknown') : 'Unknown',
      createdDate: cols.createdDate !== -1 ? parseDate(row[cols.createdDate]) : null,
      status: status,
      cycleTime: cycleTime,
      closedDate: closedDate,
      isFinished: isFinished,
      // Sprint de fermeture = dernier sprint de Issue Sprints
      sprint: closureSprint,
      sprints: allSprints,
      // Pour détecter les ajouts mid-sprint : ticket dans un seul sprint
      isSingleSprint: allSprints.length === 1,
      // Nouvelles propriétés pour le forecast (optionnelles)
      storyPoints: cols.storyPoints !== -1 ? (parseInt(row[cols.storyPoints], 10) || 0) : 0,
      assignee: cols.assignee !== -1 ? (row[cols.assignee] || '').trim() : '',
      // Équipe (détectée depuis la structure hiérarchique du CSV)
      team: currentTeam
    };

    tickets.push(ticket);
  }

  // Liste des équipes triées alphabétiquement
  const teams = [...teamsSet].sort((a, b) => a.localeCompare(b, 'fr'));

  // Trouver le sprint max pour déterminer le sprint actuel
  const allSprints = tickets.flatMap(t => t.sprints).filter(s => s != null);
  const maxSprint = allSprints.length > 0 ? Math.max(...allSprints) : null;

  console.log('[CSV Parser] Équipes trouvées:', teams);
  console.log('[CSV Parser] Tickets par équipe:', teams.map(t => `${t}: ${tickets.filter(tk => tk.team === t).length}`).join(', '));

  return {
    tickets,
    teams,
    summary: {
      total: tickets.length,
      closed: tickets.filter(t => t.closedDate).length,
      open: tickets.filter(t => !t.closedDate).length,
      maxSprint: maxSprint,
      teamCount: teams.length
    }
  };
}

/**
 * Parse une ligne CSV en gérant les guillemets
 * @param {string} line
 * @returns {string[]}
 */
function parseCSVRow(line) {
  const values = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current.trim());

  return values;
}

/**
 * Parse une date string en objet Date
 * @param {string} dateStr - Format: "2025-12-01 10:00:00" ou "2025-12-01"
 * @returns {Date|null}
 */
function parseDate(dateStr) {
  if (!dateStr || dateStr.trim() === '') return null;

  const date = new Date(dateStr.replace(' ', 'T'));
  return isNaN(date.getTime()) ? null : date;
}

// =========================================================================
// AGRÉGATION PAR SEMAINE
// =========================================================================

/**
 * Obtient le numéro de semaine ISO d'une date
 * @param {Date} date
 * @returns {Object} - { week, year }
 */
function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
  return { week: weekNo, year: d.getUTCFullYear() };
}

/**
 * Obtient la date de début d'une semaine ISO
 * @param {number} week
 * @param {number} year
 * @returns {Date}
 */
function getWeekStartDate(week, year) {
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7;
  const firstMonday = new Date(jan4);
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1);
  const targetDate = new Date(firstMonday);
  targetDate.setDate(firstMonday.getDate() + (week - 1) * 7);
  return targetDate;
}

/**
 * Calcule le lundi de début du sprint à partir d'une date de référence
 * RÈGLE MÉTIER : Les sprints commencent le LUNDI des SEMAINES PAIRES
 * @param {Date} referenceDate - Date dans le sprint (typiquement maxDate)
 * @returns {Date} - Le lundi de la semaine paire qui démarre le sprint
 */
export function getSprintStartMonday(referenceDate) {
  const date = new Date(referenceDate);

  // Trouver le lundi de la semaine courante
  const dayOfWeek = date.getDay(); // 0 = dimanche, 1 = lundi, ...
  const monday = new Date(date);
  // Si dimanche (0), reculer de 6 jours, sinon reculer de (dayOfWeek - 1)
  monday.setDate(date.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  monday.setHours(0, 0, 0, 0);

  // Obtenir le numéro de semaine ISO de ce lundi
  const { week } = getWeekNumber(monday);

  // Si semaine impaire, le sprint a commencé la semaine précédente (paire)
  // Si semaine paire, le sprint a commencé cette semaine ou 2 semaines avant
  //
  // En fait, si on est en semaine paire, c'est soit la 1ère soit la 2ème semaine du sprint
  // On veut toujours le lundi de la semaine paire de DÉBUT du sprint
  //
  // Logique : la référence est proche de la fin du sprint
  // - Si semaine impaire : le sprint a commencé la semaine d'avant (paire)
  // - Si semaine paire : le sprint a commencé cette semaine (on est en semaine 1)

  if (week % 2 !== 0) {
    // Semaine impaire = on est en semaine 2 du sprint
    // Le sprint a commencé le lundi de la semaine précédente (paire)
    monday.setDate(monday.getDate() - 7);
  }
  // Sinon semaine paire = on est en semaine 1 du sprint, monday est correct

  return monday;
}

/**
 * Agrège les tickets fermés par semaine
 * @param {Array} tickets
 * @returns {Array} - [{ week, year, date, count, cycleTimesArray }]
 */
export function aggregateByWeek(tickets) {
  const weekMap = new Map();

  tickets.forEach(ticket => {
    if (!ticket.closedDate) return;

    const { week, year } = getWeekNumber(ticket.closedDate);
    const key = `${year}-W${week}`;

    if (!weekMap.has(key)) {
      weekMap.set(key, {
        week,
        year,
        date: getWeekStartDate(week, year),
        closed: 0,
        cycleTimes: [],
        bugs: { created: 0, closed: 0 }
      });
    }

    const entry = weekMap.get(key);
    entry.closed++;

    if (ticket.cycleTime > 0) {
      entry.cycleTimes.push(ticket.cycleTime);
    }

    if (ticket.type === 'Bug') {
      entry.bugs.closed++;
    }
  });

  // Ajouter les bugs créés par semaine
  tickets.forEach(ticket => {
    if (!ticket.createdDate || ticket.type !== 'Bug') return;

    const { week, year } = getWeekNumber(ticket.createdDate);
    const key = `${year}-W${week}`;

    if (weekMap.has(key)) {
      weekMap.get(key).bugs.created++;
    }
  });

  // Trier par date
  return Array.from(weekMap.values())
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

// =========================================================================
// AGRÉGATION PAR SPRINT
// =========================================================================

/**
 * Agrège les tickets par numéro de sprint
 * Utilise la colonne "Issue Sprints" pour déterminer tous les sprints d'un ticket
 * @param {Array} tickets
 * @returns {Array} - [{ sprint, closed, totalTickets, cycleTimes, bugs, dateRange }]
 */
export function aggregateBySprint(tickets) {
  const sprintMap = new Map();

  // ÉTAPE 1: Créer les entrées pour les sprints avec des tickets FERMÉS
  // (seuls les sprints complets sont affichés)
  tickets.forEach(ticket => {
    if (!ticket.closedDate || !ticket.sprint || !ticket.isFinished) return;

    const sprintNum = ticket.sprint;
    const key = `Sprint ${sprintNum}`;

    if (!sprintMap.has(key)) {
      sprintMap.set(key, {
        sprint: sprintNum,
        label: `Sprint ${sprintNum}`,
        closed: 0,
        totalTickets: 0,
        cycleTimes: [],
        bugs: { created: 0, closed: 0, cycleTimes: [] },
        minDate: ticket.closedDate,
        maxDate: ticket.closedDate,
        midSprintAdditions: [],
        // Story Points calculés automatiquement
        storyPointsDelivered: 0,
        storyPointsCommitted: 0
      });
    }

    const entry = sprintMap.get(key);
    entry.closed++;

    // Story Points livrés (tickets fermés dans ce sprint)
    if (ticket.storyPoints > 0) {
      entry.storyPointsDelivered += ticket.storyPoints;
    }

    // Mettre à jour la plage de dates du sprint
    if (ticket.closedDate < entry.minDate) entry.minDate = ticket.closedDate;
    if (ticket.closedDate > entry.maxDate) entry.maxDate = ticket.closedDate;

    // Cycle time : exclure les bugs (ils ont leur propre métrique)
    if (ticket.cycleTime > 0 && ticket.type !== 'Bug') {
      entry.cycleTimes.push(ticket.cycleTime);
    }

    if (ticket.type === 'Bug') {
      entry.bugs.closed++;
      if (ticket.cycleTime > 0) {
        entry.bugs.cycleTimes.push(ticket.cycleTime);
      }
    }
  });

  // ÉTAPE 2: Compter TOUS les tickets embarqués dans chaque sprint (fermés ou non)
  // Un ticket est embarqué dans un sprint s'il apparaît dans sa liste "sprints"
  // + calculer les Story Points engagés (committed)
  tickets.forEach(ticket => {
    if (!ticket.sprints || ticket.sprints.length === 0) return;

    ticket.sprints.forEach(sprintNum => {
      const key = `Sprint ${sprintNum}`;
      // Seulement pour les sprints qui existent (ont des tickets fermés)
      if (sprintMap.has(key)) {
        const entry = sprintMap.get(key);
        entry.totalTickets++;
        // Story Points engagés = tous les tickets embarqués dans le sprint
        if (ticket.storyPoints > 0) {
          entry.storyPointsCommitted += ticket.storyPoints;
        }
      }
    });
  });

  // Note: bugs.created sera calculé dans le transformer basé sur la date de création

  // Détecter les tickets ajoutés en cours de sprint
  // Un ticket est mid-sprint si :
  // 1. Il n'est que dans ce sprint (pas de carry-over)
  // 2. Sa date de création est STRICTEMENT APRÈS le lundi de lancement du sprint
  //
  // RÈGLE MÉTIER : Les sprints commencent le LUNDI des SEMAINES PAIRES
  const sprintArray = Array.from(sprintMap.values());

  sprintArray.forEach(sprintData => {
    // Obtenir la date de début du sprint depuis la convention fixe (sprintDates.js)
    // Cela garantit la cohérence avec burndownService
    const { start: sprintStart } = getSprintDates(sprintData.sprint);

    // Trouver les tickets single-sprint créés APRÈS le lundi de lancement
    const singleSprintTickets = tickets.filter(t =>
      t.sprint === sprintData.sprint &&
      t.isSingleSprint &&
      t.createdDate
    );

    singleSprintTickets.forEach(ticket => {
      // Comparer en jours (sans l'heure)
      const ticketCreatedDay = new Date(ticket.createdDate);
      ticketCreatedDay.setHours(0, 0, 0, 0);

      // Strictement APRÈS le lundi de début du sprint
      if (ticketCreatedDay > sprintStart) {
        sprintData.midSprintAdditions.push({
          key: ticket.key,
          summary: ticket.summary,
          type: ticket.type,
          createdDate: ticket.createdDate,
          isFinished: ticket.isFinished
        });
      }
    });
  });

  // Trier par numéro de sprint
  return sprintArray.sort((a, b) => a.sprint - b.sprint);
}

/**
 * Calcule les statistiques de cycle time
 * @param {number[]} values
 * @returns {Object} - { avg, median, p85 }
 */
export function calculateStats(values, label = '') {
  if (!values || values.length === 0) {
    return { avg: 0, median: 0, p85: 0 };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const sum = sorted.reduce((a, b) => a + b, 0);
  const avg = sum / sorted.length;

  // Debug pour Sprint 16
  if (label.includes('16')) {
    console.log('[DEBUG Stats ' + label + '] Cycle times:', sorted);
    console.log('[DEBUG Stats ' + label + '] Sum:', sum, 'Count:', sorted.length, 'Avg:', avg);
  }

  // Médiane
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 !== 0
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;

  // 85e percentile
  const p85Index = Math.ceil(sorted.length * 0.85) - 1;
  const p85 = sorted[Math.min(p85Index, sorted.length - 1)];

  return {
    avg: Math.round(avg * 10) / 10,
    median: Math.round(median * 10) / 10,
    p85: Math.round(p85 * 10) / 10
  };
}

// =========================================================================
// TIME IN STATUS (nouveau format ticket-level avec équipes et sprints)
// =========================================================================

/**
 * Extrait le numéro de sprint depuis différents formats :
 * - "Sprint 16"
 * - "Tableau Sprint 12"
 * - "Engager Q1-2026 2/7 - 17"
 * @param {string} sprintStr
 * @returns {number|null}
 */
function parseSprintNumberFromAnyFormat(sprintStr) {
  if (!sprintStr || sprintStr.toLowerCase().includes('no sprint')) return null;

  // Pattern 1: "Sprint X" ou "Tableau Sprint X"
  const sprintMatch = sprintStr.match(/Sprint\s*(\d+)/i);
  if (sprintMatch) return parseInt(sprintMatch[1], 10);

  // Pattern 2: "Engager Q1-2026 2/7 - 17" (dernier nombre)
  const lastNumberMatch = sprintStr.match(/(\d+)\s*$/);
  if (lastNumberMatch) return parseInt(lastNumberMatch[1], 10);

  return null;
}

/**
 * Extrait tous les numéros de sprint depuis une chaîne multi-sprint
 * @param {string} sprintsStr - Ex: "Tableau Sprint 10,Tableau Sprint 11"
 * @returns {number[]}
 */
function parseAllSprintNumbers(sprintsStr) {
  if (!sprintsStr || sprintsStr.toLowerCase().includes('no sprint')) return [];

  const parts = sprintsStr.split(',');
  const sprints = [];

  for (const part of parts) {
    const num = parseSprintNumberFromAnyFormat(part.trim());
    if (num !== null && !sprints.includes(num)) {
      sprints.push(num);
    }
  }

  return sprints.sort((a, b) => a - b);
}

/**
 * Parse le fichier Time in status.csv (nouveau format EazyBI avec équipes et sprints)
 *
 * FORMAT ATTENDU :
 * Ligne 1: ,Status1,Status1,Status1,Status1,Status2,Status2,...
 * Ligne 2: ,Average workdays,Issue created date,Issue Sprint,Issue Sprints,...
 * Ligne 3: All Issues,valeurs globales...
 * Ligne 4+: EQUIPE ou ticket
 *
 * @param {string} csvContent
 * @returns {Object} - { tickets: [...], teams: [...], statuses: [...], summary: {...} }
 */
export function parseTimeInStatusCSV(csvContent) {
  const lines = csvContent.replace(/\r\n/g, '\n').split('\n').filter(l => l.trim());

  if (lines.length < 3) {
    console.error('[TimeInStatus Parser] Fichier trop court');
    return { tickets: [], teams: [], statuses: [], summary: null };
  }

  // Ligne 1 : Headers des statuts (répétés 4x chacun)
  const headerRow = parseCSVRow(lines[0]);
  // Ligne 2 : Sous-headers (Average workdays, Issue created date, Issue Sprint, Issue Sprints)
  const subHeaderRow = parseCSVRow(lines[1]);

  // Identifier les statuts et leurs colonnes
  const statusColumns = [];
  let currentStatus = null;
  let statusStartIdx = -1;

  for (let i = 1; i < headerRow.length; i++) {
    const header = headerRow[i].replace(/\s*\(\d+\)$/, '').trim(); // Enlever "(10132)"

    if (header && header !== currentStatus) {
      // Nouveau statut trouvé
      if (currentStatus !== null) {
        statusColumns.push({
          status: currentStatus,
          avgWorkdaysIdx: statusStartIdx,
          issueDateIdx: statusStartIdx + 1,
          issueSprintIdx: statusStartIdx + 2,
          issueSprintsIdx: statusStartIdx + 3
        });
      }
      currentStatus = header;
      statusStartIdx = i;
    }
  }
  // Ajouter le dernier statut
  if (currentStatus !== null) {
    statusColumns.push({
      status: currentStatus,
      avgWorkdaysIdx: statusStartIdx,
      issueDateIdx: statusStartIdx + 1,
      issueSprintIdx: statusStartIdx + 2,
      issueSprintsIdx: statusStartIdx + 3
    });
  }

  console.log('[TimeInStatus Parser] Statuts détectés:', statusColumns.map(s => s.status));

  const statuses = statusColumns.map(s => s.status);
  const tickets = [];
  const teamsSet = new Set();
  let currentTeam = null;
  let globalSummary = null;

  // Parser les données (à partir de la ligne 3)
  for (let i = 2; i < lines.length; i++) {
    const row = parseCSVRow(lines[i]);
    const firstCol = (row[0] || '').trim();

    if (!firstCol) continue;

    // Ligne "All Issues" = résumé global
    if (firstCol.toLowerCase() === 'all issues') {
      globalSummary = {};
      for (const sc of statusColumns) {
        const avgDays = parseFloat(row[sc.avgWorkdaysIdx]) || 0;
        globalSummary[sc.status] = avgDays;
      }
      console.log('[TimeInStatus Parser] Résumé global:', globalSummary);
      continue;
    }

    // Vérifier si c'est une ligne d'équipe (pattern DATECH - xxx)
    const teamName = extractTeamName(firstCol);

    // Si pas de clé de type "XXX-123", c'est une ligne d'équipe
    if (!firstCol.match(/^[A-Z]+-\d+/)) {
      if (teamName) {
        currentTeam = teamName;
        teamsSet.add(teamName);
        console.log('[TimeInStatus Parser] Équipe détectée:', teamName);
      }
      continue;
    }

    // C'est un ticket individuel
    const ticketKey = firstCol.match(/^([A-Z]+-\d+)/)?.[1] || firstCol;

    // Extraire le temps dans chaque statut
    const statusTimes = {};
    let totalTime = 0;

    for (const sc of statusColumns) {
      const avgDays = parseFloat(row[sc.avgWorkdaysIdx]) || 0;
      statusTimes[sc.status] = avgDays;
      totalTime += avgDays;
    }

    // Extraire les sprints (utiliser la première colonne Issue Sprints non vide)
    let sprintsStr = '';
    for (const sc of statusColumns) {
      const val = (row[sc.issueSprintsIdx] || '').trim();
      if (val && val.toLowerCase() !== '(no sprint)') {
        sprintsStr = val;
        break;
      }
    }

    const sprints = parseAllSprintNumbers(sprintsStr);
    const lastSprint = sprints.length > 0 ? sprints[sprints.length - 1] : null;

    tickets.push({
      key: ticketKey,
      team: currentTeam,
      statusTimes,
      totalTime,
      sprints,
      lastSprint
    });
  }

  const teams = [...teamsSet].sort((a, b) => a.localeCompare(b, 'fr'));

  console.log('[TimeInStatus Parser] Équipes:', teams);
  console.log('[TimeInStatus Parser] Tickets parsés:', tickets.length);

  return {
    tickets,
    teams,
    statuses,
    summary: globalSummary
  };
}

/**
 * Agrège les données Time in Status par équipe et plage de sprints
 * @param {Object} timeInStatusData - Données parsées du CSV
 * @param {string[]} selectedTeams - Équipes sélectionnées
 * @param {number} targetSprint - Sprint cible (pour filtrer les 6 derniers)
 * @param {number} sprintRange - Nombre de sprints à inclure (défaut: 6)
 * @returns {Object} - Données agrégées pour les graphiques
 */
export function aggregateTimeInStatus(timeInStatusData, selectedTeams = [], targetSprint = null, sprintRange = 6) {
  const { tickets, statuses } = timeInStatusData;

  if (!tickets || tickets.length === 0) {
    return { labels: statuses || [], values: [], pct: [] };
  }

  // Filtrer par équipe
  let filteredTickets = tickets;
  if (selectedTeams.length > 0) {
    filteredTickets = tickets.filter(t => selectedTeams.includes(t.team));
  }

  // Filtrer par sprint si spécifié
  if (targetSprint !== null) {
    const minSprint = targetSprint - sprintRange + 1;
    filteredTickets = filteredTickets.filter(t => {
      if (!t.lastSprint) return false;
      return t.lastSprint >= minSprint && t.lastSprint <= targetSprint;
    });
  }

  console.log(`[TimeInStatus Aggregator] Tickets après filtrage: ${filteredTickets.length} (équipes: ${selectedTeams.join(', ')}, sprint: ${targetSprint})`);

  if (filteredTickets.length === 0) {
    return { labels: statuses || [], values: [], pct: [] };
  }

  // Calculer les moyennes par statut
  const statusSums = {};
  const statusCounts = {};

  for (const status of statuses) {
    statusSums[status] = 0;
    statusCounts[status] = 0;
  }

  for (const ticket of filteredTickets) {
    for (const status of statuses) {
      const time = ticket.statusTimes[status] || 0;
      if (time > 0) {
        statusSums[status] += time;
        statusCounts[status]++;
      }
    }
  }

  // Calculer moyennes et pourcentages
  const values = [];
  let totalAvg = 0;

  for (const status of statuses) {
    const avg = statusCounts[status] > 0
      ? statusSums[status] / statusCounts[status]
      : 0;
    values.push(Math.round(avg * 100) / 100);
    totalAvg += avg;
  }

  // Calculer les pourcentages
  const pct = values.map(v => totalAvg > 0 ? Math.round((v / totalAvg) * 100) : 0);

  return {
    labels: statuses,
    values,
    pct
  };
}

// =========================================================================
// EXPORT
// =========================================================================

export default {
  parseUnifiedCSV,
  parseTimeInStatusCSV,
  aggregateTimeInStatus,
  aggregateByWeek,
  aggregateBySprint,
  calculateStats
};
