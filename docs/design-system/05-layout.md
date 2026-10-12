# Layout & Grilles

> Fichier source : `css/layout.css`

## Structure de page

```
┌─────────────────────────────────────────┐
│  .masthead (sticky)                     │
│  ┌─────────────────────────────────────┐│
│  │ .masthead__top  (brand + sprint)    ││
│  ├─────────────────────────────────────┤│
│  │ .masthead__nav  (onglets)           ││
│  └─────────────────────────────────────┘│
├─────────────────────────────────────────┤
│  main (max-width: --max-width-content)  │
│                                         │
│  ┌─ .section ─────────────────────────┐ │
│  │  .metrics-grid (4 cols)            │ │
│  │  ┌──────┐┌──────┐┌──────┐┌──────┐ │ │
│  │  │metric││metric││metric││metric│ │ │
│  │  └──────┘└──────┘└──────┘└──────┘ │ │
│  └────────────────────────────────────┘ │
│                                         │
│  ┌─ .section ─────────────────────────┐ │
│  │  .charts-grid (2 cols)             │ │
│  │  ┌────────────┐ ┌────────────┐     │ │
│  │  │   chart    │ │   chart    │     │ │
│  │  └────────────┘ └────────────┘     │ │
│  └────────────────────────────────────┘ │
│                                         │
└─────────────────────────────────────────┘
```

## Grilles

### `.metrics-grid`

Grille pour les cartes KPI. 4 colonnes par defaut, responsive.

```css
display: grid;
grid-template-columns: repeat(4, 1fr);
gap: var(--spacing-6);
```

### `.charts-grid`

Grille pour les graphiques. 2 colonnes par defaut.

```css
display: grid;
grid-template-columns: repeat(2, 1fr);
gap: var(--spacing-6);
```

### `.grid-sidebar`

Layout a deux colonnes avec sidebar fixe (ex: contenu + panneau lateral).

### `.grid-auto`

Grille auto-responsive avec `auto-fit` et min 280px :

```css
display: grid;
grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
gap: var(--spacing-6);
```

### `.kpi-grid`

Grille editoriale pour les cellules KPI (3 colonnes).

### `.scenarios`

Grille pour les cartes de scenario Monte Carlo (3 colonnes).

## Sections

`.section` -- conteneur de contenu avec padding, fond paper, bordure et radius.

```html
<section class="section">
  <h2 class="h-section">Titre de section</h2>
  <div class="metrics-grid">
    <!-- cartes -->
  </div>
</section>
```

`.section--editorial` -- variante avec separateur editorial (filet decore).

## Breakpoints responsifs

| Breakpoint | Largeur max | Changements |
|---|---|---|
| Laptop | `1200px` | `.metrics-grid` passe a 2 colonnes |
| Tablet | `992px` | `.charts-grid` passe a 1 colonne |
| Tablet portrait | `768px` | Tailles de police reduites, colonnes uniques |
| Mobile | `576px` | Layout full single-column, padding reduit |

### Comportement responsive des grilles

```
Desktop (> 1200px)     Laptop (< 1200px)     Mobile (< 576px)
┌──┐┌──┐┌──┐┌──┐      ┌──┐┌──┐               ┌──┐
│  ││  ││  ││  │      │  ││  │               │  │
└──┘└──┘└──┘└──┘      └──┘└──┘               └──┘
                       ┌──┐┌──┐               ┌──┐
                       │  ││  │               │  │
                       └──┘└──┘               └──┘
                                              ┌──┐
                                              │  │
                                              └──┘
                                              ┌──┐
                                              │  │
                                              └──┘
```

## Utilitaires de layout

### Flexbox

| Classe | Propriete |
|---|---|
| `.flex` | `display: flex` |
| `.flex-col` | `flex-direction: column` |
| `.flex-row` | `flex-direction: row` |
| `.flex-wrap` | `flex-wrap: wrap` |
| `.items-start` | `align-items: flex-start` |
| `.items-center` | `align-items: center` |
| `.items-end` | `align-items: flex-end` |
| `.justify-start` | `justify-content: flex-start` |
| `.justify-center` | `justify-content: center` |
| `.justify-between` | `justify-content: space-between` |
| `.justify-around` | `justify-content: space-around` |
| `.gap-1` a `.gap-8` | `gap: var(--spacing-X)` |

### Espacement

| Classe | Propriete |
|---|---|
| `.m-0` | `margin: 0` |
| `.m-auto` | `margin: auto` |
| `.mt-4` | `margin-top: var(--spacing-4)` |
| `.mb-6` | `margin-bottom: var(--spacing-6)` |
| `.mb-8` | `margin-bottom: var(--spacing-8)` |
| `.p-4` | `padding: var(--spacing-4)` |
| `.p-6` | `padding: var(--spacing-6)` |
| `.p-8` | `padding: var(--spacing-8)` |

### Visibilite

| Classe | Description |
|---|---|
| `.visually-hidden` | Cache visuellement, accessible aux lecteurs d'ecran |
