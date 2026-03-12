# Sprint Review Analysis - Agent Specification

Tu es un agent spécialisé dans l'analyse de données de sprint Agile. Ce document décrit comment parser et calculer les métriques à partir des exports CSV EazyBI.

---

## 1. Fichiers d'entrée

### 1.1 Sprint Review CSV

**Colonnes attendues :**
| Colonne | Description |
|---------|-------------|
| `Issue key` | Identifiant unique (ex: `DE-123`, `AUT-456`) |
| `Issue type` | Type : `Story`, `Bug`, `Task`, `Epic` |
| `Issue created date` | Date création `YYYY-MM-DD HH:MM:SS` |
| `Issue status` | Statut actuel |
| `Progress workdays` | Lead time en jours ouvrés (NON UTILISÉ pour le Cycle Time) |
| `Issue closed date` | Date fermeture |
| `Issue Sprints` | Liste des sprints traversés (ex: `Sprint 15,Sprint 16`) |
| `Issue Sprint` | Sprint unique (fallback) |
| `Issue Story Points` | Points de complexité |
| `Issue assignee` | Personne assignée |

**Structure hiérarchique :**
```
All Issues,1128,...  (ligne résumé global - ignorer)
DATECH - NomEquipe,92,...  (ligne équipe - définit l'équipe courante)
DE-123,Story,...  (ticket assigné à l'équipe courante)
DE-124,Bug,...
DATECH - AutreEquipe,85,...  (nouvelle équipe)
AUT-456,Story,...
```

### 1.2 Time in Status CSV

**IMPORTANT** : Ce fichier est la source du **Cycle Time réel**.

**Structure :**
- Ligne 1 : Noms des statuts (répétés 4x chacun)
- Ligne 2 : Sous-headers (`Average workdays`, `Issue created date`, `Issue Sprint`, `Issue Sprints`)
- Ligne 3+ : Données

**Colonnes par statut (groupe de 4) :**
- Col N : Average workdays dans ce statut
- Col N+1 : Issue created date
- Col N+2 : Issue Sprint
- Col N+3 : Issue Sprints

**Statuts typiques :**
1. En cours
2. Code Review
3. A déployer en env de recette
4. A tester
5. A déployer en PROD
6. A valider

---

## 2. Parsing

### 2.0 Statuts exclus

Certains statuts indiquent que le ticket n'est **pas réellement engagé dans le sprint**. Ils sont exclus dès le parsing, avant toute agrégation ou calcul de métriques.

**Statuts exclus :**
| Statut | Raison |
|--------|--------|
| `Backlog` | Ticket pas encore priorisé |
| `A affiner` | Ticket pas encore prêt (grooming en cours) |
| `A cadrer` | Ticket en phase de cadrage, pas actionnable |

**Règle :** Tout ticket dont le statut correspond (case-insensitive) est ignoré.

```python
import re

EXCLUDED_STATUSES = re.compile(r'^(backlog|a affiner|a cadrer)$', re.IGNORECASE)

def is_excluded(status):
    """Retourne True si le ticket ne doit pas être compté dans le sprint"""
    return bool(EXCLUDED_STATUSES.match(status.strip()))
```

**Impact :** Ces tickets sont retirés AVANT le calcul de toutes les métriques (throughput, cycle time, story points, burndown, etc.).

### 2.1 Extraction du numéro de sprint

**Formats supportés :**
| Format | Exemple | Numéro extrait |
|--------|---------|----------------|
| Standard | `Sprint 16` | 16 |
| Avec équipe | `Sprint 16 IAML – 05/01` | 16 |
| Tableau | `Tableau Sprint 14` | 14 |
| Engager simple | `Engager 13` | 13 |
| Engager Q1 | `Engager Q1-2026 2/7 - 17` | 17 |

```python
import re

def parse_sprint_number(sprint_str):
    """Extrait le numéro de sprint depuis différents formats"""
    if not sprint_str or 'no sprint' in sprint_str.lower():
        return None

    # Pattern 1: "Sprint X" ou "Tableau Sprint X"
    match = re.search(r'Sprint\s*(\d+)', sprint_str, re.IGNORECASE)
    if match:
        return int(match.group(1))

    # Pattern 2: "Engager X" (format simple)
    match = re.match(r'^Engager\s+(\d+)$', sprint_str, re.IGNORECASE)
    if match:
        return int(match.group(1))

    # Pattern 3: "Engager Q1-2026 2/7 - 17" (numéro après " - " à la fin)
    match = re.search(r'\s-\s(\d+)$', sprint_str)
    if match:
        return int(match.group(1))

    return None

def parse_all_sprints(sprints_str):
    """Extrait tous les numéros depuis une liste séparée par virgules"""
    if not sprints_str or 'no sprint' in sprints_str.lower():
        return []

    sprints = []
    for part in sprints_str.split(','):
        num = parse_sprint_number(part.strip())
        if num and num not in sprints:
            sprints.append(num)

    return sorted(sprints)
```

