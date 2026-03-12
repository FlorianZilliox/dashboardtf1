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

Le parser extrait le numéro de sprint avec plusieurs patterns :

| Format | Exemple | Numéro extrait |
|--------|---------|----------------|
| Standard | `Sprint 16` | 16 |
| Avec équipe | `Sprint 16 IAML – 05/01` | 16 |
| Tableau | `Tableau Sprint 14` | 14 |
| Engager simple | `Engager 13` | 13 |
| Engager Q1 | `Engager Q1-2026 2/7 - 17` | 17 |
| Liste | `Sprint 15,Sprint 16` | [15, 16] |
| Liste Engager | `Engager 14,Engager 15` | [14, 15] |

### 1.4 Valeurs spéciales ignorées

- `(no sprint)` : Considéré comme absence de sprint
- Lignes sans `Issue key` valide (format `XX-123`) : Ignorées (lignes de résumé)

### 1.5 Priorité des colonnes sprint

Quand les deux colonnes sont présentes :

```
1. Issue Sprints (pluriel) → Prioritaire (historique complet)
2. Issue Sprint (singulier) → Fallback si pluriel vide ou "(no sprint)"
```

### 1.6 Structure multi-équipes

Le CSV peut contenir des données de plusieurs équipes. Structure attendue :

```
,Issue key,Issue type,...
All Issues,,,... (ligne de résumé global - ignorée)
DATECH - Automatiser,,,... (ligne équipe - définit currentTeam)
AUT-123,Story,...  (ticket assigné à "Automatiser")
AUT-124,Bug,...    (ticket assigné à "Automatiser")
DATECH - IAML,,,... (nouvelle équipe)
DI-456,Story,...   (ticket assigné à "IAML")
```

**Détection d'équipe :**
- Pattern `DATECH - NomEquipe` → extrait "NomEquipe"
- Pattern générique `Projet - NomEquipe` → extrait "NomEquipe"
- Sinon utilise la valeur brute (si pas un Issue key)

**Attribution :** Chaque ticket hérite de l'équipe de la dernière ligne d'équipe rencontrée.

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

Un ticket est considéré comme **ajout mid-sprint** s'il remplit ces deux conditions :
1. Il n'apparaît que dans un seul sprint (`isSingleSprint = true`)
2. Sa date de création est **strictement après** le lundi de début du sprint

```javascript
const isSingleSprint = ticket.sprints && ticket.sprints.length === 1;
const isCreatedAfterStart = createdDate && createdDate > sprintStart;
const isMidSprintAddition = isSingleSprint && isCreatedAfterStart;
```

### 2.5 Convention des dates de sprint

**Référence fixe** : Sprint 18 commence le **2 février 2026** (lundi de la semaine 6).

**Formule** :
```
Sprint N début = 2 février 2026 - (18 - N) × 14 jours
```

**Durée** : 14 jours (lundi semaine paire → dimanche semaine impaire)

**Exemples** :
| Sprint | Date début | Date fin |
|--------|------------|----------|
| Sprint 17 | 19 janvier 2026 | 1 février 2026 |
| Sprint 18 | 2 février 2026 | 15 février 2026 |
| Sprint 19 | 16 février 2026 | 1 mars 2026 |

**Implémentation** (`utils/sprintDates.js`) :
```javascript
const SPRINT_REF = { number: 18, start: new Date(2026, 1, 2) }; // mois 0-indexed

export function getSprintDates(sprintNumber) {
  const diffSprints = SPRINT_REF.number - sprintNumber;
  const startDate = new Date(SPRINT_REF.start);
  startDate.setDate(startDate.getDate() - (diffSprints * 14));
  // ...
}
```

### 2.6 Sprint disponible en Review

Un sprint apparaît dans le sélecteur **uniquement s'il a au moins un ticket fermé**.

> **Exemple** : Le Sprint 17 démarre le lundi. Dès qu'un ticket est fermé (même le jour 1),
> le Sprint 17 devient disponible dans le sélecteur, même si le sprint n'est pas terminé.
> Cela permet de consulter les données partielles en cours de sprint.

### 2.7 Sprint Forecast

Le sprint Forecast = **Sprint Review sélectionné + 1**

Exemple : Si Review = Sprint 16, alors Forecast = Sprint 17

### 2.8 Filtrage par équipe

**RÈGLE CRITIQUE** : Quand une ou plusieurs équipes sont sélectionnées, **TOUTES les métriques** doivent être calculées uniquement sur les tickets de ces équipes.

