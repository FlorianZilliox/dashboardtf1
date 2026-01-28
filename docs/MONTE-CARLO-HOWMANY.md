# Monte Carlo "How Many" - Documentation Technique

## Vue d'ensemble

Le forecast "How Many" répond à la question : **"Combien d'items pourrons-nous livrer sur une période donnée ?"**

C'est l'inverse du forecast "When" qui répond à "Quand aurons-nous livré N items ?".

---

## 1. Architecture de la Simulation

### 1.1 Paramètres de base

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `NUM_SIMULATIONS` | 10 000 | Nombre d'itérations Monte Carlo |
| `HORIZONS` | [2, 4, 6, 8, 12] | Horizons temporels en semaines |
| `PERCENTILES` | [50, 85, 95] | Niveaux de confiance calculés |

### 1.2 Facteurs de sécurité (Safety Factors)

Les résultats bruts sont ajustés par des facteurs de sécurité pour compenser l'optimisme naturel des prévisions :

| Percentile | Facteur | Effet |
|------------|---------|-------|
| P50 | × 1.00 | Aucun ajustement |
| P85 | × 0.95 | Réduction de 5% |
| P95 | × 0.90 | Réduction de 10% |

**Formule :**
```
résultat_final = résultat_brut × safety_factor
```

---

## 2. Échantillonnage Pondéré (Weighted Sampling)

### 2.1 Principe

Les semaines récentes ont plus de poids que les semaines anciennes, car elles reflètent mieux la capacité actuelle de l'équipe.

### 2.2 Configuration

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `RECENT_WEEKS_COUNT` | 4 | Nombre de semaines considérées "récentes" |
| `RECENT_WEIGHT_RATIO` | 0.50 | Part du poids total pour les semaines récentes |

### 2.3 Algorithme de calcul des poids

```
Entrée: N semaines de données historiques

Si N ≤ RECENT_WEEKS_COUNT:
    → Poids uniformes (1/N pour chaque semaine)

Sinon:
    recent_count = min(RECENT_WEEKS_COUNT, N)
    older_count = N - recent_count

    poids_par_semaine_récente = RECENT_WEIGHT_RATIO / recent_count
    poids_par_semaine_ancienne = (1 - RECENT_WEIGHT_RATIO) / older_count

    → Les 4 dernières semaines: 0.50 / 4 = 0.125 chacune
    → Les semaines plus anciennes: 0.50 / older_count chacune
```

### 2.4 Exemple concret

Pour 10 semaines de données :
- Semaines 1-6 (anciennes) : 0.50 / 6 = 0.0833 chacune
- Semaines 7-10 (récentes) : 0.50 / 4 = 0.125 chacune

**Vérification** : 6 × 0.0833 + 4 × 0.125 = 0.50 + 0.50 = 1.00

---

## 3. Détection des Outliers (Valeurs Aberrantes)

### 3.1 Méthode IQR (Interquartile Range)

La méthode IQR identifie les valeurs statistiquement éloignées de la distribution normale.

### 3.2 Configuration

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `IQR_MULTIPLIER` | 1.0 | Multiplicateur pour les bornes (conservateur) |
| `MEDIAN_LOW_THRESHOLD` | 0.75 | Seuil bas en % de la médiane |

### 3.3 Algorithme

```
Entrée: Liste de valeurs (throughputs hebdomadaires)

1. Calculer Q1 (25e percentile) et Q3 (75e percentile)
2. IQR = Q3 - Q1
3. Borne basse = Q1 - (IQR × IQR_MULTIPLIER)
4. Borne haute = Q3 + (IQR × IQR_MULTIPLIER)

Pour chaque valeur:
    Si valeur < borne_basse ET valeur < médiane × MEDIAN_LOW_THRESHOLD:
        → Marquer comme outlier BAS

    Note: Les outliers HAUTS ne sont PAS exclus
```

### 3.4 Justification

**Pourquoi ne pas exclure les outliers hauts ?**
- Une semaine exceptionnellement productive reste possible
- Exclure les hauts biaiserait les prévisions vers le pessimisme
- Seules les semaines anormalement basses (maladies, congés, incidents) doivent être exclues

### 3.5 Exemple

Données : [2, 3, 5, 6, 7, 8, 9, 10, 12, 1]

