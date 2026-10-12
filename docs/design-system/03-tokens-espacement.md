# Tokens - Espacement, Ombres & Divers

> Fichier source : `css/variables.css`

## Espacements

Systeme base sur 8px (0.5rem) avec quelques demi-pas :

| Token | Valeur | px equiv. | Usage type |
|---|---|---|---|
| `--spacing-1` | `0.25rem` | 4px | Micro-ecart (icone + texte) |
| `--spacing-2` | `0.5rem` | 8px | Ecart minimal (inline) |
| `--spacing-3` | `0.75rem` | 12px | Padding interne compact |
| `--spacing-4` | `1rem` | 16px | Padding standard |
| `--spacing-5` | `1.25rem` | 20px | Ecart entre elements |
| `--spacing-6` | `1.5rem` | 24px | Padding de carte |
| `--spacing-8` | `2rem` | 32px | Ecart entre blocs |
| `--spacing-10` | `2.5rem` | 40px | Marge de section |
| `--spacing-12` | `3rem` | 48px | Grande marge |
| `--spacing-16` | `4rem` | 64px | Espacement editorial |
| `--spacing-20` | `5rem` | 80px | Espacement hero |

### Densite

Le multiplicateur `--density` permet d'ajuster globalement les espacements :

- `compact` : `--density: 0.78` -- interface dense, plus de donnees visibles
- `normal` : `--density: 1` -- equilibre par defaut
- `cozy` : `--density: 1.15` -- plus d'air, lecture confortable

Les composants appliquent la densite via `calc(var(--spacing-X) * var(--density))`.

## Bordures

| Token | Valeur | Usage |
|---|---|---|
| `--border-width` | `1px` | Bordure standard |
| `--border-width-thick` | `2px` | Bordure d'emphase |

## Arrondis

| Token | Valeur | Usage |
|---|---|---|
| `--radius-sm` / `--r-sm` | `4px` | Petits elements (badges) |
| `--radius-md` / `--r-md` | `6px` | Elements par defaut (inputs, boutons) |
| `--radius-lg` / `--r-lg` | `10px` | Cartes, sections |
| `--radius-xl` | `0.75rem` (12px) | Grands conteneurs |
| `--radius-2xl` | `1rem` (16px) | Modales |
| `--radius-full` | `9999px` | Pilules, avatars |

## Ombres

| Token | Valeur | Usage |
|---|---|---|
| `--shadow-sm` | `0 1px 3px rgba(0,0,0,0.04)` | Elevation subtile |
| `--shadow-md` | `0 2px 8px rgba(0,0,0,0.04), 0 1px 2px rgba(0,0,0,0.03)` | Cartes au repos |
| `--shadow-lg` | `0 4px 16px rgba(0,0,0,0.06), 0 2px 4px rgba(0,0,0,0.03)` | Elements sureleves |
| `--shadow-xl` | `0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04)` | Modales, dropdowns |
| `--shadow-card` | `0 1px 3px rgba(0,0,0,0.04)` | Carte par defaut |
| `--shadow-card-hover` | `0 4px 12px rgba(0,0,0,0.08)` | Carte au hover |

> Les ombres sont volontairement douces (opacites < 10%) pour rester dans l'esprit editorial "papier".

## Transitions

### Durees

| Token | Valeur | Usage |
|---|---|---|
| `--transition-fast` | `150ms` | Hover d'icones, focus |
| `--transition-normal` | `200ms` | Transitions standard |
| `--transition-slow` | `300ms` | Ouverture de panneaux, modales |

### Easings

| Token | Valeur | Usage |
|---|---|---|
| `--ease-default` | `ease` | Transitions generiques |
| `--ease-in-out` | `cubic-bezier(0.4, 0, 0.2, 1)` | Mouvements naturels |
| `--ease-out` | `cubic-bezier(0, 0, 0.2, 1)` | Apparitions, slides |
| `--ease-in` | `cubic-bezier(0.4, 0, 1, 1)` | Disparitions |

### Raccourcis composes

| Token | Proprietes animees |
|---|---|
| `--transition-colors` | `color`, `background-color`, `border-color` |
| `--transition-transform` | `transform` |
| `--transition-shadow` | `box-shadow` |
| `--transition-all` | `all` |

## Z-Index

Echelle ordonnee pour gerer l'empilement :

| Token | Valeur | Usage |
|---|---|---|
| `--z-base` | `0` | Elements dans le flux |
| `--z-elevated` | `10` | Cartes survolees |
| `--z-dropdown` | `100` | Menus deroulants |
| `--z-sticky` | `200` | Header fixe |
| `--z-overlay` | `300` | Overlay de modal |
| `--z-modal` | `400` | Contenu modal |
| `--z-tooltip` | `500` | Tooltips |
| `--z-toast` | `600` | Notifications toast |

## Dimensions fixes

| Token | Valeur | Usage |
|---|---|---|
| `--max-width-content` | `1480px` | Largeur max du contenu |
| `--height-header` | `56px` | Hauteur du masthead |
| `--height-metric-card` | `160px` | Hauteur des cartes KPI |
| `--height-chart` | `300px` | Hauteur standard graphique |
| `--height-chart-small` | `200px` | Graphique compact |
