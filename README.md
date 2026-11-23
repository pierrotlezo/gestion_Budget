# Gestion de budget

Application web personnelle de gestion de budget, en français, qui tourne **uniquement sur ton ordinateur**.

🔒 **Confidentialité** : aucune donnée ne quitte la machine. Pas de serveur, pas de compte, pas de statistiques d'usage, aucune ressource chargée depuis Internet. Les données sont stockées dans le navigateur (IndexedDB), et le serveur de développement n'écoute que sur `127.0.0.1`.

## Lancer l'application

Prérequis : [Node.js](https://nodejs.org) version 20 ou plus récente.

```bash
npm install      # une seule fois, installe les dépendances
npm run dev      # démarre l'application
```

Ouvre ensuite **http://127.0.0.1:5173** dans ton navigateur.

Pour découvrir l'application, va dans **Données → Charger la démo**. Les données de démonstration s'effacent en un clic, sans toucher aux tiennes.

### Autres commandes

| Commande | Rôle |
|---|---|
| `npm test` | Lance les tests unitaires (Vitest) |
| `npm run test:watch` | Relance les tests à chaque modification |
| `npm run build` | Vérifie les types et construit une version optimisée dans `dist/` |
| `npm run preview` | Sert la version construite sur http://127.0.0.1:4173 |

## ⚠️ Sauvegarde

Les données vivent dans **ce navigateur, à cette adresse** (`http://127.0.0.1:5173`). Elles disparaissent si tu vides les données de navigation du site, et ne sont pas visibles depuis un autre navigateur ni depuis l'adresse de `npm run preview`.
→ Fais régulièrement **Données → Exporter la sauvegarde** et garde le fichier JSON en lieu sûr.

## Premiers pas

1. **Paramètres** : vérifie le virement mensuel (600 €), l'aide des parents (250 €), le plafond du Livret A (22 950 €) et l'historique des taux. Ajoute chaque nouveau taux du Livret A (révisé le 1er février et le 1er août) avec sa date d'effet.
2. **Prêt** : saisis le taux de ton offre de prêt, la date de déblocage, le type de différé (partiel ou total) et l'assurance éventuelle.
3. **Épargne** : ajoute le solde du Livret A sous forme de versement daté (la date compte pour le calcul par quinzaine). Ajoute tes autres comptes (LDDS, etc.) et indique lesquels sont alimentés par le prêt.
4. **Catégories** : fixe un budget mensuel par catégorie.
5. **Import CSV** : importe un relevé bancaire, fais correspondre les colonnes et mémorise le format de ta banque.

## Fonctionnalités

- **Catégories** : ajout, renommage, suppression (avec déplacement des transactions), couleur, budget mensuel, type (dépense, épargne, revenu).
- **Transactions** : saisie manuelle, recherche, filtres par mois et par catégorie, modification, suppression.
- **Import CSV** : détection du séparateur, de l'encodage (UTF-8 ou Windows-1252) et des lignes d'en-tête. Gère la virgule décimale française, les dates JJ/MM/AAAA, une colonne montant ou deux colonnes Débit/Crédit. Ignore les doublons quand on réimporte un relevé.
- **Règles** : « si le libellé contient… alors catégorie… ». Quand tu recatégorises une opération à la main, l'application propose de créer une règle.
- **Tableau de bord** : entrées, dépenses et reste du mois. Barres de budget (orange à 80 %, rouge en cas de dépassement), répartition en anneau, évolution sur 12 mois.
- **Prêt** : différé partiel ou total, tableau d'amortissement, capital restant dû, intérêts payés, coût total du crédit.
- **Épargne** : plusieurs comptes, alerte de dépassement du plafond, intérêts estimés par quinzaine avec les retraits mensuels prévus.
- **Prêt vs épargne** : coût du prêt comparé aux intérêts gagnés, sur l'année et sur la durée du différé.
- **Patrimoine net** : épargne − capital restant dû, avec une projection sur 24 mois.
- **Données** : sauvegarde et restauration JSON, export CSV des transactions, données de démonstration.
- Mode clair, sombre ou selon le système (dans Paramètres).

## Règles de calcul

**Prêt.** Mensualité constante M = C·i / (1 − (1+i)^−n), avec i = taux annuel / 12. Pendant un différé **partiel**, on paie seulement les intérêts. Pendant un différé **total**, les intérêts s'ajoutent au capital. Les montants sont arrondis au centime à chaque échéance, et la dernière échéance solde le capital restant.

**Livret A / LDDS (règle des quinzaines).** L'année compte 24 quinzaines (du 1er au 15, puis du 16 à la fin du mois).
- Un versement rapporte à partir de la quinzaine suivante.
- Un retrait cesse de rapporter dès le début de sa quinzaine.
- Intérêts d'une quinzaine = solde × taux en vigueur / 24.
- Les intérêts sont crédités le 31 décembre.
- Pour les années futures, on utilise le dernier taux connu.

## Organisation du code

```
src/
├── app/          Squelette : registre des écrans (routes.tsx), mise en page, thème, couleurs des graphiques
├── db/           Persistance : modèle de données (schema.ts), base Dexie (db.ts), valeurs par défaut,
│                 sauvegarde JSON (backup.ts), données de démo (demo.ts)
├── domain/       Calculs purs, sans React ni base de données, testés avec Vitest
│   ├── money.ts, dates.ts      Montants en centimes, dates « AAAA-MM-JJ », quinzaines
│   ├── budget/                 Totaux par catégorie et par mois
│   ├── loan/                   Tableau d'amortissement
│   ├── savings/                Intérêts par quinzaine, plafonds, projections
│   ├── rules/                  Catégorisation automatique
│   ├── csv/                    Lecture des relevés et export CSV
│   └── netWorth.ts             Comparaison prêt / épargne, patrimoine net
├── features/     Un dossier par écran (dashboard, transactions, loan, savings…)
├── components/   Composants d'interface réutilisables
└── hooks/        Accès réactif aux données (useLiveQuery)
```

Conventions :
- Montants en **centimes entiers** (60000 = 600,00 €), pour éviter les erreurs d'arrondi.
- Dates au format `AAAA-MM-JJ`.
- Taux en décimal (0.015 = 1,5 %).
- Catégories, règles, taux et plafonds sont des **données** modifiables, pas des valeurs écrites en dur dans le code.

### Ajouter un module (prochaines versions)

Investissements (PEA, assurance-vie, ETF, PER) avec simulateur d'intérêts composés, objectifs d'épargne, détection des abonnements récurrents, prévision de fin de mois. Pour chacun :

1. Les calculs dans `src/domain/<module>/` avec leurs tests `*.test.ts`.
2. Si de nouvelles tables sont nécessaires : `this.version(2).stores({ … })` dans `src/db/db.ts`. On ajoute toujours une nouvelle version, on ne modifie jamais une version existante. Ajouter aussi la table à `DATA_TABLES` pour qu'elle entre dans la sauvegarde.
3. L'écran dans `src/features/<module>/`, puis une ligne dans `src/app/routes.tsx`.
