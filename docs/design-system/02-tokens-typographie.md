# Tokens - Typographie

> Fichier source : `css/variables.css`, `css/base.css`

## Familles de polices

| Token | Valeur | Usage |
|---|---|---|
| `--font-display` | `"Fraunces", "Iowan Old Style", Georgia, serif` | Titres, KPIs, numeros en grand |
| `--font-body` | `"Inter", -apple-system, system-ui, sans-serif` | Corps de texte, labels, UI |
| `--font-mono` | `"JetBrains Mono", ui-monospace, monospace` | Donnees chiffrees, code, eyebrows |

### Pourquoi ces trois polices ?

- **Fraunces** : variable font serif avec caractere editorial. Donne du poids aux titres et KPIs.
- **Inter** : sans-serif optimisee pour les ecrans, excellente lisibilite en petite taille.
- **JetBrains Mono** : mono a chasse fixe avec ligatures, parfaite pour les nombres alignes.

## Echelle de tailles

Echelle Major Third (ratio 1.25), base 16px :

| Token | Valeur | px equiv. | Usage type |
|---|---|---|---|
| `--font-size-xs` | `0.75rem` | 12px | Eyebrows, footnotes |
| `--font-size-sm` | `0.875rem` | 14px | Labels, texte secondaire |
| `--font-size-base` | `1rem` | 16px | Corps de texte |
| `--font-size-lg` | `1.125rem` | 18px | Titres de carte |
| `--font-size-xl` | `1.25rem` | 20px | Sous-titres |
| `--font-size-2xl` | `1.5rem` | 24px | Titres de section |
| `--font-size-3xl` | `1.875rem` | 30px | Grands titres |
| `--font-size-4xl` | `2.25rem` | 36px | Titres de page |
| `--font-size-5xl` | `3rem` | 48px | Hero / KPI |
| `--font-size-6xl` | `3.75rem` | 60px | Display (couverture) |

## Poids

| Token | Valeur | Usage |
|---|---|---|
| `--font-weight-normal` | `400` | Corps de texte |
| `--font-weight-medium` | `500` | Labels actifs, emphase legere |
| `--font-weight-semibold` | `600` | Titres de carte, boutons |
| `--font-weight-bold` | `700` | KPIs, titres principaux |

## Hauteurs de ligne

| Token | Valeur | Usage |
|---|---|---|
| `--line-height-tight` | `1.2` | Titres, KPIs |
| `--line-height-normal` | `1.5` | Corps de texte |
| `--line-height-relaxed` | `1.75` | Texte long, descriptions |

## Classes editoriales

Ces classes CSS appliquent des styles typographiques pre-definis :

### Titres

| Classe | Police | Taille | Description |
|---|---|---|---|
| `.h-display` | `--font-display` | clamp(40px, 5vw, 68px) | Titre hero / couverture |
| `.h-section` | `--font-display` | 22px | Titre de section |
| `.h-card` | `--font-display` | 18px | Titre de carte |

### Elements de texte

| Classe | Style | Description |
|---|---|---|
| `.kicker` | Italic, 13px, serif | Surtitre / sous-titre editorial |
| `.lede` | Italic, serif | Paragraphe d'introduction |
| `.dek` | Sans-serif | Chapeau / sous-titre descriptif |
| `.eyebrow` | Mono, 10.5px, uppercase, letter-spacing | Micro-label (categorie, statut) |

### Utilitaires numeriques

| Classe | Description |
|---|---|
| `.mono` | Force JetBrains Mono avec `font-variant-numeric: tabular-nums` |
| `.tnum` | Active les chiffres tabulaires (alignement en colonnes) |
| `.sp` | Style pour les Story Points (gras, mono, couleur d'accent) |
