/**
 * ==========================================================================
 * ADMINPAGE.JS - Page de préparation/administration
 * ==========================================================================
 *
 * Page permettant de :
 * - Charger les fichiers CSV EazyBI
 * - Saisir manuellement les données du sprint
 * - Définir les Sprint Goals
 * - Configurer les Story Points
 * - Gérer les snapshots
 *
 * ==========================================================================
 */

import Component from '../components/Component.js';
import FileUploader from '../components/FileUploader.js';
import SprintGoals from '../components/SprintGoals.js';
import store from '../core/store.js';
import eventBus from '../core/eventBus.js';
import config from '../core/config.js';
import dataTransformerV2, { getAvailableSprints } from '../services/dataTransformerV2.js';
import storageService from '../services/storageService.js';
import { validateSprintInput } from '../utils/validators.js';

// =========================================================================
// CLASSE ADMINPAGE
// =========================================================================

export default class AdminPage extends Component {
  constructor(container, props = {}) {
    super(container, props);

    // Sous-composants
    this.fileUploader = null;
    this.sprintGoals = null;
  }

  /**
   * Initialisation
   */
  init() {
    this.state = {
      // Infos sprint (texte libre)
      teamName: '',
      sprintName: 'Sprint',

      // Story Points pour 6 sprints (du plus récent au plus ancien)
      // Index 0 = sprint actuel (le 6ème), Index 5 = sprint le plus ancien
      storyPoints: [
        { committed: '', delivered: '' },  // Sprint actuel
        { committed: '', delivered: '' },  // Sprint -1
        { committed: '', delivered: '' },  // Sprint -2
        { committed: '', delivered: '' },  // Sprint -3
        { committed: '', delivered: '' },  // Sprint -4
        { committed: '', delivered: '' }   // Sprint -5 (le plus ancien)
      ],

      // Sélection de sprint
      availableSprints: [],
      selectedSprint: null,
      rawCsvData: null, // Données brutes pour re-transformation

      // Sélection d'équipes (multi-select)
      availableTeams: [],
      selectedTeams: [],

      // État
      csvLoaded: false,
      errors: {},
      snapshots: [],
      isLoading: false
    };

    // Charger les snapshots existants
    this._loadSnapshots();

    // S'abonner aux changements du store (mise à jour DOM directe sans re-rendu)
    this.subscribe(
      state => state.csvLoaded,
      (csvLoaded) => {
        // Mettre à jour le state interne sans re-rendre
        this.state.csvLoaded = csvLoaded;
        // Mettre à jour le bouton de sauvegarde directement
        this._updateSaveButton();
      }
    );
  }

  /**
   * Met à jour l'état du bouton de sauvegarde
   * @private
   */
  _updateSaveButton() {
    const saveBtn = this.$('[data-action="save-snapshot"]');
    if (saveBtn) {
      const hasStoryPoints = this.state.storyPoints.some(sp => sp.committed !== '' || sp.delivered !== '');
      const canSave = this.state.csvLoaded || hasStoryPoints;
      saveBtn.disabled = !canSave;
    }
  }

  /**
   * Après montage
   */
  afterMount() {
    // Initialiser le FileUploader
    this.fileUploader = new FileUploader(
      this.$('[data-component="file-uploader"]'),
      {
        onComplete: this._handleFilesLoaded.bind(this),
        onFileLoaded: this._handleFileLoaded.bind(this)
      }
    );
    this.fileUploader.mount();

    // Initialiser les Sprint Goals
    this.sprintGoals = new SprintGoals(
      this.$('[data-component="sprint-goals"]'),
      {
        editable: true,
        goals: store.getState().sprintGoals || []
      }
    );
    this.sprintGoals.mount();
  }

  /**
   * Avant démontage
   */
  beforeUnmount() {
    // Synchroniser les valeurs du formulaire au store avant de quitter
    this._syncFormValuesToState();
    this._syncToStore();

    if (this.fileUploader) {
      this.fileUploader.unmount();
    }
    if (this.sprintGoals) {
      this.sprintGoals.unmount();
    }
  }

  /**
   * Charge les snapshots depuis le localStorage
   * @private
   */
  _loadSnapshots() {
    const snapshots = storageService.listSnapshots();
    this.state.snapshots = snapshots;
    // Mettre à jour la liste dans le DOM (si monté)
    if (this._isMounted) {
      this._updateSnapshotsList();
    }
  }

