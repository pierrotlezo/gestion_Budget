# Gestion de budget

Application web personnelle, en français, pour **visualiser ses dépenses afin d'épargner et d'investir** (livrets, PEA, bitcoin…). Elle tourne **uniquement sur ton ordinateur**.

🔒 **Confidentialité** : tes données ne quittent jamais la machine. Pas de serveur, pas de compte, pas de statistiques d'usage. Les données sont stockées dans le navigateur (IndexedDB), et le serveur local n'écoute que sur `127.0.0.1`.

Ton PC sert de **serveur maison** pour le téléphone (voir plus bas) : la synchro se fait directement entre tes appareils, sur ton Wi-Fi.

Quelques échanges avec Internet, tous désactivables dans **Réglages** :
- **Cours des placements** : seuls les symboles (ex. `CW8.PA`, `bitcoin`) sont envoyés en HTTPS à Yahoo Finance et CoinGecko, sans cookies ni page d'origine. Tes montants et tes quantités ne sont jamais envoyés.
- **Bons plans** : le PC télécharge des flux publics : Google Actualités (presse locale), Crous Grenoble, Place Gre'net, Gre-Mag et Dealabs. Seuls le nom de ta ville et des mots-clés comme « bon plan » ou « happy hour » sont envoyés. Le tri se fait sur ton ordinateur.
- **Notifications** : elles partent de ton PC et passent par le service de notifications d'Apple, **chiffrées de bout en bout** (Apple ne peut pas les lire).

## Lancer l'application

Prérequis : [Node.js](https://nodejs.org) version 20 ou plus récente.

```bash
npm install      # une seule fois, installe les dépendances
npm run dev      # démarre l'application
```

Ouvre ensuite **http://127.0.0.1:5173** dans ton navigateur.

Pour découvrir l'application, va dans **Réglages → Données & sauvegarde → Charger la démo**. Les données de démonstration s'effacent en un clic, sans toucher aux tiennes.

### Autres commandes

| Commande | Rôle |
|---|---|
| `npm start` | Construit l'appli et lance le serveur maison (HTTPS, iPhone, synchro, notifications) |
| `npm test` | Lance les tests unitaires (Vitest) |
| `npm run test:watch` | Relance les tests à chaque modification |
| `npm run build` | Vérifie les types et construit une version optimisée dans `dist/` |
| `npm run preview` | Sert la version construite sur http://127.0.0.1:4173 |

## 📱 Sur l'iPhone (synchro + notifications)

L'appli s'installe sur l'iPhone comme une application, depuis Safari. Ton PC lui sert de serveur : il fournit l'appli, synchronise les données et envoie les notifications.

**1. Lance le serveur maison sur le PC**
```bash
npm start
```
Il construit l'appli puis l'affiche à l'adresse **https://pierrot-laptop.local:8443** (le nom de ton PC sur le réseau). Laisse-le tourner : **les notifications ne partent que si le PC est allumé avec le serveur lancé.**

**2. Installe l'appli sur l'iPhone** (une seule fois). Sur le PC, ouvre l'appli à l'adresse https://localhost:8443, puis va dans **Réglages → 📱 Téléphone & synchro** et suis les 5 étapes :
1. Mets l'iPhone sur le même Wi-Fi que le PC (le partage de connexion de l'iPhone marche aussi).
2. Scanne le 1er QR code : il ouvre la page qui permet de télécharger le **certificat**. Installe-le dans **Réglages → Profil téléchargé**.
3. Active la confiance dans **Réglages → Général → Informations → Réglages des certificats**. Ce certificat ne sert qu'à sécuriser la connexion entre ton iPhone et ton PC.
4. Scanne le 2e QR code. Dans Safari, appuie sur **Partager ⬆️ → Sur l'écran d'accueil**.
5. Ouvre l'appli depuis son icône, entre le **code à 6 chiffres** affiché sur le PC, puis appuie sur **🔔 Activer les notifications**.

**Ensuite :**
- **La synchro est automatique**, à l'ouverture et après chaque modification, dès que l'iPhone et le PC sont sur le même Wi-Fi.
- **Hors de chez toi**, l'appli reste utilisable et les notifications arrivent quand même (si le PC est allumé). La synchro se fait au retour.
- **Si une même donnée est modifiée sur les deux appareils**, c'est la modification la plus récente qui l'emporte.
- **Notifications possibles**, à choisir dans Réglages → Téléphone :
  - bons plans du jour à Grenoble ;
  - budget à 80 % ou dépassé, abonnement qui augmente ;
  - palier, niveau, rappel de fin de mois pour la série 🔥 ;
  - résumé du dimanche soir.

  Aucune notification n'est envoyée entre 22 h et 8 h.