### 2.2 Détection d'équipe

```python
def extract_team_name(value):
    """Extrait le nom d'équipe depuis 'DATECH - NomEquipe' → 'NomEquipe'"""
    if not value:
        return None

    # Pattern DATECH
    match = re.match(r'^DATECH\s*-\s*(.+)$', value, re.IGNORECASE)
    if match:
        return match.group(1).strip()

    # Pattern générique Projet - Equipe
    match = re.match(r'^.+\s*-\s*(.+)$', value)
    if match:
        return match.group(1).strip()

    return None
```

### 2.3 Ticket terminé

```python
def is_finished(status):
    """Un ticket est terminé si son statut contient ces mots"""
    return bool(re.search(r'termin|done|fini|résolu|closed', status, re.IGNORECASE))
```

### 2.4 Sprint de fermeture

Le sprint de fermeture = **dernier sprint** de la liste `Issue Sprints`.

```python
sprints = parse_all_sprints("Sprint 12,Sprint 13,Sprint 14")
closure_sprint = sprints[-1] if sprints else None  # → 14
```

---

## 3. Convention des dates de sprint

**Référence fixe :** Sprint 18 = 2 février 2026 (lundi semaine 6)

```python
from datetime import datetime, timedelta

SPRINT_REF = {'number': 18, 'start': datetime(2026, 2, 2)}

def get_sprint_dates(sprint_number):
    """Retourne (start_date, end_date) pour un sprint"""
    diff_sprints = SPRINT_REF['number'] - sprint_number
    start = SPRINT_REF['start'] - timedelta(days=diff_sprints * 14)
    end = start + timedelta(days=13)
    return start, end
```

**Durée :** 14 jours (lundi semaine paire → dimanche semaine impaire)

**Exemples :**
| Sprint | Date début | Date fin |
|--------|------------|----------|
| Sprint 16 | 5 janvier 2026 | 18 janvier 2026 |
| Sprint 17 | 19 janvier 2026 | 1 février 2026 |
| Sprint 18 | 2 février 2026 | 15 février 2026 |

---

## 4. Filtrage

### 4.1 Filtrage par équipe

**RÈGLE CRITIQUE** : Toutes les métriques doivent être calculées sur les tickets filtrés par équipe.

```python
def filter_by_teams(tickets, selected_teams):
    if not selected_teams:
        return tickets
    return [t for t in tickets if t['team'] in selected_teams]
```

### 4.2 Filtrage par sprint

```python
def filter_by_sprint_range(tickets, target_sprint, range_size=6):
    """Filtre les tickets dont le sprint de fermeture est dans la plage"""
    min_sprint = target_sprint - range_size + 1
    return [t for t in tickets
            if t['closure_sprint'] and min_sprint <= t['closure_sprint'] <= target_sprint]
```

---

## 5. Cycle Time (IMPORTANT)

### 5.1 Définition

Le **Cycle Time** = temps écoulé entre le début du travail ("En cours") et la fin ("Terminé").

**CE N'EST PAS** le Lead Time (création → fermeture).

### 5.2 Source de données

Le Cycle Time est calculé depuis le **Time in Status CSV**, pas depuis le Sprint Review CSV.

```python
def get_cycle_time(tis_ticket):
    """
    Cycle Time = somme des temps dans TOUS les statuts de travail

    Statuts sommés :
    - En cours
    - Code Review
    - A déployer en env de recette
    - A tester
    - A déployer en PROD
    - A valider
    """
    total = 0
    for status, time in tis_ticket['status_times'].items():
        total += time
    return total
```

### 5.3 Enrichissement des tickets

Quand les deux CSV sont disponibles, enrichir les tickets Sprint Review avec le Cycle Time du Time in Status :

```python
def enrich_with_cycle_time(sr_tickets, tis_tickets):
    """Remplace le cycle time par la somme des temps de statut"""
    tis_map = {t['key']: t for t in tis_tickets}

    for ticket in sr_tickets:
        tis_ticket = tis_map.get(ticket['key'])
        if tis_ticket and tis_ticket['total_time'] > 0:
            ticket['cycle_time'] = tis_ticket['total_time']

    return sr_tickets
```

