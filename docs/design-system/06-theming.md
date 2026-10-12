# Theming & Variantes

> Fichier source : `css/variables.css` (sections palettes, dark mode, densite, typo)

## Mecanisme

Le theming repose sur des **data-attributes** HTML qui redefinissent les custom properties CSS. Aucun fichier CSS supplementaire n'est charge -- tout est dans `variables.css`.

```html
<html data-palette="rose" data-theme="dark" data-density="compact" data-typo="sans">
```

Les attributs sont independants et combinables librement.

---

## Palettes de couleurs

### Sauge (defaut)

Palette naturelle et chaude. Aucun attribut necessaire (valeurs par defaut de `:root`).

| Accent | Hex |
|---|---|
| Sage | `#6b8559` |
| Amber | `#c9a47a` |
| Rust | `#b07564` |
| Plum | `#8a6e7e` |
| Sky | `#8499ad` |

### Rose (`data-palette="rose"`)

Palette rose/mauve. Remplace les accents sage et rust par des tons chauds roses.

| Token | Valeur Rose |
|---|---|
| `--sage` | `#a3505d` |
| `--sage-2` | `#c08896` |
| `--sage-soft` | `#ecd1d6` |
| `--forest` | `#2a1418` |
| `--amber` | `#d4a574` |
| `--ochre` | `#a16d3c` |
| `--rust` | `#7a3941` |

### Encre (`data-palette="ink"`)

Palette monochromatique bleue, plus formelle.

| Token | Valeur Encre |
|---|---|
| `--paper` | `#ffffff` |
| `--paper-2` | `#f3f3f0` |
| `--paper-3` | `#e6e6e1` |
| `--sage` | `#1a3aa8` |
| `--sage-2` | `#5d76c7` |
| `--sage-soft` | `#d4dbf0` |
| `--forest` | `#0a1230` |
| `--amber` | `#1a1a17` |
| `--ochre` | `#4a4a44` |
| `--rust` | `#1a3aa8` |

La palette Encre a aussi un ajustement specifique pour le mode sombre :
- `--sage` devient `#7d97e6`
- `--sage-soft` devient `#1f2a4d`

---

## Mode sombre (`data-theme="dark"`)

Inverse les surfaces et textes tout en conservant les accents.

| Token | Light | Dark |
|---|---|---|
| `--paper` | `#fafaf7` | `#14140f` |
| `--paper-2` | `#f3f1ea` | `#1c1c17` |
| `--paper-3` | `#e9e5d9` | `#25251f` |
| `--ink` | `#1a1a17` | `#f0ebda` |
| `--ink-2` | `#3a3a34` | `#d4cfbe` |
| `--ink-3` | `#6b6b62` | `#9a9a8e` |
| `--ink-mute` | `#9a9a8e` | `#6b6b62` |
| `--line` | `#2a2a26` | `#f0ebda` |
| `--line-soft` | `#d8d3c4` | `#3a3a32` |
| `--line-hair` | `#ebe7da` | `#2a2a24` |

Les fonds "soft" des accents sont egalement assombris :

| Token | Dark |
|---|---|
| `--sage-soft` | `#2c3a25` |
| `--amber-soft` | `#3d2f1a` |
| `--rust-soft` | `#3a201a` |
| `--plum-soft` | `#2e1f29` |
| `--sky-soft` | `#1f2a36` |

---

## Densite

| Attribut | Multiplicateur | Effet |
|---|---|---|
| `data-density="compact"` | `0.78` | Paddings et gaps reduits de 22% |
| *(par defaut)* | `1.0` | Espacement standard |
| `data-density="cozy"` | `1.15` | Paddings et gaps augmentes de 15% |

Les composants utilisent la densite via :

```css
padding: calc(var(--spacing-4) * var(--density));
```

---

## Variantes typographiques

| Attribut | `--font-display` devient | `--font-body` |
|---|---|---|
| *(par defaut / editorial)* | Fraunces (serif) | Inter (sans) |
| `data-typo="sans"` | Inter (sans) | Inter (sans) |
| `data-typo="mono"` | JetBrains Mono | JetBrains Mono |

- **Editorial** : le mode par defaut, melange serif + sans pour un rendu magazine.
- **Sans** : tout en Inter, plus neutre et "app-like".
- **Mono** : tout en JetBrains Mono, mode "terminal" pour les amateurs de donnees brutes.

---

## Panneau de personnalisation (Tweaks)

L'application integre un panneau flottant (`.twk-panel`) en bas a droite qui permet a l'utilisateur de basculer entre les options en temps reel. Il manipule les `data-attributes` sur `<html>` via JavaScript.

### Combinaisons recommandees

| Cas d'usage | Palette | Theme | Densite | Typo |
|---|---|---|---|---|
| Presentation (defaut) | sauge | light | normal | editorial |
| Sprint review en reunion | sauge | light | cozy | editorial |
| Analyse dense | sauge | light | compact | sans |
| Impression | ink | light | normal | sans |
| Mode nuit | sauge | dark | normal | editorial |
| Dashboard data | sauge | dark | compact | mono |