  /**
   * Met à jour la liste des snapshots dans le DOM
   * @private
   */
  _updateSnapshotsList() {
    const container = this.$('[data-section="snapshots"] .admin-section__content');
    if (!container) return;

    const snapshots = this.state.snapshots;

    if (snapshots.length === 0) {
      container.innerHTML = `
        <div class="empty-state empty-state--small">
          <p>Aucun snapshot sauvegardé</p>
        </div>
      `;
    } else {
      container.innerHTML = `
        <ul class="snapshot-list">
          ${snapshots.map(snapshot => `
            <li class="snapshot-item">
              <div class="snapshot-item__info">
                <span class="snapshot-item__name">${this.escapeHtml(snapshot.name)}</span>
                <span class="snapshot-item__date">${snapshot.dateFormatted}</span>
              </div>
              <div class="snapshot-item__actions">
                <button class="btn btn--ghost btn--small"
                        data-action="load-snapshot"
                        data-id="${snapshot.id}"
                        title="Charger">
                  📥
                </button>
                <button class="btn btn--ghost btn--small btn--danger"
                        data-action="delete-snapshot"
                        data-id="${snapshot.id}"
                        title="Supprimer">
                  🗑️
                </button>
              </div>
            </li>
          `).join('')}
        </ul>
      `;
    }

    // Re-bind les événements pour les boutons de snapshots
    this._bindSnapshotEvents();
  }

  /**
   * Lie les événements des boutons de snapshots
   * @private
   */
  _bindSnapshotEvents() {
    this.$$('[data-action="load-snapshot"]').forEach(btn => {
      btn.addEventListener('click', this._handleLoadSnapshot.bind(this));
    });
    this.$$('[data-action="delete-snapshot"]').forEach(btn => {
      btn.addEventListener('click', this._handleDeleteSnapshot.bind(this));
    });
  }

  /**
   * Gestionnaire quand tous les fichiers sont chargés
   * @param {Object} csvData
   * @private
   */
  _handleFilesLoaded(csvData) {
    try {
      // Afficher le loader sans re-rendu
      this._showLoader(true);

      // Stocker les données brutes pour re-transformation
      this.state.rawCsvData = csvData;

      // Extraire les équipes disponibles depuis le CSV
      const teams = csvData.teams || [];
      this.state.availableTeams = teams;

      // Si une seule équipe, la sélectionner automatiquement
      // Sinon, aucune sélection par défaut (l'utilisateur choisit)
      if (teams.length === 1) {
        this.state.selectedTeams = [teams[0]];
        this.state.teamName = teams[0];
      } else {
        this.state.selectedTeams = [];
        this.state.teamName = '';
      }

      console.log('[AdminPage] Équipes chargées:', teams);

      // Récupérer les sprints disponibles
      const availableSprints = getAvailableSprints(csvData.tickets);
      this.state.availableSprints = availableSprints;

      // Sélectionner le dernier sprint par défaut
      const defaultSprint = availableSprints.length > 0
        ? availableSprints[availableSprints.length - 1].sprint
        : null;
      this.state.selectedSprint = defaultSprint;

      // Mettre à jour le nom du sprint
      const defaultLabel = availableSprints.find(s => s.sprint === defaultSprint)?.label;
      if (defaultLabel) {
        this.state.sprintName = defaultLabel;
      }

      // Marquer comme chargé AVANT de mettre à jour le formulaire
      this.state.csvLoaded = true;

      // Mettre à jour le formulaire d'infos sprint (affiche le dropdown/chips)
      this._updateSprintSelector();

      // Si plusieurs équipes, attendre la sélection avant de transformer
      if (teams.length > 1) {
        // Stocker les données brutes sans transformer
        store.dispatch({
          csvData,
          rawCsvData: csvData, // Données non filtrées pour la page secrète
          csvLoaded: true,
          sprintMetrics: null
        });

        eventBus.emit('notification:show', {
          type: 'info',
          message: `${teams.length} équipes détectées - sélectionnez les équipes à analyser`
        });
      } else {
        // Une seule équipe : transformer directement
        const sprintMetrics = dataTransformerV2.transformAllV2(csvData, defaultSprint, teams);

        store.dispatch({
          csvData,
          rawCsvData: csvData, // Données non filtrées pour la page secrète
          csvLoaded: true,
          sprintMetrics
        });

        eventBus.emit('notification:show', {
          type: 'success',
          message: 'Données chargées avec succès'
        });
      }

      // Mettre à jour le state interne sans re-rendu
      this.state.isLoading = false;
      this.state.csvLoaded = true;
      this._showLoader(false);
      this._updateSaveButton();

      // Mettre à jour la section Story Points (peut maintenant afficher les données auto)
      this._updateStoryPointsSection();

    } catch (error) {
      console.error('[AdminPage] Erreur transformation:', error);
      eventBus.emit('notification:show', {
        type: 'error',
        message: `Erreur: ${error.message}`
      });
      this.state.isLoading = false;
      this._showLoader(false);
    }
  }