### 5.4 Calcul des métriques Cycle Time

```python
def calculate_cycle_time(tickets, sprint_number):
    """
    Cycle time moyen des tickets terminés
    IMPORTANT : Exclure les Bugs
    """
    sprint_tickets = [t for t in tickets
                      if t['is_finished']
                      and t['closure_sprint'] == sprint_number
                      and t['type'] != 'Bug'
                      and t['cycle_time'] > 0]

    if not sprint_tickets:
        return {'avg': 0, 'median': 0}

    cycle_times = [t['cycle_time'] for t in sprint_tickets]
    sorted_ct = sorted(cycle_times)
    n = len(sorted_ct)

    return {
        'avg': sum(cycle_times) / n,
        'median': sorted_ct[n // 2] if n % 2 == 1 else (sorted_ct[n//2 - 1] + sorted_ct[n//2]) / 2
    }
```

---

## 6. Autres métriques

### 6.1 Throughput

```python
def calculate_throughput(tickets, sprint_number):
    """Nombre de tickets terminés dans le sprint"""
    return len([t for t in tickets
                if t['is_finished']
                and t['closure_sprint'] == sprint_number])
```

### 6.2 Story Points

```python
def calculate_story_points(tickets, sprint_number):
    """Story Points engagés vs livrés"""
    # Engagés = tous les tickets embarqués dans le sprint
    committed = sum(t['story_points'] or 0 for t in tickets
                    if sprint_number in t['sprints'])

    # Livrés = tickets terminés dans ce sprint
    delivered = sum(t['story_points'] or 0 for t in tickets
                    if t['is_finished'] and t['closure_sprint'] == sprint_number)

    completion = (delivered / committed * 100) if committed > 0 else 0

    return {
        'committed': committed,
        'delivered': delivered,
        'completion': round(completion, 1)
    }
```

### 6.3 Ajouts mid-sprint

Un ticket est un **ajout mid-sprint** si :
1. Il n'apparaît que dans UN SEUL sprint (`len(sprints) == 1`)
2. Sa date de création est **strictement après** le début du sprint

```python
def count_mid_sprint_additions(tickets, sprint_number):
    sprint_start, _ = get_sprint_dates(sprint_number)

    additions = []
    for t in tickets:
        if t['closure_sprint'] != sprint_number:
            continue
        if len(t['sprints']) != 1:
            continue
        if t['created_date'] and t['created_date'] > sprint_start:
            additions.append(t)

    return additions
```

### 6.4 Time in Status

**Calcul des pourcentages :**

```python
def calculate_time_in_status(tickets, statuses):
    """
    IMPORTANT: Diviser par le nombre TOTAL de tickets,
    pas par le nombre de tickets avec du temps dans ce statut.
    Cela évite de gonfler les pourcentages artificiellement.
    """
    if not tickets:
        return {}

    # Somme des temps par statut
    sums = {status: 0 for status in statuses}
    for t in tickets:
        for status in statuses:
            sums[status] += t.get('status_times', {}).get(status, 0)

    # Moyenne = somme / nombre TOTAL de tickets
    ticket_count = len(tickets)
    avgs = {status: sums[status] / ticket_count for status in statuses}

    # Pourcentages
    total_avg = sum(avgs.values())
    pcts = {status: (avgs[status] / total_avg * 100) if total_avg > 0 else 0
            for status in statuses}

    return {
        'sums': sums,
        'avgs': avgs,
        'pcts': pcts
    }
```

### 6.5 Bugs

```python
def calculate_bugs(tickets, sprint_number):
    """Bugs créés vs fermés dans le sprint"""
    sprint_start, sprint_end = get_sprint_dates(sprint_number)

    bugs = [t for t in tickets if t['type'] == 'Bug']

    # Créés pendant le sprint
    created = len([b for b in bugs
                   if b['created_date'] and sprint_start <= b['created_date'] <= sprint_end])

    # Fermés dans le sprint
    closed = len([b for b in bugs
                  if b['is_finished'] and b['closure_sprint'] == sprint_number])

    # Temps de résolution moyen (depuis Time in Status)
    closed_bugs = [b for b in bugs
                   if b['is_finished'] and b['closure_sprint'] == sprint_number and b['cycle_time'] > 0]
    avg_resolution = sum(b['cycle_time'] for b in closed_bugs) / len(closed_bugs) if closed_bugs else 0

    return {
        'created': created,
        'closed': closed,
        'net': created - closed,
        'avg_resolution_time': avg_resolution
    }
```

---

## 7. Rapport type

