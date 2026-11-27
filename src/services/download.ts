/**
 * Enregistrement d'un fichier généré dans l'appli (CSV, sauvegarde JSON), sans aucun envoi réseau.
 *
 * - Sur téléphone (iPhone notamment, surtout dans l'appli ajoutée à l'écran d'accueil), le téléchargement
 *   classique ne marche pas toujours : on ouvre la feuille de partage (« Enregistrer dans Fichiers », AirDrop…).
 *   iOS n'autorise le partage que directement dans le geste de l'utilisateur : appeler cette fonction
 *   immédiatement dans le clic, avec un contenu déjà prêt (pas après une lecture asynchrone).
 * - Sinon : lien de téléchargement ajouté à la page, et fichier temporaire libéré seulement après coup
 *   (le libérer tout de suite annule le téléchargement dans Safari et certains navigateurs).
 */
export type SaveResult = 'shared' | 'downloaded' | 'cancelled';

const isTouchDevice = () => window.matchMedia?.('(pointer: coarse)').matches ?? false;

export async function saveFile(name: string, content: string, type: string): Promise<SaveResult> {
  const file = new File([content], name, { type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (isTouchDevice() && nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: name });
      return 'shared';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'cancelled'; // l'utilisateur a fermé la feuille de partage
      // Partage refusé (ex. geste expiré) : on tente le téléchargement classique
    }
  }
  const url = URL.createObjectURL(file);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return 'downloaded';
}
