/**
 * ==========================================================================
 * SPRINTGOALS.JS - Composant Sprint Goals
 * ==========================================================================
 *
 * Affiche et gère les Sprint Goals avec :
 * - Liste des objectifs
 * - Statut de chaque objectif (achieved, partial, missed)
 * - Formulaire d'ajout (mode admin)
 * - Calcul du taux de réussite
 *
 * USAGE :
 *   const goals = new SprintGoals('#container', {
 *     editable: true,
 *     goals: [{ text: 'Goal 1', status: 'achieved' }]
 *   });
 *
 * ==========================================================================
 */

import Component from './Component.js';
import store from '../core/store.js';
import eventBus from '../core/eventBus.js';

// =========================================================================
// CONFIGURATION
// =========================================================================

const STATUS_CONFIG = {
  achieved: {
    label: 'Atteint',
    icon: '✓',
    className: 'goal-status--achieved'
  },
  partial: {
    label: 'Partiel',
    icon: '◐',
    className: 'goal-status--partial'
  },
  missed: {
    label: 'Manqué',
    icon: '✗',
    className: 'goal-status--missed'
  },
  null: {
    label: 'Non défini',
    icon: '○',
    className: 'goal-status--undefined'
  }
};

// =========================================================================
// CLASSE SPRINTGOALS
// =========================================================================

export default class SprintGoals extends Component {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {boolean} props.editable - Mode édition
   * @param {Array} props.goals - Liste des goals
   * @param {boolean} props.showStats - Afficher les statistiques
   */
  constructor(container, props = {}) {
    super(container, {
      editable: false,
      goals: [],
      showStats: true,
      maxGoals: 5,
      ...props
    });
  }

  /**
   * Initialisation
   */
  init() {
    this.state = {
      goals: this.props.goals || [],
      newGoalText: '',
      editingIndex: null
    };

    // S'abonner aux changements des goals dans le store
    this.subscribe(
      state => state.sprintGoals,
      (goals) => {
        if (goals && goals !== this.state.goals) {
          this.setState({ goals });
        }
      }
    );
  }

  /**
   * Calcule les statistiques des goals
   * @returns {Object}
   */
  _calculateStats() {
    const { goals } = this.state;

    if (!goals || goals.length === 0) {
      return { total: 0, achieved: 0, partial: 0, missed: 0, rate: 0 };
    }

    const stats = {
      total: goals.length,
      achieved: goals.filter(g => g.status === 'achieved').length,
      partial: goals.filter(g => g.status === 'partial').length,
      missed: goals.filter(g => g.status === 'missed').length
    };

    // Taux de réussite : achieved = 100%, partial = 50%
    stats.rate = Math.round(
      ((stats.achieved + stats.partial * 0.5) / stats.total) * 100
    );

    return stats;
  }

  /**
   * Ajoute un nouveau goal
   * @param {string} text
   */
  addGoal(text) {
    if (!text.trim()) return;

    const { goals } = this.state;
    const { maxGoals } = this.props;

    if (goals.length >= maxGoals) {
      eventBus.emit('notification:show', {
        type: 'warning',
        message: `Maximum ${maxGoals} objectifs`
      });
      return;
    }

    const newGoals = [...goals, { text: text.trim(), status: null }];

    this.setState({ goals: newGoals, newGoalText: '' });
    this._syncStore(newGoals);

    eventBus.emit('goals:added', { text });
  }

  /**
   * Supprime un goal
   * @param {number} index
   */
  removeGoal(index) {
    const { goals } = this.state;
    const newGoals = goals.filter((_, i) => i !== index);

    this.setState({ goals: newGoals });
    this._syncStore(newGoals);

    eventBus.emit('goals:removed', { index });
  }

  /**
   * Change le statut d'un goal
   * @param {number} index
   * @param {string} status
   */
  setGoalStatus(index, status) {
    const { goals } = this.state;
    const newGoals = goals.map((goal, i) =>
      i === index ? { ...goal, status } : goal
    );

    this.setState({ goals: newGoals });
    this._syncStore(newGoals);

    eventBus.emit('goals:statusChanged', { index, status });
  }