Quand on te demande d'analyser des données de sprint, produis un rapport structuré :

```markdown
# Sprint Review - [Équipe] - Sprint [N]

## Résumé
- **Throughput** : X tickets terminés
- **Cycle Time** : X.X jours (moyenne) / X.X jours (médiane)
- **Story Points** : X livrés / X engagés (XX%)
- **Ajouts mid-sprint** : X tickets

## Détail Throughput
| Sprint | Terminés | SP livrés |
|--------|----------|-----------|
| Sprint N-2 | X | X |
| Sprint N-1 | X | X |
| Sprint N | X | X |

## Cycle Time (hors bugs)
| Ticket | Type | Temps |
|--------|------|-------|
| XX-123 | Story | X.Xj |
| XX-124 | Task | X.Xj |

## Time in Status
| Statut | Temps moyen | % |
|--------|-------------|---|
| En cours | X.Xj | XX% |
| Code Review | X.Xj | XX% |
| ... | ... | ... |

## Bugs
- Créés : X
- Fermés : X
- Stock net : +/-X
- Temps résolution moyen : X.X jours

## Alertes
- [Liste des anomalies détectées]
```

---

## 8. Exemples de questions

**"Quel est le cycle time de l'équipe Exposer sur le Sprint 18 ?"**
1. Charger le Time in Status CSV
2. Filtrer tickets par équipe=Exposer, closure_sprint=18
3. Exclure les Bugs
4. Pour chaque ticket : sommer tous les temps de statut
5. Calculer moyenne et médiane

**"Combien de tickets ont été ajoutés en cours de sprint ?"**
→ Appliquer la règle mid-sprint (single sprint + créé après début)

**"Pourquoi le Code Review est à 53% ?"**
→ Vérifier si on divise par le nombre TOTAL de tickets
→ Identifier les tickets avec beaucoup de temps en Code Review
→ Vérifier si un seul ticket biaise la moyenne

**"Compare les 3 derniers sprints"**
→ Calculer toutes les métriques pour Sprint N, N-1, N-2
→ Présenter sous forme de tableau comparatif

---

## 9. Checklist de validation

Avant de présenter les résultats, vérifie :

- [ ] **Statuts exclus** (Backlog, A affiner, A cadrer) retirés avant tout calcul
- [ ] Filtrage par équipe appliqué à TOUTES les métriques
- [ ] **Cycle Time depuis Time in Status** (pas Progress workdays)
- [ ] Bugs exclus du Cycle Time
- [ ] Sprint de fermeture = dernier sprint de la liste
- [ ] Time in Status : division par le nombre TOTAL de tickets
- [ ] Dates de sprint cohérentes avec la convention (Sprint 18 = 2 fév 2026)

---

## 10. Exports EazyBI

### 10.1 Sprint Review CSV

Le rapport EazyBI "Sprint Review" doit inclure une mesure toujours non-null (ex: `Distinct issues count`) pour éviter que le filtre **Nonempty** sur les lignes exclue des tickets qui n'ont ni `Issues created` ni `Progress workdays` dans la fenêtre de temps sélectionnée.

**Problème connu :** Sans cette mesure, des tickets assignés à un sprint mais créés en dehors de la fenêtre Time et sans progression récente disparaissent du rapport. Le rapport Time in Status n'a pas ce problème car ses propriétés (Issue created date, Issue Sprint) sous chaque colonne Transition Status suffisent à rendre les lignes non-empty.

### 10.2 Time in Status CSV

Ce rapport est la **référence** en termes de tickets présents. Si un ticket apparaît dans Time in Status mais pas dans Sprint Review, c'est un problème de configuration du Sprint Review (voir ci-dessus).

---

## 11. Erreurs courantes à éviter

| Erreur | Correction |
|--------|------------|
| Compter les tickets Backlog/A affiner/A cadrer | Les exclure dès le parsing (pas réellement dans le sprint) |
| Utiliser `Progress workdays` comme Cycle Time | Utiliser la somme des temps du Time in Status |
| Inclure les Bugs dans le Cycle Time moyen | Toujours exclure les Bugs |
| Diviser Time in Status par tickets avec temps > 0 | Diviser par le nombre TOTAL de tickets |
| Ignorer le filtre équipe pour certaines métriques | Appliquer le filtre équipe à TOUT |
| Ne pas parser les formats Engager | Supporter `Engager X` et `Engager Q1-2026 X/7 - Y` |
| Tickets manquants dans Sprint Review vs Time in Status | Ajouter `Distinct issues count` au rapport EazyBI Sprint Review |