  /**
   * Affiche/masque le loader
   * @param {boolean} show
   * @private
   */
  _showLoader(show) {
    const loader = this.$('.admin-page__loader');
    if (loader) {
      loader.style.display = show ? 'flex' : 'none';
    } else if (show) {
      // Créer le loader s'il n'existe pas
      const loaderEl = document.createElement('div');
      loaderEl.className = 'admin-page__loader';
      loaderEl.innerHTML = '<div class="loader"></div>';
      this.container.appendChild(loaderEl);
    }
  }

  /**
   * Met à jour la section Story Points dans le DOM
   * @private
   */
  _updateStoryPointsSection() {
    // Trouver la section Story Points
    const spSection = this.container?.querySelector('.admin-section--compact:last-child .admin-section__content--compact');
    if (spSection) {
      spSection.innerHTML = this._renderStoryPointsForm();
    }
  }

  /**
   * Met à jour le formulaire d'infos sprint dans le DOM (pour le dropdown)
   * @private
   */
  _updateSprintSelector() {
    // Re-rendre le formulaire d'infos sprint
    const formContainer = this.$('.admin-section--compact .admin-section__content--compact');
    if (formContainer) {
      formContainer.innerHTML = this._renderSprintInfoForm();

      // Bind l'événement change sur le select si présent
      const select = formContainer.querySelector('[data-action="select-sprint"]');
      if (select) {
        select.addEventListener('change', this._handleSprintSelect.bind(this));
      }

      // Bind les événements click sur les chips d'équipes
      formContainer.querySelectorAll('[data-action="toggle-team"]').forEach(chip => {
        chip.addEventListener('click', this._handleToggleTeam.bind(this));
      });
    }
  }

  /**
   * Gestionnaire de sélection de sprint
   * @param {Event} e
   * @private
   */
  _handleSprintSelect(e) {
    const sprintNum = parseInt(e.target.value, 10);
    if (sprintNum === this.state.selectedSprint) return;

    this.state.selectedSprint = sprintNum;

    // Mettre à jour le nom du sprint pour les snapshots
    const selectedLabel = this.state.availableSprints.find(s => s.sprint === sprintNum)?.label;
    if (selectedLabel) {
      this.state.sprintName = selectedLabel;
    }

    // Re-transformer les données avec le nouveau sprint
    if (this.state.rawCsvData) {
      const sprintMetrics = dataTransformerV2.transformAllV2(
        this.state.rawCsvData,
        sprintNum,
        this.state.selectedTeams
      );

      store.dispatch({ sprintMetrics });

      eventBus.emit('notification:show', {
        type: 'info',
        message: `Affichage: ${selectedLabel}`
      });

      // Mettre à jour la section Story Points (les données ont changé)
      this._updateStoryPointsSection();
    }

    // Synchroniser avec le store
    this._syncToStore();
  }

  /**
   * Gestionnaire quand un fichier est chargé
   * @param {string} type
   * @param {Object} data
   * @param {string} filename
   * @private
   */
  _handleFileLoaded(type, data, filename) {
    eventBus.emit('notification:show', {
      type: 'info',
      message: `${filename} chargé`
    });
  }

  /**
   * Met à jour les données manuelles
   * @param {Object} data
   */
  _updateManualData(data) {
    const validation = validateSprintInput(data);

    this.setState({
      ...data,
      errors: validation.errors
    });

    // Mettre à jour le store avec les données manuelles
    store.dispatch({
      manualInput: {
        teamName: data.teamName || this.state.teamName,
        sprintName: data.sprintName || this.state.sprintName,
        storyPointsCommitted: data.storyPointsCommitted !== ''
          ? parseInt(data.storyPointsCommitted, 10)
          : null,
        storyPointsDelivered: data.storyPointsDelivered !== ''
          ? parseInt(data.storyPointsDelivered, 10)
          : null
      }
    });
  }

  /**
   * Sauvegarde un snapshot
   */
  _saveSnapshot() {
    // Lire les valeurs actuelles depuis le DOM (au cas où blur n'a pas eu lieu)
    this._syncFormValuesToState();
    this._syncToStore();

    const state = store.getState();
    const name = `${this.state.sprintName} - ${this.state.teamName}`;

    try {
      storageService.saveSnapshot(name, state);
      this._loadSnapshots();

      eventBus.emit('notification:show', {
        type: 'success',
        message: 'Snapshot sauvegardé'
      });

      // Remettre à zéro pour la prochaine équipe
      this._resetForNextTeam();

    } catch (error) {
      eventBus.emit('notification:show', {
        type: 'error',
        message: `Erreur: ${error.message}`
      });
    }
  }