```
Q1 = 3.5, Q3 = 9.5, IQR = 6
Médiane = 6.5

Borne basse = 3.5 - 6 = -2.5
Seuil médiane = 6.5 × 0.75 = 4.875

Valeur 1: < -2.5 ? Non. < 4.875 ? Oui → Candidat outlier
Valeur 2: < -2.5 ? Non → Pas outlier
```

---

## 4. Détection de Tendance (Trend Detection)

### 4.1 Méthode

Régression linéaire sur les données historiques pour détecter une tendance à la hausse ou à la baisse.

### 4.2 Configuration

| Paramètre | Valeur | Description |
|-----------|--------|-------------|
| `TREND_SIGNIFICANCE_THRESHOLD` | 0.05 | Seuil de changement modéré (5%) |
| Seuil fort | 0.10 | Seuil de changement fort (10%) |

### 4.3 Algorithme de régression linéaire

```
Entrée: Valeurs y₁, y₂, ..., yₙ pour les semaines 1, 2, ..., n

1. Calculer les moyennes
   x̄ = (n+1)/2
   ȳ = moyenne(y)

2. Calculer la pente (slope)
   slope = Σ((xᵢ - x̄)(yᵢ - ȳ)) / Σ((xᵢ - x̄)²)

3. Calculer le changement relatif
   Si ȳ ≠ 0:
       relative_change = slope / ȳ
   Sinon:
       relative_change = 0
```

### 4.4 Classification de la tendance

| Changement relatif | Direction | Force |
|--------------------|-----------|-------|
| < -10% | Descendante | Forte |
| -10% à -5% | Descendante | Modérée |
| -5% à +5% | Stable | - |
| +5% à +10% | Ascendante | Modérée |
| > +10% | Ascendante | Forte |

### 4.5 Utilisation dans les prévisions

La tendance est fournie à titre **informatif uniquement**. Elle n'ajuste pas automatiquement les résultats mais alerte l'utilisateur :

- **Tendance forte descendante** : "Attention, la vélocité diminue. Les prévisions pourraient être optimistes."
- **Tendance forte ascendante** : "L'équipe accélère. Les prévisions pourraient être conservatrices."

---

## 5. Classification de Stabilité

### 5.1 Coefficient de Variation (CV)

Le CV mesure la variabilité relative des données.

```
CV = écart_type / moyenne
```

### 5.2 Classification

| CV | Stabilité | Interprétation |
|----|-----------|----------------|
| < 0.30 | Haute | Données fiables, prévisions précises |
| 0.30 - 0.50 | Modérée | Variabilité normale, prévisions raisonnables |
| > 0.50 | Basse | Forte variabilité, prévisions incertaines |

### 5.3 Impact sur l'affichage

- **Haute stabilité** : Afficher confiance élevée
- **Modérée** : Afficher avec réserve
- **Basse** : Afficher avertissement sur l'incertitude

---

## 6. Validation des Données

### 6.1 Règles de validation

| Règle | Seuil | Action |
|-------|-------|--------|
| Minimum de semaines | 4 | Erreur si < 4 semaines |
| Valeurs négatives | 0 | Erreur si throughput < 0 |
| Données manquantes | - | Semaines à 0 incluses (congés, etc.) |

### 6.2 Messages d'erreur

```
- "Minimum 4 semaines de données requises pour une prévision fiable"
- "Les throughputs ne peuvent pas être négatifs"
```

---

## 7. Agrégation Bi-hebdomadaire

### 7.1 Principe

Les données peuvent être agrégées par périodes de 2 semaines pour lisser la variabilité.

### 7.2 Algorithme

```
Entrée: Données hebdomadaires [s1, s2, s3, s4, s5, s6, s7, s8]

Si nombre_semaines est impair:
    → Première semaine isolée, puis paires

Sortie bi-hebdomadaire:
    [s1+s2, s3+s4, s5+s6, s7+s8]
    ou
    [s1, s2+s3, s4+s5, s6+s7, s8] si impair
```

### 7.3 Quand utiliser

- Équipes avec forte variabilité hebdomadaire
- Sprints de 2 semaines
- Lissage pour réduire le bruit

---

## 8. Processus Complet de Simulation

### 8.1 Étapes

