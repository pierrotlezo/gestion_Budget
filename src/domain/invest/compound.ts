/**
 * Intérêts composés : capital de départ + versements mensuels + rendement annuel supposé.
 * Le rendement est converti en taux mensuel équivalent : (1 + r)^(1/12) − 1.
 * Les versements sont faits en fin de mois.
 */
import type { Cents } from '../money';

export interface SimInput {
  initial: Cents;
  monthly: Cents;
  years: number;
  annualReturn: number;
}

export interface SimPoint {
  year: number;
  contributed: Cents;
  value: Cents;
  gains: Cents;
}

export const monthlyRate = (annual: number) => Math.pow(1 + annual, 1 / 12) - 1;

/** Valeur année par année (année 0 = aujourd'hui). */
export function simulate({ initial, monthly, years, annualReturn }: SimInput): SimPoint[] {
  const r = monthlyRate(annualReturn);
  let value = initial;
  let contributed = initial;
  const points: SimPoint[] = [{ year: 0, contributed, value, gains: 0 }];
  for (let m = 1; m <= Math.round(years * 12); m++) {
    value = value * (1 + r) + monthly;
    contributed += monthly;
    if (m % 12 === 0) points.push({ year: m / 12, contributed, value: Math.round(value), gains: Math.round(value) - contributed });
  }
  return points;
}

/** Nombre de mois pour atteindre `target` (null si jamais atteint en 100 ans). */
export function monthsToTarget(current: Cents, monthly: Cents, annualReturn: number, target: Cents): number | null {
  if (current >= target) return 0;
  const r = monthlyRate(annualReturn);
  let value = current;
  for (let m = 1; m <= 1200; m++) {
    value = value * (1 + r) + monthly;
    if (value >= target) return m;
  }
  return null;
}

/** Versement mensuel nécessaire pour passer de `current` à `target` en `months` mois. */
export function requiredMonthly(current: Cents, target: Cents, months: number, annualReturn: number): Cents {
  if (months <= 0) return Math.max(0, target - current);
  const r = monthlyRate(annualReturn);
  const growth = Math.pow(1 + r, months);
  const missing = target - current * growth;
  if (missing <= 0) return 0;
  return Math.ceil(r === 0 ? missing / months : (missing * r) / (growth - 1));
}