- **Si l'adresse « .local » ne marche pas**, la page indique aussi l'adresse IP du PC.
- **Si le PC a un pare-feu actif**, il faut autoriser les ports 8443 et 8080 sur le réseau local.
- **Le dossier `donnees-serveur/`** contient une copie de tes données, les certificats et la clé secrète d'appairage. Il n'est jamais envoyé sur GitHub (`.gitignore`). Garde-le privé et ne le partage pas.

Prérequis : iOS 16.4 ou plus récent pour les notifications.

## ⚠️ Sauvegarde

Les données vivent dans **ce navigateur, à cette adresse** (`http://127.0.0.1:5173`). Elles disparaissent si tu vides les données de navigation du site, et ne sont pas visibles depuis un autre navigateur ni depuis l'adresse de `npm run preview`.
→ Fais régulièrement **Réglages → Données & sauvegarde → Exporter la sauvegarde** et garde le fichier JSON en lieu sûr.

Les cours, les bons plans et la synchro passent par le serveur local. Ils fonctionnent avec `npm start`, `npm run dev` et `npm run preview`, mais pas en ouvrant directement les fichiers de `dist/`. Pour un usage quotidien avec l'iPhone, utilise `npm start`.

## Premiers pas

1. **Réglages** : vérifie le virement mensuel, l'aide des parents, le plafond du Livret A et l'historique de ses taux (révisés le 1er février et le 1er août).
2. **Prêt → Mon prêt** : saisis le taux de ton offre, la date de déblocage, le type de différé et l'assurance.
3. **Épargne & Invest. → Livrets** : ajoute le solde de chaque livret sous forme de versement daté.
4. **Épargne & Invest. → Placements** : ajoute tes placements en les recherchant par nom, symbole ou ISIN (« bitcoin », « CW8 », « FR0010315770 »), puis tes achats.
5. **Dépenses → Importer un relevé** : importe ton relevé bancaire CSV. Dans **Catégories & budgets**, fixe un budget par catégorie.
6. **Épargne & Invest. → Objectifs** : fixe-toi des objectifs (épargne de précaution, 1 000 € en BTC…).

## Fonctionnalités

L'application est organisée en 5 rubriques :

- 🏠 **Accueil** :
  - ce qu'il te reste ce mois-ci et ce que tu as mis de côté ;
  - ton niveau et ta série 🔥 ;
  - ton potentiel d'épargne et les **astuces du mois** ;
  - tes budgets et la répartition de tes dépenses en barres (un clic ouvre la catégorie) ;
  - le bouton **« J'épargne »**.
- 💸 **Dépenses** :
  - **Par catégorie** : une tuile par catégorie, cliquable. Chaque catégorie a sa page : total, budget modifiable, comparaison avec ta moyenne, astuces, opérations. La tuile « À trier » permet de classer en un clic.
  - **Opérations** : toutes les opérations, groupées par jour.
  - **Astuces & bons plans** :
    - 3 astuces qui changent chaque mois, choisies d'après tes dépenses ;
    - tes abonnements, avec une alerte en cas de hausse de prix ;
    - les autres prélèvements réguliers ;
    - les bons plans du moment dans les catégories où tu dépenses le plus.
  - **Importer** un relevé CSV.
  - **Catégories & règles** : icône, couleur, budget, tri automatique.
- 📈 **Épargne & Invest.** :
  - **Vue d'ensemble** : épargne totale, patrimoine net, répartition.
  - **Placements** : BTC, ETF, PEA, assurance-vie, PER, avec cours automatiques et plus-values.
  - **Livrets** : intérêts calculés par quinzaine, alerte de plafond.
  - **🎮 Objectifs**, présentés comme un jeu :
    - niveaux (🌱 Graine → 👑 Légende) et points d'expérience ;
    - série de mois épargnés et mission du mois ;
    - 12 badges à débloquer ;
    - objectifs en quêtes avec paliers à 25 / 50 / 75 / 100 % et confettis.
  - **Simulateur** d'intérêts composés.
