/** Lecture des flux RSS publics de Dealabs (bons plans). Fonction pure, testable. */
export interface Deal {
  title: string;
  price?: string;
  merchant?: string;
  link: string;
  date: string;
  feed: string;
}

const decode = (s: string) =>
  s
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .trim();

export function parseDealabsRss(xml: string, feed: string): Deal[] {
  const items = xml.match(/<item>[\s\S]*?<\/item>/g) ?? [];
  return items
    .map((item) => {
      const tag = (name: string) => item.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`))?.[1];
      const merchant = item.match(/<pepper:merchant([^>]*)\/>/)?.[1] ?? '';
      const attr = (n: string) => merchant.match(new RegExp(`${n}="([^"]*)"`))?.[1];
      const link = decode(tag('link') ?? '');
      return {
        title: decode(tag('title') ?? ''),
        price: attr('price') ? decode(attr('price')!) : undefined,
        merchant: attr('name') ? decode(attr('name')!) : undefined,
        link,
        date: tag('pubDate') ? new Date(decode(tag('pubDate')!)).toISOString() : '',
        feed,
      };
    })
    .filter((d) => d.title && /^https:\/\/www\.dealabs\.com\//.test(d.link));
}