  /**
   * Met à jour le texte d'un goal
   * @param {number} index
   * @param {string} text
   */
  updateGoalText(index, text) {
    const { goals } = this.state;
    const newGoals = goals.map((goal, i) =>
      i === index ? { ...goal, text } : goal
    );

    this.setState({ goals: newGoals, editingIndex: null });
    this._syncStore(newGoals);
  }

  /**
   * Synchronise avec le store
   * @param {Array} goals
   * @private
   */
  _syncStore(goals) {
    store.dispatch({ sprintGoals: goals });
  }

  /**
   * Rendu du composant
   */
  render() {
    const { editable, showStats } = this.props;
    const { goals } = this.state;
    const stats = this._calculateStats();

    return `
      <div class="sprint-goals">
        <div class="sprint-goals__header">
          <h3 class="sprint-goals__title">Sprint Goals</h3>
          ${showStats && goals.length > 0 ? this._renderStats(stats) : ''}
        </div>

        <div class="sprint-goals__list">
          ${goals.length > 0
            ? goals.map((goal, index) => this._renderGoal(goal, index)).join('')
            : this._renderEmptyState()
          }
        </div>

        ${editable ? this._renderAddForm() : ''}
      </div>
    `;
  }

  /**
   * Rendu des statistiques
   * @param {Object} stats
   * @returns {string}
   * @private
   */
  _renderStats(stats) {
    const rateClass = stats.rate >= 80 ? 'good' : stats.rate >= 50 ? 'warning' : 'danger';

    return `
      <div class="sprint-goals__stats">
        <span class="sprint-goals__rate sprint-goals__rate--${rateClass}">
          ${stats.rate}%
        </span>
        <span class="sprint-goals__count">
          ${stats.achieved}/${stats.total} atteints
        </span>
      </div>
    `;
  }

