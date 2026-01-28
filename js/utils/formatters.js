/**
 * ==========================================================================
 * FORMATTERS.JS - Fonctions de formatage
 * ==========================================================================
 *
 * Fonctions utilitaires pour formater :
 * - Nombres
 * - Pourcentages
 * - Unités
 * - Textes
 *
 * ==========================================================================
 */

import config from '../core/config.js';

/**
 * Formate un nombre avec séparateur de milliers
 * @param {number} value - Valeur à formater
 * @param {number} decimals - Nombre de décimales
 * @param {string} locale - Locale
 * @returns {string}
 */
export function formatNumber(value, decimals = 0, locale = config.locale) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0';
  }

  return value.toLocaleString(locale, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Formate un pourcentage
 * @param {number} value - Valeur (0-100 ou 0-1)
 * @param {boolean} showSign - Afficher le signe +/-
 * @param {number} decimals - Décimales
 * @returns {string}
 */
export function formatPercent(value, showSign = false, decimals = 0) {
  if (typeof value !== 'number' || isNaN(value)) {
    return '0%';
  }

  // Normaliser si la valeur est entre 0 et 1
  const normalized = value <= 1 && value >= -1 ? value * 100 : value;
  const rounded = Number(normalized.toFixed(decimals));
  const sign = showSign && rounded > 0 ? '+' : '';

  return `${sign}${rounded}%`;
}

/**
 * Formate une valeur avec son unité
 * @param {number} value - Valeur
 * @param {string} unit - Unité ('items', 'days', 'SP', '%')
 * @param {number} decimals - Décimales
 * @returns {string}
 */
export function formatWithUnit(value, unit, decimals = 1) {
  const formattedValue = formatNumber(value, decimals);
  // Utiliser <= 1 pour le singulier (0.5 jour, 1 jour, mais 1.1 jours)
  const isSingular = value <= 1;

  const unitLabels = {
    items: isSingular ? 'item' : 'items',
    days: isSingular ? 'jour' : 'jours',
    'jours ouvrés': isSingular ? 'jour ouvré' : 'jours ouvrés',
    SP: 'SP',
    '%': '%',
    points: isSingular ? 'point' : 'points'
  };

  const unitLabel = unitLabels[unit] || unit;

  if (unit === '%') {
    return `${formattedValue}%`;
  }

  return `${formattedValue} ${unitLabel}`;
}

/**
 * Formate des jours avec singulier/pluriel
 * @param {number} value - Nombre de jours
 * @param {number} decimals - Décimales
 * @param {boolean} ouvres - Ajouter "ouvré(s)"
 * @returns {string}
 */
export function formatDays(value, decimals = 1, ouvres = false) {
  const formattedValue = formatNumber(value, decimals);
  const isSingular = value <= 1;

  if (ouvres) {
    return `${formattedValue} ${isSingular ? 'jour ouvré' : 'jours ouvrés'}`;
  }
  return `${formattedValue} ${isSingular ? 'jour' : 'jours'}`;
}

/**
 * Formate une tendance avec icône
 * @param {number} value - Pourcentage de variation
 * @returns {Object} { icon, text, direction, className }
 */
export function formatTrend(value) {
  if (typeof value !== 'number' || isNaN(value)) {
    return { icon: '→', text: '0%', direction: 'stable', className: 'trend--stable' };
  }

  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'stable';
  const icon = direction === 'up' ? '↑' : direction === 'down' ? '↓' : '→';
  const text = formatPercent(Math.abs(value), false);

  return {
    icon,
    text: `${icon} ${text}`,
    direction,
    className: `trend--${direction}`,
    value
  };
}

/**
 * Formate une plage de valeurs
 * @param {number} min - Minimum
 * @param {number} max - Maximum
 * @param {string} unit - Unité optionnelle
 * @returns {string}
 */
export function formatRange(min, max, unit = '') {
  const formattedMin = formatNumber(min);
  const formattedMax = formatNumber(max);

  if (unit) {
    return `${formattedMin} - ${formattedMax} ${unit}`;
  }

  return `${formattedMin} - ${formattedMax}`;
}

/**
 * Tronque un texte avec ellipsis
 * @param {string} text - Texte à tronquer
 * @param {number} maxLength - Longueur maximale
 * @returns {string}
 */
export function truncate(text, maxLength = 50) {
  if (!text || text.length <= maxLength) {
    return text || '';
  }

  return text.substring(0, maxLength - 3) + '...';
}

/**
 * Met en majuscule la première lettre
 * @param {string} text
 * @returns {string}
 */
export function capitalize(text) {
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
}

/**
 * Convertit en camelCase
 * @param {string} text
 * @returns {string}
 */
export function toCamelCase(text) {
  return text
    .replace(/[-_\s]+(.)?/g, (_, char) => char ? char.toUpperCase() : '')
    .replace(/^(.)/, (char) => char.toLowerCase());
}

/**
 * Convertit en kebab-case
 * @param {string} text
 * @returns {string}
 */
export function toKebabCase(text) {
  return text
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[\s_]+/g, '-')
    .toLowerCase();
}

/**
 * Génère un slug à partir d'un texte
 * @param {string} text
 * @returns {string}
 */
export function slugify(text) {
  return text
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

/**
 * Pluralise un mot selon une quantité
 * @param {number} count - Quantité
 * @param {string} singular - Forme singulière
 * @param {string} plural - Forme plurielle
 * @returns {string}
 */
export function pluralize(count, singular, plural) {
  return count === 1 ? singular : plural;
}

/**
 * Formate des bytes en taille lisible
 * @param {number} bytes
 * @param {number} decimals
 * @returns {string}
 */
export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 B';

  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

export default {
  formatNumber,
  formatPercent,
  formatWithUnit,
  formatDays,
  formatTrend,
  formatRange,
  truncate,
  capitalize,
  toCamelCase,
  toKebabCase,
  slugify,
  pluralize,
  formatBytes
};
