# Gestion de budget

Application web personnelle, en français, pour **visualiser ses dépenses afin d'épargner et d'investir** (livrets, PEA, bitcoin…). Elle tourne **uniquement sur ton ordinateur**.

🔒 **Confidentialité** : tes données ne quittent jamais la machine. Pas de serveur, pas de compte, pas de statistiques d'usage. Les données sont stockées dans le navigateur (IndexedDB), et le serveur local n'écoute que sur `127.0.0.1`.

Seule exception, désactivable dans **Réglages** : la mise à jour des **cours des placements**. Seuls les symboles (ex. `CW8.PA`, `bitcoin`) sont envoyés en HTTPS à Yahoo Finance et CoinGecko, sans cookies ni page d'origine. Tes montants et tes quantités ne sont jamais envoyés.

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
| `npm test` | Lance les tests unitaires (Vitest) |
| `npm run test:watch` | Relance les tests à chaque modification |
| `npm run build` | Vérifie les types et construit une version optimisée dans `dist/` |
| `npm run preview` | Sert la version construite sur http://127.0.0.1:4173 |

## ⚠️ Sauvegarde

Les données vivent dans **ce navigateur, à cette adresse** (`http://127.0.0.1:5173`). Elles disparaissent si tu vides les données de navigation du site, et ne sont pas visibles depuis un autre navigateur ni depuis l'adresse de `npm run preview`.
→ Fais régulièrement **Réglages → Données & sauvegarde → Exporter la sauvegarde** et garde le fichier JSON en lieu sûr.

Les cours automatiques passent par le serveur local de Vite : ils fonctionnent avec `npm run dev` et `npm run preview`, pas en ouvrant directement les fichiers de `dist/`.

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
  - ton **potentiel d'épargne** moyen et ce qu'il deviendrait s'il était investi ;
  - tes budgets (orange à 80 %, rouge en cas de dépassement), la répartition des dépenses et tes objectifs ;
  - le bouton **« J'épargne »** pour enregistrer un versement en un clic.
- 💸 **Dépenses** :
  - transactions avec recherche et filtres ;
  - import CSV (virgule décimale, dates JJ/MM/AAAA, Débit/Crédit, encodage Windows-1252, doublons ignorés) ;
  - catégories et budgets ;
  - règles de catégorisation, avec une proposition de règle quand tu recatégorises une opération à la main.
- 📈 **Épargne & Invest.** :
  - **Vue d'ensemble** : épargne totale, patrimoine net, répartition, taux d'épargne.
  - **Placements** : BTC, ETF, actions, assurance-vie, PER… Cours automatiques, plus-values, historique des achats et ventes. Les placements sans cotation (fonds euros, PER) se mettent à jour à la main.
  - **Livrets** : plusieurs comptes, intérêts calculés par quinzaine, alerte de plafond.
  - **Objectifs** : progression, date estimée, effort mensuel nécessaire pour tenir une échéance.
  - **Simulateur** : intérêts composés, jusqu'à 4 scénarios comparés.
- 🏦 **Prêt** : différé partiel ou total, tableau d'amortissement, coût du crédit, comparaison **prêt vs épargne**.
- ⚙️ **Réglages** : paramètres, cours automatiques, thème clair ou sombre, sauvegarde et restauration JSON, export CSV, données de démonstration.

## Règles de calcul

**Prêt.** Mensualité constante M = C·i / (1 − (1+i)^−n), avec i = taux annuel / 12. Pendant un différé **partiel**, on paie seulement les intérêts. Pendant un différé **total**, les intérêts s'ajoutent au capital. Les montants sont arrondis au centime à chaque échéance, et la dernière échéance solde le capital restant.

**Placements.** Le montant investi correspond aux achats moins les ventes. La valeur actuelle se calcule ainsi :
- placement coté : quantité × dernier cours (convertie en euros si besoin) ;
- placement sans cotation : dernière valorisation saisie, plus les achats et moins les ventes faits depuis.

**Intérêts composés.** Le rendement annuel est converti en taux mensuel équivalent, (1 + r)^(1/12) − 1. Les versements sont faits en fin de mois.

**Capacité d'épargne.** Potentiel = revenus − dépenses de consommation. Ce que tu as « mis de côté » correspond aux sorties classées dans une catégorie de type Épargne. Les virements vers Trade Republic, Coinbase, Binance… y sont classés automatiquement.

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
│   └── netWorth.ts             Comparaison prêt / épargne, patrimoine net
├── services/     Accès réseau (cours des placements uniquement)
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

Idées pour la suite : détection des abonnements récurrents et des hausses de prix, prévision de fin de mois, historique de la valeur des placements. Pour chaque module :

1. Les calculs dans `src/domain/<module>/` avec leurs tests `*.test.ts`.
2. Si de nouvelles tables sont nécessaires : `this.version(2).stores({ … })` dans `src/db/db.ts`. On ajoute toujours une nouvelle version, on ne modifie jamais une version existante. Ajouter aussi la table à `DATA_TABLES` pour qu'elle entre dans la sauvegarde.
3. L'écran dans `src/features/<module>/`, puis une page dans la rubrique concernée de `src/app/routes.tsx`.