```
1. VALIDATION
   └── Vérifier minimum 4 semaines de données
   └── Vérifier pas de valeurs négatives

2. PRÉPARATION
   └── Détecter et exclure les outliers bas
   └── Calculer les poids d'échantillonnage
   └── Analyser la tendance
   └── Calculer la stabilité (CV)

3. SIMULATION (×10 000)
   Pour chaque horizon H (2, 4, 6, 8, 12 semaines):
       Pour chaque itération i (1 à 10000):
           total = 0
           Pour chaque semaine s (1 à H):
               → Tirer une valeur selon les poids
               → total += valeur_tirée
           résultats[H][i] = total

4. CALCUL DES PERCENTILES
   Pour chaque horizon H:
       → Trier les 10000 résultats
       → P50 = médiane
       → P85 = 85e percentile
       → P95 = 95e percentile

5. APPLICATION DES SAFETY FACTORS
   Pour chaque horizon H:
       P50_final = P50 × 1.00
       P85_final = P85 × 0.95
       P95_final = P95 × 0.90

6. RETOUR
   → Résultats par horizon
   → Métadonnées (tendance, stabilité, outliers exclus)
```

---

## 9. Différences avec le Forecast Actuel

### 9.1 Forecast "When" (actuel)

| Aspect | Implémentation actuelle |
|--------|------------------------|
| Question | "Quand livrerons-nous N items ?" |
| Unité | Sprints |
| Échantillonnage | Uniforme |
| Outliers | Non traités |
| Tendance | Non analysée |

### 9.2 Forecast "How Many" (nouveau)

| Aspect | Nouvelle implémentation |
|--------|------------------------|
| Question | "Combien livrerons-nous en H semaines ?" |
| Unité | Semaines |
| Échantillonnage | Pondéré (50% sur 4 dernières semaines) |
| Outliers | IQR, exclusion des bas uniquement |
| Tendance | Régression linéaire, informatif |

### 9.3 Décision d'intégration

**Conversion sprint → semaines : 1 sprint = 2 semaines**

Les données CSV sont par sprint. Pour l'algorithme "How Many" :

| Donnée CSV | Conversion |
|------------|------------|
| Throughput/sprint | Throughput/sprint ÷ 2 = throughput/semaine |
| 6 sprints historiques | = 12 semaines de données |
| Horizon 4 semaines | = 2 sprints |

**Adaptation des horizons :**

| Horizon original | En sprints |
|------------------|------------|
| 2 semaines | 1 sprint |
| 4 semaines | 2 sprints |
| 6 semaines | 3 sprints |
| 8 semaines | 4 sprints |
| 12 semaines | 6 sprints |

**Multi-équipes** : L'agrégation pour les contributeurs partagés reste identique.

---

## 10. Formules Mathématiques Récapitulatives

### Poids d'échantillonnage
```
w_récent = 0.50 / min(4, N)
w_ancien = 0.50 / max(1, N - 4)
```

### IQR et bornes
```
IQR = Q3 - Q1
borne_basse = Q1 - 1.0 × IQR
seuil_médiane = médiane × 0.75
outlier_bas = (valeur < borne_basse) ET (valeur < seuil_médiane)
```

### Régression linéaire
```
slope = Σ(x - x̄)(y - ȳ) / Σ(x - x̄)²
relative_change = slope / ȳ
```

### Coefficient de variation
```
CV = σ / μ
```

### Safety factors
```
P50_final = P50_brut × 1.00
P85_final = P85_brut × 0.95
P95_final = P95_brut × 0.90
```

---

## 11. Glossaire

| Terme | Définition |
|-------|------------|
| **Throughput** | Nombre d'items livrés par unité de temps |
| **Horizon** | Période future sur laquelle porte la prévision |
| **Percentile P50** | Valeur médiane (50% de chances de faire mieux) |
| **Percentile P85** | Valeur prudente (85% de chances de faire mieux) |
| **Percentile P95** | Valeur très prudente (95% de chances de faire mieux) |
| **IQR** | Écart interquartile, mesure de dispersion robuste |
| **CV** | Coefficient de variation, variabilité relative |
| **Safety Factor** | Facteur correctif pour compenser l'optimisme |

---

## 12. Références

- Projet Python source : `/monte carlo/core/`
- Fichiers analysés :
  - `simulation.py` - Boucle principale
  - `sampling.py` - Échantillonnage pondéré
  - `outliers.py` - Détection IQR
  - `trends.py` - Régression linéaire
  - `statistics.py` - CV et stabilité
  - `validation.py` - Règles de validation
  - `aggregation.py` - Agrégation bi-hebdomadaire

---

*Documentation générée le 21/01/2026*
*Version 1.0*
