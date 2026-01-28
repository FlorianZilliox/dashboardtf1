/**
 * ==========================================================================
 * FILEUPLOADER.JS - Composant upload de fichiers CSV
 * ==========================================================================
 *
 * Gère l'upload des fichiers CSV EazyBI :
 * - Drag & Drop
 * - Input file classique
 * - Validation des fichiers
 * - Checklist des fichiers requis
 * - Parsing et stockage
 *
 * FICHIERS ATTENDUS :
 * - Bugs.csv
 * - Cycle Time.csv
 * - Throughput.csv
 * - Time in status.csv
 *
 * USAGE :
 *   const uploader = new FileUploader('#container', {
 *     onComplete: (data) => console.log('All files loaded', data)
 *   });
 *
 * ==========================================================================
 */

import Component from './Component.js';
import { parseUnifiedCSV, parseTimeInStatusCSV } from '../services/csvParserV2.js';
import store from '../core/store.js';
import eventBus from '../core/eventBus.js';
import config from '../core/config.js';
import { isValidCSVFile } from '../utils/validators.js';

// =========================================================================
// CONFIGURATION
// =========================================================================

const REQUIRED_FILES = config.csv.requiredFiles;

// =========================================================================
// CLASSE FILEUPLOADER
// =========================================================================

export default class FileUploader extends Component {
  /**
   * @param {string|HTMLElement} container
   * @param {Object} props
   * @param {Function} props.onComplete - Callback quand tous les fichiers sont chargés
   * @param {Function} props.onFileLoaded - Callback à chaque fichier chargé
   */
  constructor(container, props = {}) {
    super(container, {
      onComplete: null,
      onFileLoaded: null,
      showChecklist: true,
      ...props
    });
  }

  /**
   * Retourne la liste des fichiers requis
   * @returns {Array}
   */
  _getRequiredFiles() {
    return REQUIRED_FILES;
  }

  /**
   * Initialisation
   */
  init() {
    this.state = {
      files: {},
      loadedFiles: {},
      isDragging: false,
      isLoading: false,
      errors: []
    };

    // Initialiser le statut des fichiers requis selon la version
    const requiredFiles = this._getRequiredFiles();
    requiredFiles.forEach(file => {
      this.state.files[file.key] = {
        name: file.name,
        loaded: false,
        data: null
      };
    });
  }

  /**
   * Après montage : ajouter les event listeners drag & drop
   */
  afterMount() {
    this._setupDragAndDrop();
  }