  /**
   * Remet à zéro l'application pour la prochaine équipe
   * @private
   */
  _resetForNextTeam() {
    // Story points vides pour 6 sprints
    const emptyStoryPoints = Array(6).fill(null).map(() => ({ committed: null, delivered: null }));

    // Réinitialiser le store
    store.dispatch({
      csvData: null,
      csvLoaded: false,
      sprintMetrics: null,
      manualInput: {
        teamName: '',
        sprintName: 'Sprint',
        storyPoints: emptyStoryPoints
      },
      sprintGoals: []
    });

    // Réinitialiser l'état local
    this.state.teamName = '';
    this.state.sprintName = 'Sprint';
    this.state.storyPoints = Array(6).fill(null).map(() => ({ committed: '', delivered: '' }));
    this.state.csvLoaded = false;
    this.state.availableSprints = [];
    this.state.selectedSprint = null;
    this.state.rawCsvData = null;

    // Mettre à jour les champs du formulaire
    this._updateFormFields();

    // Réinitialiser le FileUploader
    if (this.fileUploader) {
      this.fileUploader.resetAll();
    }

    // Réinitialiser les Sprint Goals
    if (this.sprintGoals) {
      this.sprintGoals.setGoals([]);
    }

    // Mettre à jour le bouton de sauvegarde et le sélecteur de sprint
    this._updateSaveButton();
    this._updateSprintSelector();
  }

  /**
   * Lit les valeurs du formulaire et les met dans le state
   * @private
   */
  _syncFormValuesToState() {
    const teamNameInput = this.$('#teamName');
    const sprintNameInput = this.$('#sprintName');

    if (teamNameInput) this.state.teamName = teamNameInput.value;
    if (sprintNameInput) this.state.sprintName = sprintNameInput.value;

    // Récupérer les story points des 6 sprints
    for (let i = 0; i < 6; i++) {
      const committedInput = this.$(`#sp-committed-${i}`);
      const deliveredInput = this.$(`#sp-delivered-${i}`);

      if (committedInput) this.state.storyPoints[i].committed = committedInput.value;
      if (deliveredInput) this.state.storyPoints[i].delivered = deliveredInput.value;
    }
  }

  /**
   * Charge un snapshot
   * @param {string} id
   */
  _loadSnapshot(id) {
    // loadSnapshot retourne directement les données, pas l'objet snapshot
    const data = storageService.loadSnapshot(id);
    if (data) {
      // S'assurer que sprintGoals est toujours défini (réinitialiser si absent)
      const dataWithGoals = {
        ...data,
        sprintGoals: data.sprintGoals || []
      };
      store.dispatch(dataWithGoals);

      // Mettre à jour l'état local et les champs sans re-rendu
      if (data.manualInput) {
        const { teamName, sprintName, storyPoints } = data.manualInput;

        // Mettre à jour le state interne
        this.state.teamName = teamName || '';
        this.state.sprintName = sprintName || 'Sprint';

        // Gérer la migration des anciens snapshots (storyPointsCommitted/Delivered) vers le nouveau format
        if (storyPoints && Array.isArray(storyPoints)) {
          this.state.storyPoints = storyPoints.map(sp => ({
            committed: sp?.committed !== null ? String(sp.committed) : '',
            delivered: sp?.delivered !== null ? String(sp.delivered) : ''
          }));
        } else if (data.manualInput.storyPointsCommitted !== undefined) {
          // Migration ancien format : mettre dans le premier sprint (actuel)
          this.state.storyPoints = Array(6).fill(null).map(() => ({ committed: '', delivered: '' }));
          this.state.storyPoints[0].committed = data.manualInput.storyPointsCommitted !== null
            ? String(data.manualInput.storyPointsCommitted) : '';
          this.state.storyPoints[0].delivered = data.manualInput.storyPointsDelivered !== null
            ? String(data.manualInput.storyPointsDelivered) : '';
        }

        // Mettre à jour les champs du formulaire dans le DOM
        this._updateFormFields();
      }

      // Mettre à jour l'état csvLoaded si présent dans le snapshot
      if (data.csvLoaded !== undefined) {
        this.state.csvLoaded = data.csvLoaded;
        this._updateSaveButton();
      }

      // Mettre à jour le composant SprintGoals directement
      if (this.sprintGoals) {
        this.sprintGoals.setGoals(dataWithGoals.sprintGoals);
      }

      // Récupérer le nom du snapshot pour la notification
      const snapshots = storageService.listSnapshots();
      const snapshotInfo = snapshots.find(s => s.id === id);

      eventBus.emit('notification:show', {
        type: 'success',
        message: `Snapshot "${snapshotInfo?.name || 'sans nom'}" chargé`
      });
    }
  }