| Métrique | Filtrage appliqué |
|----------|-------------------|
| Throughput | Tickets filtrés par équipe |
| Cycle Time | Tickets filtrés par équipe |
| Story Points | Tickets filtrés par équipe |
| Bugs | Tickets filtrés par équipe |
| Burndown | Tickets filtrés par équipe |
| WIP | Tickets filtrés par équipe |
| Corrélation | Tickets filtrés par équipe |
| Time in Status | Tickets filtrés par équipe ET sprint |

**Implémentation** (`dataTransformerV2.js`) :

```javascript
// OBLIGATOIRE : Filtrer par équipe AVANT tout calcul
let filteredTickets = rawData.tickets;
if (selectedTeams && selectedTeams.length > 0) {
  filteredTickets = rawData.tickets.filter(t => selectedTeams.includes(t.team));
}

// Utiliser filteredTickets pour TOUTES les métriques
const sprintData = aggregateBySprint(filteredTickets);
result.bugs = transformBugsV2(displayedSprints, filteredTickets);
result.storyPoints = transformStoryPointsV2(displayedSprints, filteredTickets);
// etc.
```

**Validation** : Si IAML est sélectionnée seule et que le CSV contient 1128 tickets au total dont 151 pour IAML, alors toutes les métriques doivent être calculées sur ces 151 tickets uniquement.

---

## 3. Calculs et formules

### 3.1 Throughput

```
Throughput = Nombre de tickets fermés dans le sprint
```

- Exclut les Epics (sauf configuration contraire)
- Compte uniquement les tickets avec `isFinished = true`

### 3.2 Cycle Time

**IMPORTANT** : Le Cycle Time est calculé depuis le **Time in Status CSV**, pas depuis le Sprint Review CSV.

```
Cycle Time = Somme des temps dans tous les statuts de travail
           = En cours + Code Review + A tester + A déployer + A valider
```

**Source de données :**
- `Time in Status CSV` → **Cycle Time réel** (temps de travail effectif)
- `Progress workdays` (Sprint Review) → Lead Time (création → fermeture) - NON UTILISÉ

**Règles :**
- Exclut les **Bugs** (calculés séparément dans la métrique Bugs)
- Si le Time in Status n'est pas chargé, fallback sur Progress workdays (moins précis)
- Calcul de la moyenne ET de la médiane pour chaque sprint

**Implémentation** (`dataTransformerV2.js`) :
```javascript
// Enrichissement depuis Time in Status
if (tisTicket && tisTicket.totalTime > 0) {
  ticket.cycleTime = tisTicket.totalTime; // Somme des temps de statut
}
```

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

### 3.7 Time in Status

#### Calcul des moyennes

```
Moyenne par statut = Somme des temps / Nombre TOTAL de tickets filtrés
```

**IMPORTANT** : On divise par le nombre total de tickets, pas par le nombre de tickets ayant du temps dans ce statut. Cela évite de gonfler artificiellement les pourcentages pour les statuts peu utilisés.

#### Exemple

Pour 7 tickets avec ces temps en Code Review : [0, 0, 0, 0, 0, 0, 1.71j]

| Méthode | Calcul | Moyenne | % si total=10j |
|---------|--------|---------|----------------|
| ❌ Ancienne | 1.71 / 1 | 1.71j | **53%** (trompeur) |
| ✅ Nouvelle | 1.71 / 7 | 0.24j | **17%** (réaliste) |

#### Filtrage

Le Time in Status est filtré par :
- **Équipe** : tickets de l'équipe sélectionnée
- **Sprint** : tickets dont le `lastSprint` est dans la plage (6 derniers sprints ou sprint unique)

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
| 2026-02-18 | 2.3 | **Clarification Cycle Time** : Documentation mise à jour pour clarifier que le Cycle Time vient du Time in Status (somme des temps de statut), pas du Progress workdays (Lead Time). Support formats Engager. |
| 2026-02-17 | 2.2 | **Fix Time in Status** : Pourcentages calculés sur le total des tickets (évite les % gonflés artificiellement) |
| 2026-02-12 | 2.1 | **Fix critique** : Filtrage par équipe appliqué à TOUTES les métriques (était ignoré sauf Time in Status) |
| 2026-01-20 | 2.0 | Support multi-colonnes sprint, Story Points auto, Monte Carlo individuel |

