# Design System - Sprint Review Dashboard

## Philosophie

Le Sprint Review Dashboard adopte une approche **editoriale** : typographies expressives (serif + sans + mono), palette chaude et naturelle, mise en page aérée inspirée de la presse magazine. L'objectif est de rendre la lecture des métriques de sprint aussi agréable qu'un article bien maquetté.

## Principes directeurs

1. **Lisibilité d'abord** -- Les données chiffrées utilisent des polices tabulaires ; les titres en serif créent une hiérarchie visuelle immédiate.
2. **Chaleur** -- Pas de bleu froid corporate. La palette tourne autour du sage (vert olive), de l'ambre, du rust et du plum.
3. **Densité adaptable** -- Le système supporte trois niveaux de densité (compact, normal, cozy) via un simple attribut HTML.
4. **Thématisation légère** -- Trois palettes (Sauge, Rose, Encre) et un mode sombre, sans jamais réécrire de CSS.

## Architecture des fichiers CSS

```
css/
  variables.css         # Tous les design tokens
  base.css              # Reset, typographie editoriale, utilitaires
  layout.css            # Grilles, sections, structure de page
  components/
    badge.css           # Badges & labels
    button.css          # Boutons
    card.css            # Cartes (metric, info, section)
    charts.css          # Wrappers de graphiques
    empty-state.css     # Etats vides
    file-upload.css     # Upload de fichiers CSV
    gauge.css           # Jauges de progression
    input.css           # Champs de formulaire
    loader.css          # Loaders & skeletons
    navigation.css      # Masthead & onglets
    toggle.css          # Toggles, switches, radio groups
    tweaks.css          # Panneau de personnalisation
  pages/                # Styles specifiques aux pages
```

## Personnalisation (data-attributes)

Le theming se fait via des attributs sur `<html>` ou `<body>` :

| Attribut | Valeurs | Par defaut |
|---|---|---|
| `data-palette` | `sauge` (implicite), `rose`, `ink` | sauge |
| `data-theme` | `light` (implicite), `dark` | light |
| `data-density` | `compact`, `normal` (implicite), `cozy` | normal |
| `data-typo` | `editorial` (implicite), `sans`, `mono` | editorial |

## Table des matières

1. [Tokens - Couleurs](01-tokens-couleurs.md)
2. [Tokens - Typographie](02-tokens-typographie.md)
3. [Tokens - Espacement, Ombres & Divers](03-tokens-espacement.md)
4. [Composants](04-composants.md)
5. [Layout & Grilles](05-layout.md)
6. [Theming & Variantes](06-theming.md)
