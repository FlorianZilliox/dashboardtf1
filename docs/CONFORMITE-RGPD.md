# Analyse de conformité RGPD / GDPR

**Application** : Sprint Review Dashboard
**Version** : 1.0
**Date d'analyse** : Janvier 2025
**Statut** : Conforme avec recommandations

---

## 1. Résumé exécutif

Le Sprint Review Dashboard est une application **100% client-side** (sans serveur) qui traite des données exportées depuis Jira pour visualiser les métriques d'équipe Agile. L'application présente un **risque RGPD faible** en raison de son architecture locale, mais nécessite quelques points d'attention concernant les données personnelles des contributeurs.

### Verdict

| Critère | Statut |
|---------|--------|
| Minimisation des données | Conforme |
| Stockage local uniquement | Conforme |
| Pas de transfert externe | Conforme |
| Traitement de données personnelles | Attention requise |
| Droit à l'effacement | Conforme |
| Base légale | À documenter |

---

## 2. Données traitées

### 2.1 Données non personnelles

- Identifiants de tickets (PHX-101, etc.)
- Types de tickets (Story, Bug, Task)
- Statuts (To Do, In Progress, Done)
- Story Points
- Noms de sprints
- Dates de création/résolution
- Temps passé dans chaque statut

### 2.2 Données personnelles (Article 4 RGPD)

| Donnée | Catégorie | Sensibilité |
|--------|-----------|-------------|
| **Nom de l'assigné** | Donnée d'identification | Faible |
| **Performance individuelle** | Donnée dérivée | Moyenne |
| **Vélocité par contributeur** | Donnée dérivée | Moyenne |

> **Note** : Les noms des assignés permettent d'identifier des personnes physiques et constituent donc des données personnelles au sens du RGPD.

---

## 3. Architecture et flux de données

```
┌─────────────────────────────────────────────────────────────┐
│                     NAVIGATEUR LOCAL                         │
│  ┌─────────┐    ┌──────────────────┐    ┌───────────────┐  │
│  │ Fichier │───>│ Sprint Review    │───>│ localStorage  │  │
│  │ CSV     │    │ Dashboard        │    │ (optionnel)   │  │
│  └─────────┘    └──────────────────┘    └───────────────┘  │
│                          │                                   │
│                          v                                   │
│                 ┌──────────────────┐                        │
│                 │ Affichage écran  │                        │
│                 └──────────────────┘                        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ✗ Aucun transfert réseau
                           ✗ Aucun serveur externe
                           ✗ Aucun cookie tiers
```

### Points clés

- **Pas de backend** : Aucune donnée n'est envoyée à un serveur
- **Pas de tracking** : Aucun outil d'analytics (Google Analytics, etc.)
- **Pas de cookies tiers** : Uniquement localStorage navigateur
- **Données éphémères** : Les données sont perdues à la fermeture (sauf snapshot explicite)

---

## 4. Conformité par article RGPD

### Article 5 - Principes de traitement

| Principe | Conformité | Commentaire |
|----------|------------|-------------|
| Licéité, loyauté, transparence | ✅ | Traitement local, visible par l'utilisateur |
| Limitation des finalités | ✅ | Uniquement pour Sprint Review |
| Minimisation des données | ✅ | Seules les données Jira nécessaires |
| Exactitude | ✅ | Données importées directement de Jira |
| Limitation de conservation | ✅ | Données non persistées par défaut |
| Intégrité et confidentialité | ⚠️ | Dépend du poste de l'utilisateur |

### Article 6 - Base légale

Le traitement repose sur **l'intérêt légitime** (Art. 6.1.f) de l'employeur pour :
- Piloter l'activité de l'équipe
- Améliorer les processus Agile
- Préparer les Sprint Reviews

> **Recommandation** : Documenter cette base légale dans le registre des traitements de l'entreprise.

### Article 13/14 - Information des personnes

Les membres de l'équipe doivent être informés que leurs données de performance Jira sont utilisées pour les Sprint Reviews.

> **Recommandation** : Inclure cette information dans la politique de confidentialité interne ou la charte d'utilisation des outils.

### Article 17 - Droit à l'effacement

