# Sprint Review Dashboard

Dashboard interactif pour les Sprint Reviews d'équipes Agile. Visualisez vos métriques, analysez vos tendances et projetez votre capacité future.

---

## Table des matières

1. [Présentation](#présentation)
2. [Installation](#installation)
3. [Pages principales](#pages-principales)
   - [Préparation](#préparation)
   - [Review](#review)
   - [Forecast](#forecast)
4. [Pages secrètes](#pages-secrètes)
   - [StarAc](#starac)
   - [Simulation longue durée](#simulation-longue-durée)
5. [Format des données](#format-des-données)
6. [Métriques calculées](#métriques-calculées)
7. [Algorithmes](#algorithmes)
8. [Conformité RGPD](#conformité-rgpd)

---

## Présentation

Le Sprint Review Dashboard est un outil web standalone (sans backend) conçu pour accompagner les équipes Scrum lors de leurs Sprint Reviews. Il permet de :

- **Visualiser** les métriques du sprint (throughput, cycle time, bugs)
- **Comparer** les performances avec les sprints précédents
- **Projeter** la capacité future via Monte Carlo
- **Présenter** les résultats de manière claire et professionnelle

### Caractéristiques

- 100% client-side (pas de serveur requis)
- Import de données via CSV (export Jira)
- Calculs automatiques des métriques
- Export PDF pour archivage
- Design responsive

---

## Installation

1. Cloner ou télécharger le projet
2. Ouvrir `index.html` dans un navigateur moderne
3. C'est prêt !

> **Note** : Pour le développement local, utilisez un serveur HTTP simple pour éviter les restrictions CORS :
> ```bash
> npx serve .
> ```

---

## Pages principales

### Préparation

Page d'administration pour configurer la review.

#### Fonctionnalités

- **Sélection de l'équipe** : Choisir parmi les équipes disponibles dans les données
- **Import CSV** : Charger les exports Jira (tickets et time in status)
- **Sprint Goals** : Saisir et évaluer les objectifs du sprint
- **Story Points** : Saisie manuelle si non disponible dans le CSV

#### Comment utiliser

1. Sélectionner l'équipe dans le menu déroulant
2. Importer le fichier CSV des tickets
3. (Optionnel) Importer le fichier Time in Status
4. Définir les Sprint Goals et leur statut
5. Naviguer vers "Review"

---

### Review

Page de présentation des métriques du sprint, conçue pour être projetée pendant la Sprint Review.

#### Métriques affichées

**Ligne 1 - Métriques Flow**

| Métrique | Description |
|----------|-------------|
| **Throughput** | Nombre de tickets terminés par sprint |
| **Ajouts mid-sprint** | Tickets ajoutés après le début du sprint |
| **Cycle Time** | Temps moyen de traitement (moyenne + médiane) |
| **Corrélation SP/CT** | Coefficient de Pearson entre Story Points et Cycle Time |

**Ligne 2 - Métriques DORA**

| Métrique | Description |
|----------|-------------|
| **Stock Bugs** | Bugs ouverts, créés et résolus |
| **MTTR** | Mean Time To Recovery - temps moyen de résolution des bugs |
| **Change Failure Rate** | % de bugs créés par rapport aux items livrés |

#### Graphiques

- **Throughput** : Barres par sprint (toggle Tickets/Story Points)
- **Cycle Time** : Barres avec lignes de benchmark (moyenne/médiane globale)
- **Time in Status** : Camemberts comparant le sprint vs 6 sprints
- **Bugs** : Barres empilées (créés vs résolus)
- **WIP Individuel** : Courbe du WIP moyen par membre (tickets en cours)

#### Story Points

Affichage automatique depuis le CSV :
- Sprint actuel : Engagés / Livrés / % Complétion
- Moyenne des sprints précédents
- **Vélocité recommandée** (cachée, clic pour révéler)

---

### Forecast

Projection Monte Carlo pour répondre à la question : **"Quand sera-ce terminé ?"**

#### Fonctionnalités

- Saisie du nombre d'items restants dans le backlog
- Simulation Monte Carlo (10 000 itérations)
- Résultats par percentile (P50, P85, P95)
- Visualisation de la distribution

#### Interprétation des résultats

| Percentile | Signification |
|------------|---------------|
| **P50** | 50% de chances de finir à cette date ou avant |
| **P85** | 85% de chances (recommandé pour les engagements) |
| **P95** | 95% de chances (scénario pessimiste) |

#### Sections cachées

Les sections **Simuler des absences** et **Simulation par contributeur** sont masquées par défaut car discuter de vélocité individuelle n'est pas recommandé en Agile. Utilisez le code `→→←←` pour les afficher si nécessaire.

---

## Pages secrètes

Des pages additionnelles accessibles via des codes Konami.

### Codes disponibles

| Code | Action |
|------|--------|
| `↑ ↑ ↓ ↓` | Affiche l'onglet **StarAc** |
| `← ← → →` | Affiche l'onglet **Simulation longue durée** |
| `→ → ← ←` | Affiche les **sections individuelles** dans Forecast |
| `p e a r` | Affiche la carte **Corrélation Pearson SP/CT** dans Review |
| `↓ ↓ ↑ ↑` | **Cache** tous les secrets (onglets + sections + cartes) |

> **Astuce** : Utilisez `↓↓↑↑` pour masquer rapidement tous les éléments secrets lors d'une présentation.

---

### StarAc

Page de visualisation des contributeurs partagés entre équipes.

Affiche les développeurs qui ont travaillé sur plusieurs équipes pendant la période, avec le détail de leur contribution (tickets, story points).

---

### Simulation longue durée

Projection Monte Carlo avancée pour répondre à la question : **"Combien pourrons-nous livrer ?"**

#### Différence avec Forecast

| Forecast | Simulation longue durée |
|----------|------------------------|
| "Quand sera-ce fini ?" | "Combien sur X semaines ?" |
| Backlog fixe → Date | Horizon fixe → Quantité |
| Court terme | Long terme (jusqu'à 12 semaines) |

#### Options

- **Métrique** : Tickets ou Story Points
- **Pondération** : Donne plus de poids aux 2 derniers sprints
- **Outliers** : Exclut les sprints anormalement bas (congés, incidents)

#### Résultats

Projection sur 5 horizons temporels :

| Horizon | Sprints |
|---------|---------|
| 2 semaines | 1 sprint |
| 4 semaines | 2 sprints |
| 6 semaines | 3 sprints |
| 8 semaines | 4 sprints |
| 12 semaines | 6 sprints |

Pour chaque horizon, 3 scénarios :

| Scénario | Description |
|----------|-------------|
| **Réaliste** | Issue la plus probable (P50) |
| **Optimiste** | 15% de chances de faire mieux |
| **Très optimiste** | 5% de chances de faire mieux |

#### Analyse

- **Tendance** : Haussière, stable ou baissière
- **Stabilité** : Haute, modérée ou basse (basée sur le coefficient de variation)

---

## Format des données

### CSV Tickets (export Jira)

Le fichier doit être nommé **"Sprint Review.csv"** (ou contenir "sprint review" dans le nom).

#### Structure attendue

```csv
,Issues created,Issue key,Issue type,Issue created date,Issue status,Progress workdays,Issue closed date,Issue Sprints,Issue Sprint,Issue Story Points,Issue assignee
All Issues,41,,,,,287.45,,,,,
NomEquipe,41,,,,,287.45,,,,,
PHX-101 Description,,PHX-101,Story,2024-10-02 09:15:00,Terminé,6.78,2024-10-11 16:45:00,Sprint 10,(no sprint),8,Marie Dupont
```

#### Colonnes

| Colonne | Description | Obligatoire |
|---------|-------------|-------------|
| (vide) | Résumé du ticket | Non |
| `Issues created` | Compteur (pour lignes agrégat) | Non |
| `Issue key` | Identifiant du ticket (PHX-101) | Oui |
| `Issue type` | Type (Story, Bug, Task, Epic) | Oui |
| `Issue created date` | Date de création (YYYY-MM-DD HH:MM:SS) | Oui |
| `Issue status` | Statut actuel (Terminé, En cours, etc.) | Oui |
| `Progress workdays` | Cycle time en jours ouvrés | Non |
| `Issue closed date` | Date de résolution | Non |
| `Issue Sprints` | Sprint(s) associé(s), séparés par virgule | Oui |
| `Issue Sprint` | Sprint actif | Non |
| `Issue Story Points` | Estimation en points | Non |
| `Issue assignee` | Nom de l'assigné | Non |

#### Lignes spéciales

- **Ligne "All Issues"** : Agrégat global (ignorée)
- **Ligne équipe** : Nom de l'équipe utilisé pour les chips de sélection

### CSV Time in Status

Fichier optionnel pour les graphiques de répartition du temps par statut.

#### Structure attendue

```csv
Status,Period,Avg Workdays,Cycle %
To Do (12),Previous week,0.8,0.12
To Do (45),Last 12 weeks,1.2,0.15
In Progress (8),Previous week,2.1,0.32
```

| Colonne | Description |
|---------|-------------|
| `Status` | Nom du statut avec count entre parenthèses |
| `Period` | "Previous week" ou "Last 12 weeks" |
| `Avg Workdays` | Temps moyen en jours ouvrés |
| `Cycle %` | Pourcentage du cycle total |

### Fichiers de démonstration

Des fichiers d'exemple sont disponibles dans le dossier `/demo/` :
- `Sprint Review.csv` - Données fictives d'une équipe "Phoenix"
- `Time in status.csv` - Répartition du temps par statut

---

## Métriques calculées

### Throughput

- **Définition** : Nombre d'items terminés par sprint
- **Calcul** : Count des tickets avec `Resolved` dans la période du sprint
- **Variantes** : Tickets ou Story Points

### Cycle Time

- **Définition** : Temps entre le début du travail et la livraison
- **Calcul** : `Date Resolved - Date début travail` (en jours ouvrés)
- **Exclusions** : Les bugs sont exclus (métrique séparée)

### Mid-Sprint Additions

- **Définition** : Tickets ajoutés après le lancement du sprint
- **Règle** : Ticket créé APRÈS le lundi de début ET présent uniquement dans ce sprint

### Stock Bugs

- **Stock** : Bugs ouverts à date
- **Flux** : Créés vs Résolus par sprint

### MTTR (Mean Time To Recovery)

- **Définition** : Temps moyen de résolution des bugs
- **Calcul** : Moyenne du cycle time des tickets de type "Bug"
- **Interprétation** : Plus bas = meilleure réactivité

### Change Failure Rate

- **Définition** : Taux d'échec des changements (métrique DORA)
- **Calcul** : `(Bugs créés / Items livrés) × 100`
- **Seuils** :
  - < 15% : Excellent (vert)
  - 15-30% : Moyen (orange)
  - > 30% : À améliorer (rouge)

### WIP Individuel Moyen

- **Définition** : Nombre moyen de tickets "en cours" par membre de l'équipe
- **Calcul** : `Tickets en cours ÷ Contributeurs actifs`
- **Interprétation** :
  - WIP stable et bas : Flux sain, équipe focalisée
  - WIP en hausse : L'équipe démarre plus qu'elle ne termine
  - Loi de Little : `Cycle Time = WIP ÷ Throughput`

### Corrélation SP/Cycle Time (Pearson)

- **Définition** : Mesure si le sizing relatif (Story Points) est cohérent avec l'effort réel (Cycle Time)
- **Calcul** : Coefficient de corrélation de Pearson entre Story Points et Cycle Time
- **Interprétation** :
  - **0.7 - 1.0** : Forte → Le sizing est fiable pour la prédictibilité
  - **0.4 - 0.7** : Modérée → Le sizing est partiellement utile
  - **0.0 - 0.4** : Faible → Le sizing n'aide pas à planifier
- **Usage** : Une corrélation proche de 0 suggère que les story points n'aident pas à la prédictibilité. Comparer le sprint actuel aux sprints précédents permet de voir si la fiabilité du sizing s'améliore.

---

## Algorithmes

### Monte Carlo - "When" (Forecast)

```
Pour chaque simulation (10 000x) :
  sprints_nécessaires = 0
  items_restants = backlog_size

  Tant que items_restants > 0 :
    throughput = échantillon_aléatoire(historique)
    items_restants -= throughput
    sprints_nécessaires++

  Enregistrer sprints_nécessaires

Résultat = percentiles(toutes_simulations)
```

### Monte Carlo - "How Many" (Simulation longue durée)

Approche statistique (distribution normale) :

```
μ = moyenne_pondérée(throughputs)
σ = écart_type_pondéré(throughputs)

Pour chaque horizon N sprints :
  μ_horizon = N × μ + bonus_tendance
  σ_horizon = √N × σ

  P50 = μ_horizon × safety_factor_50
  P85 = (μ_horizon + 1.036σ_horizon) × safety_factor_85
  P95 = (μ_horizon + 1.645σ_horizon) × safety_factor_95
```

#### Bonus tendance (si haussière)

Avec rendements décroissants (decay = 0.85) :

```
bonus = factor × slope × Σ(decay^i) pour i=0 à N-1
      = factor × slope × (1 - decay^N) / (1 - decay)

factor = 0.50 si tendance modérée
       = 0.75 si tendance forte
```

#### Safety factors

| Percentile | Factor |
|------------|--------|
| P50 | 1.00 |
| P85 | 0.95 |
| P95 | 0.90 |

### Détection des outliers

Méthode IQR modifiée (outliers bas uniquement) :

```
Q1, Q3 = quartiles(données)
IQR = Q3 - Q1
seuil_iqr = Q1 - 1.5 × IQR
seuil_médiane = médiane × 0.50

outlier si : valeur < seuil_médiane ET valeur ≤ Q1
```

---

## Architecture technique

```
sprint-review-dashboard/
├── index.html              # Point d'entrée
├── css/
│   ├── variables.css       # Design tokens
│   ├── base.css           # Reset & typography
│   ├── layout.css         # Grid & containers
│   ├── components/        # Composants réutilisables
│   └── pages/             # Styles par page
├── js/
│   ├── main.js            # Bootstrap application
│   ├── core/              # Store, Router, EventBus
│   ├── components/        # Composants UI
│   ├── pages/             # Pages (Admin, Review, Forecast...)
│   ├── services/          # Logique métier
│   └── utils/             # Helpers
├── demo/                   # Fichiers CSV de démonstration
│   ├── Sprint Review.csv
│   └── Time in status.csv
└── docs/                   # Documentation
    ├── README.md
    └── CONFORMITE-RGPD.md
```

---

## Raccourcis clavier

| Raccourci | Action |
|-----------|--------|
| `↑ ↑ ↓ ↓` | Afficher StarAc |
| `← ← → →` | Afficher Simulation longue durée |
| `→ → ← ←` | Afficher sections individuelles (Forecast) |
| `p e a r` | Afficher corrélation Pearson (Review) |
| `↓ ↓ ↑ ↑` | Cacher tous les secrets |

---

## Conformité RGPD

L'application est **conforme RGPD** grâce à son architecture 100% client-side :

| Critère | Statut |
|---------|--------|
| Pas de serveur externe | ✅ |
| Pas de cookies tiers | ✅ |
| Pas de tracking/analytics | ✅ |
| Données éphémères par défaut | ✅ |
| Sections individuelles cachées | ✅ |

**Points d'attention** :
- Les noms des assignés sont des données personnelles
- Informer l'équipe de l'utilisation de leurs données Jira
- Ne pas utiliser les métriques individuelles pour l'évaluation de performance

📄 Voir [CONFORMITE-RGPD.md](./CONFORMITE-RGPD.md) pour l'analyse complète.

---

## Support

Pour toute question ou suggestion, ouvrir une issue sur le repository.
