/* Generated: output of skills/managing-backlog/scripts/wsjf.py (--json and --jira-csv) on each case of test-cases.js.
   Regenerate after changing samples: see research/wave1-F.md. */
export const FIXTURES = {
 "en-120": {
  "json": {
   "ranked": [
    {
     "id": "F-07",
     "title": "Suspend wallet tokens when the card is blocked",
     "cod": 29,
     "job_size": 3,
     "wsjf": 9.67,
     "points": 13
    },
    {
     "id": "F-02",
     "title": "Add blocked PANs to the Visa Exception File automatically",
     "cod": 41,
     "job_size": 5,
     "wsjf": 8.2,
     "points": 21
    },
    {
     "id": "F-06",
     "title": "Real-time block API on the authorisation host",
     "cod": 36,
     "job_size": 5,
     "wsjf": 7.2,
     "points": 21
    },
    {
     "id": "F-01",
     "title": "Block a lost or stolen card in the app",
     "cod": 46,
     "job_size": 8,
     "wsjf": 5.75,
     "points": 34
    },
    {
     "id": "F-03",
     "title": "Fraud declaration workflow for unrecognised transactions",
     "cod": 34,
     "job_size": 8,
     "wsjf": 4.25,
     "points": 30
    },
    {
     "id": "F-05",
     "title": "Explain declined payments in the app (response codes)",
     "cod": 9,
     "job_size": 3,
     "wsjf": 3.0,
     "points": 13
    },
    {
     "id": "F-08",
     "title": "Merchant category controls set by the cardholder",
     "cod": 10,
     "job_size": 8,
     "wsjf": 1.25,
     "points": 26
    },
    {
     "id": "F-04",
     "title": "Open disputes from the fraud declaration",
     "cod": 16,
     "job_size": 13,
     "wsjf": 1.23,
     "points": 40
    }
   ],
   "planned": [
    "F-06",
    "F-07",
    "F-02",
    "F-01",
    "F-03"
   ],
   "used": 119,
   "capacity": 120,
   "not_planned": {
    "F-05": "no capacity left (1 pts free, needs 13)",
    "F-08": "no capacity left (1 pts free, needs 26)",
    "F-04": "no capacity left (1 pts free, needs 40)"
   },
   "deadline_missed": []
  },
  "jira": "Summary,Issue Type,Description,Labels,Labels,Story Points\nSuspend wallet tokens when the card is blocked,Story,WSJF 9.67 (BV 8 + TC 8 + RR 13) / size 3. Ref F-07. Depends on: F-06.,PI-committed,CARD-WSJF,13\nAdd blocked PANs to the Visa Exception File automatically,Epic,WSJF 8.2 (BV 8 + TC 13 + RR 20) / size 5. Ref F-02. Depends on: F-06.,PI-committed,CARD-WSJF,21\nReal-time block API on the authorisation host,Enabler,WSJF 7.2 (BV 3 + TC 13 + RR 20) / size 5. Ref F-06.,PI-committed,CARD-WSJF,21\nBlock a lost or stolen card in the app,Epic,WSJF 5.75 (BV 20 + TC 13 + RR 13) / size 8. Ref F-01. Depends on: F-06.,PI-committed,CARD-WSJF,34\nFraud declaration workflow for unrecognised transactions,Epic,WSJF 4.25 (BV 13 + TC 8 + RR 13) / size 8. Ref F-03.,PI-committed,CARD-WSJF,30\nExplain declined payments in the app (response codes),Story,WSJF 3.0 (BV 5 + TC 2 + RR 2) / size 3. Ref F-05.,PI-candidate,CARD-WSJF,13\nMerchant category controls set by the cardholder,Epic,WSJF 1.25 (BV 5 + TC 2 + RR 3) / size 8. Ref F-08.,PI-candidate,CARD-WSJF,26\nOpen disputes from the fraud declaration,Epic,WSJF 1.23 (BV 8 + TC 3 + RR 5) / size 13. Ref F-04. Depends on: F-03.,PI-candidate,CARD-WSJF,40\n"
 },
 "fr-120": {
  "json": {
   "ranked": [
    {
     "id": "F-07",
     "title": "Suspension des jetons de paiement mobile à l'opposition",
     "cod": 29,
     "job_size": 3,
     "wsjf": 9.67,
     "points": 13
    },
    {
     "id": "F-02",
     "title": "Inscription automatique des cartes en opposition sur la liste d'opposition CB",
     "cod": 41,
     "job_size": 5,
     "wsjf": 8.2,
     "points": 21
    },
    {
     "id": "F-06",
     "title": "API d'opposition temps réel sur le serveur d'autorisation",
     "cod": 36,
     "job_size": 5,
     "wsjf": 7.2,
     "points": 21
    },
    {
     "id": "F-01",
     "title": "Mise en opposition dans l'application",
     "cod": 46,
     "job_size": 8,
     "wsjf": 5.75,
     "points": 34
    },
    {
     "id": "F-03",
     "title": "Déclaration de fraude au GIE CB depuis le dossier",
     "cod": 34,
     "job_size": 8,
     "wsjf": 4.25,
     "points": 30
    },
    {
     "id": "F-05",
     "title": "Explication des refus de paiement dans l'appli",
     "cod": 9,
     "job_size": 3,
     "wsjf": 3.0,
     "points": 13
    },
    {
     "id": "F-08",
     "title": "Blocage par catégorie de commerçant",
     "cod": 10,
     "job_size": 8,
     "wsjf": 1.25,
     "points": 26
    },
    {
     "id": "F-04",
     "title": "Émission des impayés depuis le dossier de fraude",
     "cod": 16,
     "job_size": 13,
     "wsjf": 1.23,
     "points": 40
    }
   ],
   "planned": [
    "F-06",
    "F-07",
    "F-02",
    "F-01",
    "F-03"
   ],
   "used": 119,
   "capacity": 120,
   "not_planned": {
    "F-05": "no capacity left (1 pts free, needs 13)",
    "F-08": "no capacity left (1 pts free, needs 26)",
    "F-04": "no capacity left (1 pts free, needs 40)"
   },
   "deadline_missed": []
  },
  "jira": "Summary,Issue Type,Description,Labels,Labels,Story Points\nSuspension des jetons de paiement mobile à l'opposition,Story,WSJF 9.67 (BV 8 + TC 8 + RR 13) / size 3. Ref F-07. Depends on: F-06.,PI-committed,CARTE-WSJF,13\nInscription automatique des cartes en opposition sur la liste d'opposition CB,Epic,WSJF 8.2 (BV 8 + TC 13 + RR 20) / size 5. Ref F-02. Depends on: F-06.,PI-committed,CARTE-WSJF,21\nAPI d'opposition temps réel sur le serveur d'autorisation,Enabler,WSJF 7.2 (BV 3 + TC 13 + RR 20) / size 5. Ref F-06.,PI-committed,CARTE-WSJF,21\nMise en opposition dans l'application,Epic,WSJF 5.75 (BV 20 + TC 13 + RR 13) / size 8. Ref F-01. Depends on: F-06.,PI-committed,CARTE-WSJF,34\nDéclaration de fraude au GIE CB depuis le dossier,Epic,WSJF 4.25 (BV 13 + TC 8 + RR 13) / size 8. Ref F-03.,PI-committed,CARTE-WSJF,30\nExplication des refus de paiement dans l'appli,Story,WSJF 3.0 (BV 5 + TC 2 + RR 2) / size 3. Ref F-05.,PI-candidate,CARTE-WSJF,13\nBlocage par catégorie de commerçant,Epic,WSJF 1.25 (BV 5 + TC 2 + RR 3) / size 8. Ref F-08.,PI-candidate,CARTE-WSJF,26\nÉmission des impayés depuis le dossier de fraude,Epic,WSJF 1.23 (BV 8 + TC 3 + RR 5) / size 13. Ref F-04. Depends on: F-03.,PI-candidate,CARTE-WSJF,40\n"
 },
 "en-60": {
  "json": {
   "ranked": [
    {
     "id": "F-07",
     "title": "Suspend wallet tokens when the card is blocked",
     "cod": 29,
     "job_size": 3,
     "wsjf": 9.67,
     "points": 13
    },
    {
     "id": "F-02",
     "title": "Add blocked PANs to the Visa Exception File automatically",
     "cod": 41,
     "job_size": 5,
     "wsjf": 8.2,
     "points": 21
    },
    {
     "id": "F-06",
     "title": "Real-time block API on the authorisation host",
     "cod": 36,
     "job_size": 5,
     "wsjf": 7.2,
     "points": 21
    },
    {
     "id": "F-01",
     "title": "Block a lost or stolen card in the app",
     "cod": 46,
     "job_size": 8,
     "wsjf": 5.75,
     "points": 34
    },
    {
     "id": "F-03",
     "title": "Fraud declaration workflow for unrecognised transactions",
     "cod": 34,
     "job_size": 8,
     "wsjf": 4.25,
     "points": 30
    },
    {
     "id": "F-05",
     "title": "Explain declined payments in the app (response codes)",
     "cod": 9,
     "job_size": 3,
     "wsjf": 3.0,
     "points": 13
    },
    {
     "id": "F-08",
     "title": "Merchant category controls set by the cardholder",
     "cod": 10,
     "job_size": 8,
     "wsjf": 1.25,
     "points": 26
    },
    {
     "id": "F-04",
     "title": "Open disputes from the fraud declaration",
     "cod": 16,
     "job_size": 13,
     "wsjf": 1.23,
     "points": 40
    }
   ],
   "planned": [
    "F-06",
    "F-07",
    "F-02"
   ],
   "used": 55,
   "capacity": 60,
   "not_planned": {
    "F-01": "no capacity left (5 pts free, needs 34)",
    "F-03": "no capacity left (5 pts free, needs 30)",
    "F-05": "no capacity left (5 pts free, needs 13)",
    "F-08": "no capacity left (5 pts free, needs 26)",
    "F-04": "no capacity left (5 pts free, needs 70 with F-03)"
   },
   "deadline_missed": [
    "F-01"
   ]
  },
  "jira": "Summary,Issue Type,Description,Labels,Labels,Story Points\nSuspend wallet tokens when the card is blocked,Story,WSJF 9.67 (BV 8 + TC 8 + RR 13) / size 3. Ref F-07. Depends on: F-06.,PI-committed,CARD-WSJF,13\nAdd blocked PANs to the Visa Exception File automatically,Epic,WSJF 8.2 (BV 8 + TC 13 + RR 20) / size 5. Ref F-02. Depends on: F-06.,PI-committed,CARD-WSJF,21\nReal-time block API on the authorisation host,Enabler,WSJF 7.2 (BV 3 + TC 13 + RR 20) / size 5. Ref F-06.,PI-committed,CARD-WSJF,21\nBlock a lost or stolen card in the app,Epic,WSJF 5.75 (BV 20 + TC 13 + RR 13) / size 8. Ref F-01. Depends on: F-06.,PI-candidate,CARD-WSJF,34\nFraud declaration workflow for unrecognised transactions,Epic,WSJF 4.25 (BV 13 + TC 8 + RR 13) / size 8. Ref F-03.,PI-candidate,CARD-WSJF,30\nExplain declined payments in the app (response codes),Story,WSJF 3.0 (BV 5 + TC 2 + RR 2) / size 3. Ref F-05.,PI-candidate,CARD-WSJF,13\nMerchant category controls set by the cardholder,Epic,WSJF 1.25 (BV 5 + TC 2 + RR 3) / size 8. Ref F-08.,PI-candidate,CARD-WSJF,26\nOpen disputes from the fraud declaration,Epic,WSJF 1.23 (BV 8 + TC 3 + RR 5) / size 13. Ref F-04. Depends on: F-03.,PI-candidate,CARD-WSJF,40\n"
 },
 "en-200": {
  "json": {
   "ranked": [
    {
     "id": "F-07",
     "title": "Suspend wallet tokens when the card is blocked",
     "cod": 29,
     "job_size": 3,
     "wsjf": 9.67,
     "points": 13
    },
    {
     "id": "F-02",
     "title": "Add blocked PANs to the Visa Exception File automatically",
     "cod": 41,
     "job_size": 5,
     "wsjf": 8.2,
     "points": 21
    },
    {
     "id": "F-06",
     "title": "Real-time block API on the authorisation host",
     "cod": 36,
     "job_size": 5,
     "wsjf": 7.2,
     "points": 21
    },
    {
     "id": "F-01",
     "title": "Block a lost or stolen card in the app",
     "cod": 46,
     "job_size": 8,
     "wsjf": 5.75,
     "points": 34
    },
    {
     "id": "F-03",
     "title": "Fraud declaration workflow for unrecognised transactions",
     "cod": 34,
     "job_size": 8,
     "wsjf": 4.25,
     "points": 30
    },
    {
     "id": "F-05",
     "title": "Explain declined payments in the app (response codes)",
     "cod": 9,
     "job_size": 3,
     "wsjf": 3.0,
     "points": 13
    },
    {
     "id": "F-08",
     "title": "Merchant category controls set by the cardholder",
     "cod": 10,
     "job_size": 8,
     "wsjf": 1.25,
     "points": 26
    },
    {
     "id": "F-04",
     "title": "Open disputes from the fraud declaration",
     "cod": 16,
     "job_size": 13,
     "wsjf": 1.23,
     "points": 40
    }
   ],
   "planned": [
    "F-06",
    "F-07",
    "F-02",
    "F-01",
    "F-03",
    "F-05",
    "F-08",
    "F-04"
   ],
   "used": 198,
   "capacity": 200,
   "not_planned": {},
   "deadline_missed": []
  },
  "jira": "Summary,Issue Type,Description,Labels,Labels,Story Points\nSuspend wallet tokens when the card is blocked,Story,WSJF 9.67 (BV 8 + TC 8 + RR 13) / size 3. Ref F-07. Depends on: F-06.,PI-committed,CARD-WSJF,13\nAdd blocked PANs to the Visa Exception File automatically,Epic,WSJF 8.2 (BV 8 + TC 13 + RR 20) / size 5. Ref F-02. Depends on: F-06.,PI-committed,CARD-WSJF,21\nReal-time block API on the authorisation host,Enabler,WSJF 7.2 (BV 3 + TC 13 + RR 20) / size 5. Ref F-06.,PI-committed,CARD-WSJF,21\nBlock a lost or stolen card in the app,Epic,WSJF 5.75 (BV 20 + TC 13 + RR 13) / size 8. Ref F-01. Depends on: F-06.,PI-committed,CARD-WSJF,34\nFraud declaration workflow for unrecognised transactions,Epic,WSJF 4.25 (BV 13 + TC 8 + RR 13) / size 8. Ref F-03.,PI-committed,CARD-WSJF,30\nExplain declined payments in the app (response codes),Story,WSJF 3.0 (BV 5 + TC 2 + RR 2) / size 3. Ref F-05.,PI-committed,CARD-WSJF,13\nMerchant category controls set by the cardholder,Epic,WSJF 1.25 (BV 5 + TC 2 + RR 3) / size 8. Ref F-08.,PI-committed,CARD-WSJF,26\nOpen disputes from the fraud declaration,Epic,WSJF 1.23 (BV 8 + TC 3 + RR 5) / size 13. Ref F-04. Depends on: F-03.,PI-committed,CARD-WSJF,40\n"
 },
 "en-f04-size8": {
  "json": {
   "ranked": [
    {
     "id": "F-07",
     "title": "Suspend wallet tokens when the card is blocked",
     "cod": 29,
     "job_size": 3,
     "wsjf": 9.67,
     "points": 13
    },
    {
     "id": "F-02",
     "title": "Add blocked PANs to the Visa Exception File automatically",
     "cod": 41,
     "job_size": 5,
     "wsjf": 8.2,
     "points": 21
    },
    {
     "id": "F-06",
     "title": "Real-time block API on the authorisation host",
     "cod": 36,
     "job_size": 5,
     "wsjf": 7.2,
     "points": 21
    },
    {
     "id": "F-01",
     "title": "Block a lost or stolen card in the app",
     "cod": 46,
     "job_size": 8,
     "wsjf": 5.75,
     "points": 34
    },
    {
     "id": "F-03",
     "title": "Fraud declaration workflow for unrecognised transactions",
     "cod": 34,
     "job_size": 8,
     "wsjf": 4.25,
     "points": 30
    },
    {
     "id": "F-05",
     "title": "Explain declined payments in the app (response codes)",
     "cod": 9,
     "job_size": 3,
     "wsjf": 3.0,
     "points": 13
    },
    {
     "id": "F-04",
     "title": "Open disputes from the fraud declaration",
     "cod": 16,
     "job_size": 8,
     "wsjf": 2.0,
     "points": 40
    },
    {
     "id": "F-08",
     "title": "Merchant category controls set by the cardholder",
     "cod": 10,
     "job_size": 8,
     "wsjf": 1.25,
     "points": 26
    }
   ],
   "planned": [
    "F-06",
    "F-07",
    "F-02",
    "F-01",
    "F-03"
   ],
   "used": 119,
   "capacity": 120,
   "not_planned": {
    "F-05": "no capacity left (1 pts free, needs 13)",
    "F-04": "no capacity left (1 pts free, needs 40)",
    "F-08": "no capacity left (1 pts free, needs 26)"
   },
   "deadline_missed": []
  },
  "jira": "Summary,Issue Type,Description,Labels,Labels,Story Points\nSuspend wallet tokens when the card is blocked,Story,WSJF 9.67 (BV 8 + TC 8 + RR 13) / size 3. Ref F-07. Depends on: F-06.,PI-committed,CARD-WSJF,13\nAdd blocked PANs to the Visa Exception File automatically,Epic,WSJF 8.2 (BV 8 + TC 13 + RR 20) / size 5. Ref F-02. Depends on: F-06.,PI-committed,CARD-WSJF,21\nReal-time block API on the authorisation host,Enabler,WSJF 7.2 (BV 3 + TC 13 + RR 20) / size 5. Ref F-06.,PI-committed,CARD-WSJF,21\nBlock a lost or stolen card in the app,Epic,WSJF 5.75 (BV 20 + TC 13 + RR 13) / size 8. Ref F-01. Depends on: F-06.,PI-committed,CARD-WSJF,34\nFraud declaration workflow for unrecognised transactions,Epic,WSJF 4.25 (BV 13 + TC 8 + RR 13) / size 8. Ref F-03.,PI-committed,CARD-WSJF,30\nExplain declined payments in the app (response codes),Story,WSJF 3.0 (BV 5 + TC 2 + RR 2) / size 3. Ref F-05.,PI-candidate,CARD-WSJF,13\nOpen disputes from the fraud declaration,Epic,WSJF 2.0 (BV 8 + TC 3 + RR 5) / size 8. Ref F-04. Depends on: F-03.,PI-candidate,CARD-WSJF,40\nMerchant category controls set by the cardholder,Epic,WSJF 1.25 (BV 5 + TC 2 + RR 3) / size 8. Ref F-08.,PI-candidate,CARD-WSJF,26\n"
 },
 "ties": {
  "json": {
   "ranked": [
    {
     "id": "F",
     "title": "Item F",
     "cod": 6,
     "job_size": 2,
     "wsjf": 3.0,
     "points": 25
    },
    {
     "id": "D",
     "title": "Item D",
     "cod": 9,
     "job_size": 13,
     "wsjf": 0.69,
     "points": 5
    },
    {
     "id": "A",
     "title": "Item A",
     "cod": 5,
     "job_size": 8,
     "wsjf": 0.62,
     "points": 5
    },
    {
     "id": "C",
     "title": "Item C",
     "cod": 5,
     "job_size": 8,
     "wsjf": 0.62,
     "points": 5
    },
    {
     "id": "B",
     "title": "Item B",
     "cod": 3,
     "job_size": 8,
     "wsjf": 0.38,
     "points": 5
    },
    {
     "id": "E",
     "title": "Item E",
     "cod": 3,
     "job_size": 8,
     "wsjf": 0.38,
     "points": 5
    }
   ],
   "planned": [
    "D",
    "A",
    "C",
    "B",
    "E"
   ],
   "used": 25,
   "capacity": 30,
   "not_planned": {
    "F": "no capacity left (5 pts free, needs 25)"
   },
   "deadline_missed": []
  },
  "jira": "Summary,Issue Type,Description,Labels,Labels,Story Points\nItem F,Story,\"WSJF 3.0 (BV 2 + TC 2 + RR 2) / size 2. Ref F. Depends on: A, C.\",PI-candidate,T-WSJF,25\nItem D,Story,WSJF 0.69 (BV 3 + TC 3 + RR 3) / size 13. Ref D.,PI-committed,T-WSJF,5\nItem A,Story,WSJF 0.62 (BV 1 + TC 2 + RR 2) / size 8. Ref A.,PI-committed,T-WSJF,5\nItem C,Story,WSJF 0.62 (BV 2 + TC 2 + RR 1) / size 8. Ref C.,PI-committed,T-WSJF,5\nItem B,Story,WSJF 0.38 (BV 1 + TC 1 + RR 1) / size 8. Ref B.,PI-committed,T-WSJF,5\nItem E,Story,WSJF 0.38 (BV 1 + TC 1 + RR 1) / size 8. Ref E.,PI-committed,T-WSJF,5\n"
 },
 "cycle": {
  "json": {
   "ranked": [
    {
     "id": "X",
     "title": "Item X",
     "cod": 24,
     "job_size": 3,
     "wsjf": 8.0,
     "points": 10
    },
    {
     "id": "Y",
     "title": "Item Y",
     "cod": 15,
     "job_size": 3,
     "wsjf": 5.0,
     "points": 10
    },
    {
     "id": "Z",
     "title": "Item Z",
     "cod": 9,
     "job_size": 5,
     "wsjf": 1.8,
     "points": 10
    }
   ],
   "planned": [
    "Z"
   ],
   "used": 10,
   "capacity": 50,
   "not_planned": {
    "X": "circular dependency",
    "Y": "circular dependency"
   },
   "deadline_missed": []
  },
  "jira": "Summary,Issue Type,Description,Labels,Labels,Story Points\nItem X,Story,WSJF 8.0 (BV 8 + TC 8 + RR 8) / size 3. Ref X. Depends on: Y.,PI-candidate,C-WSJF,10\nItem Y,Story,WSJF 5.0 (BV 5 + TC 5 + RR 5) / size 3. Ref Y. Depends on: X.,PI-candidate,C-WSJF,10\nItem Z,Story,WSJF 1.8 (BV 3 + TC 3 + RR 3) / size 5. Ref Z.,PI-committed,C-WSJF,10\n"
 },
 "quotes": {
  "json": {
   "ranked": [
    {
     "id": "Q-2",
     "title": "Item Q-2",
     "cod": 9,
     "job_size": 3,
     "wsjf": 3.0,
     "points": 8
    },
    {
     "id": "Q-1",
     "title": "Block, then \"list\" the PAN",
     "cod": 15,
     "job_size": 5,
     "wsjf": 3.0,
     "points": 0
    }
   ],
   "planned": [
    "Q-2",
    "Q-1"
   ],
   "used": 8,
   "capacity": 10,
   "not_planned": {},
   "deadline_missed": []
  },
  "jira": "Summary,Issue Type,Description,Labels,Labels,Story Points\nItem Q-2,Story,WSJF 3.0 (BV 3 + TC 3 + RR 3) / size 3. Ref Q-2.,PI-committed,Q-WSJF,8\n\"Block, then \"\"list\"\" the PAN\",Story,WSJF 3.0 (BV 5 + TC 5 + RR 5) / size 5. Ref Q-1.,PI-committed,Q-WSJF,\n"
 }
};
export default FIXTURES;
/* Python round(cod / size, 2) for cod 3..60 and every Fibonacci size: [cod, size, value]. */
export const ROUND = [[3, 1, 3.0], [3, 2, 1.5], [3, 3, 1.0], [3, 5, 0.6], [3, 8, 0.38], [3, 13, 0.23], [3, 20, 0.15], [4, 1, 4.0], [4, 2, 2.0], [4, 3, 1.33], [4, 5, 0.8], [4, 8, 0.5], [4, 13, 0.31], [4, 20, 0.2], [5, 1, 5.0], [5, 2, 2.5], [5, 3, 1.67], [5, 5, 1.0], [5, 8, 0.62], [5, 13, 0.38], [5, 20, 0.25], [6, 1, 6.0], [6, 2, 3.0], [6, 3, 2.0], [6, 5, 1.2], [6, 8, 0.75], [6, 13, 0.46], [6, 20, 0.3], [7, 1, 7.0], [7, 2, 3.5], [7, 3, 2.33], [7, 5, 1.4], [7, 8, 0.88], [7, 13, 0.54], [7, 20, 0.35], [8, 1, 8.0], [8, 2, 4.0], [8, 3, 2.67], [8, 5, 1.6], [8, 8, 1.0], [8, 13, 0.62], [8, 20, 0.4], [9, 1, 9.0], [9, 2, 4.5], [9, 3, 3.0], [9, 5, 1.8], [9, 8, 1.12], [9, 13, 0.69], [9, 20, 0.45], [10, 1, 10.0], [10, 2, 5.0], [10, 3, 3.33], [10, 5, 2.0], [10, 8, 1.25], [10, 13, 0.77], [10, 20, 0.5], [11, 1, 11.0], [11, 2, 5.5], [11, 3, 3.67], [11, 5, 2.2], [11, 8, 1.38], [11, 13, 0.85], [11, 20, 0.55], [12, 1, 12.0], [12, 2, 6.0], [12, 3, 4.0], [12, 5, 2.4], [12, 8, 1.5], [12, 13, 0.92], [12, 20, 0.6], [13, 1, 13.0], [13, 2, 6.5], [13, 3, 4.33], [13, 5, 2.6], [13, 8, 1.62], [13, 13, 1.0], [13, 20, 0.65], [14, 1, 14.0], [14, 2, 7.0], [14, 3, 4.67], [14, 5, 2.8], [14, 8, 1.75], [14, 13, 1.08], [14, 20, 0.7], [15, 1, 15.0], [15, 2, 7.5], [15, 3, 5.0], [15, 5, 3.0], [15, 8, 1.88], [15, 13, 1.15], [15, 20, 0.75], [16, 1, 16.0], [16, 2, 8.0], [16, 3, 5.33], [16, 5, 3.2], [16, 8, 2.0], [16, 13, 1.23], [16, 20, 0.8], [17, 1, 17.0], [17, 2, 8.5], [17, 3, 5.67], [17, 5, 3.4], [17, 8, 2.12], [17, 13, 1.31], [17, 20, 0.85], [18, 1, 18.0], [18, 2, 9.0], [18, 3, 6.0], [18, 5, 3.6], [18, 8, 2.25], [18, 13, 1.38], [18, 20, 0.9], [19, 1, 19.0], [19, 2, 9.5], [19, 3, 6.33], [19, 5, 3.8], [19, 8, 2.38], [19, 13, 1.46], [19, 20, 0.95], [20, 1, 20.0], [20, 2, 10.0], [20, 3, 6.67], [20, 5, 4.0], [20, 8, 2.5], [20, 13, 1.54], [20, 20, 1.0], [21, 1, 21.0], [21, 2, 10.5], [21, 3, 7.0], [21, 5, 4.2], [21, 8, 2.62], [21, 13, 1.62], [21, 20, 1.05], [22, 1, 22.0], [22, 2, 11.0], [22, 3, 7.33], [22, 5, 4.4], [22, 8, 2.75], [22, 13, 1.69], [22, 20, 1.1], [23, 1, 23.0], [23, 2, 11.5], [23, 3, 7.67], [23, 5, 4.6], [23, 8, 2.88], [23, 13, 1.77], [23, 20, 1.15], [24, 1, 24.0], [24, 2, 12.0], [24, 3, 8.0], [24, 5, 4.8], [24, 8, 3.0], [24, 13, 1.85], [24, 20, 1.2], [25, 1, 25.0], [25, 2, 12.5], [25, 3, 8.33], [25, 5, 5.0], [25, 8, 3.12], [25, 13, 1.92], [25, 20, 1.25], [26, 1, 26.0], [26, 2, 13.0], [26, 3, 8.67], [26, 5, 5.2], [26, 8, 3.25], [26, 13, 2.0], [26, 20, 1.3], [27, 1, 27.0], [27, 2, 13.5], [27, 3, 9.0], [27, 5, 5.4], [27, 8, 3.38], [27, 13, 2.08], [27, 20, 1.35], [28, 1, 28.0], [28, 2, 14.0], [28, 3, 9.33], [28, 5, 5.6], [28, 8, 3.5], [28, 13, 2.15], [28, 20, 1.4], [29, 1, 29.0], [29, 2, 14.5], [29, 3, 9.67], [29, 5, 5.8], [29, 8, 3.62], [29, 13, 2.23], [29, 20, 1.45], [30, 1, 30.0], [30, 2, 15.0], [30, 3, 10.0], [30, 5, 6.0], [30, 8, 3.75], [30, 13, 2.31], [30, 20, 1.5], [31, 1, 31.0], [31, 2, 15.5], [31, 3, 10.33], [31, 5, 6.2], [31, 8, 3.88], [31, 13, 2.38], [31, 20, 1.55], [32, 1, 32.0], [32, 2, 16.0], [32, 3, 10.67], [32, 5, 6.4], [32, 8, 4.0], [32, 13, 2.46], [32, 20, 1.6], [33, 1, 33.0], [33, 2, 16.5], [33, 3, 11.0], [33, 5, 6.6], [33, 8, 4.12], [33, 13, 2.54], [33, 20, 1.65], [34, 1, 34.0], [34, 2, 17.0], [34, 3, 11.33], [34, 5, 6.8], [34, 8, 4.25], [34, 13, 2.62], [34, 20, 1.7], [35, 1, 35.0], [35, 2, 17.5], [35, 3, 11.67], [35, 5, 7.0], [35, 8, 4.38], [35, 13, 2.69], [35, 20, 1.75], [36, 1, 36.0], [36, 2, 18.0], [36, 3, 12.0], [36, 5, 7.2], [36, 8, 4.5], [36, 13, 2.77], [36, 20, 1.8], [37, 1, 37.0], [37, 2, 18.5], [37, 3, 12.33], [37, 5, 7.4], [37, 8, 4.62], [37, 13, 2.85], [37, 20, 1.85], [38, 1, 38.0], [38, 2, 19.0], [38, 3, 12.67], [38, 5, 7.6], [38, 8, 4.75], [38, 13, 2.92], [38, 20, 1.9], [39, 1, 39.0], [39, 2, 19.5], [39, 3, 13.0], [39, 5, 7.8], [39, 8, 4.88], [39, 13, 3.0], [39, 20, 1.95], [40, 1, 40.0], [40, 2, 20.0], [40, 3, 13.33], [40, 5, 8.0], [40, 8, 5.0], [40, 13, 3.08], [40, 20, 2.0], [41, 1, 41.0], [41, 2, 20.5], [41, 3, 13.67], [41, 5, 8.2], [41, 8, 5.12], [41, 13, 3.15], [41, 20, 2.05], [42, 1, 42.0], [42, 2, 21.0], [42, 3, 14.0], [42, 5, 8.4], [42, 8, 5.25], [42, 13, 3.23], [42, 20, 2.1], [43, 1, 43.0], [43, 2, 21.5], [43, 3, 14.33], [43, 5, 8.6], [43, 8, 5.38], [43, 13, 3.31], [43, 20, 2.15], [44, 1, 44.0], [44, 2, 22.0], [44, 3, 14.67], [44, 5, 8.8], [44, 8, 5.5], [44, 13, 3.38], [44, 20, 2.2], [45, 1, 45.0], [45, 2, 22.5], [45, 3, 15.0], [45, 5, 9.0], [45, 8, 5.62], [45, 13, 3.46], [45, 20, 2.25], [46, 1, 46.0], [46, 2, 23.0], [46, 3, 15.33], [46, 5, 9.2], [46, 8, 5.75], [46, 13, 3.54], [46, 20, 2.3], [47, 1, 47.0], [47, 2, 23.5], [47, 3, 15.67], [47, 5, 9.4], [47, 8, 5.88], [47, 13, 3.62], [47, 20, 2.35], [48, 1, 48.0], [48, 2, 24.0], [48, 3, 16.0], [48, 5, 9.6], [48, 8, 6.0], [48, 13, 3.69], [48, 20, 2.4], [49, 1, 49.0], [49, 2, 24.5], [49, 3, 16.33], [49, 5, 9.8], [49, 8, 6.12], [49, 13, 3.77], [49, 20, 2.45], [50, 1, 50.0], [50, 2, 25.0], [50, 3, 16.67], [50, 5, 10.0], [50, 8, 6.25], [50, 13, 3.85], [50, 20, 2.5], [51, 1, 51.0], [51, 2, 25.5], [51, 3, 17.0], [51, 5, 10.2], [51, 8, 6.38], [51, 13, 3.92], [51, 20, 2.55], [52, 1, 52.0], [52, 2, 26.0], [52, 3, 17.33], [52, 5, 10.4], [52, 8, 6.5], [52, 13, 4.0], [52, 20, 2.6], [53, 1, 53.0], [53, 2, 26.5], [53, 3, 17.67], [53, 5, 10.6], [53, 8, 6.62], [53, 13, 4.08], [53, 20, 2.65], [54, 1, 54.0], [54, 2, 27.0], [54, 3, 18.0], [54, 5, 10.8], [54, 8, 6.75], [54, 13, 4.15], [54, 20, 2.7], [55, 1, 55.0], [55, 2, 27.5], [55, 3, 18.33], [55, 5, 11.0], [55, 8, 6.88], [55, 13, 4.23], [55, 20, 2.75], [56, 1, 56.0], [56, 2, 28.0], [56, 3, 18.67], [56, 5, 11.2], [56, 8, 7.0], [56, 13, 4.31], [56, 20, 2.8], [57, 1, 57.0], [57, 2, 28.5], [57, 3, 19.0], [57, 5, 11.4], [57, 8, 7.12], [57, 13, 4.38], [57, 20, 2.85], [58, 1, 58.0], [58, 2, 29.0], [58, 3, 19.33], [58, 5, 11.6], [58, 8, 7.25], [58, 13, 4.46], [58, 20, 2.9], [59, 1, 59.0], [59, 2, 29.5], [59, 3, 19.67], [59, 5, 11.8], [59, 8, 7.38], [59, 13, 4.54], [59, 20, 2.95], [60, 1, 60.0], [60, 2, 30.0], [60, 3, 20.0], [60, 5, 12.0], [60, 8, 7.5], [60, 13, 4.62], [60, 20, 3.0]];
