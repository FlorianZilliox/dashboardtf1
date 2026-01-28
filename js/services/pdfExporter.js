/**
 * ==========================================================================
 * PDFEXPORTER.JS - Export Markdown & PDF Infographique
 * ==========================================================================
 *
 * Génère un fichier Markdown ou un PDF infographique
 * à partir des données du sprint review.
 *
 * ==========================================================================
 */

import eventBus from '../core/eventBus.js';
import store from '../core/store.js';
import { formatNumber, formatPercent, formatDays } from '../utils/formatters.js';

// =========================================================================
// CLASSE EXPORTER
// =========================================================================

class Exporter {
  constructor() {
    this.isExporting = false;
  }

  /**
   * Exporte les données en Markdown
   * @param {string} filename - Nom du fichier (sans extension)
   * @returns {Promise<boolean>}
   */
  async export(filename = 'sprint-review') {
    if (this.isExporting) {
      console.warn('[Exporter] Export déjà en cours');
      return false;
    }

    this.isExporting = true;
    eventBus.emit('pdf:generating');

    try {
      const state = store.getState();
      const { sprintMetrics, manualInput } = state;

      if (!sprintMetrics) {
        throw new Error('Pas de données à exporter');
      }

      // Générer le Markdown
      const markdown = this._generateMarkdown(sprintMetrics, manualInput);

      // Télécharger
      const fullFilename = `${filename}-${this._getDateString()}.md`;
      this._downloadFile(markdown, fullFilename, 'text/markdown');

      eventBus.emit('pdf:generated', { filename: fullFilename });
      console.log('[Exporter] Export terminé:', fullFilename);
      return true;

    } catch (error) {
      console.error('[Exporter] Erreur:', error);
      eventBus.emit('pdf:error', { error: error.message });
      return false;

    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Génère le contenu Markdown (format Confluence)
   * @private
   */
  _generateMarkdown(metrics, manualInput) {
    const lines = [];
    const sprintName = manualInput?.sprintName || 'Sprint';
    const teamName = manualInput?.teamName || 'Équipe';

    // Header
    lines.push(`# ${teamName} - ${sprintName}`);
    lines.push('');

    // Vélocité (Story Points)
    if (metrics.storyPoints?.isFromCSV) {
      const sp = metrics.storyPoints;
      const completionStatus = sp.currentCompletion >= 90 ? '✅' :
                               sp.currentCompletion >= 70 ? '⚠️' : '❌';

      lines.push('## Vélocité');
      lines.push('');
      lines.push('| Engagés | Livrés | Complétion |');
      lines.push('|:-------:|:------:|:----------:|');
      lines.push(`| ${sp.currentCommitted} SP | ${sp.currentDelivered} SP | ${completionStatus} ${sp.currentCompletion}% |`);
      lines.push('');
    }

    // Indicateurs (tableau unique)
    lines.push('## Indicateurs');
    lines.push('');
    lines.push('| Métrique | Valeur | Statut |');
    lines.push('|----------|:------:|:------:|');

    // Throughput
    if (metrics.throughput) {
      const t = metrics.throughput;
      const status = t.trend >= 0 ? '✅' : '❌';
      lines.push(`| **Throughput** | ${t.currentValue} tickets | ${status} |`);
    }

    // Cycle Time
    if (metrics.cycleTime) {
      const c = metrics.cycleTime;
      const status = c.trend <= 0 ? '✅' : '❌';
      lines.push(`| **Cycle Time** | ${c.currentValue?.toFixed(1)} jours | ${status} |`);
    }

    // Mid-sprint
    if (metrics.throughput?.midSprintCount !== undefined) {
      const count = metrics.throughput.midSprintCount;
      const status = count <= 2 ? '✅' : count <= 5 ? '⚠️' : '❌';
      lines.push(`| **Ajouts Mid-Sprint** | ${count} tickets | ${status} |`);
    }

    // Bugs
    if (metrics.bugs) {
      const b = metrics.bugs;
      const delta = b.sprintCreated - b.sprintClosed;
      const status = delta <= 0 ? '✅' : '❌';
      lines.push(`| **Stock Bugs** | ${b.stock} ouverts (+${b.sprintCreated}/-${b.sprintClosed}) | ${status} |`);
    }

    // MTTR
    if (metrics.bugs?.mttr !== undefined && metrics.bugs.mttr > 0) {
      const mttr = metrics.bugs.mttr;
      const status = mttr < 3 ? '✅' : mttr < 7 ? '⚠️' : '❌';
      lines.push(`| **Mean Time To Recovery** | ${mttr.toFixed(1)} jours | ${status} |`);
    }

    // CFR
    if (metrics.bugs?.changeFailureRate !== undefined) {
      const cfr = metrics.bugs.changeFailureRate;
      const status = cfr < 15 ? '✅' : cfr < 30 ? '⚠️' : '❌';
      lines.push(`| **Change Failure Rate** | ${cfr.toFixed(1)}% | ${status} |`);
    }

    lines.push('');

    return lines.join('\n');
  }

  /**
   * Télécharge un fichier
   * @private
   */
  _downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Génère une chaîne de date
   * @private
   */
  _getDateString() {
    return new Date().toISOString().split('T')[0];
  }

  // =========================================================================
  // EXPORT PDF INFOGRAPHIQUE
  // =========================================================================

  /**
   * Exporte les données en PDF infographique (paysage pour PowerPoint)
   * @param {string} filename - Nom du fichier (sans extension)
   * @returns {Promise<boolean>}
   */
  async exportInfographic(filename = 'sprint-review') {
    if (this.isExporting) {
      console.warn('[Exporter] Export déjà en cours');
      return false;
    }

    this.isExporting = true;
    eventBus.emit('pdf:generating');

    try {
      const state = store.getState();
      const { sprintMetrics, manualInput, sprintGoals } = state;

      if (!sprintMetrics) {
        throw new Error('Pas de données à exporter');
      }

      // Vérifier que jsPDF est disponible
      if (typeof window.jspdf === 'undefined') {
        throw new Error('jsPDF non chargé');
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Dimensions A4 paysage
      const pageWidth = 297;
      const pageHeight = 210;
      const margin = 12;
      const contentWidth = pageWidth - (margin * 2);

      // Couleurs du design system
      const colors = {
        primary: [30, 41, 59],       // #1e293b - text primary
        secondary: [100, 116, 139],  // #64748b - text secondary
        accent: [107, 155, 210],     // #6b9bd2 - accent blue
        accentDark: [74, 123, 181],  // #4a7bb5
        success: [34, 197, 94],      // #22c55e
        warning: [245, 158, 11],     // #f59e0b
        danger: [239, 68, 68],       // #ef4444
        cardBg: [248, 250, 252],     // #f8fafc
        white: [255, 255, 255],
        border: [226, 232, 240]      // #e2e8f0
      };

      const teamName = manualInput?.teamName || 'Équipe';
      const sprintName = manualInput?.sprintName || 'Sprint';
      const date = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });

      // =====================================================================
      // HEADER COMPACT - Bandeau fin
      // =====================================================================
      const headerHeight = 18;
      doc.setFillColor(...colors.accent);
      doc.rect(0, 0, pageWidth, headerHeight, 'F');

      // Équipe + Sprint sur la même ligne
      doc.setTextColor(...colors.white);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(teamName, margin, 12);

      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      const teamWidth = doc.getTextWidth(teamName);
      doc.text(`  •  ${sprintName}`, margin + teamWidth, 12);

      // Date à droite
      doc.setFontSize(9);
      doc.text(date, pageWidth - margin, 12, { align: 'right' });

      let y = headerHeight + 8;

      // =====================================================================
      // LAYOUT EN 2 COLONNES
      // =====================================================================
      const leftColX = margin;
      const leftColWidth = 95;
      const rightColX = margin + leftColWidth + 10;
      const rightColWidth = contentWidth - leftColWidth - 10;

      // =====================================================================
      // COLONNE GAUCHE : Vélocité + Objectifs
      // =====================================================================
      let leftY = y;

      // --- Section Vélocité ---
      if (sprintMetrics.storyPoints?.isFromCSV) {
        const sp = sprintMetrics.storyPoints;

        doc.setTextColor(...colors.primary);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Vélocité Sprint', leftColX, leftY);
        leftY += 6;

        // Carte vélocité compacte
        const velocityCardHeight = 50;
        doc.setFillColor(...colors.white);
        doc.setDrawColor(...colors.border);
        doc.roundedRect(leftColX, leftY, leftColWidth, velocityCardHeight, 2, 2, 'FD');

        // Layout horizontal : Engagés | Livrés | Complétion
        const spColWidth = leftColWidth / 3;
        const spCenterY = leftY + velocityCardHeight / 2;

        // Engagés
        doc.setTextColor(...colors.secondary);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text('Engagés', leftColX + spColWidth * 0.5, spCenterY - 10, { align: 'center' });
        doc.setTextColor(...colors.primary);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(String(sp.currentCommitted), leftColX + spColWidth * 0.5, spCenterY + 3, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.secondary);
        doc.text('SP', leftColX + spColWidth * 0.5, spCenterY + 10, { align: 'center' });

        // Livrés
        doc.setTextColor(...colors.secondary);
        doc.setFontSize(8);
        doc.text('Livrés', leftColX + spColWidth * 1.5, spCenterY - 10, { align: 'center' });
        doc.setTextColor(...colors.primary);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(String(sp.currentDelivered), leftColX + spColWidth * 1.5, spCenterY + 3, { align: 'center' });
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(...colors.secondary);
        doc.text('SP', leftColX + spColWidth * 1.5, spCenterY + 10, { align: 'center' });

        // Complétion avec couleur
        const completionPct = sp.currentCompletion || 0;
        const completionColor = completionPct >= 90 ? colors.success :
                                completionPct >= 70 ? colors.warning : colors.danger;

        doc.setTextColor(...colors.secondary);
        doc.setFontSize(8);
        doc.text('Complétion', leftColX + spColWidth * 2.5, spCenterY - 10, { align: 'center' });
        doc.setTextColor(...completionColor);
        doc.setFontSize(22);
        doc.setFont('helvetica', 'bold');
        doc.text(`${completionPct}%`, leftColX + spColWidth * 2.5, spCenterY + 3, { align: 'center' });

        leftY += velocityCardHeight + 8;
      }

      // --- Section Objectifs ---
      if (sprintGoals && sprintGoals.length > 0) {
        doc.setTextColor(...colors.primary);
        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.text('Objectifs', leftColX, leftY);
        leftY += 6;

        sprintGoals.forEach((goal) => {
          const statusColor = goal.achieved === true ? colors.success :
                              goal.achieved === 'partial' ? colors.warning : colors.secondary;

          // Dessiner l'icône de statut (cercle avec ou sans coche)
          const iconX = leftColX + 2;
          const iconY = leftY + 2;
          const iconRadius = 2.5;

          if (goal.achieved === true) {
            // Cercle plein vert avec coche
            doc.setFillColor(...statusColor);
            doc.circle(iconX, iconY, iconRadius, 'F');
            // Coche blanche
            doc.setDrawColor(...colors.white);
            doc.setLineWidth(0.6);
            doc.line(iconX - 1.2, iconY, iconX - 0.2, iconY + 1);
            doc.line(iconX - 0.2, iconY + 1, iconX + 1.5, iconY - 1);
          } else if (goal.achieved === 'partial') {
            // Cercle demi-plein orange
            doc.setFillColor(...statusColor);
            doc.circle(iconX, iconY, iconRadius, 'F');
            doc.setFillColor(...colors.white);
            doc.rect(iconX, iconY - iconRadius, iconRadius, iconRadius * 2, 'F');
          } else {
            // Cercle vide gris
            doc.setDrawColor(...statusColor);
            doc.setLineWidth(0.5);
            doc.circle(iconX, iconY, iconRadius, 'S');
          }

          doc.setTextColor(...colors.primary);
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const goalText = goal.text || goal;
          // Tronquer si trop long
          const maxChars = 45;
          const displayText = goalText.length > maxChars ? goalText.substring(0, maxChars) + '...' : goalText;
          doc.text(displayText, leftColX + 8, leftY + 4);

          leftY += 8;
        });
      }

      // =====================================================================
      // COLONNE DROITE : Indicateurs KPI (grille 3x2)
      // =====================================================================
      let rightY = y;

      doc.setTextColor(...colors.primary);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.text('Indicateurs', rightColX, rightY);
      rightY += 6;

      // Grille 3 colonnes x 2 lignes
      const cardWidth = (rightColWidth - 8) / 3;
      const cardHeight = 55;
      const cardGap = 4;

      const kpiCards = [];

      // Throughput
      if (sprintMetrics.throughput) {
        kpiCards.push({
          label: 'Throughput',
          value: sprintMetrics.throughput.currentValue,
          unit: 'tickets',
          trend: sprintMetrics.throughput.trend,
          trendUp: true
        });
      }

      // Cycle Time
      if (sprintMetrics.cycleTime) {
        kpiCards.push({
          label: 'Cycle Time',
          value: formatNumber(sprintMetrics.cycleTime.currentValue, 1),
          unit: 'jours (moy.)',
          subValue: `Méd: ${formatNumber(sprintMetrics.cycleTime.sprintMedian, 1)}j`,
          trend: sprintMetrics.cycleTime.trend,
          trendUp: false
        });
      }

      // Mid-sprint additions
      if (sprintMetrics.throughput?.midSprintCount !== undefined) {
        kpiCards.push({
          label: 'Ajouts mid-sprint',
          value: sprintMetrics.throughput.midSprintCount,
          unit: 'tickets',
          neutral: sprintMetrics.throughput.midSprintCount === 0
        });
      }

      // Stock Bugs
      if (sprintMetrics.bugs) {
        kpiCards.push({
          label: 'Stock Bugs',
          value: sprintMetrics.bugs.stock,
          unit: 'ouverts',
          subValue: `+${sprintMetrics.bugs.sprintCreated} / -${sprintMetrics.bugs.sprintClosed}`
        });
      }

      // MTTR
      if (sprintMetrics.bugs?.mttr > 0) {
        kpiCards.push({
          label: 'MTTR',
          value: formatNumber(sprintMetrics.bugs.mttr, 1),
          unit: 'jours',
          subValue: `Période: ${formatNumber(sprintMetrics.bugs.mttrPeriod, 1)}j`
        });
      }

      // Change Failure Rate
      if (sprintMetrics.bugs?.changeFailureRate !== undefined) {
        const cfr = sprintMetrics.bugs.changeFailureRate;
        kpiCards.push({
          label: 'Change Failure Rate',
          value: `${formatNumber(cfr, 1)}%`,
          unit: '',
          statusColor: cfr < 15 ? 'success' : cfr < 30 ? 'warning' : 'danger',
          subValue: `${sprintMetrics.bugs.sprintCreated}/${sprintMetrics.bugs.itemsDelivered} items`
        });
      }

      // Dessiner les cartes KPI
      kpiCards.forEach((card, idx) => {
        const col = idx % 3;
        const row = Math.floor(idx / 3);
        const cardX = rightColX + col * (cardWidth + cardGap);
        const cardY = rightY + row * (cardHeight + cardGap);

        // Fond de la carte
        doc.setFillColor(...colors.white);
        doc.setDrawColor(...colors.border);
        doc.roundedRect(cardX, cardY, cardWidth, cardHeight, 2, 2, 'FD');

        // Label
        doc.setTextColor(...colors.secondary);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'normal');
        doc.text(card.label, cardX + 4, cardY + 8);

        // Valeur principale
        let valueColor = colors.primary;
        if (card.statusColor === 'success') valueColor = colors.success;
        else if (card.statusColor === 'warning') valueColor = colors.warning;
        else if (card.statusColor === 'danger') valueColor = colors.danger;

        doc.setTextColor(...valueColor);
        doc.setFontSize(20);
        doc.setFont('helvetica', 'bold');
        doc.text(String(card.value), cardX + 4, cardY + 26);

        // Unité
        if (card.unit) {
          doc.setTextColor(...colors.secondary);
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(card.unit, cardX + 4, cardY + 34);
        }

        // Sous-valeur
        if (card.subValue) {
          doc.setTextColor(...colors.secondary);
          doc.setFontSize(7);
          doc.text(card.subValue, cardX + 4, cardY + 42);
        }

        // Trend avec flèche dessinée
        if (card.trend !== undefined && card.trend !== null) {
          const isPositive = card.trend > 0;
          const isGood = (isPositive && card.trendUp) || (!isPositive && !card.trendUp);
          const trendColor = card.trend === 0 ? colors.secondary :
                             isGood ? colors.success : colors.danger;

          // Position du texte
          const trendText = `${Math.abs(card.trend)}%`;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'bold');
          const textWidth = doc.getTextWidth(trendText);
          const trendTextX = cardX + cardWidth - 4;
          const trendTextY = cardY + 10;

          // Dessiner le texte
          doc.setTextColor(...trendColor);
          doc.text(trendText, trendTextX, trendTextY, { align: 'right' });

          // Dessiner la flèche (triangle)
          const arrowX = trendTextX - textWidth - 4;
          const arrowY = trendTextY - 3;
          const arrowSize = 2.5;

          doc.setFillColor(...trendColor);
          if (card.trend > 0) {
            // Flèche vers le haut (triangle pointant vers le haut)
            doc.triangle(
              arrowX, arrowY,
              arrowX - arrowSize, arrowY + arrowSize * 1.5,
              arrowX + arrowSize, arrowY + arrowSize * 1.5,
              'F'
            );
          } else if (card.trend < 0) {
            // Flèche vers le bas (triangle pointant vers le bas)
            doc.triangle(
              arrowX, arrowY + arrowSize * 1.5,
              arrowX - arrowSize, arrowY,
              arrowX + arrowSize, arrowY,
              'F'
            );
          } else {
            // Stable : petit tiret
            doc.setDrawColor(...trendColor);
            doc.setLineWidth(0.8);
            doc.line(arrowX - arrowSize, arrowY + arrowSize * 0.5, arrowX + arrowSize, arrowY + arrowSize * 0.5);
          }
        }

        // Badge "Scope OK" pour mid-sprint = 0
        if (card.neutral) {
          doc.setFillColor(...colors.success);
          doc.roundedRect(cardX + 4, cardY + 38, 24, 7, 2, 2, 'F');
          doc.setTextColor(...colors.white);
          doc.setFontSize(6);
          doc.setFont('helvetica', 'bold');
          doc.text('Scope OK', cardX + 16, cardY + 43, { align: 'center' });
        }
      });

      // =====================================================================
      // FOOTER
      // =====================================================================
      doc.setTextColor(...colors.secondary);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(
        `Sprint Review Dashboard • ${date}`,
        pageWidth / 2,
        pageHeight - 6,
        { align: 'center' }
      );

      // Télécharger
      const fullFilename = `${filename}-${this._getDateString()}.pdf`;
      doc.save(fullFilename);

      eventBus.emit('pdf:generated', { filename: fullFilename });
      console.log('[Exporter] Export PDF terminé:', fullFilename);
      return true;

    } catch (error) {
      console.error('[Exporter] Erreur PDF:', error);
      eventBus.emit('pdf:error', { error: error.message });
      return false;

    } finally {
      this.isExporting = false;
    }
  }

  // =========================================================================
  // EXPORT PDF RADIAL (Design circulaire)
  // =========================================================================

  /**
   * Exporte les données en PDF radial (design circulaire pour PowerPoint)
   * @param {string} filename - Nom du fichier (sans extension)
   * @returns {Promise<boolean>}
   */
  async exportRadial(filename = 'sprint-review-radial') {
    if (this.isExporting) {
      console.warn('[Exporter] Export déjà en cours');
      return false;
    }

    this.isExporting = true;
    eventBus.emit('pdf:generating');

    try {
      const state = store.getState();
      const { sprintMetrics, manualInput } = state;

      if (!sprintMetrics) {
        throw new Error('Pas de données à exporter');
      }

      if (typeof window.jspdf === 'undefined') {
        throw new Error('jsPDF non chargé');
      }

      const { jsPDF } = window.jspdf;
      const doc = new jsPDF({
        orientation: 'landscape',
        unit: 'mm',
        format: 'a4'
      });

      // Dimensions A4 paysage
      const pageWidth = 297;
      const pageHeight = 210;

      // Couleurs du design system
      const colors = {
        primary: [30, 41, 59],
        secondary: [100, 116, 139],
        accent: [107, 155, 210],
        accentTeal: [91, 181, 176],
        success: [34, 197, 94],
        warning: [245, 158, 11],
        danger: [239, 68, 68],
        purple: [167, 139, 218],
        coral: [242, 139, 130],
        white: [255, 255, 255],
        lightGray: [241, 245, 249],
        border: [200, 210, 220]
      };

      const teamName = manualInput?.teamName || 'Équipe';
      const sprintName = manualInput?.sprintName || 'Sprint';

      // =====================================================================
      // FOND BLANC
      // =====================================================================
      doc.setFillColor(...colors.white);
      doc.rect(0, 0, pageWidth, pageHeight, 'F');

      // =====================================================================
      // HEADER MINIMALISTE CENTRÉ
      // =====================================================================
      doc.setTextColor(...colors.primary);
      doc.setFontSize(22);
      doc.setFont('helvetica', 'bold');
      doc.text(`${teamName} - ${sprintName}`, pageWidth / 2, 18, { align: 'center' });

      // =====================================================================
      // CERCLE CENTRAL - Complétion (coloré selon performance)
      // =====================================================================
      const centerX = pageWidth / 2;
      const centerY = pageHeight / 2 + 8;
      const centerRadius = 25; // Compact

      // Contenu central
      const sp = sprintMetrics.storyPoints;
      const completionPct = sp?.currentCompletion || 0;

      // Couleur du cercle central selon la complétion
      const centerColor = completionPct >= 90 ? colors.success :
                          completionPct >= 70 ? colors.warning : colors.danger;

      // Cercle principal
      doc.setFillColor(...centerColor);
      doc.circle(centerX, centerY, centerRadius, 'F');

      // Pourcentage de complétion
      doc.setTextColor(...colors.white);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text(`${completionPct}%`, centerX, centerY - 2, { align: 'center' });

      // Label
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text('Completion', centerX, centerY + 6, { align: 'center' });

      // SP engagés / livrés
      doc.setFontSize(8);
      const spText = `${sp?.currentDelivered || 0} / ${sp?.currentCommitted || 0} SP`;
      doc.text(spText, centerX, centerY + 12, { align: 'center' });

      // =====================================================================
      // CERCLES KPI AUTOUR (6 KPIs, sans Vélocité)
      // =====================================================================
      const orbitRadius = 68;
      const kpiRadius = 15; // Plus petit

      // Préparer les KPIs (6 seulement)
      const kpis = [];

      // 1. Throughput
      if (sprintMetrics.throughput) {
        const trend = sprintMetrics.throughput.trend || 0;
        const isGood = trend >= 0;
        kpis.push({
          label: 'Throughput',
          value: sprintMetrics.throughput.currentValue,
          unit: 'tickets',
          color: isGood ? colors.success : colors.danger
        });
      }

      // 2. Cycle Time (inversé : moins = mieux)
      if (sprintMetrics.cycleTime) {
        const trend = sprintMetrics.cycleTime.trend || 0;
        const isGood = trend <= 0;
        kpis.push({
          label: 'Cycle Time',
          value: formatNumber(sprintMetrics.cycleTime.currentValue, 1),
          unit: 'jours',
          color: isGood ? colors.success : colors.danger
        });
      }

      // 3. Mid-sprint additions
      if (sprintMetrics.throughput?.midSprintCount !== undefined) {
        const count = sprintMetrics.throughput.midSprintCount;
        const isGood = count <= 2;
        const isWarning = count > 2 && count <= 5;
        kpis.push({
          label: 'Mid-Sprint',
          value: count,
          unit: 'ajouts',
          color: isGood ? colors.success : isWarning ? colors.warning : colors.danger
        });
      }

      // 4. Stock Bugs
      if (sprintMetrics.bugs) {
        const delta = (sprintMetrics.bugs.sprintCreated || 0) - (sprintMetrics.bugs.sprintClosed || 0);
        const isGood = delta <= 0;
        kpis.push({
          label: 'Stock Bugs',
          value: sprintMetrics.bugs.stock,
          unit: 'ouverts',
          color: isGood ? colors.success : colors.danger
        });
      }

      // 5. MTTR (Mean Time To Recovery)
      if (sprintMetrics.bugs?.mttr !== undefined) {
        const mttr = sprintMetrics.bugs.mttr;
        const isGood = mttr < 3;
        const isWarning = mttr >= 3 && mttr < 7;
        kpis.push({
          label: 'Mean Time To Recovery',
          value: formatNumber(mttr, 1),
          unit: 'jours',
          color: isGood ? colors.success : isWarning ? colors.warning : colors.danger
        });
      }

      // 6. Change Failure Rate (DORA) - valeur avec % intégré
      if (sprintMetrics.bugs?.changeFailureRate !== undefined) {
        const cfr = sprintMetrics.bugs.changeFailureRate;
        const isGood = cfr < 15;
        const isWarning = cfr >= 15 && cfr < 30;
        kpis.push({
          label: 'Change Failure Rate',
          value: `${formatNumber(cfr, 1)}%`,
          unit: '', // Pas d'unité séparée
          color: isGood ? colors.success : isWarning ? colors.warning : colors.danger
        });
      }

      // Positionner les KPIs en cercle (6 KPIs)
      const kpiCount = Math.min(kpis.length, 6);
      const angleOffset = -Math.PI / 2; // Commencer en haut

      kpis.slice(0, 6).forEach((kpi, idx) => {
        const angle = angleOffset + (idx * 2 * Math.PI) / kpiCount;
        const x = centerX + orbitRadius * Math.cos(angle);
        const y = centerY + orbitRadius * Math.sin(angle);

        // Ligne de connexion
        doc.setDrawColor(...colors.border);
        doc.setLineWidth(0.5);
        const innerX = centerX + (centerRadius + 2) * Math.cos(angle);
        const innerY = centerY + (centerRadius + 2) * Math.sin(angle);
        const outerX = centerX + (orbitRadius - kpiRadius - 2) * Math.cos(angle);
        const outerY = centerY + (orbitRadius - kpiRadius - 2) * Math.sin(angle);
        doc.line(innerX, innerY, outerX, outerY);

        // Petit cercle de jonction au centre
        doc.setFillColor(...colors.border);
        doc.circle(innerX, innerY, 1.5, 'F');

        // Cercle KPI
        doc.setFillColor(...kpi.color);
        doc.circle(x, y, kpiRadius, 'F');

        // Valeur
        doc.setTextColor(...colors.white);
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.text(String(kpi.value), x, y, { align: 'center' });

        // Unité (si présente)
        if (kpi.unit) {
          doc.setFontSize(8);
          doc.setFont('helvetica', 'normal');
          doc.text(kpi.unit, x, y + 6, { align: 'center' });
        }

        // =====================================================================
        // LABEL POSITIONNÉ À GAUCHE OU À DROITE SELON LA POSITION DU CERCLE
        // =====================================================================
        const isLeftSide = x < centerX - 10;
        const isRightSide = x > centerX + 10;
        const isTop = y < centerY - 20;
        const isBottom = y > centerY + 20;

        doc.setTextColor(...kpi.color);
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');

        let labelX, labelY, labelAlign;

        if (isLeftSide) {
          // Label à gauche du cercle
          labelX = x - kpiRadius - 6;
          labelY = y + 1;
          labelAlign = 'right';
        } else if (isRightSide) {
          // Label à droite du cercle
          labelX = x + kpiRadius + 6;
          labelY = y + 1;
          labelAlign = 'left';
        } else if (isTop) {
          // Label au-dessus (mais décalé pour éviter collision avec header)
          labelX = x;
          labelY = y - kpiRadius - 5;
          labelAlign = 'center';
        } else if (isBottom) {
          // Label en-dessous
          labelX = x;
          labelY = y + kpiRadius + 8;
          labelAlign = 'center';
        } else {
          // Défaut : à droite
          labelX = x + kpiRadius + 6;
          labelY = y + 1;
          labelAlign = 'left';
        }

        doc.text(kpi.label, labelX, labelY, { align: labelAlign });
      });

      // =====================================================================
      // LÉGENDE (en bas à gauche)
      // =====================================================================
      const legendY = pageHeight - 18;
      const legendX = 12;

      // Cercle vert + texte
      doc.setFillColor(...colors.success);
      doc.circle(legendX + 3, legendY, 2.5, 'F');
      doc.setTextColor(...colors.secondary);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text('Progresse', legendX + 8, legendY + 1);

      // Cercle orange + texte
      doc.setFillColor(...colors.warning);
      doc.circle(legendX + 33, legendY, 2.5, 'F');
      doc.text('À surveiller', legendX + 38, legendY + 1);

      // Cercle rouge + texte
      doc.setFillColor(...colors.danger);
      doc.circle(legendX + 68, legendY, 2.5, 'F');
      doc.text('À améliorer', legendX + 73, legendY + 1);

      // =====================================================================
      // FOOTER (aligné à gauche, juste la date)
      // =====================================================================
      const date = new Date().toLocaleDateString('fr-FR', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
      });
      doc.setTextColor(...colors.secondary);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'italic');
      doc.text(date, 12, pageHeight - 8);

      // Télécharger
      const fullFilename = `${filename}-${this._getDateString()}.pdf`;
      doc.save(fullFilename);

      eventBus.emit('pdf:generated', { filename: fullFilename });
      console.log('[Exporter] Export Radial PDF terminé:', fullFilename);
      return true;

    } catch (error) {
      console.error('[Exporter] Erreur PDF Radial:', error);
      eventBus.emit('pdf:error', { error: error.message });
      return false;

    } finally {
      this.isExporting = false;
    }
  }

  /**
   * Prévisualise (ouvre dans un nouvel onglet)
   */
  async preview(filename = 'sprint-review') {
    try {
      const state = store.getState();
      const { sprintMetrics, manualInput } = state;

      if (!sprintMetrics) {
        throw new Error('Pas de données');
      }

      const markdown = this._generateMarkdown(sprintMetrics, manualInput);

      // Ouvrir dans un nouvel onglet
      const blob = new Blob([markdown], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      window.open(url, '_blank');

      return true;
    } catch (error) {
      console.error('[Exporter] Erreur preview:', error);
      return false;
    }
  }
}

// =========================================================================
// EXPORT
// =========================================================================

const pdfExporter = new Exporter();
export default pdfExporter;
