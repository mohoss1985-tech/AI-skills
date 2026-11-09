{"client": "Banque Lumière (exemple)", "skill": "facilitating-workshops", "lang": "fr", "title": "Compte-rendu : atelier mise en opposition et déclaration de fraude"}
===INPUT===
Notes de l'atelier de ce matin, il me faut le CR aujourd'hui.

Atelier 1 – opposition + déclaration de fraude – 9h30-11h30. Anne (responsable monétique, sponsor), Thomas (IT monétique / serveur d'autorisation), Priya (fraude), Léo (responsable centre d'appels), Karim (impayés), moi. Juridique invité, absent.

- Anne : opposition temps réel dans l'appli ET au téléphone. Décidé.
- Thomas : l'opposition est immédiate dans le système de gestion des cartes, mais le serveur d'autorisation la reçoit par batch toutes les heures !! Il regarde pour du temps réel.
- Léo : les conseillers ont perte / vol. Ils veulent "utilisation frauduleuse" (carte toujours en main). OK Anne.
- Priya : contestations reçues par courrier, saisies à la main, remboursement parfois à J+5. La loi dit J+1 ouvré sauf soupçon de fraude du porteur. Il faut un remboursement automatique. Décidé sur le principe, seuil à définir.
- Priya : la fraude doit être déclarée au GIE CB, aujourd'hui fichier Excel mensuel. Karim : pour émettre un impayé pour fraude il faut que l'opération soit contestée par le porteur et la fraude déclarée. Décidé : déclaration avant impayé.
- Carte volée : jamais de levée d'opposition. Perte : levée dans les 24h ? Léo pour, Priya contre. Pas décidé.
- Jetons Apple Pay pas suspendus aujourd'hui à l'opposition !!
- Prochain atelier : juridique (franchise 50 €, texte client), seuil de remboursement automatique.
===OUTPUT===
## Compte-rendu · Mise en opposition et déclaration de fraude · Atelier 1

**Date :** aujourd'hui, 9h30–11h30 · **Objectif :** définir comment une carte perdue, volée ou utilisée frauduleusement est mise en opposition, remboursée, déclarée au GIE CB et traitée en impayé.
**Présents :** Anne (responsable monétique, sponsor), Thomas (IT monétique, serveur d'autorisation), Priya (fraude), Léo (centre d'appels), Karim (impayés), BA (rédacteur).
**Invité absent :** Juridique. ⚠️ Nécessaire pour la levée d'opposition et le texte au porteur.

### Synthèse
L'opposition sera temps réel dans l'appli et au téléphone, avec un troisième motif « utilisation frauduleuse ». Les contestations seront remboursées automatiquement pour respecter le J+1, et la fraude sera déclarée au GIE CB **avant** tout impayé. Deux écarts : le serveur d'autorisation ne reçoit les oppositions que toutes les heures, et les jetons de paiement mobile restent actifs.

### Décisions
| ID | Décision | Par |
|---|---|---|
| D-01 | Opposition en temps réel dans l'appli et au téléphone | Anne |
| D-02 | Trois motifs : perte, vol, utilisation frauduleuse | Anne, Léo |
| D-03 | Pas de levée d'opposition pour vol : nouvelle carte, nouveau PAN | Atelier |
| D-04 | Remboursement automatique des contestations (seuil à définir) | Anne, Priya |
| D-05 | Fraude déclarée au GIE CB avant l'émission d'un impayé | Priya, Karim |

### Exigences
| ID | Exigence | Type | Source | Priorité |
|---|---|---|---|---|
| EX-01 | Opposition temps réel depuis l'appli et l'outil du centre d'appels | Fonctionnelle | Anne | Must |
| EX-02 | Opposition reçue par le serveur d'autorisation en temps réel (aujourd'hui batch horaire) | Fonctionnelle | Thomas | Must *(faisabilité Q-01)* |
| EX-03 | Suspension des jetons de paiement mobile à l'opposition | Sécurité | Thomas | Must |
| EX-04 | Remboursement des opérations contestées au plus tard J+1 ouvré, sauf soupçon de fraude du porteur | Réglementaire (art. L133-18 CMF) | Priya | Must |
| EX-05 | Déclaration de fraude au GIE CB depuis le dossier, plus de fichier Excel mensuel | Processus | Priya | Must |

### Règles de gestion
| ID | Règle | Exemple |
|---|---|---|
| RG-01 | Si la carte est en opposition pour perte, alors refus **41** ; pour vol, **43** | Carte 4821 en opposition « vol » à 10h02 → 43 à 10h03 |
| RG-02 | Si un impayé pour fraude est émis, alors la fraude a déjà été déclarée au GIE CB | Paiement VAD de 89,90 € contesté → déclaration, puis impayé |
| RG-03 | Si le motif est vol, alors l'opposition ne peut pas être levée | — |

### Questions ouvertes
| ID | Question | Responsable | Échéance |
|---|---|---|---|
| Q-01 | Le serveur d'autorisation peut-il recevoir les oppositions en temps réel ? | Thomas | Atelier 2 |
| Q-02 | Levée d'opposition pour perte sous 24 h ? Léo pour, Priya contre | Anne, avec le juridique | Atelier 2 |
| Q-03 | Seuil du remboursement automatique | Priya, Anne | Atelier 2 |
| Q-04 | Texte au porteur sur la franchise de 50 € avant opposition (art. L133-19) | Juridique | Atelier 2 |

### Risques
- **Batch horaire (Q-01) :** une carte volée peut être acceptée jusqu'à une heure après l'opposition.
- **Remboursements à J+5 :** non-conformité au délai légal tant que le remboursement n'est pas automatisé.
- **Juridique absent :** Q-02 et Q-04 bloquent les textes au porteur.

### Actions
| ID | Action | Responsable | Échéance |
|---|---|---|---|
| A-01 | Étudier le temps réel vers le serveur d'autorisation | Thomas | Atelier 2 |
| A-02 | Corriger la suspension des jetons (anomalie, pas un projet) | Thomas | Prochain sprint |
| A-03 | Volumes de contestations et délais de remboursement actuels | Priya | Atelier 2 |
| A-04 | Inviter le juridique | Anne | Cette semaine |
| A-05 | Rédiger la SFD à partir de ce compte-rendu | BA | Atelier 2 |
