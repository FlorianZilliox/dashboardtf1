# Composants

> Fichiers sources : `css/components/*.css`, `js/components/`

---

## Badges

> `css/components/badge.css`

Petits indicateurs inline pour afficher un statut, une categorie ou un compteur.

### Classes

| Classe | Description |
|---|---|
| `.badge` | Base -- fond `--paper-3`, texte `--ink-2`, border-radius `--radius-sm` |
| `.badge--primary` | Fond `--sage-soft`, texte `--forest` |
| `.badge--success` | Fond vert clair, texte vert fonce |
| `.badge--warning` | Fond ambre clair, texte ochre |
| `.badge--danger` | Fond rust clair, texte rust |
| `.badge--blue` | Bleu |
| `.badge--teal` | Bleu-gris |
| `.badge--coral` | Corail |
| `.badge--yellow` | Jaune |
| `.badge--purple` | Prune |
| `.badge--green` | Vert |
| `.badge--orange` | Orange |

### Modificateurs

| Classe | Effet |
|---|---|
| `.badge--sm` | Taille reduite (font-size xs) |
| `.badge--lg` | Taille augmentee |
| `.badge--pill` | Border-radius `--radius-full` (pilule) |
| `.badge--outline` | Bordure seule, fond transparent |

### Variante compteur

`.count-badge` -- pastille numerique, souvent positionnee en absolu sur un element parent.

```html
<span class="badge badge--success badge--pill">Termine</span>
<span class="badge badge--warning">En cours</span>
<span class="count-badge">3</span>
```

---

## Boutons

> `css/components/button.css`

### Classes

| Classe | Description |
|---|---|
| `.btn` | Base -- pilule arrondie, padding 8px 16px |
| `.btn--primary` | Fond fonce (`--ink`), texte clair |
| `.btn--secondary` | Bordure, fond transparent |
| `.btn--ghost` | Aucun fond ni bordure, texte seul |
| `.btn--outline` | Bordure accent |
| `.btn--link` | Style lien (underline) |
| `.btn--success` | Vert |
| `.btn--danger` | Rouge |
| `.btn--warning` | Orange |

### Tailles & variantes

| Classe | Effet |
|---|---|
| `.btn--sm` | Petit |
| `.btn--lg` | Grand |
| `.btn--block` | Pleine largeur |
| `.btn--icon-only` | Carre (icone seule) |
| `.btn--fab` | Floating action button (cercle) |

### Groupe de boutons

`.btn-group` -- boutons connectes horizontalement, les radius intermediaires sont supprimes.

```html
<div class="btn-group">
  <button class="btn btn--secondary">Jour</button>
  <button class="btn btn--primary">Semaine</button>
  <button class="btn btn--secondary">Mois</button>
</div>
```

---

## Cartes

> `css/components/card.css`

### Types

| Classe | Description |
|---|---|
| `.card` | Carte de base -- fond paper, bordure line-soft, radius-lg, shadow-card |
| `.card--interactive` | Hover avec lift (translateY -2px) et shadow-card-hover |
| `.card--bordered` | Bordure superieure coloree (4px) |
| `.card--bordered-success` | Bordure top verte |
| `.card--bordered-warning` | Bordure top orange |
| `.card--bordered-danger` | Bordure top rouge |

### Carte metrique (KPI)

`.metric-card` -- composant principal du dashboard. Affiche un KPI avec titre, valeur, icone et footer.

```html
<div class="metric-card">
  <div class="metric-card__header">
    <span class="metric-card__title">Velocity</span>
    <span class="metric-card__icon">...</span>
  </div>
  <div class="metric-card__value mono">42</div>
  <div class="metric-card__footer">
    <span class="metric-card__trend badge badge--success">+12%</span>
  </div>
</div>
```

Variante : `.metric-card--compact` pour une version plus petite.

### Carte info

`.info-card` -- carte avec icone et description textuelle (etats, messages).

---

## Jauges (Gauges)

> `css/components/gauge.css`

Barres de progression pour visualiser l'avancement.

### Types

| Classe | Description |
|---|---|
| `.gauge` | Barre lineaire horizontale |
| `.gauge--success` | Remplissage vert |
| `.gauge--warning` | Remplissage orange |
| `.gauge--danger` | Remplissage rouge |
| `.gauge--gradient` | Remplissage degrade |
| `.mini-gauge` | Barre inline (dans un tableau) |
| `.segmented-gauge` | Barre a segments / etapes |
| `.ring-gauge` | Jauge circulaire (SVG) |
| `.sp-gauge` | Affichage Story Points (grand format) |
| `.story-points-gauge` | SP avec markers et zones colorees |