  /**
   * Rendu d'un goal
   * @param {Object} goal
   * @param {number} index
   * @returns {string}
   * @private
   */
  _renderGoal(goal, index) {
    const { editable } = this.props;
    const { editingIndex } = this.state;
    const statusConfig = STATUS_CONFIG[goal.status] || STATUS_CONFIG.null;

    const isEditing = editable && editingIndex === index;

    return `
      <div class="goal-item ${statusConfig.className}" data-index="${index}">
        <div class="goal-item__status">
          <span class="goal-item__icon">${statusConfig.icon}</span>
        </div>

        <div class="goal-item__content">
          ${isEditing ? `
            <input type="text"
                   class="goal-item__input"
                   value="${this.escapeHtml(goal.text)}"
                   data-ref="editInput"
                   data-action="save-edit" />
          ` : `
            <p class="goal-item__text">${this.escapeHtml(goal.text)}</p>
          `}
        </div>

        ${editable ? `
          <div class="goal-item__actions">
            ${!isEditing ? `
              <button class="goal-item__btn goal-item__btn--edit"
                      data-action="edit"
                      data-index="${index}"
                      title="Modifier">
                ✎
              </button>
            ` : `
              <button class="goal-item__btn goal-item__btn--save"
                      data-action="save"
                      data-index="${index}"
                      title="Enregistrer">
                ✓
              </button>
            `}
            <button class="goal-item__btn goal-item__btn--delete"
                    data-action="delete"
                    data-index="${index}"
                    title="Supprimer">
              ✕
            </button>
          </div>

          <div class="goal-item__status-selector">
            ${this._renderStatusButtons(index, goal.status)}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Rendu des boutons de statut
   * @param {number} index
   * @param {string} currentStatus
   * @returns {string}
   * @private
   */
  _renderStatusButtons(index, currentStatus) {
    return ['achieved', 'partial', 'missed'].map(status => {
      const config = STATUS_CONFIG[status];
      const isActive = currentStatus === status;

      return `
        <button class="status-btn ${config.className} ${isActive ? 'status-btn--active' : ''}"
                data-action="set-status"
                data-index="${index}"
                data-status="${status}"
                title="${config.label}">
          ${config.icon}
        </button>
      `;
    }).join('');
  }

  /**
   * Rendu du formulaire d'ajout
   * @returns {string}
   * @private
   */
  _renderAddForm() {
    const { goals } = this.state;
    const { maxGoals } = this.props;
    const canAdd = goals.length < maxGoals;

    return `
      <div class="sprint-goals__add ${!canAdd ? 'sprint-goals__add--disabled' : ''}">
        <input type="text"
               class="sprint-goals__input"
               placeholder="${canAdd ? 'Ajouter un objectif...' : `Maximum ${maxGoals} objectifs`}"
               data-ref="addInput"
               ${!canAdd ? 'disabled' : ''} />
        <button class="sprint-goals__btn btn btn--primary"
                data-action="add"
                ${!canAdd ? 'disabled' : ''}>
          Ajouter
        </button>
      </div>
    `;
  }

  /**
   * Rendu de l'état vide
   * @returns {string}
   * @private
   */
  _renderEmptyState() {
    const { editable } = this.props;

    return `
      <div class="sprint-goals__empty">
        <p>Aucun Sprint Goal défini</p>
        ${editable ? '<p class="text-muted">Ajoutez vos objectifs ci-dessous</p>' : ''}
      </div>
    `;
  }

  /**
   * Définition des événements
   */
  events() {
    return {
      'click [data-action="add"]': this._handleAdd,
      'click [data-action="delete"]': this._handleDelete,
      'click [data-action="edit"]': this._handleEdit,
      'click [data-action="save"]': this._handleSave,
      'click [data-action="set-status"]': this._handleSetStatus,
      'keypress [data-ref="addInput"]': this._handleKeyPress,
      'keypress [data-ref="editInput"]': this._handleEditKeyPress
    };
  }

  /**
   * Gestionnaire d'ajout
   * @param {Event} e
   * @private
   */
  _handleAdd(e) {
    const input = this.getRef('addInput');
    if (input && input.value.trim()) {
      this.addGoal(input.value);
    }
  }

  /**
   * Gestionnaire de suppression
   * @param {Event} e
   * @private
   */
  _handleDelete(e) {
    const index = parseInt(e.target.dataset.index, 10);
    if (!isNaN(index)) {
      this.removeGoal(index);
    }
  }

  /**
   * Gestionnaire d'édition
   * @param {Event} e
   * @private
   */
  _handleEdit(e) {
    const index = parseInt(e.target.dataset.index, 10);
    if (!isNaN(index)) {
      this.setState({ editingIndex: index });
    }
  }

  /**
   * Gestionnaire de sauvegarde
   * @param {Event} e
   * @private
   */
  _handleSave(e) {
    const index = parseInt(e.target.dataset.index, 10);
    const input = this.getRef('editInput');
    if (!isNaN(index) && input && input.value.trim()) {
      this.updateGoalText(index, input.value);
    }
  }

  /**
   * Gestionnaire de changement de statut
   * @param {Event} e
   * @private
   */
  _handleSetStatus(e) {
    const index = parseInt(e.target.dataset.index, 10);
    const status = e.target.dataset.status;
    if (!isNaN(index) && status) {
      this.setGoalStatus(index, status);
    }
  }

  /**
   * Gestionnaire de touche (formulaire d'ajout)
   * @param {KeyboardEvent} e
   * @private
   */
  _handleKeyPress(e) {
    if (e.key === 'Enter') {
      this._handleAdd(e);
    }
  }

  /**
   * Gestionnaire de touche (édition)
   * @param {KeyboardEvent} e
   * @private
   */
  _handleEditKeyPress(e) {
    if (e.key === 'Enter') {
      const index = this.state.editingIndex;
      if (index !== null && e.target.value.trim()) {
        this.updateGoalText(index, e.target.value);
      }
    }
  }

  /**
   * Récupère les goals
   * @returns {Array}
   */
  getGoals() {
    return this.state.goals;
  }

  /**
   * Définit les goals
   * @param {Array} goals
   */
  setGoals(goals) {
    this.setState({ goals });
  }
}
