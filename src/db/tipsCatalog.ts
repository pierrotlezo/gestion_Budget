/**
 * Catalogue des astuces d'économie (DONNÉES). Pour en ajouter une : ajouter un objet ici.
 * Conditions possibles : voir TipCondition dans src/domain/tips/engine.ts.
 * Les textes restent volontairement généraux : les offres précises changent souvent, les liens pointent
 * vers les sites officiels.
 */
import type { TipDef } from '../domain/tips/engine';

export const TIPS_CATALOG: TipDef[] = [
  // ── Alimentation ──
  { id: 'alim-antigaspi', icon: '🥖', title: 'Paniers anti-gaspi', text: 'Tu dépenses en moyenne {moyenne} par mois en courses. Les applis anti-gaspi (Too Good To Go, Phenix…) vendent les invendus du jour à environ un tiers du prix. Quelques paniers par mois : jusqu\'à {economie} d\'économie.', categoryId: 'cat-alimentation', when: { type: 'categoryAbove', categoryId: 'cat-alimentation', minMonthly: 8000 }, savingRatio: 0.1 },
  { id: 'alim-mdd', icon: '🏷️', title: 'Marques distributeur', text: 'Remplacer les grandes marques par les marques des supermarchés coûte souvent 20 à 30 % de moins pour une qualité proche. Sur tes {moyenne} de courses : environ {economie} par mois.', categoryId: 'cat-alimentation', when: { type: 'categoryAbove', categoryId: 'cat-alimentation', minMonthly: 8000 }, savingRatio: 0.15 },
  { id: 'alim-liste', icon: '📝', title: 'Liste + drive', text: 'Faire ses courses en drive avec une liste évite les achats d\'impulsion (souvent 10 % du panier). Sur tes {moyenne} : environ {economie} par mois.', categoryId: 'cat-alimentation', when: { type: 'categoryAbove', categoryId: 'cat-alimentation', minMonthly: 10000 }, savingRatio: 0.1 },
  { id: 'alim-batch', icon: '🍲', title: 'Batch cooking', text: 'Cuisiner en grande quantité le dimanche pour la semaine évite les plats préparés et les repas achetés dehors. Économie estimée : {economie} par mois.', categoryId: 'cat-alimentation', when: { type: 'categoryAbove', categoryId: 'cat-alimentation', minMonthly: 15000 }, savingRatio: 0.12 },
  { id: 'alim-crous', icon: '🎓', title: 'Restaurant universitaire', text: 'Si tu es étudiant, les restos U du Crous proposent un repas complet à petit prix, bien moins cher qu\'un repas acheté dehors.', categoryId: 'cat-alimentation', when: { type: 'categoryAbove', categoryId: 'cat-alimentation', minMonthly: 15000 }, savingFixed: 2000, link: { label: 'Trouver un resto U', url: 'https://www.crous.fr/' } },

  // ── Transport ──
  { id: 'transport-carte-jeune', icon: '🚄', title: 'Carte Avantage Jeune', text: 'Tu dépenses en moyenne {moyenne} par mois en train. Si tu as entre 12 et 27 ans, la carte Avantage Jeune SNCF donne des réductions sur la plupart des trajets et se rembourse vite.', categoryId: 'cat-transport', when: { type: 'categoryAbove', categoryId: 'cat-transport', minMonthly: 2000 }, savingRatio: 0.25, link: { label: 'Voir sur SNCF Connect', url: 'https://www.sncf-connect.com/' } },
  { id: 'transport-tot', icon: '⏰', title: 'Réserver tôt', text: 'Les billets de train sont bien moins chers réservés plusieurs semaines à l\'avance (et en semaine). Active les alertes prix sur tes trajets habituels : environ {economie} par mois.', categoryId: 'cat-transport', when: { type: 'categoryAbove', categoryId: 'cat-transport', minMonthly: 2000 }, savingRatio: 0.2 },
  { id: 'transport-covoit', icon: '🚗', title: 'Covoiturage', text: 'Pour certains trajets, le covoiturage (BlaBlaCar…) coûte moins cher que le train, surtout en dernière minute.', categoryId: 'cat-transport', when: { type: 'categoryAbove', categoryId: 'cat-transport', minMonthly: 3000 }, savingRatio: 0.15 },

  // ── Abonnements ──
  { id: 'abo-tri', icon: '✂️', title: 'Fais le tri dans tes abonnements', text: 'Tes abonnements détectés coûtent {moyenne} par mois. En résilier un ou deux que tu utilises peu (ou les alterner : un mois Netflix, un mois Disney+…) peut te faire gagner {economie} par mois.', when: { type: 'subscriptions', min: 2 }, savingRatio: 0.3 },
  { id: 'abo-etudiant', icon: '🎧', title: 'Tarifs étudiants', text: 'Spotify, Deezer, Apple Music, Amazon Prime… proposent des formules étudiantes environ à moitié prix. Vérifie si tu y as droit.', categoryId: 'cat-abonnements', when: { type: 'labelMatch', pattern: 'SPOTIFY' }, savingFixed: 550 },
  { id: 'abo-forfait', icon: '📱', title: 'Forfait mobile moins cher', text: 'Les opérateurs à petit prix proposent des forfaits avec beaucoup de données pour quelques euros par mois, sans engagement. Compare avec ton forfait actuel.', categoryId: 'cat-abonnements', when: { type: 'labelMatch', pattern: 'MOBILE' }, savingFixed: 600 },

  // ── Énergie ──
  { id: 'energie-comparateur', icon: '⚡', title: 'Compare ton offre d\'électricité', text: 'Tu paies en moyenne {moyenne} par mois. Le comparateur officiel et gratuit du médiateur de l\'énergie montre les offres moins chères que la tienne.', categoryId: 'cat-energie', when: { type: 'categoryAbove', categoryId: 'cat-energie', minMonthly: 2000 }, savingRatio: 0.1, link: { label: 'Comparateur officiel', url: 'https://comparateur.energie-info.fr/' } },
  { id: 'energie-gestes', icon: '🌡️', title: 'Chauffage à 19 °C', text: 'Chaque degré en moins fait baisser la facture de chauffage d\'environ 7 %. Éteindre les veilles et couvrir les casseroles aident aussi.', categoryId: 'cat-energie', when: { type: 'categoryAbove', categoryId: 'cat-energie', minMonthly: 2000 }, savingRatio: 0.07 },

  // ── Sorties ──
  { id: 'loisirs-reduc', icon: '🎬', title: 'Tarifs réduits', text: 'Tu dépenses {moyenne} par mois en sorties. Cinémas, musées et salles proposent des tarifs jeunes / étudiants, et beaucoup de musées sont gratuits pour les moins de 26 ans.', categoryId: 'cat-divertissement', when: { type: 'categoryAbove', categoryId: 'cat-divertissement', minMonthly: 2000 }, savingRatio: 0.25 },
  { id: 'loisirs-biblio', icon: '📚', title: 'Bibliothèque municipale', text: 'Livres, BD, films, jeux vidéo et parfois presse en ligne : l\'inscription est gratuite ou presque dans beaucoup de villes.', categoryId: 'cat-divertissement', when: { type: 'categoryAbove', categoryId: 'cat-divertissement', minMonthly: 1000 }, savingFixed: 1000 },

  // ── Banque ──
  { id: 'banque-frais', icon: '🏦', title: 'Frais bancaires', text: 'Des frais bancaires apparaissent dans tes relevés. Les banques en ligne proposent des comptes et cartes gratuits sous conditions.', when: { type: 'labelMatch', pattern: 'FRAIS' }, savingFixed: 500 },

  // ── Toujours utiles ──
  { id: 'gen-payer-en-premier', icon: '🤖', title: 'Épargne automatique', text: 'Programme un virement automatique vers ton épargne le jour où tu reçois ton argent : ce qui part d\'abord ne se dépense pas.', when: { type: 'always' }, savingFixed: 2500 },
  { id: 'gen-48h', icon: '⏳', title: 'Règle des 48 heures', text: 'Avant un achat plaisir de plus de 30 €, attends 48 h. Une bonne partie de ces envies disparaît d\'elle-même.', when: { type: 'always' }, savingFixed: 1500 },
  { id: 'gen-cashback', icon: '💳', title: 'Cashback et cartes de fidélité', text: 'Les cartes de fidélité gratuites de ton supermarché et les sites de cashback te rendent une partie de ce que tu dépenses de toute façon.', when: { type: 'always' }, savingFixed: 500 },
];
