/**
 * ==========================================================================
 * VALIDATORS.JS - Fonctions de validation
 * ==========================================================================
 *
 * Fonctions utilitaires pour valider :
 * - Données de formulaire
 * - Fichiers CSV
 * - Types de données
 *
 * ==========================================================================
 */

/**
 * Vérifie si une valeur est vide
 * @param {*} value
 * @returns {boolean}
 */
export function isEmpty(value) {
  if (value === null || value === undefined) return true;
  if (typeof value === 'string') return value.trim() === '';
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value).length === 0;
  return false;
}

/**
 * Vérifie si une valeur est un nombre valide
 * @param {*} value
 * @returns {boolean}
 */
export function isNumber(value) {
  if (typeof value === 'number') return !isNaN(value) && isFinite(value);
  if (typeof value === 'string') {
    const num = parseFloat(value);
    return !isNaN(num) && isFinite(num);
  }
  return false;
}

/**
 * Vérifie si une valeur est un entier positif
 * @param {*} value
 * @returns {boolean}
 */
export function isPositiveInteger(value) {
  const num = typeof value === 'string' ? parseInt(value, 10) : value;
  return Number.isInteger(num) && num >= 0;
}

/**
 * Vérifie si une valeur est dans une plage
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {boolean}
 */
export function isInRange(value, min, max) {
  return isNumber(value) && value >= min && value <= max;
}

/**
 * Vérifie si une chaîne est une date valide
 * @param {string} dateString
 * @returns {boolean}
 */
export function isValidDate(dateString) {
  const date = new Date(dateString);
  return !isNaN(date.getTime());
}

/**
 * Vérifie si un fichier est un CSV valide
 * @param {File} file
 * @returns {Object} { valid, error }
 */
export function isValidCSVFile(file) {
  if (!file) {
    return { valid: false, error: 'Aucun fichier sélectionné' };
  }

  // Vérifier l'extension
  const validExtensions = ['.csv'];
  const extension = '.' + file.name.split('.').pop().toLowerCase();

  if (!validExtensions.includes(extension)) {
    return { valid: false, error: 'Le fichier doit être au format CSV' };
  }

  // Vérifier le type MIME
  const validTypes = ['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel'];
  if (file.type && !validTypes.includes(file.type)) {
    // Certains systèmes ne définissent pas correctement le type
    // On accepte quand même si l'extension est correcte
  }

  // Vérifier la taille (max 5MB)
  const maxSize = 5 * 1024 * 1024;
  if (file.size > maxSize) {
    return { valid: false, error: 'Le fichier est trop volumineux (max 5MB)' };
  }

  return { valid: true, error: null };
}

/**
 * Valide les données de saisie manuelle du sprint
 * @param {Object} data
 * @returns {Object} { valid, errors }
 */
export function validateSprintInput(data) {
  const errors = {};

  // Nom de l'équipe
  if (isEmpty(data.teamName)) {
    errors.teamName = "Le nom de l'équipe est requis";
  }

  // Numéro du sprint
  if (!isPositiveInteger(data.sprintNumber)) {
    errors.sprintNumber = 'Le numéro de sprint doit être un entier positif';
  }

  // Story Points engagés
  if (data.storyPointsCommitted !== undefined && data.storyPointsCommitted !== '') {
    if (!isPositiveInteger(data.storyPointsCommitted)) {
      errors.storyPointsCommitted = 'Les story points doivent être un entier positif';
    }
  }

  // Story Points livrés
  if (data.storyPointsDelivered !== undefined && data.storyPointsDelivered !== '') {
    if (!isPositiveInteger(data.storyPointsDelivered)) {
      errors.storyPointsDelivered = 'Les story points doivent être un entier positif';
    }
  }

  // Vérifier que livrés <= engagés (avertissement, pas erreur)
  if (
    isPositiveInteger(data.storyPointsCommitted) &&
    isPositiveInteger(data.storyPointsDelivered) &&
    data.storyPointsDelivered > data.storyPointsCommitted
  ) {
    errors.storyPointsDelivered = 'Les points livrés dépassent les points engagés (inhabituel)';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors
  };
}

/**
 * Valide un Sprint Goal
 * @param {Object} goal
 * @returns {Object} { valid, error }
 */
export function validateGoal(goal) {
  if (isEmpty(goal.text)) {
    return { valid: false, error: 'Le texte du goal est requis' };
  }

  if (goal.text.length > 500) {
    return { valid: false, error: 'Le goal est trop long (max 500 caractères)' };
  }

  const validStatuses = ['achieved', 'partial', 'missed', null];
  if (goal.status !== undefined && !validStatuses.includes(goal.status)) {
    return { valid: false, error: 'Statut invalide' };
  }

  return { valid: true, error: null };
}

/**
 * Valide un email
 * @param {string} email
 * @returns {boolean}
 */
export function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * Sanitize une chaîne (protection XSS basique)
 * @param {string} str
 * @returns {string}
 */
export function sanitize(str) {
  if (typeof str !== 'string') return '';

  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#x27;',
    '/': '&#x2F;'
  };

  return str.replace(/[&<>"'/]/g, char => map[char]);
}

export default {
  isEmpty,
  isNumber,
  isPositiveInteger,
  isInRange,
  isValidDate,
  isValidCSVFile,
  validateSprintInput,
  validateGoal,
  isValidEmail,
  sanitize
};
