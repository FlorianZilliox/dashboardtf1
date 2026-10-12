/**
 * ==========================================================================
 * CONFIG.JS - Configuration globale de l'application
 * ==========================================================================
 *
 * Centralise toutes les constantes et configurations de l'application.
 * Permet de modifier facilement les paramètres sans toucher au code.
 *
 * SECTIONS :
 * 1. Couleurs (graphiques, statuts)
 * 2. Seuils et limites
 * 3. Formats (dates, nombres)
 * 4. Labels et textes
 * 5. Configuration Chart.js
 * 6. Fichiers CSV
 *
 * ==========================================================================
 */

const config = {
  // =========================================================================
  // 1. COULEURS
  // =========================================================================

  /**
   * Palette de couleurs principale (avec nuances)
   */
  colors: {
    // Primary (Slate Blue - Editorial)
    primary: {
      50: '#f7f9fb',
      100: '#e8eff3',
      200: '#d9e4ea',
      300: '#cad5ed',
      400: '#a9b4b9',
      500: '#545f73',
      600: '#485367',
      700: '#3d4759'
    },
    // Secondary (Tertiary - Muted Blue)
    secondary: {
      50: '#f9f8ff',
      100: '#dae2fd',
      200: '#ccd4ee',
      300: '#b0b8d4',
      400: '#8a92aa',
      500: '#575f75',
      600: '#4b5369',
      700: '#373f54'
    },
    // Gray (Surface system)
    gray: {
      50: '#f7f9fb',
      100: '#f0f4f7',
      200: '#e1e9ee',
      300: '#cfdce3',
      400: '#a9b4b9',
      500: '#717c82',
      600: '#566166',
      700: '#2a3439',
      800: '#0b0f10'
    },
    // Success (Green)
    success: {
      50: '#f0fdf4',
      100: '#dcfce7',
      400: '#4ade80',
      500: '#22c55e',
      600: '#16a34a'
    },
    // Warning (Orange/Yellow)
    warning: {
      50: '#fffbeb',
      100: '#fef3c7',
      400: '#fbbf24',
      500: '#f59e0b',
      600: '#d97706'
    },
    // Danger (Red - Editorial deep red)
    danger: {
      50: '#fff7f6',
      100: '#fee2e2',
      400: '#fe8983',
      500: '#9f403d',
      600: '#752121'
    },
    // Ligne de référence
    reference: '#a9b4b9',
    referenceAlpha: 'rgba(169, 180, 185, 0.3)'
  },

  /**
   * Palette de couleurs pour les graphiques (tableau pour itération)
   * Style éditorial : tons sourds, bleu-ardoise dominant
   */
  chartColors: [
    '#6b8559', // sage
    '#c9a47a', // amber
    '#b07564', // rust
    '#8a6e7e', // plum
    '#8499ad', // sky
    '#9bb38a', // sage-2
    '#a8865c', // ochre
    '#2a3e2d'  // forest
  ],

  /**
   * Couleurs assignées aux métriques
   */
  metricColors: {
    throughput: '#6b8559',    // sage
    cycleTime: '#c9a47a',     // amber
    timeInStatus: '#8a6e7e',  // plum
    bugs: '#b07564',          // rust
    velocity: '#6b8559',      // sage
    capacity: '#8499ad'       // sky
  },

  /**
   * Couleurs pour Time in Status (donut chart)
   */
  statusColors: {
    'En cours': '#6b8559',
    'Code Review': '#c9a47a',
    'A déployer en env de recette': '#8499ad',
    'A tester': '#8a6e7e',
    'A déployer en PROD': '#a8865c',
    'A valider': '#9bb38a'
  },

  // =========================================================================
  // 2. SEUILS ET LIMITES
  // =========================================================================

  /**
   * Seuils pour les indicateurs de performance
   */
  thresholds: {
    // Story Points : % de réalisation
    storyPoints: {
      success: 90,  // >= 90% = vert
      warning: 70   // >= 70% = orange, < 70% = rouge
    },

    // Cycle Time : jours (par rapport au benchmark)
    cycleTime: {
      good: -10,    // <= -10% vs benchmark = bon
      bad: 10       // >= +10% vs benchmark = mauvais
    },

    // Bugs : ratio créés/résolus
    bugs: {
      healthy: 1,   // résolus >= créés = sain
      warning: 1.5  // créés > 1.5x résolus = critique
    }
  },

  /**
   * Limites de l'application
   */
  limits: {
    maxGoals: 5,                    // Nombre max de Sprint Goals
    maxSprintHistory: 20,           // Sprints en historique
    sprintDurationWeeks: 2,         // Durée d'un sprint en semaines
    forecastSprintsCount: 3,        // Sprints pour calcul forecast
    displaySprintsCount: 6          // Sprints affichés dans les graphiques
  },

  // =========================================================================
  // 3. FORMATS
  // =========================================================================

  /**
   * Configuration des formats de date
   */
  dateFormats: {
    // Format court : "6 jan"
    short: { day: 'numeric', month: 'short' },
    // Format moyen : "6 janvier"
    medium: { day: 'numeric', month: 'long' },
    // Format long : "6 janvier 2026"
    long: { day: 'numeric', month: 'long', year: 'numeric' },
    // Format pour les graphiques : "Jan 26"
    chart: { month: 'short', year: '2-digit' },
    // Format ISO pour stockage
    iso: 'YYYY-MM-DD'
  },

  /**
   * Locale pour le formatage
   */
  locale: 'fr-FR',

  /**
   * Précision décimale
   */
  decimals: {
    percentage: 0,    // 85%
    days: 1,          // 5.2 jours
    storyPoints: 0    // 42 SP
  },

  // =========================================================================
  // 4. LABELS ET TEXTES
  // =========================================================================

  /**
   * Labels des métriques
   */
  labels: {
    metrics: {
      throughput: 'Throughput',
      cycleTime: 'Cycle Time',
      timeInStatus: 'Time in Status',
      bugs: 'Bugs',
      velocity: 'Vélocité',
      capacity: 'Capacité estimée'
    },

    units: {
      items: 'items',
      days: 'jours',
      storyPoints: 'SP',
      percentage: '%'
    },

    goalStatus: {
      achieved: 'Atteint',
      partial: 'Partiel',
      missed: 'Non atteint'
    },

    statsMode: {
      average: 'Moyenne',
      median: 'Médiane'
    }
  },

  /**
   * Textes pour les états vides
   */
  emptyStates: {
    noData: 'Aucune donnée disponible',
    noCSV: 'Chargez les fichiers CSV pour voir les métriques',
    noGoals: 'Sprint Goal non renseigné dans Jira',
    noHistory: 'Aucun historique de sprint'
  },

  // =========================================================================
  // 5. CONFIGURATION CHART.JS
  // =========================================================================

  /**
   * Options par défaut pour Chart.js
   */
  chartDefaults: {
    // Police (raccourci) - Inter pour les labels, JetBrains Mono pour les chiffres
    fontFamily: "'Inter', -apple-system, system-ui, sans-serif",

    // Police (détaillé)
    font: {
      family: "'Inter', -apple-system, system-ui, sans-serif",
      size: 11
    },

    // Animation
    animation: {
      duration: 400,
      easing: 'easeOutQuart'
    },

    // Responsive
    responsive: true,
    maintainAspectRatio: false,

    // Plugins
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          padding: 16,
          usePointStyle: true,
          pointStyle: 'rectRounded',
          font: {
            family: "'Inter', sans-serif",
            size: 10,
            weight: '500'
          },
          color: '#6b6b62'
        }
      },
      tooltip: {
        backgroundColor: '#1a1a17',
        titleColor: '#fafaf7',
        bodyColor: '#e9e5d9',
        borderColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 6,
        displayColors: true,
        titleFont: {
          family: "'JetBrains Mono', monospace",
          weight: '500'
        },
        bodyFont: {
          family: "'Inter', sans-serif"
        }
      }
    }
  },

  /**
   * Options spécifiques par type de graphique
   * Style éditorial : barres arrondies en haut, tons gris, ligne courbe
   */
  chartTypes: {
    bar: {
      borderRadius: 3,
      borderSkipped: 'bottom',
      barPercentage: 0.65,
      categoryPercentage: 0.75
    },
    line: {
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 5,
      borderWidth: 2.5,
      fill: false
    },
    doughnut: {
      cutout: '70%',
      borderWidth: 0,
      hoverBorderWidth: 0,
      hoverOffset: 4
    }
  },

  // =========================================================================
  // 6. FICHIERS CSV
  // =========================================================================

  /**
   * Configuration CSV pour FileUploader
   * Format: fichier unifié ticket-level + time in status
   */
  csv: {
    requiredFiles: [
      { key: 'unified', name: 'Sprint Review.csv', optional: false },
      { key: 'timeInStatus', name: 'Time in status.csv', optional: false }
    ]
  },

  /**
   * Configuration des fichiers CSV attendus
   */
  csvFiles: {
    bugs: {
      id: 'bugs',
      name: 'Bugs.csv',
      displayName: 'Bugs',
      columns: {
        week: 0,
        created: 1,
        closed: 2,
        avgClosingDays: 3
      },
      required: true
    },
    cycleTime: {
      id: 'cycleTime',
      name: 'Cycle Time.csv',
      displayName: 'Cycle Time',
      columns: {
        week: 0,
        avgProgress: 1,
        avgOfAvg: 2,
        medianOfAvg: 3
      },
      required: true
    },
    throughput: {
      id: 'throughput',
      name: 'Throughput.csv',
      displayName: 'Throughput',
      columns: {
        week: 0,
        closed: 1,
        avgClosed: 2,
        medianClosed: 3
      },
      required: true
    },
    timeInStatus: {
      id: 'timeInStatus',
      name: 'Time in status.csv',
      displayName: 'Time in Status',
      columns: {
        status: 0,
        period: 1,
        avgWorkdays: 2,
        cyclePercentage: 3
      },
      required: true
    }
  },

  /**
   * Format attendu des semaines dans les CSV
   * Exemple : "W28, Jul 07 2025"
   */
  weekFormat: {
    regex: /^W(\d{1,2}),\s+(\w{3})\s+(\d{1,2})\s+(\d{4})$/,
    // Groupes : 1=numéro semaine, 2=mois abrégé, 3=jour, 4=année
  },

  // =========================================================================
  // 7. STORAGE
  // =========================================================================

  /**
   * Clés localStorage
   */
  storageKeys: {
    sprintHistory: 'sprintReview_sprintHistory',
    snapshots: 'sprintReview_snapshots',
    preferences: 'sprintReview_preferences',
    lastSession: 'sprintReview_lastSession'
  },

  // =========================================================================
  // 8. APPLICATION
  // =========================================================================

  /**
   * Informations sur l'application
   */
  app: {
    name: 'Sprint Review Dashboard',
    version: '1.0.0',
    author: 'Data Tribe TF1'
  },

  /**
   * Nom d'équipe par défaut
   */
  defaultTeamName: 'Data Tribe TF1'
};

// =========================================================================
// HELPERS
// =========================================================================

/**
 * Lit une variable CSS depuis l'element racine
 * @param {string} name - Nom de la variable (ex: '--sage')
 * @returns {string}
 */
export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/**
 * Retourne la palette de couleurs courante (resout les CSS vars)
 * Utile pour Chart.js qui ne lit pas les CSS vars nativement.
 * @returns {Object}
 */
export function chartPalette() {
  return {
    ink: cssVar('--ink'),
    ink3: cssVar('--ink-3'),
    sage: cssVar('--sage'),
    sageSoft: cssVar('--sage-soft'),
    amber: cssVar('--amber'),
    amberSoft: cssVar('--amber-soft'),
    rust: cssVar('--rust'),
    rustSoft: cssVar('--rust-soft'),
    plum: cssVar('--plum'),
    plumSoft: cssVar('--plum-soft'),
    sky: cssVar('--sky'),
    skySoft: cssVar('--sky-soft'),
    line: cssVar('--line-hair'),
    paper: cssVar('--paper')
  };
}

// =========================================================================
// EXPORT
// =========================================================================

export default config;
