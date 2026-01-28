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
    // Primary (Blue)
    primary: {
      50: '#eff6ff',
      100: '#dbeafe',
      200: '#bfdbfe',
      300: '#93c5fd',
      400: '#60a5fa',
      500: '#3b82f6',
      600: '#2563eb',
      700: '#1d4ed8'
    },
    // Secondary (Teal)
    secondary: {
      50: '#f0fdfa',
      100: '#ccfbf1',
      200: '#99f6e4',
      300: '#5eead4',
      400: '#2dd4bf',
      500: '#14b8a6',
      600: '#0d9488',
      700: '#0f766e'
    },
    // Gray
    gray: {
      50: '#f8fafc',
      100: '#f1f5f9',
      200: '#e2e8f0',
      300: '#cbd5e1',
      400: '#94a3b8',
      500: '#64748b',
      600: '#475569',
      700: '#334155',
      800: '#1e293b'
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
    // Danger (Red)
    danger: {
      50: '#fef2f2',
      100: '#fee2e2',
      400: '#f87171',
      500: '#ef4444',
      600: '#dc2626'
    },
    // Ligne de référence
    reference: '#94a3b8',
    referenceAlpha: 'rgba(148, 163, 184, 0.3)'
  },

  /**
   * Palette de couleurs pour les graphiques (tableau pour itération)
   */
  chartColors: [
    '#3b82f6', // blue
    '#14b8a6', // teal
    '#f59e0b', // yellow
    '#ef4444', // red
    '#8b5cf6', // purple
    '#22c55e', // green
    '#f97316', // orange
    '#ec4899'  // pink
  ],

  /**
   * Couleurs assignées aux métriques
   */
  metricColors: {
    throughput: '#6b9bd2',    // Bleu
    cycleTime: '#5bb5b0',     // Teal
    timeInStatus: '#a78bda',  // Purple
    bugs: '#f28b82',          // Coral
    velocity: '#7bc47f',      // Green
    capacity: '#f5c869'       // Yellow
  },

  /**
   * Couleurs pour Time in Status (donut chart)
   */
  statusColors: {
    'En cours': '#6b9bd2',
    'Code Review': '#5bb5b0',
    'A déployer en env de recette': '#f5c869',
    'A tester': '#a78bda',
    'A déployer en PROD': '#f5a962',
    'A valider': '#7bc47f'
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
    // Police (raccourci)
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",

    // Police (détaillé)
    font: {
      family: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      size: 12
    },

    // Animation
    animation: {
      duration: 300,
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
          pointStyle: 'circle'
        }
      },
      tooltip: {
        backgroundColor: 'rgba(30, 41, 59, 0.95)',
        titleColor: '#ffffff',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        cornerRadius: 8,
        displayColors: true
      }
    }
  },

  /**
   * Options spécifiques par type de graphique
   */
  chartTypes: {
    bar: {
      borderRadius: 4,
      borderSkipped: false,
      barPercentage: 0.7,
      categoryPercentage: 0.8
    },
    line: {
      tension: 0.4,
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2,
      fill: false
    },
    doughnut: {
      cutout: '65%',
      borderWidth: 0,
      hoverBorderWidth: 2,
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
// EXPORT
// =========================================================================

export default config;
