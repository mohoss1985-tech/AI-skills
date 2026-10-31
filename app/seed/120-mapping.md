{"client": "Banque Lumière (exemple)", "lang": "fr", "skill": "mapping-data", "title": "Mapping : dossiers de fraude vers déclarations GIE CB"}
===INPUT===
L'équipe fraude confirme la fraude dans son outil de dossiers, puis remplit chaque mois un fichier Excel pour la déclaration au GIE CB. Nous voulons générer la déclaration chaque jour depuis l'outil. Il faut le mapping, les règles de qualité et les contrôles.

Tables : dossier_fraude (num_dossier, jeton_carte, motif 'PERTE','VOL','NON_RECUE','CONTREFACON','VAD','AUTRE', confirme_le), dossier_operation (num_dossier, arn, date_op, montant décimal, devise, mode_saisie '05','07','81','90','01').
Cible : declaration_fraude (reference_operation = ARN, jeton_pan, typologie, date_operation, date_declaration, montant_centimes, devise, mode_lecture, numero_dossier). Environ 900 déclarations par mois.
===OUTPUT===
## Mapping · Dossiers de fraude → déclarations au GIE CB

### 1 · Périmètre
| | |
|---|---|
| **Source** | Outil de dossiers de fraude : `dossier_fraude`, `dossier_operation` |
| **Cible** | Déclaration quotidienne `declaration_fraude` |
| **Volume** | ~900 déclarations par mois |
| **Clé** | `dossier_operation.arn` → `declaration_fraude.reference_operation` (une déclaration par opération) |

### 2 · Mapping source → cible
mapping-declaration-fraude.csv
```csv
target_table,target_field,type,mandatory,source_table,source_field,transformation,default,rule,allowed
declaration_fraude,reference_operation,varchar(23),Y,dossier_operation,arn,TRIM(src.arn),,DQ-01,
declaration_fraude,jeton_pan,varchar(19),Y,dossier_fraude,jeton_carte,src.jeton_carte (jamais le PAN),,DQ-02,
declaration_fraude,typologie,varchar(15),Y,dossier_fraude,motif,table de transcodage T-01,,DQ-03,PERTE_VOL|NON_PARVENUE|CONTREFACON|NUMERO_USURPE|AUTRE
declaration_fraude,date_operation,date,Y,dossier_operation,date_op,src.date_op,,DQ-04,
declaration_fraude,date_declaration,date,Y,dossier_fraude,confirme_le,CAST(src.confirme_le AS DATE),,DQ-04,
declaration_fraude,montant_centimes,bigint,Y,dossier_operation,montant,"ROUND(src.montant * 100)",,DQ-05,
declaration_fraude,devise,varchar(3),Y,dossier_operation,devise,UPPER(src.devise),,DQ-05,EUR|USD|GBP
declaration_fraude,mode_lecture,varchar(12),N,dossier_operation,mode_saisie,table de transcodage T-02,,DQ-03,PUCE|SANS_CONTACT|VAD|PISTE|MANUEL
declaration_fraude,numero_dossier,varchar(12),Y,dossier_fraude,num_dossier,src.num_dossier,,DQ-01,
```

### 3 · Tables de transcodage
**T-01 · Typologie** (`motif` → `typologie`), selon les catégories de fraude utilisées dans les statistiques françaises *(codes exacts du format CB à confirmer)* :
| Outil fraude | Typologie |
|---|---|
| PERTE, VOL | PERTE_VOL · carte perdue ou volée |
| NON_RECUE | NON_PARVENUE · carte non parvenue |
| CONTREFACON | CONTREFACON · carte contrefaite |
| VAD | NUMERO_USURPE · numéro de carte usurpé |
| AUTRE | AUTRE |

**T-02 · Mode de lecture** (`mode_saisie` → `mode_lecture`) : 05 → PUCE · 07 → SANS_CONTACT · 81 → VAD · 90 → PISTE · 01 → MANUEL ; autre → mis en attente pour l'analyste.

### 4 · Règles de qualité
| ID | Dimension | Règle | Seuil | En cas d'échec | Responsable |
|---|---|---|---|---|---|
| DQ-01 | Unicité | Une déclaration par opération | 100 % | Ne pas envoyer le doublon | Fraude |
| DQ-02 | Validité | **Aucun PAN en clair** (recherche de suites de 16 chiffres valides Luhn) | 100 % | Bloquer le fichier, alerter la sécurité | Sécurité |
| DQ-03 | Validité | Typologie et mode de lecture transcodés (T-01, T-02) | 100 % | Attente analyste | Fraude |
| DQ-04 | Cohérence | Date de déclaration ≥ date de l'opération | 100 % | Attente analyste | Fraude |
| DQ-05 | Validité | Montant positif, devise ISO | 100 % | Attente | Fraude |

**Contrôle du mapping** (`check_mapping.py`) : 0 erreur ; 8 avertissements car les champs obligatoires n'ont pas de valeur par défaut. C'est voulu : une déclaration incomplète est mise en attente, jamais envoyée avec une valeur inventée.

### 5 · Contrôles avant envoi
controles.sql
```sql
-- Doublons (DQ-01) : doit renvoyer 0
SELECT COUNT(*) - COUNT(DISTINCT reference_operation) AS doublons FROM declaration_fraude;

-- Typologie hors T-01 (DQ-03)
SELECT COUNT(*) AS en_echec FROM declaration_fraude
WHERE typologie IS NOT NULL AND typologie NOT IN ('PERTE_VOL', 'NON_PARVENUE', 'CONTREFACON', 'NUMERO_USURPE', 'AUTRE');

-- Déclaration antérieure à l'opération (DQ-04)
SELECT reference_operation, date_operation, date_declaration
FROM declaration_fraude WHERE date_declaration < date_operation;

-- PAN possible en clair (DQ-02)
SELECT numero_dossier FROM declaration_fraude WHERE jeton_pan ~ '^[0-9]{16}$';
```

Le contrôle des doublons détecte l'anomalie vue en recette (CARTE-310 : déclaration envoyée deux fois).

### 6 · Approche de test
1. Générer la déclaration d'un mois de dossiers confirmés et la comparer au fichier Excel du même mois (mêmes ARN, mêmes typologies).
2. Envoi en environnement de test ; chaque rejet revient au mapping.
3. Double run de 2 semaines avec le fichier Excel, puis arrêt d'Excel.

### 7 · Points ouverts
| Question | Responsable |
|---|---|
| Format, codes et délais de la déclaration de fraude CB | Fraude |
| Opérations en attente de compensation : déclarer ou attendre ? | Fraude |