| Mécanisme | Disponible |
|-----------|------------|
| Fermer le navigateur | ✅ Données en mémoire effacées |
| Vider le localStorage | ✅ Snapshots supprimés |
| Ne pas importer les données | ✅ Aucun traitement |

### Article 25 - Privacy by Design

| Critère | Implémentation |
|---------|----------------|
| Minimisation par défaut | ✅ Pas de collecte automatique |
| Pas de persistance par défaut | ✅ Opt-in pour snapshots |
| Sections individuelles cachées | ✅ Konami code requis |

---

## 5. Points d'attention spécifiques

### 5.1 Affichage des performances individuelles

Les sections "Simulation par contributeur" et "Simuler des absences" affichent des métriques individuelles qui pourraient être perçues comme une évaluation de performance.

**Mesures en place** :
- Ces sections sont **cachées par défaut**
- Un code secret (→→←←) est nécessaire pour les afficher
- Elles peuvent être masquées rapidement (↓↓↑↑)

**Recommandation** :
- Utiliser ces fonctionnalités uniquement pour la planification d'équipe
- Ne pas utiliser pour l'évaluation individuelle de performance
- Informer l'équipe de l'existence de ces métriques

### 5.2 Export des données

L'application permet d'exporter :
- PDF de la Review (contient les métriques équipe)
- Markdown du Forecast (peut contenir les noms)

**Recommandation** :
- Stocker ces exports dans un espace sécurisé
- Supprimer les exports obsolètes

### 5.3 Projection sur écran

Lors des Sprint Reviews, les données sont projetées à l'écran.

**Recommandation** :
- S'assurer que seules les personnes autorisées sont présentes
- Utiliser le code ↓↓↑↑ pour masquer les sections sensibles avant projection

---

## 6. Comparaison avec les alternatives

| Solution | Données envoyées | Stockage | Conformité |
|----------|------------------|----------|------------|
| **Sprint Review Dashboard** | Aucune | Local uniquement | ✅ Excellent |
| Jira natif | Serveur Atlassian | Cloud | ⚠️ Selon contrat |
| Google Sheets | Serveurs Google | Cloud | ⚠️ Selon config |
| Excel Online | Serveurs Microsoft | Cloud | ⚠️ Selon config |

---

## 7. Checklist de mise en conformité

### Pour le déploiement

- [ ] Ajouter l'outil au registre des traitements (Art. 30)
- [ ] Documenter la base légale (intérêt légitime)
- [ ] Informer les équipes de l'utilisation de leurs données Jira
- [ ] Définir une politique de rétention pour les exports

### Pour l'utilisation quotidienne

- [ ] Ne pas partager les exports contenant des noms
- [ ] Masquer les sections individuelles lors des présentations publiques
- [ ] Supprimer les snapshots localStorage après les reviews

### Pour les droits des personnes

- [ ] Prévoir une procédure si un membre demande l'effacement
- [ ] Permettre l'exclusion d'un contributeur des analyses sur demande

---

## 8. Autres réglementations

### ePrivacy (Directive 2002/58/CE)

- **Cookies** : Non applicable (pas de cookies, uniquement localStorage)
- **Communications électroniques** : Non applicable

### CCPA (California Consumer Privacy Act)

- **Vente de données** : Non applicable (aucune vente)
- **Droit de suppression** : Couvert (effacement localStorage)

### Loi Informatique et Libertés (France)

- Conforme via la conformité RGPD
- Pas de données sensibles (Art. 6)

---

## 9. Conclusion

Le Sprint Review Dashboard est **conforme aux exigences RGPD** grâce à son architecture 100% locale qui élimine les risques liés au transfert et au stockage distant de données.

Les principales recommandations sont :
1. **Documenter** le traitement dans le registre de l'entreprise
2. **Informer** les équipes de l'utilisation de leurs données
3. **Utiliser avec discernement** les fonctionnalités de simulation individuelle

---

## 10. Contacts

Pour toute question relative à la conformité de cet outil :
- Contacter le DPO (Délégué à la Protection des Données) de votre organisation
- Consulter le service juridique pour la base légale

---

*Document généré à titre informatif. Ne constitue pas un avis juridique.*
