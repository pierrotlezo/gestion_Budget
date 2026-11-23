/**
 * Bons plans locaux : lecture de flux RSS, filtrage par mots-clés, classement par thème.
 * Fonctions pures (utilisées par le serveur maison et testées).
 */
import { NEARBY_PLACES, type DealTheme, type LocalSource } from '../../db/localSources';
import { normalizeLabel } from '../rules/categorize';

export interface LocalDeal {
  id: string;
  title: string;
  source: string;
  link: string;
  date: string;
  theme: DealTheme;
  price?: string;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;|&#8217;/g, '’')
    .replace(/&#8211;|&#8212;/g, '–')
    .replace(/&#8230;/g, '…')
    .replace(/&nbsp;|&#160;/g, ' ')
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, ' ')
    .trim();

export interface RssItem {
  title: string;
  link: string;
  date: string;
  source?: string;
  price?: string;
}

export function parseRss(xml: string): RssItem[] {
  return (xml.match(/<item[\s>][\s\S]*?<\/item>/g) ?? []).map((item) => {
    const tag = (n: string) => item.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`))?.[1];
    const date = tag('pubDate');
    return {
      title: decode(tag('title') ?? ''),
      link: decode(tag('link') ?? ''),
      date: date && !Number.isNaN(Date.parse(decode(date))) ? new Date(decode(date)).toISOString() : '',
      source: tag('source') ? decode(tag('source')!) : undefined,
      price: item.match(/<pepper:merchant[^>]*price="([^"]*)"/)?.[1],
    };
  });
}

/** Mots qui signalent vraiment un bon plan (un simple prix ou « tarifs » ne suffit pas). */
const DEAL_WORDS = /\b(GRATUITE?S?|GRATUITEMENT|BONS? PLANS?|PAS CHERS?|PETITS? PRIX|PRIX MINI|PROMOS?|PROMOTIONS?|REDUCTIONS?|TARIFS? REDUITS?|REMISES?|OFFERTE?S?|OFFRES?|MOITIE PRIX|SOLDES|BRADERIES?|HAPPY HOURS?|ENTREE LIBRE|ANTI-GASPI|A PRIX CASSES?|DEMI-TARIF)\b|-\d+ ?%/;

const THEME_WORDS: [DealTheme, RegExp][] = [
  ['ski', /\b(SKIS?|FORFAITS?|STATIONS?|LUGES?|RAQUETTES?|PISTES?|NEIGE|CHAMROUSSE|7 LAUX|VILLARD|AUTRANS|ALPE D.HUEZ|DEUX ALPES)\b/],
  ['bars', /\b(BARS?|HAPPY HOURS?|AFTERWORKS?|APEROS?|SOIREES?|CONCERTS?|FESTIVALS?|BIERES?|BRASSERIES?|CLUBS?|SPECTACLES?|CINEMAS?|MUSEES?|EXPOS?|EXPOSITIONS?)\b/],
  ['food', /\b(RESTAURANTS?|RESTOS?|MANGER|REPAS|BOULANGERIES?|FOOD|BRUNCHS?|EPICERIES?|MARCHES?|COURSES|CUISINE|PIZZAS?|BURGERS?|KEBABS?|SUPERMARCHES?|ANTI-GASPI|DENREES)\b/],
  ['student', /\b(ETUDIANTE?S?|CROUS|CAMPUS|UNIVERSITES?|UGA|JEUNES)\b/],
  ['free', /\b(GRATUITE?S?|ENTREE LIBRE|OFFERTE?S?)\b/],
];

/** Mots qui signalent un article hors sujet (faits divers, sport…). */
const NOISE_WORDS = /\b(MEURTRE|AGRESSION|ACCIDENT|DECES|MORTS?|PROCES|GARDE A VUE|INCENDIE|LIGUE [12]|GF38|MATCH|BLESSES?|POLICE|GREVE|MANIFESTATION|FEMINICIDE|AMENDES?|COUPE DE FRANCE|FOOTBALL|RUGBY|HOCKEY|HANDBALL|BASKET|ELECTIONS?|TRIBUNAL)\b/;

export function classifyDeal(title: string, fallback?: DealTheme): DealTheme | null {
  const t = normalizeLabel(title);
  for (const [theme, re] of THEME_WORDS) if (re.test(t)) return theme;
  return fallback ?? null;
}

/** Construit l'adresse d'une source pour une ville donnée. */
export function sourceUrl(source: LocalSource, city: string): string {
  if (source.kind === 'rss') return source.url!;
  const places = NEARBY_PLACES[normalizeLabel(city).toLowerCase()] ?? [city];
  const stations = places.slice(0, 7).map((p) => (p.includes(' ') ? `"${p}"` : p)).join(' OR ');
  const q = source.query!.replaceAll('{ville}', city).replaceAll('{stations}', stations);
  return `https://news.google.com/rss/search?q=${encodeURIComponent(q)}&hl=fr&gl=FR&ceid=FR:fr`;
}

/** Filtre, classe et dédoublonne les articles d'une source. */
export function extractDeals(items: RssItem[], source: LocalSource, city: string, now: Date, defaultMaxAgeDays = 45): LocalDeal[] {
  const local = [city, ...(NEARBY_PLACES[normalizeLabel(city).toLowerCase()] ?? [])].map(normalizeLabel);
  const maxAgeDays = source.maxAgeDays ?? defaultMaxAgeDays;
  const include = source.include ? new RegExp(`\\b(${source.include})\\b`) : null;
  const deals = items.flatMap((it) => {
    // Google News : « Titre - Source »
    let title = it.title;
    let src = it.source ?? source.id;
    const dash = title.lastIndexOf(' - ');
    if (source.kind === 'googleNews' && dash > 20) {
      src = title.slice(dash + 3).trim();
      title = title.slice(0, dash).trim();
    }
    const t = normalizeLabel(title);
    if (!title || !/^https:\/\//.test(it.link)) return [];
    if (it.date && now.getTime() - Date.parse(it.date) > maxAgeDays * 86400000) return [];
    if (NOISE_WORDS.test(t)) return [];
    if (source.requireDealKeyword && !DEAL_WORDS.test(t)) return [];
    if (source.requireLocal && !local.some((l) => t.includes(l))) return [];
    if (include && !include.test(t)) return [];
    const theme = classifyDeal(title, source.theme);
    if (!theme) return [];
    return [{ id: t.slice(0, 80), title, source: src, link: it.link, date: it.date, theme, price: it.price }];
  });
  return source.maxItems ? deals.slice(0, source.maxItems) : deals;
}

/** Fusionne les bons plans de toutes les sources : sans doublons, les plus récents d'abord. */
export function mergeDeals(lists: LocalDeal[][], max = 60): LocalDeal[] {
  const seen = new Set<string>();
  return lists
    .flat()
    .sort((a, b) => b.date.localeCompare(a.date))
    .filter((d) => (seen.has(d.id) ? false : (seen.add(d.id), true)))
    .slice(0, max);
}