  /**
   * Configure le drag & drop
   * @private
   */
  _setupDragAndDrop() {
    const dropZone = this.$('.file-upload__dropzone');
    if (!dropZone) return;

    // Prévenir le comportement par défaut
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
      dropZone.addEventListener(eventName, this._preventDefaults.bind(this));
      document.body.addEventListener(eventName, this._preventDefaults.bind(this));
    });

    // Gérer le drag enter/leave - modifier directement la classe sans re-rendre
    dropZone.addEventListener('dragenter', () => {
      dropZone.classList.add('file-upload__dropzone--active');
    });

    dropZone.addEventListener('dragleave', (e) => {
      if (!dropZone.contains(e.relatedTarget)) {
        dropZone.classList.remove('file-upload__dropzone--active');
      }
    });

    // Gérer le drop
    dropZone.addEventListener('drop', (e) => {
      dropZone.classList.remove('file-upload__dropzone--active');
      this._handleDrop(e);
    });
  }

  /**
   * Prévient le comportement par défaut
   * @param {Event} e
   * @private
   */
  _preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  /**
   * Gère le drop de fichiers
   * @param {DragEvent} e
   * @private
   */
  async _handleDrop(e) {
    const files = Array.from(e.dataTransfer.files);
    await this._processFiles(files);
  }

  /**
   * Gère la sélection de fichiers via input
   * @param {Event} e
   * @private
   */
  async _handleFileSelect(e) {
    const files = Array.from(e.target.files);
    if (files.length > 0) {
      await this._processFiles(files);
    }
    e.target.value = ''; // Reset pour permettre de re-sélectionner
  }

  /**
   * Affiche/masque le loader
   * @param {boolean} show
   * @private
   */
  _showLoading(show) {
    const loading = this.getRef('loading');
    if (loading) {
      loading.style.display = show ? 'flex' : 'none';
    }
  }

  /**
   * Affiche les erreurs
   * @param {string[]} errors
   * @private
   */
  _showErrors(errors) {
    const container = this.getRef('errors');
    if (!container) return;

    if (errors.length === 0) {
      container.innerHTML = '';
      return;
    }

    container.innerHTML = errors.map(error => `
      <div class="file-upload__error">
        <span class="file-upload__error-icon">⚠️</span>
        <span>${this.escapeHtml(error)}</span>
      </div>
    `).join('');
  }

  /**
   * Met à jour un item de la checklist
   * @param {string} key
   * @param {boolean} loaded
   * @private
   */
  _updateChecklistItem(key, loaded) {
    const item = this.$(`[data-file-key="${key}"]`);
    if (!item) return;

    if (loaded) {
      item.classList.add('file-upload__checklist-item--loaded');
      const icon = item.querySelector('.file-upload__checklist-icon');
      if (icon) icon.textContent = '✓';
    } else {
      item.classList.remove('file-upload__checklist-item--loaded');
      const icon = item.querySelector('.file-upload__checklist-icon');
      if (icon) icon.textContent = '○';
    }

    // Mettre à jour le compteur
    this._updateChecklistCount();
  }

  /**
   * Met à jour le compteur de la checklist
   * @private
   */
  _updateChecklistCount() {
    const countEl = this.$('.file-upload__checklist-count');
    if (!countEl) return;

    const loaded = Object.values(this.state.files).filter(f => f.loaded).length;
    const total = Object.keys(this.state.files).length;
    countEl.textContent = `${loaded}/${total}`;
  }

  /**
   * Lit le contenu d'un fichier
   * @param {File} file
   * @returns {Promise<string>}
   * @private
   */
  _readFileContent(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target.result);
      reader.onerror = (e) => reject(new Error('Erreur de lecture du fichier'));
      reader.readAsText(file);
    });
  }

  /**
   * Traite les fichiers sélectionnés
   * @param {File[]} files
   * @private
   */
  async _processFiles(files) {
    this._showLoading(true);
    this._showErrors([]);
    const errors = [];

    for (const file of files) {
      // Valider le fichier
      const validation = isValidCSVFile(file);
      if (!validation.valid) {
        errors.push(`${file.name}: ${validation.error}`);
        continue;
      }

      // Identifier le type de fichier
      const fileType = this._identifyFileType(file.name);
      if (!fileType) {
        errors.push(`${file.name}: Type de fichier non reconnu`);
        continue;
      }

      // Parser le fichier
      try {
        let data;
        const content = await this._readFileContent(file);

        if (fileType.key === 'unified') {
          const parsed = parseUnifiedCSV(content);
          data = { tickets: parsed.tickets, teams: parsed.teams, summary: parsed.summary };
        } else if (fileType.key === 'timeInStatus') {
          data = parseTimeInStatusCSV(content);
        }

        // Mettre à jour l'état interne (sans re-rendre)
        this.state.files[fileType.key] = {
          name: file.name,
          loaded: true,
          data
        };

        // Mettre à jour la checklist visuellement
        this._updateChecklistItem(fileType.key, true);

        // Callback individuel
        if (this.props.onFileLoaded) {
          this.props.onFileLoaded(fileType.key, data, file.name);
        }

        eventBus.emit('file:loaded', { type: fileType.key, data, filename: file.name });

      } catch (error) {
        console.error(`[FileUploader] Erreur parsing ${file.name}:`, error);
        errors.push(`${file.name}: Erreur de lecture - ${error.message}`);
      }
    }

    this._showLoading(false);
    this._showErrors(errors);
    this.state.errors = errors;

    // Vérifier si tous les fichiers sont chargés
    this._checkCompletion();
  }

  /**
   * Identifie le type de fichier basé sur son nom
   * @param {string} filename
   * @returns {Object|null}
   * @private
   */
  _identifyFileType(filename) {
    const lowerName = filename.toLowerCase();
    const requiredFiles = this._getRequiredFiles();

    console.log('[FileUploader] Identifying file:', filename);

    // Time in status (doit contenir "time" ET "status")
    if (lowerName.includes('time') && lowerName.includes('status')) {
      console.log('[FileUploader] -> Detected as: timeInStatus');
      return requiredFiles.find(f => f.key === 'timeInStatus');
    }

    // Tout autre fichier CSV = fichier unifié (sprint data)
    console.log('[FileUploader] -> Detected as: unified');
    return requiredFiles.find(f => f.key === 'unified');
  }

  /**
   * Vérifie si les fichiers requis sont chargés
   * Les fichiers optionnels ne bloquent pas la completion
   * @private
   */
  _checkCompletion() {
    const requiredFiles = this._getRequiredFiles();

    // Vérifier uniquement les fichiers non-optionnels
    const requiredLoaded = requiredFiles
      .filter(f => !f.optional)
      .every(f => this.state.files[f.key]?.loaded);

    if (requiredLoaded) {
      const unifiedData = this.state.files.unified?.data || {};
      const timeInStatusData = this.state.files.timeInStatus?.data || {};

      // Valider la cohérence des équipes entre les deux fichiers
      const unifiedTeams = unifiedData.teams || [];
      const tisTeams = timeInStatusData.teams || [];

      // Trouver les équipes communes
      const commonTeams = unifiedTeams.filter(t => tisTeams.includes(t));

      // Avertir si les équipes ne correspondent pas
      if (unifiedTeams.length > 0 && tisTeams.length > 0 && commonTeams.length === 0) {
        console.warn('[FileUploader] Aucune équipe commune entre les deux fichiers !');
        console.warn('[FileUploader] Sprint Review:', unifiedTeams);
        console.warn('[FileUploader] Time in Status:', tisTeams);
        this._showErrors([
          'Les équipes des fichiers ne correspondent pas. Vérifiez que vous avez exporté les mêmes équipes.'
        ]);
        return;
      }

      if (commonTeams.length < unifiedTeams.length || commonTeams.length < tisTeams.length) {
        console.warn('[FileUploader] Équipes partiellement communes');
        console.warn('[FileUploader] Communes:', commonTeams);
      }

      const csvData = {
        tickets: unifiedData.tickets || [],
        teams: unifiedTeams, // Utiliser les équipes du fichier principal
        teamsTimeInStatus: tisTeams, // Garder aussi les équipes TiS
        commonTeams: commonTeams,
        summary: unifiedData.summary || null,
        timeInStatus: timeInStatusData // Maintenant un objet avec { tickets, teams, statuses, summary }
      };

      // Mettre à jour le store
      store.dispatch({ csvData, csvLoaded: true });

      // Callback de completion
      if (this.props.onComplete) {
        this.props.onComplete(csvData);
      }

      eventBus.emit('files:allLoaded', { data: csvData });
    }
  }

  /**
   * Réinitialise un fichier
   * @param {string} key
   */
  resetFile(key) {
    if (this.state.files[key]) {
      this.state.files[key] = {
        ...this.state.files[key],
        loaded: false,
        data: null
      };
      this.setState({ files: { ...this.state.files } });
    }
  }

  /**
   * Réinitialise tous les fichiers
   */
  resetAll() {
    const files = {};
    const requiredFiles = this._getRequiredFiles();
    requiredFiles.forEach(file => {
      files[file.key] = {
        name: file.name,
        loaded: false,
        data: null
      };
    });

    this.setState({ files, errors: [] });
    store.dispatch({ csvData: null, csvLoaded: false });
  }

  /**
   * Rendu du composant
   */
  render() {
    const { showChecklist } = this.props;
    const { errors } = this.state;

    return `
      <div class="file-upload" data-ref="container">
        <div class="file-upload__dropzone" data-ref="dropzone">
          <div class="file-upload__icon">📁</div>
          <p class="file-upload__text">
            Glissez vos fichiers CSV ici
          </p>
          <p class="file-upload__subtext">ou</p>
          <label class="file-upload__label btn btn--secondary">
            Parcourir
            <input type="file"
                   class="file-upload__input"
                   accept=".csv"
                   multiple
                   data-ref="fileInput" />
          </label>
        </div>

        <div class="file-upload__loading" data-ref="loading" style="display: none;">
          <div class="loader loader--small"></div>
          <span>Chargement en cours...</span>
        </div>

        <div class="file-upload__errors" data-ref="errors"></div>

        ${showChecklist ? this._renderChecklist() : ''}
      </div>
    `;
  }

  /**
   * Rendu des erreurs
   * @returns {string}
   * @private
   */
  _renderErrors() {
    const { errors } = this.state;

    return `
      <div class="file-upload__errors">
        ${errors.map(error => `
          <div class="file-upload__error">
            <span class="file-upload__error-icon">⚠️</span>
            <span>${this.escapeHtml(error)}</span>
          </div>
        `).join('')}
      </div>
    `;
  }

  /**
   * Rendu de la checklist des fichiers
   * @returns {string}
   * @private
   */
  _renderChecklist() {
    const { files } = this.state;
    const requiredFiles = this._getRequiredFiles();
    const mandatoryFiles = requiredFiles.filter(f => !f.optional);
    const loadedMandatory = mandatoryFiles.filter(f => files[f.key]?.loaded).length;
    const totalMandatory = mandatoryFiles.length;

    return `
      <div class="file-upload__checklist">
        <div class="file-upload__checklist-header">
          <span>Fichiers</span>
          <span class="file-upload__checklist-count">${loadedMandatory}/${totalMandatory} requis</span>
        </div>
        <ul class="file-upload__checklist-list">
          ${requiredFiles.map(file => this._renderChecklistItem(file)).join('')}
        </ul>
      </div>
    `;
  }

  /**
   * Rendu d'un item de la checklist
   * @param {Object} file
   * @returns {string}
   * @private
   */
  _renderChecklistItem(file) {
    const fileState = this.state.files[file.key];
    const isLoaded = fileState?.loaded;
    const isOptional = file.optional;

    return `
      <li class="file-upload__checklist-item ${isLoaded ? 'file-upload__checklist-item--loaded' : ''} ${isOptional ? 'file-upload__checklist-item--optional' : ''}"
          data-file-key="${file.key}">
        <span class="file-upload__checklist-icon">
          ${isLoaded ? '✓' : '○'}
        </span>
        <span class="file-upload__checklist-name">
          ${file.name}${isOptional ? ' <span class="file-upload__optional-tag">(optionnel)</span>' : ''}
        </span>
        ${isLoaded ? `
          <button class="file-upload__checklist-reset"
                  data-action="reset"
                  data-key="${file.key}"
                  title="Réinitialiser">
            ✕
          </button>
        ` : ''}
      </li>
    `;
  }

  /**
   * Définition des événements
   */
  events() {
    return {
      'change [data-ref="fileInput"]': this._handleFileSelect,
      'click [data-action="reset"]': this._handleReset
    };
  }

  /**
   * Gestionnaire de réinitialisation
   * @param {Event} e
   * @private
   */
  _handleReset(e) {
    const key = e.target.dataset.key;
    if (key) {
      this.resetFile(key);
    }
  }

  /**
   * Vérifie si les fichiers requis sont chargés
   * @returns {boolean}
   */
  isComplete() {
    const requiredFiles = this._getRequiredFiles();
    return requiredFiles
      .filter(f => !f.optional)
      .every(f => this.state.files[f.key]?.loaded);
  }

  /**
   * Récupère les données chargées
   * @returns {Object}
   */
  getData() {
    const data = {};
    Object.entries(this.state.files).forEach(([key, file]) => {
      if (file.loaded) {
        data[key] = file.data;
      }
    });
    return data;
  }
}