  /**
   * Met à jour les champs du formulaire dans le DOM
   * @private
   */
  _updateFormFields() {
    const teamNameInput = this.$('#teamName');
    const sprintNameInput = this.$('#sprintName');

    if (teamNameInput) teamNameInput.value = this.state.teamName;
    if (sprintNameInput) sprintNameInput.value = this.state.sprintName;

    // Mettre à jour les story points des 6 sprints
    for (let i = 0; i < 6; i++) {
      const committedInput = this.$(`#sp-committed-${i}`);
      const deliveredInput = this.$(`#sp-delivered-${i}`);

      if (committedInput) committedInput.value = this.state.storyPoints[i].committed;
      if (deliveredInput) deliveredInput.value = this.state.storyPoints[i].delivered;
    }
  }

  /**
   * Supprime un snapshot
   * @param {string} id
   */
  _deleteSnapshot(id) {
    storageService.deleteSnapshot(id);
    this._loadSnapshots();

    eventBus.emit('notification:show', {
      type: 'info',
      message: 'Snapshot supprimé'
    });
  }

  /**
   * Rendu du composant
   */
  render() {
    const {
      teamName, sprintName, storyPoints,
      errors, snapshots, isLoading, csvLoaded
    } = this.state;
    const hasStoryPoints = storyPoints.some(sp => sp.committed !== '' || sp.delivered !== '');

    return `
      <div class="admin-page">
        <div class="admin-page__header">
          <h2 class="admin-page__title">Préparation de la Sprint Review</h2>
          <p class="admin-page__subtitle">
            Chargez vos données et configurez les informations du sprint
          </p>
        </div>

        <div class="admin-page__grid">
          <!-- Colonne gauche : CSV Upload -->
          <section class="admin-section">
            <div class="admin-section__header">
              <h3 class="admin-section__title">Fichiers CSV EazyBI</h3>
            </div>
            <div class="admin-section__content">
              <div data-component="file-uploader"></div>
            </div>
          </section>

          <!-- Colonne droite : Infos Sprint + Story Points empilés -->
          <div class="admin-column">
            <section class="admin-section admin-section--compact">
              <div class="admin-section__header">
                <h3 class="admin-section__title">Informations Sprint</h3>
              </div>
              <div class="admin-section__content admin-section__content--compact">
                ${this._renderSprintInfoForm()}
              </div>
            </section>

            <section class="admin-section admin-section--compact">
              <div class="admin-section__header">
                <h3 class="admin-section__title">Story Points</h3>
              </div>
              <div class="admin-section__content admin-section__content--compact">
                ${this._renderStoryPointsForm()}
              </div>
            </section>
          </div>

          <!-- Sprint Goals : pleine largeur -->
          <section class="admin-section admin-section--full">
            <div class="admin-section__header">
              <h3 class="admin-section__title">Sprint Goals</h3>
            </div>
            <div class="admin-section__content">
              <div data-component="sprint-goals"></div>
            </div>
          </section>

          <!-- Snapshots -->
          <section class="admin-section admin-section--full" data-section="snapshots">
            <div class="admin-section__header">
              <h3 class="admin-section__title">Snapshots</h3>
              <button class="btn btn--primary btn--small"
                      data-action="save-snapshot"
                      ${!csvLoaded && !hasStoryPoints ? 'disabled' : ''}>
                Sauvegarder
              </button>
            </div>
            <div class="admin-section__content">
              ${this._renderSnapshots()}
            </div>
          </section>
        </div>

        ${isLoading ? '<div class="admin-page__loader"><div class="loader"></div></div>' : ''}
      </div>
    `;
  }

