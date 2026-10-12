# Tokens - Couleurs

> Fichier source : `css/variables.css`

## Surfaces (fond de page)

| Token | Valeur | Usage |
|---|---|---|
| `--paper` | `#fafaf7` | Fond principal (off-white chaud) |
| `--paper-2` | `#f3f1ea` | Fond secondaire (cartes, sections) |
| `--paper-3` | `#e9e5d9` | Fond tertiaire (hover, zones actives) |

## Encre (texte)

| Token | Valeur | Usage |
|---|---|---|
| `--ink` | `#1a1a17` | Texte principal (quasi-noir chaud) |
| `--ink-2` | `#3a3a34` | Texte secondaire |
| `--ink-3` | `#6b6b62` | Texte tertiaire (descriptions) |
| `--ink-mute` | `#9a9a8e` | Texte desactive, placeholders |

## Lignes (bordures)

| Token | Valeur | Usage |
|---|---|---|
| `--line` | `#2a2a26` | Bordure forte (separateurs principaux) |
| `--line-soft` | `#d8d3c4` | Bordure par defaut (cartes, inputs) |
| `--line-hair` | `#ebe7da` | Bordure subtile (filets internes) |

## Accents

### Sage (vert olive) -- accent principal

| Token | Valeur | Apercu |
|---|---|---|
| `--sage` | `#6b8559` | Accent principal, succes |
| `--sage-2` | `#9bb38a` | Version plus claire |
| `--sage-soft` | `#dee5d4` | Fond tres clair |
| `--forest` | `#2a3e2d` | Version sombre (texte sur fond clair) |

### Amber (dore chaud)

| Token | Valeur | Apercu |
|---|---|---|
| `--amber` | `#c9a47a` | Dore chaud |
| `--amber-soft` | `#ecddc7` | Fond dore leger |
| `--ochre` | `#a8865c` | Ocre mat (warning) |

### Rust (terre cuite)

| Token | Valeur | Apercu |
|---|---|---|
| `--rust` | `#b07564` | Corail / terre cuite (danger) |
| `--rust-soft` | `#e8d3ca` | Fond rose chaud |

### Plum (prune)

| Token | Valeur | Apercu |
|---|---|---|
| `--plum` | `#8a6e7e` | Mauve / prune |
| `--plum-soft` | `#ddd0d6` | Fond mauve clair |

### Sky (bleu-gris)

| Token | Valeur | Apercu |
|---|---|---|
| `--sky` | `#8499ad` | Bleu-gris (info) |
| `--sky-soft` | `#d6dde4` | Fond bleu-gris clair |

## Couleurs semantiques

| Token | Mappe vers | Usage |
|---|---|---|
| `--ok` / `--ok-soft` | `--sage` / `--sage-soft` | Succes, objectif atteint |
| `--warn` / `--warn-soft` | `--ochre` / `--amber-soft` | Avertissement, en cours |
| `--bad` / `--bad-soft` | `--rust` / `--rust-soft` | Danger, echec, alerte |

## Couleurs de statut (aliases)

Utilisees par les badges et composants d'etat :

| Token | Token source |
|---|---|
| `--color-status-success` | `--sage` |
| `--color-status-success-bg` | `--sage-soft` |
| `--color-status-warning` | `--ochre` |
| `--color-status-warning-bg` | `--amber-soft` |
| `--color-status-danger` | `--rust` |
| `--color-status-danger-bg` | `--rust-soft` |
| `--color-status-info` | `--sky` |
| `--color-status-info-bg` | `--sky-soft` |

## Couleurs de graphiques

Sequence ordonnee pour les series de donnees :

| Token | Couleur | Hex |
|---|---|---|
| `--chart-color-1` | Sage | `#6b8559` |
| `--chart-color-2` | Amber | `#c9a47a` |
| `--chart-color-3` | Rust | `#b07564` |
| `--chart-color-4` | Plum | `#8a6e7e` |
| `--chart-color-5` | Sky | `#8499ad` |
| `--chart-color-6` | Sage clair | `#9bb38a` |
| `--chart-color-7` | Ochre | `#a8865c` |

Chaque couleur possede une variante alpha a 15% (`--chart-color-X-alpha`) pour les remplissages de zones.

La ligne de reference / benchmark utilise `--chart-color-reference` (`--ink-mute`).
