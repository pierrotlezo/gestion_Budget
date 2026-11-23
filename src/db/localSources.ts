/**
 * Sources des bons plans locaux (DONNÉES). `{ville}` est remplacé par la ville des Réglages.
 * Google News agrège la presse locale (Le Dauphiné, actu.fr, Place Gre'net, mesinfos…) : seule la
 * requête de recherche est envoyée (ex. « Grenoble bar happy hour »), jamais tes données.
 */
export type DealTheme = 'food' | 'bars' | 'ski' | 'student' | 'free';

export interface LocalSource {
  id: string;
  /** Flux RSS ; les requêtes Google News sont construites à partir de `query`. */
  kind: 'googleNews' | 'rss';
  query?: string;
  url?: string;
  /** Thème par défaut des articles de cette source (affiné par mots-clés). */
  theme?: DealTheme;
  /** Ne garder que les articles contenant un mot-clé de bon plan. */
  requireDealKeyword: boolean;
  /** Ne garder que les articles qui mentionnent la ville ou ses environs. */
  requireLocal?: boolean;
  /** Expression (sans accents, majuscules) que le titre doit contenir, ex. forfaits pour le flux ski. */
  include?: string;
  /** Nombre maximal d'articles gardés pour cette source (évite qu'une source noie les autres). */
  maxItems?: number;
  /** Ancienneté maximale des articles, en jours. */
  maxAgeDays?: number;
}

export const THEME_LABELS: Record<DealTheme, string> = {
  food: '🍔 Manger',
  bars: '🍺 Bars & sorties',
  ski: '🎿 Ski & montagne',
  student: '🎓 Étudiants',
  free: '🎁 Gratuit',
};

/** Stations proches (pour les offres de ski). */
export const NEARBY_PLACES: Record<string, string[]> = {
  grenoble: ['Chamrousse', '7 Laux', 'Villard-de-Lans', 'Autrans', 'Alpe d\'Huez', 'Deux Alpes', 'Col de Porte', 'Lans-en-Vercors', 'Vercors', 'Chartreuse', 'Isère', 'Échirolles', 'Saint-Martin-d\'Hères', 'Meylan', 'Fontaine', 'Seyssinet'],
};

export const LOCAL_SOURCES: LocalSource[] = [
  { id: 'gn-food', kind: 'googleNews', theme: 'food', requireDealKeyword: true, maxAgeDays: 60, query: '{ville} (restaurant OR resto OR manger OR repas OR boulangerie OR "food truck" OR brunch OR épicerie OR "anti-gaspi" OR marché) when:60d' },
  { id: 'gn-bonplan', kind: 'googleNews', requireDealKeyword: true, maxAgeDays: 60, query: '{ville} "bon plan" when:60d' },
  { id: 'gn-bars', kind: 'googleNews', theme: 'bars', requireDealKeyword: true, query: '{ville} (bar OR "happy hour" OR afterwork OR apéro OR soirée OR concert OR festival OR brasserie) (gratuit OR "pas cher" OR "bon plan" OR offert OR réduction OR "entrée libre") when:30d' },
  { id: 'gn-ski', kind: 'googleNews', theme: 'ski', requireDealKeyword: true, query: '({stations}) (forfait OR ski OR luge OR raquettes) (prix OR promo OR "bon plan" OR réduction OR gratuit OR "moitié prix" OR "pas cher") when:45d' },
  { id: 'gn-student', kind: 'googleNews', theme: 'student', requireDealKeyword: true, query: '{ville} étudiants ("bon plan" OR gratuit OR réduction OR "tarif réduit" OR aide OR "pas cher") when:30d' },
  { id: 'gn-free', kind: 'googleNews', theme: 'free', requireDealKeyword: true, query: '{ville} (gratuit OR gratuite OR "bon plan" OR "entrée libre") when:14d' },
  { id: 'crous', kind: 'rss', url: 'https://www.crous-grenoble.fr/feed/', theme: 'student', requireDealKeyword: true },
  { id: 'placegrenet', kind: 'rss', url: 'https://www.placegrenet.fr/feed', requireDealKeyword: true },
  { id: 'gremag', kind: 'rss', url: 'https://www.gre-mag.fr/feed/', requireDealKeyword: true },
  // Ski : seulement les forfaits, séjours et locations (pas le matériel)
  { id: 'dealabs-ski', kind: 'rss', url: 'https://www.dealabs.com/rss/groupe/ski', theme: 'ski', requireDealKeyword: false, include: 'FORFAIT|SEJOUR|LOCATION|SKI A LA CARTE|PASS|STATION|COURS DE SKI', maxItems: 5 },
];

/** Adresses autorisées pour le serveur (liste blanche : il ne télécharge rien d'autre). */
export const ALLOWED_FEED_HOSTS = ['news.google.com', 'www.crous-grenoble.fr', 'www.placegrenet.fr', 'www.gre-mag.fr', 'www.dealabs.com'];