  /**
   * Rendu du formulaire d'infos sprint
   * @returns {string}
   * @private
   */
  _renderSprintInfoForm() {
    const { teamName, sprintName, errors, csvLoaded, availableSprints, selectedSprint, availableTeams, selectedTeams } = this.state;

    // Avec CSV chargé : afficher le dropdown des sprints
    const showSprintDropdown = csvLoaded && availableSprints.length > 0;
    // Avec plusieurs équipes : afficher les chips
    const showTeamChips = csvLoaded && availableTeams.length > 1;

    return `
      <form class="form" data-form="sprint-info">
        <div class="form__group">
          <label class="form__label" for="teamName">
            ${showTeamChips ? 'Équipes' : 'Nom de l\'équipe'}
          </label>
          ${showTeamChips ? `
            <div class="team-chips" data-component="team-chips">
              ${availableTeams.map(team => `
                <button type="button"
                        class="team-chip ${selectedTeams.includes(team) ? 'team-chip--selected' : ''}"
                        data-action="toggle-team"
                        data-team="${this.escapeHtml(team)}">
                  ${this.escapeHtml(team)}
                </button>
              `).join('')}
            </div>
            ${selectedTeams.length === 0 ? `
              <span class="form__hint form__hint--warning">Sélectionnez au moins une équipe</span>
            ` : selectedTeams.length === availableTeams.length ? `
              <span class="form__hint">Toutes les équipes sélectionnées</span>
            ` : `
              <span class="form__hint">${selectedTeams.length} équipe(s) sélectionnée(s)</span>
            `}
          ` : `
            <input type="text"
                   id="teamName"
                   name="teamName"
                   class="form__input ${errors.teamName ? 'form__input--error' : ''}"
                   value="${this.escapeHtml(teamName)}"
                   placeholder="Ex: Data Platform" />
            ${errors.teamName ? `<span class="form__error">${errors.teamName}</span>` : ''}
          `}
        </div>

        <div class="form__group">
          <label class="form__label" for="${showSprintDropdown ? 'sprintSelect' : 'sprintName'}">
            Sprint${showSprintDropdown ? ' à afficher' : ''}
          </label>
          ${showSprintDropdown ? `
            <select id="sprintSelect"
                    name="sprintSelect"
                    class="form__input form__select"
                    data-action="select-sprint">
              ${availableSprints.map(s => `
                <option value="${s.sprint}" ${s.sprint === selectedSprint ? 'selected' : ''}>
                  ${s.label}
                </option>
              `).join('')}
            </select>
          ` : `
            <input type="text"
                   id="sprintName"
                   name="sprintName"
                   class="form__input ${errors.sprintName ? 'form__input--error' : ''}"
                   value="${this.escapeHtml(sprintName)}"
                   placeholder="Ex: Sprint5, PI 4.2, etc." />
            ${errors.sprintName ? `<span class="form__error">${errors.sprintName}</span>` : ''}
          `}
        </div>
      </form>
    `;
  }

  /**
   * Rendu du formulaire Story Points
   * @returns {string}
   * @private
   */
  _renderStoryPointsForm() {
    const { storyPoints, csvLoaded } = this.state;

    // Vérifier si les données CSV contiennent des story points
    const storeState = store.getState();
    const csvStoryPoints = storeState.sprintMetrics?.storyPoints;
    const hasCSVStoryPoints = csvStoryPoints?.isFromCSV;

    // Si le CSV contient des story points, afficher un résumé
    if (hasCSVStoryPoints) {
      return this._renderAutoStoryPoints(csvStoryPoints);
    }

    // Sinon, afficher le formulaire de saisie manuelle
    // Labels pour les 6 sprints (du plus récent au plus ancien)
    const sprintLabels = [
      'Sprint actuel',
      'Sprint -1',
      'Sprint -2',
      'Sprint -3',
      'Sprint -4',
      'Sprint -5'
    ];

    return `
      ${csvLoaded ? `
        <div class="admin-notice admin-notice--info">
          <span class="admin-notice__icon">💡</span>
          <span class="admin-notice__text">Ajoutez la colonne "Issue Story Points" dans votre export EazyBI pour automatiser ce calcul.</span>
        </div>
      ` : ''}
      <form class="form" data-form="story-points">
        <div class="story-points-grid">
          <div class="story-points-grid__header">
            <span></span>
            <span>Engagés</span>
            <span>Livrés</span>
          </div>
          ${sprintLabels.map((label, index) => `
            <div class="story-points-grid__row ${index === 0 ? 'story-points-grid__row--current' : ''}">
              <span class="story-points-grid__label">${label}</span>
              <input type="number"
                     id="sp-committed-${index}"
                     name="sp-committed-${index}"
                     class="form__input form__input--small"
                     value="${storyPoints[index].committed}"
                     min="0"
                     placeholder="0" />
              <input type="number"
                     id="sp-delivered-${index}"
                     name="sp-delivered-${index}"
                     class="form__input form__input--small"
                     value="${storyPoints[index].delivered}"
                     min="0"
                     placeholder="0" />
            </div>
          `).join('')}
        </div>
      </form>
    `;
  }

