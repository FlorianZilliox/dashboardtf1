/**
 * ==========================================================================
 * DATEUTILS.JS - Utilitaires pour la manipulation des dates
 * ==========================================================================
 *
 * Fonctions utilitaires pour :
 * - Formatage de dates
 * - Calculs de dates
 * - Parsing de dates
 *
 * ==========================================================================
 */

import config from '../core/config.js';

/**
 * Formate une date selon un format prédéfini
 * @param {Date|string} date - Date à formater
 * @param {string} format - 'short' | 'medium' | 'long' | 'chart'
 * @param {string} locale - Locale (défaut: config.locale)
 * @returns {string} Date formatée
 */
export function formatDate(date, format = 'medium', locale = config.locale) {
  const d = date instanceof Date ? date : new Date(date);

  if (isNaN(d.getTime())) {
    return '';
  }

  const formats = config.dateFormats || {
    short: { day: 'numeric', month: 'short' },
    medium: { day: 'numeric', month: 'long' },
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    chart: { month: 'short', year: '2-digit' }
  };

  return d.toLocaleDateString(locale, formats[format] || formats.medium);
}

/**
 * Formate une plage de dates
 * @param {Date} startDate - Date de début
 * @param {Date} endDate - Date de fin
 * @param {string} locale - Locale
 * @returns {string} Plage formatée
 */
export function formatDateRange(startDate, endDate, locale = config.locale) {
  const start = startDate instanceof Date ? startDate : new Date(startDate);
  const end = endDate instanceof Date ? endDate : new Date(endDate);

  const sameMonth = start.getMonth() === end.getMonth();
  const sameYear = start.getFullYear() === end.getFullYear();

  if (sameMonth && sameYear) {
    return `${start.getDate()} - ${end.getDate()} ${formatDate(end, 'medium', locale)}`;
  }

  if (sameYear) {
    return `${formatDate(start, 'short', locale)} - ${formatDate(end, 'medium', locale)}`;
  }

  return `${formatDate(start, 'long', locale)} - ${formatDate(end, 'long', locale)}`;
}

/**
 * Retourne la date d'aujourd'hui à minuit
 * @returns {Date}
 */
export function today() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Ajoute des jours à une date
 * @param {Date} date - Date de base
 * @param {number} days - Nombre de jours à ajouter
 * @returns {Date} Nouvelle date
 */
export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

/**
 * Ajoute des semaines à une date
 * @param {Date} date - Date de base
 * @param {number} weeks - Nombre de semaines à ajouter
 * @returns {Date} Nouvelle date
 */
export function addWeeks(date, weeks) {
  return addDays(date, weeks * 7);
}

/**
 * Retourne le lundi de la semaine d'une date
 * @param {Date} date - Date
 * @returns {Date} Lundi de cette semaine
 */
export function getMonday(date) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Retourne le dimanche de la semaine d'une date
 * @param {Date} date - Date
 * @returns {Date} Dimanche de cette semaine
 */
export function getSunday(date) {
  const monday = getMonday(date);
  return addDays(monday, 6);
}

/**
 * Vérifie si deux dates sont le même jour
 * @param {Date} date1
 * @param {Date} date2
 * @returns {boolean}
 */
export function isSameDay(date1, date2) {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Calcule le nombre de jours entre deux dates
 * @param {Date} startDate
 * @param {Date} endDate
 * @returns {number}
 */
export function daysBetween(startDate, endDate) {
  const oneDay = 24 * 60 * 60 * 1000;
  return Math.round(Math.abs((endDate - startDate) / oneDay));
}

/**
 * Formate un timestamp en temps relatif
 * @param {Date|number} date - Date ou timestamp
 * @returns {string} "il y a 5 minutes", "hier", etc.
 */
export function timeAgo(date) {
  const d = date instanceof Date ? date : new Date(date);
  const now = new Date();
  const seconds = Math.floor((now - d) / 1000);

  if (seconds < 60) return "à l'instant";
  if (seconds < 3600) return `il y a ${Math.floor(seconds / 60)} min`;
  if (seconds < 86400) return `il y a ${Math.floor(seconds / 3600)} h`;
  if (seconds < 172800) return 'hier';
  if (seconds < 604800) return `il y a ${Math.floor(seconds / 86400)} jours`;

  return formatDate(d, 'medium');
}

/**
 * Parse une chaîne de date en objet Date
 * @param {string} dateString - Chaîne à parser
 * @returns {Date|null}
 */
export function parseDate(dateString) {
  if (!dateString) return null;

  const date = new Date(dateString);
  return isNaN(date.getTime()) ? null : date;
}

export default {
  formatDate,
  formatDateRange,
  today,
  addDays,
  addWeeks,
  getMonday,
  getSunday,
  isSameDay,
  daysBetween,
  timeAgo,
  parseDate
};