```html
<div class="gauge gauge--success">
  <div class="gauge__fill" style="width: 75%"></div>
</div>
```

---

## Champs de formulaire (Inputs)

> `css/components/input.css`

### Elements

| Classe | Description |
|---|---|
| `.form-group` | Conteneur label + input |
| `.form-label` | Label du champ |
| `.form-label--required` | Label avec indicateur obligatoire |
| `.form-help` | Texte d'aide sous le champ |
| `.form-error` | Message d'erreur |
| `.input` | Champ texte standard |
| `.input--error` | Etat erreur (bordure rouge) |
| `.input--valid` | Etat valide (bordure verte) |
| `.input--sm` / `.input--lg` | Tailles |
| `.input-group` | Input avec icone ou addon |
| `.textarea` | Champ multi-lignes |
| `.select` | Menu deroulant |
| `.input-number` | Champ numerique avec boutons +/- |

---

## Toggles & Selection

> `css/components/toggle.css`

| Classe | Description |
|---|---|
| `.toggle-group` | Groupe de boutons toggle (ex: Moyenne/Mediane) |
| `.switch` | Interrupteur on/off |
| `.radio` / `.radio-group` | Boutons radio |
| `.checkbox` | Case a cocher custom |
| `.toggle-card` | Carte selectionnable |

---

## Navigation

> `css/components/navigation.css`

### Masthead (header)

```html
<header class="masthead">
  <div class="masthead__top">
    <!-- Brand, nom du sprint, selecteur d'equipe -->
  </div>
  <nav class="masthead__nav">
    <button class="tab tab--active">Vue d'ensemble</button>
    <button class="tab">Flux</button>
    <button class="tab">Engagement</button>
    <button class="tab tab--secret">Monte Carlo</button>
  </nav>
</header>
```

- `.masthead` : header sticky (`position: sticky; top: 0`)
- `.tab` : onglet de navigation
- `.tab--active` : onglet selectionne (bordure basse accent)
- `.tab--secret` : onglet cache avec effet gradient

---

## Graphiques (Charts)

> `css/components/charts.css`

Wrappers pour les graphiques Chart.js :

| Classe | Description |
|---|---|
| `.chart-wrapper` | Conteneur avec canvas |
| `.chart-box` | Carte avec header + graphique |
| `.chart-legend` | Legende externe |
| `.chart-benchmark` | Indicateur de ligne de reference |
| `.donut-chart` | Doughnut avec texte central |
| `.bar-chart-highlight` | Bar chart avec valeur en surimpression |
| `.trend-chart` | Conteneur de line chart |
| `.sparkline` | Mini bar chart inline |

---

## Loaders & Etats

> `css/components/loader.css`

### Spinners

| Classe | Description |
|---|---|
| `.loader` | Spinner circulaire (24px par defaut) |
| `.loader--xs` / `--sm` / `--lg` / `--xl` | Tailles |
| `.dots-loader` | Trois points qui rebondissent |
| `.pulse-loader` | Cercle pulsant |

### Barres de progression

| Classe | Description |
|---|---|
| `.progress` | Barre lineaire |
| `.progress--sm` / `--lg` | Tailles |
| `.progress--success` / `--warning` / `--danger` | Couleurs |

### Squelettes

`.skeleton` -- placeholder anime (shimmer) pour le chargement. Applique un degrade anime qui simule le chargement du contenu.

### Etat vide

> `css/components/empty-state.css`

`.empty-state` -- affiche un message et une illustration quand il n'y a pas de donnees.

---

## Upload de fichiers

> `css/components/file-upload.css`

`.file-upload` -- zone de depot de fichier CSV avec drag & drop, indicateur de progression et etats (idle, loading, success, error).

---

## Panneau Tweaks

> `css/components/tweaks.css`

`.twk-panel` -- panneau flottant en bas a droite permettant a l'utilisateur de changer en temps reel :
- La palette de couleurs (Sauge, Rose, Encre)
- La densite (Dense, Normal, Aere)
- La typographie (Editorial, Sans, Mono)
- Le theme (Clair / Sombre)
