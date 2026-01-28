/**
 * ==========================================================================
 * DOMHELPERS.JS - Utilitaires de manipulation DOM
 * ==========================================================================
 *
 * Fonctions utilitaires pour :
 * - Sélection d'éléments
 * - Création d'éléments
 * - Manipulation de classes
 * - Gestion d'événements
 *
 * ==========================================================================
 */

/**
 * Sélectionne un élément par son sélecteur
 * @param {string} selector
 * @param {HTMLElement} context
 * @returns {HTMLElement|null}
 */
export function $(selector, context = document) {
  return context.querySelector(selector);
}

/**
 * Sélectionne tous les éléments correspondant à un sélecteur
 * @param {string} selector
 * @param {HTMLElement} context
 * @returns {HTMLElement[]}
 */
export function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

/**
 * Crée un élément DOM avec attributs et contenu
 * @param {string} tag - Nom de la balise
 * @param {Object} attrs - Attributs
 * @param {string|HTMLElement|Array} children - Contenu
 * @returns {HTMLElement}
 *
 * @example
 * createElement('div', { class: 'card', id: 'myCard' }, [
 *   createElement('h2', {}, 'Titre'),
 *   createElement('p', {}, 'Contenu')
 * ]);
 */
export function createElement(tag, attrs = {}, children = null) {
  const element = document.createElement(tag);

  // Appliquer les attributs
  Object.entries(attrs).forEach(([key, value]) => {
    if (key === 'class' || key === 'className') {
      element.className = Array.isArray(value) ? value.join(' ') : value;
    } else if (key === 'style' && typeof value === 'object') {
      Object.assign(element.style, value);
    } else if (key.startsWith('data-')) {
      element.setAttribute(key, value);
    } else if (key.startsWith('on') && typeof value === 'function') {
      const event = key.slice(2).toLowerCase();
      element.addEventListener(event, value);
    } else if (value !== undefined && value !== null) {
      element.setAttribute(key, value);
    }
  });

  // Ajouter le contenu
  if (children !== null) {
    if (Array.isArray(children)) {
      children.forEach(child => {
        if (child) appendChild(element, child);
      });
    } else {
      appendChild(element, children);
    }
  }

  return element;
}

/**
 * Ajoute un enfant à un élément
 * @param {HTMLElement} parent
 * @param {string|HTMLElement} child
 */
export function appendChild(parent, child) {
  if (typeof child === 'string') {
    parent.appendChild(document.createTextNode(child));
  } else if (child instanceof HTMLElement) {
    parent.appendChild(child);
  }
}

/**
 * Vide un élément de son contenu
 * @param {HTMLElement} element
 */
export function empty(element) {
  while (element.firstChild) {
    element.removeChild(element.firstChild);
  }
}

/**
 * Remplace le contenu d'un élément par du HTML
 * @param {HTMLElement} element
 * @param {string} html
 */
export function setHTML(element, html) {
  element.innerHTML = html;
}

/**
 * Toggle une classe sur un élément
 * @param {HTMLElement} element
 * @param {string} className
 * @param {boolean} force
 * @returns {boolean} La classe est-elle présente
 */
export function toggleClass(element, className, force) {
  return element.classList.toggle(className, force);
}

/**
 * Ajoute une ou plusieurs classes
 * @param {HTMLElement} element
 * @param {...string} classNames
 */
export function addClass(element, ...classNames) {
  element.classList.add(...classNames);
}

/**
 * Supprime une ou plusieurs classes
 * @param {HTMLElement} element
 * @param {...string} classNames
 */
export function removeClass(element, ...classNames) {
  element.classList.remove(...classNames);
}

/**
 * Vérifie si un élément a une classe
 * @param {HTMLElement} element
 * @param {string} className
 * @returns {boolean}
 */
export function hasClass(element, className) {
  return element.classList.contains(className);
}

/**
 * Ajoute un écouteur d'événement avec délégation
 * @param {HTMLElement} parent
 * @param {string} eventType
 * @param {string} selector
 * @param {Function} handler
 * @returns {Function} Fonction pour supprimer l'écouteur
 */
export function delegate(parent, eventType, selector, handler) {
  const listener = (event) => {
    const target = event.target.closest(selector);
    if (target && parent.contains(target)) {
      handler.call(target, event, target);
    }
  };

  parent.addEventListener(eventType, listener);

  return () => parent.removeEventListener(eventType, listener);
}

/**
 * Ajoute un écouteur d'événement qui se déclenche une seule fois
 * @param {HTMLElement} element
 * @param {string} eventType
 * @param {Function} handler
 */
export function once(element, eventType, handler) {
  element.addEventListener(eventType, handler, { once: true });
}

/**
 * Scroll vers un élément
 * @param {HTMLElement|string} target - Élément ou sélecteur
 * @param {Object} options
 */
export function scrollTo(target, options = {}) {
  const element = typeof target === 'string' ? $(target) : target;

  if (!element) return;

  element.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
    ...options
  });
}

/**
 * Anime un élément avec une transition
 * @param {HTMLElement} element
 * @param {Object} styles - Styles finaux
 * @param {number} duration - Durée en ms
 * @returns {Promise}
 */
export function animate(element, styles, duration = 200) {
  return new Promise(resolve => {
    element.style.transition = `all ${duration}ms ease`;

    Object.assign(element.style, styles);

    setTimeout(() => {
      element.style.transition = '';
      resolve();
    }, duration);
  });
}

/**
 * Affiche un élément avec une animation fade in
 * @param {HTMLElement} element
 * @param {number} duration
 */
export async function fadeIn(element, duration = 200) {
  element.style.opacity = '0';
  element.style.display = '';

  await animate(element, { opacity: '1' }, duration);
}

/**
 * Cache un élément avec une animation fade out
 * @param {HTMLElement} element
 * @param {number} duration
 */
export async function fadeOut(element, duration = 200) {
  await animate(element, { opacity: '0' }, duration);
  element.style.display = 'none';
}

/**
 * Copie du texte dans le presse-papier
 * @param {string} text
 * @returns {Promise<boolean>}
 */
export async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback pour les navigateurs plus anciens
    const textarea = createElement('textarea', {
      style: { position: 'fixed', opacity: '0' }
    }, text);

    document.body.appendChild(textarea);
    textarea.select();

    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

/**
 * Attend que le DOM soit prêt
 * @param {Function} callback
 */
export function ready(callback) {
  if (document.readyState !== 'loading') {
    callback();
  } else {
    document.addEventListener('DOMContentLoaded', callback);
  }
}

export default {
  $,
  $$,
  createElement,
  appendChild,
  empty,
  setHTML,
  toggleClass,
  addClass,
  removeClass,
  hasClass,
  delegate,
  once,
  scrollTo,
  animate,
  fadeIn,
  fadeOut,
  copyToClipboard,
  ready
};