  /**
   * Rendu des Story Points calculés automatiquement depuis le CSV
   * @param {Object} csvStoryPoints - Données story points du CSV
   * @returns {string}
   * @private
   */
  _renderAutoStoryPoints(csvStoryPoints) {
    const {
      sprints,
      currentCommitted,
      currentDelivered,
      currentCompletion,
      avgCommitted,
      avgDelivered,
      previousSprintsCount
    } = csvStoryPoints;

    // Classe pour le % completion
    const getCompletionClass = (pct) => {
      if (pct >= 90) return 'success';
      if (pct < 70) return 'danger';
      return 'warning';
    };

    return `
      <div class="admin-notice admin-notice--success">
        <span class="admin-notice__icon">✓</span>
        <span class="admin-notice__text">Story Points calculés automatiquement depuis le CSV</span>
      </div>
      <div class="story-points-auto">
        <div class="story-points-auto__header">
          <span></span>
          <span>Engagés</span>
          <span>Livrés</span>
          <span>%</span>
        </div>
        ${sprints.slice(-3).reverse().map((s, idx) => `
          <div class="story-points-auto__row ${idx === 0 ? 'story-points-auto__row--current' : ''}">
            <span class="story-points-auto__label">${s.label}</span>
            <span class="story-points-auto__value">${s.committed}</span>
            <span class="story-points-auto__value">${s.delivered}</span>
            <span class="story-points-auto__badge story-points-auto__badge--${getCompletionClass(s.completion)}">${s.completion}%</span>
          </div>
        `).join('')}
        ${previousSprintsCount > 0 ? `
          <div class="story-points-auto__row story-points-auto__row--avg">
            <span class="story-points-auto__label">Moyenne</span>
            <span class="story-points-auto__value">${avgCommitted.toFixed(1)}</span>
            <span class="story-points-auto__value">${avgDelivered.toFixed(1)}</span>
            <span class="story-points-auto__badge">-</span>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Rendu de la liste des snapshots
   * @returns {string}
   * @private
   */
  _renderSnapshots() {
    const { snapshots } = this.state;

    if (snapshots.length === 0) {
      return `
        <div class="empty-state empty-state--small">
          <p>Aucun snapshot sauvegardé</p>
        </div>
      `;
    }

    return `
      <ul class="snapshot-list">
        ${snapshots.map(snapshot => `
          <li class="snapshot-item">
            <div class="snapshot-item__info">
              <span class="snapshot-item__name">${this.escapeHtml(snapshot.name)}</span>
              <span class="snapshot-item__date">${snapshot.dateFormatted}</span>
            </div>
            <div class="snapshot-item__actions">
              <button class="btn btn--ghost btn--small"
                      data-action="load-snapshot"
                      data-id="${snapshot.id}"
                      title="Charger">
                📥
              </button>
              <button class="btn btn--ghost btn--small btn--danger"
                      data-action="delete-snapshot"
                      data-id="${snapshot.id}"
                      title="Supprimer">
                🗑️
              </button>
            </div>
          </li>
        `).join('')}
      </ul>
    `;
  }

  /**
   * Définition des événements
   */
  events() {
    return {
      'blur [data-form="sprint-info"] input': this._handleInputBlur,
      'blur [data-form="story-points"] input': this._handleInputBlur,
      'change [data-action="select-sprint"]': this._handleSprintSelect,
      'click [data-action="toggle-team"]': this._handleToggleTeam,
      'click [data-action="save-snapshot"]': this._handleSaveSnapshot,
      'click [data-action="load-snapshot"]': this._handleLoadSnapshot,
      'click [data-action="delete-snapshot"]': this._handleDeleteSnapshot
    };
  }

  /**
   * Gestionnaire de toggle d'équipe (chips)
   * @param {Event} e
   * @private
   */
  _handleToggleTeam(e) {
    const team = e.target.dataset.team;
    if (!team) return;

    const { selectedTeams } = this.state;
    const isSelected = selectedTeams.includes(team);

    if (isSelected) {
      // Retirer l'équipe
      this.state.selectedTeams = selectedTeams.filter(t => t !== team);
    } else {
      // Ajouter l'équipe
      this.state.selectedTeams = [...selectedTeams, team];
    }

    // Mettre à jour le nom d'équipe affiché
    this._updateTeamNameFromSelection();

    // Re-transformer les données avec les équipes filtrées
    this._applyTeamFilter();

    // Mettre à jour l'UI des chips
    this._updateSprintSelector();
  }

  /**
   * Met à jour le nom d'équipe depuis la sélection
   * @private
   */
  _updateTeamNameFromSelection() {
    const { selectedTeams, availableTeams } = this.state;

    if (selectedTeams.length === 0) {
      this.state.teamName = '';
    } else if (selectedTeams.length === 1) {
      this.state.teamName = selectedTeams[0];
    } else if (selectedTeams.length === availableTeams.length) {
      this.state.teamName = 'Toutes les équipes';
    } else {
      this.state.teamName = selectedTeams.join(', ');
    }

    this._syncToStore();
  }

  /**
   * Applique le filtre d'équipes et re-transforme les données
   * @private
   */
  _applyTeamFilter() {
    if (!this.state.rawCsvData) return;

    const { selectedTeams, availableTeams } = this.state;

    // Si aucune équipe sélectionnée et plusieurs dispo, ne pas charger de données
    if (selectedTeams.length === 0 && availableTeams.length > 1) {
      console.log('[AdminPage] Aucune équipe sélectionnée, en attente...');
      store.dispatch({ sprintMetrics: null });
      return;
    }

    const allTickets = this.state.rawCsvData.tickets;

    // Filtrer les tickets par équipes sélectionnées (ou tous si une seule équipe)
    const filteredTickets = selectedTeams.length > 0
      ? allTickets.filter(t => selectedTeams.includes(t.team))
      : allTickets;

    console.log('[AdminPage] Filtre équipes:', selectedTeams, '→', filteredTickets.length, 'tickets');

    // Créer une copie des données avec les tickets filtrés
    const filteredData = {
      ...this.state.rawCsvData,
      tickets: filteredTickets
    };

    // Récupérer les sprints disponibles pour les données filtrées
    const availableSprints = getAvailableSprints(filteredTickets);
    this.state.availableSprints = availableSprints;

    // Sélectionner le dernier sprint par défaut si non défini
    if (availableSprints.length > 0) {
      const lastSprint = availableSprints[availableSprints.length - 1];
      if (!this.state.selectedSprint || !availableSprints.find(s => s.sprint === this.state.selectedSprint)) {
        this.state.selectedSprint = lastSprint.sprint;
        this.state.sprintName = lastSprint.label;
      }
    }

    // Transformer les données filtrées
    const sprintMetrics = dataTransformerV2.transformAllV2(
      filteredData,
      this.state.selectedSprint,
      this.state.selectedTeams
    );

    // Mettre à jour le store
    store.dispatch({
      csvData: filteredData,
      sprintMetrics
    });

    // Mettre à jour la section Story Points
    this._updateStoryPointsSection();
  }

  /**
   * Gestionnaire de blur sur les inputs (sauvegarde sans re-rendu)
   * @param {Event} e
   * @private
   */
  _handleInputBlur(e) {
    const { name, value } = e.target;

    // Gérer les inputs story points (sp-committed-X ou sp-delivered-X)
    if (name.startsWith('sp-')) {
      const parts = name.split('-');  // ['sp', 'committed'|'delivered', '0-5']
      const type = parts[1];  // 'committed' ou 'delivered'
      const index = parseInt(parts[2], 10);

      if (this.state.storyPoints[index]) {
        this.state.storyPoints[index][type] = value;
      }
    } else {
      // Mettre à jour le state interne sans re-rendre
      this.state[name] = value;
    }

    // Synchroniser avec le store
    this._syncToStore();
  }

  /**
   * Synchronise les données avec le store
   * @private
   */
  _syncToStore() {
    // Convertir les story points en nombres (ou null si vide)
    const storyPoints = this.state.storyPoints.map(sp => ({
      committed: sp.committed !== '' ? parseInt(sp.committed, 10) : null,
      delivered: sp.delivered !== '' ? parseInt(sp.delivered, 10) : null
    }));

    store.dispatch({
      manualInput: {
        teamName: this.state.teamName,
        sprintName: this.state.sprintName,
        storyPoints: storyPoints
      }
    });
  }

  /**
   * Gestionnaire sauvegarde snapshot
   * @private
   */
  _handleSaveSnapshot() {
    this._saveSnapshot();
  }

  /**
   * Gestionnaire chargement snapshot
   * @param {Event} e
   * @private
   */
  _handleLoadSnapshot(e) {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id) {
      this._loadSnapshot(id);
    }
  }

  /**
   * Gestionnaire suppression snapshot
   * @param {Event} e
   * @private
   */
  _handleDeleteSnapshot(e) {
    const id = e.target.closest('[data-id]')?.dataset.id;
    if (id && confirm('Supprimer ce snapshot ?')) {
      this._deleteSnapshot(id);
    }
  }
}
