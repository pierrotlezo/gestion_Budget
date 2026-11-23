import { describe, expect, it } from 'vitest';
import { LOCAL_SOURCES } from '../../db/localSources';
import { classifyDeal, extractDeals, mergeDeals, parseRss, sourceUrl } from './localDeals';

const now = new Date('2026-11-23T12:00:00Z');
const item = (title: string, date = 'Mon, 16 Nov 2026 10:00:00 GMT', link = 'https://news.google.com/rss/articles/abc') =>
  `<item><title>${title}</title><link>${link}</link><pubDate>${date}</pubDate></item>`;
const gnFood = LOCAL_SOURCES.find((s) => s.id === 'gn-food')!;
const crous = LOCAL_SOURCES.find((s) => s.id === 'crous')!;

describe('bons plans locaux', () => {
  it('lit un flux RSS (CDATA, entités, sources)', () => {
    const xml = `<rss><channel>${item('<![CDATA[Grenoble. Ce bon plan pour manger pas cher au restaurant - Actu.fr]]>')}<item><title>Musées gratuits &amp; expos</title><link>https://evous.fr/a</link><pubDate>x</pubDate><source url="https://evous.fr">eVous</source></item></channel></rss>`;
    const items = parseRss(xml);
    expect(items[0]).toMatchObject({ title: 'Grenoble. Ce bon plan pour manger pas cher au restaurant - Actu.fr', date: '2026-11-16T10:00:00.000Z' });
    expect(items[1]).toMatchObject({ title: 'Musées gratuits & expos', source: 'eVous', date: '' });
  });

  it('garde les bons plans, sépare la source Google News, ignore le hors-sujet et les vieux articles', () => {
    const items = parseRss([
      item('Grenoble. Ce bon plan du moment pour manger pas cher au restaurant - Actu.fr'),
      item('Dominateur puis solidaire à dix, le FC Nantes bat Grenoble, Ligue 2 match - Ouest-France'),
      item('Grenoble : un restaurant ouvre rue Félix-Poulat - Le Dauphiné'), // pas un bon plan
      item('Grenoble. Bon plan : brunch à moitié prix - Actu.fr', 'Mon, 01 Jun 2026 10:00:00 GMT'), // trop vieux
    ].join(''));
    const deals = extractDeals(items, gnFood, 'Grenoble', now);
    expect(deals).toHaveLength(1);
    expect(deals[0]).toMatchObject({ title: 'Grenoble. Ce bon plan du moment pour manger pas cher au restaurant', source: 'Actu.fr', theme: 'food' });
  });

  it('classe par thème', () => {
    expect(classifyDeal('Chamrousse propose des forfaits de ski à moitié prix')).toBe('ski');
    expect(classifyDeal('Happy hour : les bars pas chers de Grenoble')).toBe('bars');
    expect(classifyDeal('Distribution gratuite de denrées pour les étudiants')).toBe('food');
    expect(classifyDeal('Profitez de l’offre 1 Bus 1 Campus : 4 jours de ski tout inclus à 325 €')).toBe('ski');
    expect(classifyDeal('Musées gratuits à Grenoble')).toBe('bars');
    expect(classifyDeal('Rien de spécial', 'student')).toBe('student');
  });

  it('flux du Crous : uniquement les offres', () => {
    const items = parseRss([item('Profitez de l’offre 1 Bus 1 Campus : 4 jours de ski tout inclus à 325 €', undefined, 'https://www.crous-grenoble.fr/x'), item('Mouvement de grève du 5 novembre 2026', undefined, 'https://www.crous-grenoble.fr/y')].join(''));
    expect(extractDeals(items, crous, 'Grenoble', now).map((d) => d.theme)).toEqual(['ski']);
  });

  it('construit la recherche Google News pour la ville et ses stations', () => {
    const url = decodeURIComponent(sourceUrl(LOCAL_SOURCES.find((s) => s.id === 'gn-ski')!, 'Grenoble'));
    expect(url).toContain('Chamrousse OR "7 Laux"');
    expect(sourceUrl(gnFood, 'Grenoble')).toMatch(/^https:\/\/news\.google\.com\/rss\/search\?q=Grenoble/);
  });

  it('flux ski : seulement les forfaits et séjours, et un nombre limité', () => {
    const ski = LOCAL_SOURCES.find((s) => s.id === 'dealabs-ski')!;
    const items = parseRss([
      item('Casque de ski avec visière adulte', undefined, 'https://www.dealabs.com/a'),
      item('[Clients Passe Montagne] Adhésion Ski à la Carte à 9€', undefined, 'https://www.dealabs.com/b'),
      item('Séjour de ski 8J/7N pour 2 personnes', undefined, 'https://www.dealabs.com/c'),
    ].join(''));
    expect(extractDeals(items, ski, 'Grenoble', now).map((d) => d.link)).toEqual(['https://www.dealabs.com/b', 'https://www.dealabs.com/c']);
  });

  it('un simple montant ou un article de sport ne suffit pas', () => {
    const items = parseRss([
      item('Grenoble. Des auto-écoles paient jusqu’à 6 000 € d’amendes - actu-locale.fr'),
      item('Coupe de France : diffusion gratuite du match Seyssinet – Nîmes - Métro-Sports'),
      item('Musées gratuits à Grenoble et dans la métropole - eVous'),
    ].join(''));
    expect(extractDeals(items, LOCAL_SOURCES.find((s) => s.id === 'gn-free')!, 'Grenoble', now).map((d) => d.title)).toEqual(['Musées gratuits à Grenoble et dans la métropole']);
  });

  it('fusionne sans doublons, du plus récent au plus ancien', () => {
    const a = { id: 'A', title: 'A', source: 's', link: 'https://x', date: '2026-11-20', theme: 'food' as const };
    const b = { ...a, id: 'B', date: '2026-11-22' };
    expect(mergeDeals([[a, b], [a]]).map((d) => d.id)).toEqual(['B', 'A']);
  });
});
