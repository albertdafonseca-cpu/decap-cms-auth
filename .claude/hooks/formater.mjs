/**
 * .claude/hooks/formater.mjs — hook PostToolUse de Claude Code.
 *
 * Après chaque écriture d'une session (Edit, MultiEdit, Write), reformate le
 * fichier avec le formateur du dépôt, tel que la CI le vérifie. Une session
 * n'a donc plus à lancer le formateur à la main, et ne pousse plus un fichier
 * que le contrôle de mise en forme refuserait.
 *
 * Ce qui est formaté, et rien d'autre :
 *  - le fichier écrit, jamais le dépôt entier ;
 *  - seulement s'il est DANS le dépôt ;
 *  - avec le binaire LOCAL (`node_modules/.bin`), jamais `npx` : pas de
 *    téléchargement, et la version est celle du lockfile ;
 *  - selon la configuration du dépôt : ses fichiers ignorés et son périmètre
 *    restent ce qu'ils sont.
 *
 * Silencieux dans tous les cas, sortie 0 : un fichier qui ne se formate pas
 * (erreur de syntaxe, formateur absent) n'empêche rien. Le contrôle de la CI
 * reste le juge.
 *
 * Éprouvé par `.claude/hooks/formater.essai.mjs`.
 */
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, join, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

// ── Réglage propre à ce dépôt ───────────────────────────────────────────────
/** `prettier` ou `biome`. */
const FORMATEUR = 'prettier';
// ────────────────────────────────────────────────────────────────────────────
const OUTILS_ECRITURE = new Set(['Edit', 'MultiEdit', 'Write']);

/**
 * Chemin absolu du fichier à formater, ou `null` s'il n'y a rien à faire.
 * @param entree
 * @param racine
 */
export function fichierAFormater(entree, racine) {
  if (!OUTILS_ECRITURE.has(entree?.tool_name)) return null;

  const chemin = entree?.tool_input?.file_path;

  if (typeof chemin !== 'string' || !chemin || !racine) return null;

  const absolu = resolve(racine, chemin);
  const rel = relative(racine, absolu);

  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null;
  if (rel.split(/[\\/]/).includes('node_modules')) return null;
  return absolu;
}

/**
 * Arguments de la ligne de commande du formateur pour un fichier.
 * @param formateur
 * @param fichier
 */
export function argumentsFormateur(formateur, fichier) {
  if (formateur === 'biome') {
    return ['format', '--write', '--no-errors-on-unmatched', fichier];
  }

  return ['--write', '--ignore-unknown', '--log-level', 'silent', fichier];
}

/**
 * Lance le formateur local ; rend `true` s'il a tourné sans erreur.
 * @param fichier
 * @param racine
 * @param formateur
 */
export function formater(fichier, racine, formateur = FORMATEUR) {
  const binaire = join(racine, 'node_modules', '.bin', formateur);

  if (!existsSync(binaire) || !existsSync(fichier)) return false;

  try {
    execFileSync(binaire, argumentsFormateur(formateur, fichier), {
      cwd: racine,
      stdio: 'ignore',
      timeout: 20000,
    });
    return true;
  } catch {
    return false;
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    const racine = process.env.CLAUDE_PROJECT_DIR;
    const fichier = fichierAFormater(JSON.parse(readFileSync(0, 'utf8')), racine);

    if (fichier) formater(fichier, racine);
  } catch {
    // Un hook qui plante ne doit rien bloquer.
  }

  process.exit(0);
}
