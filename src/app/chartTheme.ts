/**
 * Couleurs des graphiques. Palette catégorielle validée (lisible par les daltoniens,
 * contrastes vérifiés) en mode clair, avec ses équivalents ajustés pour le mode sombre.
 */
export const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#6250d6', '#e34948'];
const DARK_STEPS: Record<string, string> = {
  '#2a78d6': '#3987e5',
  '#eb6834': '#d95926',
  '#1baf7a': '#199e70',
  '#eda100': '#c98500',
  '#e87ba4': '#d55181',
  '#008300': '#0ca30c',
  '#6250d6': '#9085e9',
  '#e34948': '#e66767',
};

/** Couleur d'une série selon le thème (les couleurs choisies par l'utilisateur restent telles quelles). */
export const seriesColor = (hex: string, dark: boolean) => (dark ? (DARK_STEPS[hex.toLowerCase()] ?? hex) : hex);

export function chartChrome(dark: boolean) {
  return {
    surface: dark ? '#0f172a' : '#ffffff',
    grid: dark ? '#1e293b' : '#e2e8f0',
    axis: dark ? '#94a3b8' : '#64748b',
    text: dark ? '#e2e8f0' : '#0f172a',
    income: seriesColor(CATEGORICAL[0], dark),
    spent: seriesColor(CATEGORICAL[1], dark),
  };
}
