import { describe, expect, it } from 'vitest';
import type { SavingsMovement } from '../../db/schema';
import { balanceAt, ceilingBreaches, checkDeposit, plannedWithdrawals, projectAccount, rateAt, yearInterest } from './quinzaine';

const mv = (date: string, amount: number, kind?: SavingsMovement['kind']): SavingsMovement => ({ id: date + amount, accountId: 'a', date, amount, label: '', kind });
const flat3 = [{ from: '2000-01-01', rate: 0.03 }];

describe('taux', () => {
  const rates = [{ from: '2025-08-01', rate: 0.017 }, { from: '2025-02-01', rate: 0.024 }, { from: '2026-02-01', rate: 0.015 }];
  it('prend le taux en vigueur à la date', () => {
    expect(rateAt(rates, '2025-01-31')).toBe(0);
    expect(rateAt(rates, '2025-02-01')).toBe(0.024);
    expect(rateAt(rates, '2025-12-16')).toBe(0.017);
    expect(rateAt(rates, '2026-11-23')).toBe(0.015);
  });
});

describe('intérêts par quinzaine', () => {
  it('solde présent toute l’année = solde × taux', () => {
    // 10 000 € à 3 % présents depuis l'année précédente → 300 €
    expect(yearInterest([mv('2025-06-10', 1000000)], flat3, 2026).interest).toBe(30000);
  });

  it('un versement rapporte à partir de la quinzaine suivante', () => {
    // versé le 3 janvier → rapporte à partir du 16 janvier : 23 quinzaines
    expect(yearInterest([mv('2026-01-03', 1000000)], flat3, 2026).interest).toBe(Math.round((1000000 * 0.03 * 23) / 24));
    // versé le 15 janvier → même chose
    expect(yearInterest([mv('2026-01-15', 1000000)], flat3, 2026).interest).toBe(28750);
    // versé le 16 janvier → à partir du 1er février : 22 quinzaines
    expect(yearInterest([mv('2026-01-16', 1000000)], flat3, 2026).interest).toBe(27500);
    // versé le 1er janvier → à partir du 16 janvier aussi (règle stricte)
    expect(yearInterest([mv('2026-01-01', 1000000)], flat3, 2026).interest).toBe(28750);
  });

  it('un versement du 20 décembre rapporte dès le 1er janvier suivant', () => {
    expect(yearInterest([mv('2025-12-20', 1000000)], flat3, 2025).interest).toBe(0);
    expect(yearInterest([mv('2025-12-20', 1000000)], flat3, 2026).interest).toBe(30000);
  });

  it('un retrait cesse de rapporter dès le début de sa quinzaine', () => {
    // 10 000 € toute l'année, retrait de 2 400 € le 20 juin (quinzaine n°11)
    // → 11 quinzaines à 10 000 € + 13 quinzaines à 7 600 €
    const r = yearInterest([mv('2025-01-01', 1000000), mv('2026-06-20', -240000)], flat3, 2026);
    expect(r.interest).toBe(Math.round((1000000 * 11 + 760000 * 13) * 0.03 / 24));
    expect(r.quinzaines[10].balance).toBe(1000000);
    expect(r.quinzaines[11].balance).toBe(760000);
  });

  it('un retrait le 1er ou le 16 ne pénalise que sa propre quinzaine', () => {
    const r = yearInterest([mv('2025-01-01', 1000000), mv('2026-07-01', -1000000)], flat3, 2026);
    expect(r.quinzaines[11].balance).toBe(1000000); // 16-30 juin
    expect(r.quinzaines[12].balance).toBe(0); // 1-15 juillet
  });

  it('applique le changement de taux au 1er février et au 1er août', () => {
    const rates = [{ from: '2025-08-01', rate: 0.017 }, { from: '2026-02-01', rate: 0.015 }];
    // 12 000 € toute l'année 2026 : 2 quinzaines à 1,7 % + 22 à 1,5 %
    const r = yearInterest([mv('2025-01-01', 1200000)], rates, 2026);
    expect(r.interest).toBe(Math.round((1200000 * (0.017 * 2 + 0.015 * 22)) / 24));
    expect(r.quinzaines[1].rate).toBe(0.017);
    expect(r.quinzaines[2].rate).toBe(0.015);
  });

  it('cas réel : 22 950 € avec retraits de 600 € le 1er de chaque mois', () => {
    const moves = [mv('2025-10-10', 2295000), ...Array.from({ length: 12 }, (_, k) => mv(`2026-${String(k + 1).padStart(2, '0')}-01`, -60000))];
    const r = yearInterest(moves, flat3, 2026);
    // chaque retrait réduit le solde à partir de la 1re quinzaine de son mois
    let expected = 0;
    for (let q = 0; q < 24; q++) expected += ((2295000 - 60000 * (Math.floor(q / 2) + 1)) * 0.03) / 24;
    expect(r.interest).toBe(Math.round(expected));
  });
});

describe('plafond', () => {
  it('signale un versement qui dépasse le plafond', () => {
    expect(checkDeposit(2200000, 95000, 2295000)).toEqual({ exceeds: false, maxDeposit: 95000, excess: 0 });
    expect(checkDeposit(2200000, 100000, 2295000)).toEqual({ exceeds: true, maxDeposit: 95000, excess: 5000 });
    expect(checkDeposit(2200000, 100000, null).exceeds).toBe(false);
  });
  it('les intérêts capitalisés peuvent dépasser le plafond sans alerte', () => {
    const moves = [mv('2025-01-02', 2295000), mv('2025-12-31', 50000, 'interest'), mv('2026-03-01', 1000)];
    expect(ceilingBreaches(moves, 2295000).map((m) => m.date)).toEqual(['2026-03-01']);
    expect(ceilingBreaches(moves.slice(0, 2), 2295000)).toEqual([]);
    expect(balanceAt(moves, '2025-12-31')).toBe(2345000);
  });
});

describe('projection', () => {
  it('génère les retraits mensuels prévus', () => {
    expect(plannedWithdrawals('2026-11-23', '2027-02-15', 60000, 1).map((w) => w.date)).toEqual(['2026-12-01', '2027-01-01', '2027-02-01']);
    expect(plannedWithdrawals('2026-11-01', '2026-12-31', 60000, 1).map((w) => w.date)).toEqual(['2026-12-01']);
  });

  it('capitalise les intérêts et s’arrête quand le compte est vide', () => {
    const p = projectAccount({ movements: [mv('2025-12-20', 120000)], rates: flat3, today: '2026-01-01', until: '2027-12-31', monthlyWithdrawal: 60000, withdrawalDay: 5 });
    expect(p[0].withdrawals).toBe(120000); // seulement 2 retraits possibles
    // retrait du 5 janvier → effet dès le 1er janvier : 600 € productifs pendant 2 quinzaines, puis 0
    expect(p[0].interest).toBe(Math.round((60000 * 2 * 0.03) / 24));
    expect(p[0].endBalance).toBe(p[0].interest);
    expect(p).toHaveLength(2);
  });

  it('sans retrait : croissance composée annuelle', () => {
    const p = projectAccount({ movements: [mv('2025-06-01', 1000000)], rates: flat3, today: '2026-01-01', until: '2027-12-31', monthlyWithdrawal: 0, withdrawalDay: 1 });
    expect(p[0]).toMatchObject({ interest: 30000, endBalance: 1030000 });
    expect(p[1]).toMatchObject({ interest: 30900, endBalance: 1060900 });
  });
});
