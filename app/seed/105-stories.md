{"client": "Banque Lumière (exemple)", "skill": "writing-user-stories", "lang": "fr", "title": "User stories : opposition et contestation dans l'appli"}
===INPUT===
User stories pour RG-01 à RG-05 et RG-09 de la SFD opposition (côté appli). Jira. Utilisateurs : porteurs dans l'application mobile.
===OUTPUT===
### Story map

| Étape | Choisir la carte | Faire opposition | Après l'opposition | Opérations inconnues |
|---|---|---|---|---|
| **Release 1** | Voir mes cartes (visuel, 4 derniers chiffres) | Opposition avec motif (RG-01, RG-02) | Confirmation, nouvelle carte | Contester et être remboursé (RG-04, RG-05) |
| Plus tard | — | — | Lever une opposition pour perte (RG-09) | Suivre le dossier |

---

### 1 · Faire opposition sur une carte perdue ou volée
`Jira` · Epic : Opposition · Labels : monetique, appli, fraude · Source : RG-01, RG-02, RG-03

En tant que **porteur**, je veux faire opposition sur ma carte dans l'appli en indiquant le motif, afin que personne ne puisse payer avec.

```gherkin
# language: fr
Scénario: Le porteur fait opposition sur une carte volée
  Étant donné que Sam a une carte CB se terminant par 4821 active
  Quand Sam fait opposition sur la carte 4821 avec le motif "Vol" et confirme
  Alors l'appli affiche "Votre carte se terminant par 4821 est en opposition"
  Et une demande d'autorisation 10 secondes plus tard est refusée avec le code 43
  Et le jeton Apple Pay de la carte est suspendu

Scénario: Le porteur a deux cartes
  Étant donné que Sam a les cartes 4821 et 1177
  Quand Sam ouvre "Faire opposition"
  Alors les deux cartes sont affichées avec leur visuel et leurs 4 derniers chiffres
  Et aucune carte n'est présélectionnée
```

**INVEST :** tout ✓ → **Prête**

---

### 2 · Contester des opérations et être remboursé
`Jira` · Epic : Opposition · Source : RG-04, RG-05

En tant que **porteur**, je veux contester les opérations que je ne reconnais pas, afin d'être remboursé rapidement.

```gherkin
# language: fr
Scénario: Contestation remboursée automatiquement
  Étant donné que Sam a fait opposition sur la carte 4821 pour "Utilisation frauduleuse" le lundi à 15h
  Quand Sam conteste les paiements de 89,90 € et 240,00 € du 2 novembre
  Alors l'appli affiche "Nous vous remboursons 329,90 € au plus tard le mardi"
  Et un dossier de fraude avec ces 2 opérations est créé

Scénario: Opération de plus de 13 mois
  Étant donné qu'une opération a été débitée il y a 13 mois et 2 jours
  Quand Sam ouvre "Opérations à contester"
  Alors cette opération n'est pas proposée
```

**INVEST :** tout ✓ → **Prête**. RG-06 (au-delà de 500 €) et RG-07 (déclaration au GIE CB) sont des stories de l'équipe fraude, liées ici.

---

### 3 · Lever une opposition pour perte
`Jira` · Source : RG-09

```gherkin
# language: fr
Plan du scénario: Levée d'opposition
  Étant donné que Sam a fait opposition sur la carte 4821 pour "<motif>" le samedi à 18h
  Et que "<tentative>" demande d'autorisation a été faite depuis
  Quand Sam demande la levée à <heure>
  Alors le résultat est "<résultat>"

  Exemples:
    | motif | tentative | heure            | résultat                             |
    | Perte | aucune    | dimanche 10h00   | Opposition levée                     |
    | Perte | aucune    | dimanche 18h01   | Levée plus possible                  |
    | Perte | une       | dimanche 10h00   | Levée plus possible                  |
    | Vol   | aucune    | dimanche 10h00   | Levée impossible pour une carte volée |
```

**INVEST :** N ⚠️ : texte « Levée plus possible » à valider par le juridique → **Prête après relecture**.
