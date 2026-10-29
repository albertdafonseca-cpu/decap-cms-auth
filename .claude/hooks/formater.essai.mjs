/**
 * .claude/hooks/formater.essai.mjs — exerce le hook de formatage, sans réseau.
 *
 * Lancer : `node .claude/hooks/formater.essai.mjs`.
 */
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { argumentsFormateur, fichierAFormater, formater } from './formater.mjs';

const R = '/depot';
/**
 * @param outil
 * @param p
 */
const ecrire = (outil, p) => ({ tool_name: outil, tool_input: { file_path: p } });

/** [libellé, entrée, attendu : chemin absolu ou null] */
const CAS = [
  ['Edit dans le dépôt', ecrire('Edit', `${R}/src/a.js`), `${R}/src/a.js`],
  ['Write dans le dépôt', ecrire('Write', `${R}/b.md`), `${R}/b.md`],
  ['MultiEdit dans le dépôt', ecrire('MultiEdit', `${R}/c.ts`), `${R}/c.ts`],
  ['chemin relatif', ecrire('Edit', 'src/a.js'), `${R}/src/a.js`],
  // Contre-cas
  ['lecture', ecrire('Read', `${R}/src/a.js`), null],
  ['commande shell', { tool_name: 'Bash', tool_input: { command: 'ls' } }, null],
  ['hors du dépôt', ecrire('Write', '/tmp/x.js'), null],
  ['remonte hors du dépôt', ecrire('Edit', `${R}/../autre/x.js`), null],
  ['dans node_modules', ecrire('Edit', `${R}/node_modules/p/x.js`), null],
  ['sans chemin', { tool_name: 'Edit', tool_input: {} }, null],
  ['entrée vide', {}, null],
];

let echecs = 0;

/**
 * @param libelle
 * @param ok
 */
const verifier = (libelle, ok) => {
  if (!ok) {
    echecs += 1;
    console.error(`✗ ${libelle}`);
  }
};

CAS.forEach(([libelle, entree, attendu]) => {
  verifier(libelle, fichierAFormater(entree, R) === attendu);
});
verifier(
  'biome : format --write',
  argumentsFormateur('biome', 'f').slice(0, 2).join(' ') === 'format --write',
);
verifier(
  'prettier : ignore les inconnus',
  argumentsFormateur('prettier', 'f').includes('--ignore-unknown'),
);

// Le vrai formateur du dépôt, sur un fichier jetable hors du dépôt.
const depot = fileURLToPath(new URL('../..', import.meta.url));
const fichier = fileURLToPath(import.meta.url);

const formateur = /FORMATEUR = '(\w+)'/.exec(
  readFileSync(fichier.replace('.essai', ''), 'utf8'),
)[1];

const bac = mkdtempSync(join(tmpdir(), 'formater-'));

try {
  symlinkSync(join(depot, 'node_modules'), join(bac, 'node_modules'));

  const cible = join(bac, 'laid.js');

  writeFileSync(cible, 'const   a={b:1}\n');
  verifier(`${formateur} a tourné`, formater(cible, bac, formateur));
  verifier(`${formateur} a reformaté`, readFileSync(cible, 'utf8') !== 'const   a={b:1}\n');
  verifier('fichier absent : rien', formater(join(bac, 'absent.js'), bac, formateur) === false);
  verifier('formateur absent : rien', formater(cible, bac, 'inexistant') === false);

  // Le protocole réel : toujours sortie 0, rien sur stdout.
  const hook = fileURLToPath(new URL('./formater.mjs', import.meta.url));

  /**
   * @param entree
   */
  const lancer = (entree) =>
    String(
      execFileSync(process.execPath, [hook], {
        input: entree,
        env: { ...process.env, CLAUDE_PROJECT_DIR: bac },
      }),
    );

  verifier('protocole : rien sur stdout', lancer(JSON.stringify(ecrire('Write', cible))) === '');
  verifier('JSON illisible : sortie 0', lancer('pas du json') === '');
} finally {
  rmSync(bac, { recursive: true, force: true });
}

const total = CAS.length + 8;

if (echecs) {
  console.error(`${echecs} échec(s) sur ${total}`);
  process.exit(1);
}

console.log(`formater : ${total} cas, tous conformes`);