- 🏦 **Prêt** :
  - **Mon plan** : « je prends X €/mois sur le prêt pendant N ans ». Le plan estime la mensualité de remboursement à la fin du différé, avec ou sans remboursement anticipé de l'argent restant, et prévient si l'argent est épuisé avant la fin.
  - **Détails du prêt** (tableau d'amortissement) et **Prêt vs épargne**.
- ⚙️ **Réglages** : paramètres, connexions Internet facultatives, thème, sauvegarde JSON, export CSV, démo.

Les astuces sont des **données** (`src/db/tipsCatalog.ts`) : on peut en ajouter sans toucher au code.

## Règles de calcul

**Prêt.** Mensualité constante M = C·i / (1 − (1+i)^−n), avec i = taux annuel / 12. Pendant un différé **partiel**, on paie seulement les intérêts. Pendant un différé **total**, les intérêts s'ajoutent au capital. Les montants sont arrondis au centime à chaque échéance, et la dernière échéance solde le capital restant.

**Placements.** Le montant investi correspond aux achats moins les ventes. La valeur actuelle se calcule ainsi :
- placement coté : quantité × dernier cours (convertie en euros si besoin) ;
- placement sans cotation : dernière valorisation saisie, plus les achats et moins les ventes faits depuis.

**Intérêts composés.** Le rendement annuel est converti en taux mensuel équivalent, (1 + r)^(1/12) − 1. Les versements sont faits en fin de mois.

**Capacité d'épargne.** Potentiel = revenus − dépenses de consommation. Ce que tu as « mis de côté » correspond aux sorties classées dans une catégorie de type Épargne. Les virements vers Trade Republic, Coinbase, Binance… y sont classés automatiquement.

**Mon plan (prêt).** C'est une estimation mois par mois. L'argent restant rapporte le taux actuel du livret. On retire le montant choisi pendant la durée choisie, plus les intérêts du différé si tu le coches. À la fin du différé, on compare deux mensualités : la mensualité normale, et celle calculée sur le capital diminué de l'argent restant (même durée).

**Abonnements.** Un même libellé (sans chiffres) revient au plus une fois par mois, sur au moins 3 des 4 derniers mois, avec un montant quasi identique. Une hausse est signalée au-delà de 2 %.

**Jeu.** On compte 1 XP par euro mis de côté. L'épargne d'un mois correspond au plus grand des deux montants : virements classés en Épargne, ou achats et versements, pour ne pas compter deux fois le même argent. S'y ajoutent les paliers d'objectifs, 50 XP par badge, et 20 ou 40 XP par astuce essayée ou adoptée.

**Livret A / LDDS (règle des quinzaines).** L'année compte 24 quinzaines (du 1er au 15, puis du 16 à la fin du mois).
- Un versement rapporte à partir de la quinzaine suivante.
- Un retrait cesse de rapporter dès le début de sa quinzaine.
- Intérêts d'une quinzaine = solde × taux en vigueur / 24.
- Les intérêts sont crédités le 31 décembre.
- Pour les années futures, on utilise le dernier taux connu.

## Organisation du code

```
src/
├── app/          Squelette : rubriques et onglets (routes.tsx), mise en page, thème, couleurs des graphiques
├── db/           Persistance : modèle de données (schema.ts), base Dexie (db.ts), valeurs par défaut,
│                 sauvegarde JSON (backup.ts), données de démo (demo.ts)
├── domain/       Calculs purs, sans React ni base de données, testés avec Vitest
│   ├── money.ts, dates.ts      Montants en centimes, dates « AAAA-MM-JJ », quinzaines
│   ├── budget/                 Totaux par catégorie et par mois
│   ├── loan/                   Tableau d'amortissement
│   ├── savings/                Intérêts par quinzaine, plafonds, projections
│   ├── rules/                  Catégorisation automatique
│   ├── csv/                    Lecture des relevés et export CSV
│   ├── invest/                 Placements, cours, intérêts composés, objectifs
│   ├── tips/                   Astuces, abonnements, bons plans
│   ├── gamification.ts         Niveaux, XP, badges, séries
│   ├── progress.ts             Calculs partagés appli / serveur (patrimoine, jeu, astuces)
│   ├── notifications.ts        Règles des notifications
│   ├── sync/                   Fusion des données entre appareils
│   └── netWorth.ts             Comparaison prêt / épargne, patrimoine net
├── services/     Accès réseau (cours, bons plans, synchro, notifications)
server/           Serveur maison : HTTPS, certificats, API, synchro, envoi des notifications
public/           Service worker (hors connexion + notifications), manifeste, icônes
├── features/     Un dossier par écran (home, transactions, invest, savings, loan…)
├── components/   Composants d'interface réutilisables
└── hooks/        Accès réactif aux données (useLiveQuery)
```

Conventions :
- Montants en **centimes entiers** (60000 = 600,00 €), pour éviter les erreurs d'arrondi.
- Dates au format `AAAA-MM-JJ`.
- Taux en décimal (0.015 = 1,5 %).
- Catégories, règles, taux et plafonds sont des **données** modifiables, pas des valeurs écrites en dur dans le code.

### Ajouter un module (prochaines versions)

Idées pour la suite : import OFX, prévision de fin de mois, historique de la valeur des placements. Pour chaque module :

1. Les calculs dans `src/domain/<module>/` avec leurs tests `*.test.ts`.
2. Si de nouvelles tables sont nécessaires : `this.version(2).stores({ … })` dans `src/db/db.ts`. On ajoute toujours une nouvelle version, on ne modifie jamais une version existante. Ajouter aussi la table à `DATA_TABLES` pour qu'elle entre dans la sauvegarde.
3. L'écran dans `src/features/<module>/`, puis une page dans la rubrique concernée de `src/app/routes.tsx`.
