# Sprint Review Dashboard - Documentation

## Table des matières

1. [Export EazyBI](#1-export-eazybi)
2. [Règles métier](#2-règles-métier)
3. [Calculs et formules](#3-calculs-et-formules)
4. [Architecture technique](#4-architecture-technique)

---

## 1. Export EazyBI

### 1.1 Colonnes requises

| Colonne | Obligatoire | Description | Exemple |
|---------|-------------|-------------|---------|
| `Issue key` | **Oui** | Identifiant unique du ticket | `DE-123`, `DI-456` |
| `Issue type` | Oui | Type de ticket | `Story`, `Bug`, `Epic`, `Task` |
| `Issue status` | Oui | Statut actuel | `Terminé`, `A Faire`, `En cours` |
| `Issue closed date` | Oui | Date de fermeture | `2025-12-15 14:00:00` |
| `Progress workdays` | Oui | Cycle time en jours ouvrés | `5.5` |
| `Issue created date` | Non | Date de création | `2025-12-01 10:00:00` |
| `Issue Sprints` | **Oui*** | Liste des sprints traversés | `Sprint 15,Sprint 16` |
| `Issue Sprint` | **Oui*** | Sprint unique/actuel | `Sprint 16` |
| `Issue Story Points` | Non | Points de complexité | `3`, `5`, `8` |
| `Issue assignee` | Non | Personne assignée | `Jean DUPONT` |

> **\*** Au moins une des deux colonnes sprint doit être renseignée.

### 1.2 Ordre des colonnes

**L'ordre des colonnes n'est PAS important.** Le parser détecte automatiquement les colonnes par leur nom (insensible à la casse).

### 1.3 Formats de sprint supportés

Le parser extrait le numéro de sprint avec le pattern `Sprint\s*(\d+)` :

| Format | Exemple | Numéro extrait |
|--------|---------|----------------|
| Simple | `Sprint 16` | 16 |
| Avec équipe | `Sprint 16 IAML – 05/01` | 16 |
| Avec date | `Sprint 12 Team – 10/11` | 12 |
| Liste | `Sprint 15,Sprint 16` | [15, 16] |

### 1.4 Valeurs spéciales ignorées

- `(no sprint)` : Considéré comme absence de sprint
- Lignes sans `Issue key` valide (format `XX-123`) : Ignorées (lignes de résumé)

### 1.5 Priorité des colonnes sprint

Quand les deux colonnes sont présentes :

```
1. Issue Sprints (pluriel) → Prioritaire (historique complet)
2. Issue Sprint (singulier) → Fallback si pluriel vide ou "(no sprint)"
```

---

## 2. Règles métier

### 2.1 Ticket terminé

Un ticket est considéré **terminé** si son statut contient (insensible à la casse) :
- `Terminé`
- `Done`
- `Fini`
- `Résolu`
- `Closed`

```javascript
const isFinished = /termin|done|fini|résolu|closed/i.test(status);
```

### 2.2 Sprint de fermeture

Le **sprint de fermeture** d'un ticket est le **dernier sprint** de sa liste `Issue Sprints`.

Exemple :
- `Issue Sprints` = `"Sprint 12,Sprint 13,Sprint 14"`
- Sprint de fermeture = **14**

### 2.3 Tickets embarqués vs fermés

| Métrique | Définition |
|----------|------------|
| **Embarqués** | Tickets qui apparaissent dans le sprint (dans `Issue Sprints`) |
| **Fermés** | Tickets terminés dont le sprint de fermeture = ce sprint |

### 2.4 Ajouts mid-sprint

Un ticket est considéré comme **ajout mid-sprint** s'il n'apparaît que dans un seul sprint (`isSingleSprint = true`) et a été créé après le début du sprint.

### 2.5 Sprint disponible en Review

Un sprint apparaît dans le sélecteur **uniquement s'il a au moins un ticket fermé**.

> **Exemple** : Le Sprint 17 démarre le lundi. Dès qu'un ticket est fermé (même le jour 1),
> le Sprint 17 devient disponible dans le sélecteur, même si le sprint n'est pas terminé.
> Cela permet de consulter les données partielles en cours de sprint.

### 2.6 Sprint Forecast

Le sprint Forecast = **Sprint Review sélectionné + 1**

Exemple : Si Review = Sprint 16, alors Forecast = Sprint 17

---

## 3. Calculs et formules

### 3.1 Throughput

```
Throughput = Nombre de tickets fermés dans le sprint
```

- Exclut les Epics (sauf configuration contraire)
- Compte uniquement les tickets avec `isFinished = true`

### 3.2 Cycle Time

```
Cycle Time moyen = Moyenne des "Progress workdays" des tickets fermés
```

- Exclut les Bugs (calculés séparément)
- Si `Progress workdays = 0` pour un ticket terminé → valeur par défaut = 1 jour

### 3.3 Story Points

| Métrique | Calcul |
|----------|--------|
| **SP Engagés (Committed)** | Somme des SP de tous les tickets embarqués dans le sprint |
| **SP Livrés (Delivered)** | Somme des SP des tickets fermés dans le sprint |
| **Completion %** | `(Delivered / Committed) * 100` |

### 3.4 Vélocité recommandée

```
Vélocité recommandée = P50 Monte Carlo des Story Points
```

Cohérent entre la page Review et la page Forecast.

### 3.5 Monte Carlo

#### Paramètres
- **Itérations** : 10 000 simulations
- **Sprints analysés** : 6 derniers sprints avec au moins 1 ticket fermé

> **Note** : Un sprint est considéré comme "disponible" dès qu'il a au moins 1 ticket fermé,
> même s'il est encore en cours. Cela permet d'analyser les données partielles du sprint actuel.

#### Algorithme
Pour chaque simulation :
1. Pour chaque contributeur actif, tirer aléatoirement une de ses performances passées
2. Sommer les contributions individuelles
3. Obtenir un total équipe

#### Percentiles
| Percentile | Signification | Label |
|------------|---------------|-------|
| **P15** | 85% des simulations font mieux | Pessimiste |
| **P50** | Médiane (50/50) | Réaliste |
| **P85** | Seulement 15% font mieux | Optimiste |

#### Fiabilité contributeur

Un contributeur est considéré **fiable** s'il a été actif dans au moins **50% des sprints analysés**.

```javascript
const isReliable = (sprintsActive / sprintsAnalyzed) >= 0.5;
```

### 3.6 Simulation d'absences

Quand un contributeur est marqué absent :
1. Il est exclu de la simulation Monte Carlo
2. Les scénarios P15/P50/P85 sont recalculés sans sa contribution
3. Le tableau affiche ses lignes barrées

---

## 4. Architecture technique

### 4.1 Flux de données

```
CSV EazyBI
    ↓
csvParserV2.js (parseUnifiedCSV)
    ↓
dataTransformerV2.js (transformAllDataV2)
    ↓
store.js (état global)
    ↓
ReviewPage.js / ForecastPage.js
```

### 4.2 Services principaux

| Service | Responsabilité |
|---------|----------------|
| `csvParserV2.js` | Parse le CSV, détecte les colonnes, extrait les tickets |
| `dataTransformerV2.js` | Transforme les données brutes en métriques (throughput, cycle time, story points) |
| `monteCarloService.js` | Exécute les simulations Monte Carlo par contributeur |
| `forecastDataService.js` | Prépare les données pour la page Forecast |

### 4.3 Fichiers de style

| Fichier | Contenu |
|---------|---------|
| `css/pages/review.css` | Styles page Review |
| `css/pages/forecast.css` | Styles page Forecast |
| `css/pages/admin.css` | Styles page Préparation |
| `css/components/*.css` | Composants réutilisables |

### 4.4 État global (Store)

```javascript
{
  csvData: {
    tickets: [...],      // Tickets parsés
    summary: {...}       // Résumé global
  },
  sprintMetrics: {
    throughput: {...},   // Métriques throughput
    cycleTime: {...},    // Métriques cycle time
    bugs: {...},         // Métriques bugs
    storyPoints: {...}   // Story points auto-calculés
  },
  manualInput: {
    teamName: "...",     // Nom de l'équipe
    sprintName: "...",   // Sprint sélectionné
    storyPoints: [...]   // SP manuels (fallback)
  }
}
```

---

## Changelog

| Date | Version | Changements |
|------|---------|-------------|
| 2026-01-20 | 2.0 | Support multi-colonnes sprint, Story Points auto, Monte Carlo individuel |

