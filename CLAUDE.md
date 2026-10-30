# decap-cms-auth — consignes pour les sessions Claude

Worker Cloudflare d'authentification OAuth GitHub pour l'éditeur `/admin` (Decap CMS) du **wiki du SAV** (dépôt `wiki`). Il ne fait qu'échanger un code de connexion GitHub contre un jeton d'accès ; il ne voit jamais le contenu du site. Le wiki l'appelle par `base_url` de `public/admin/config.yml`.

Le code vient du modèle `github.com/sveltia/sveltia-cms-auth` (`README.md` en anglais est le sien, `.github/` aussi) et **n'a pas été modifié depuis l'import** (27/09/2026) : `src/index.js`, un seul fichier. Historique du nom (`sveltia-cms-auth` → `decap-cms-auth`) : `DECISIONS.md` et `EDITION.md` du wiki.

## Avant de modifier

- Un changement ici peut **couper la connexion à `/admin`** pour tout le monde. Le recours documenté (`docs/EXPLOITATION.md` du wiki) est l'édition directe sur github.com. Préférer ne pas toucher `src/index.js` sans demande.
- Garder le code proche du modèle amont : c'est ce qui permet de reprendre ses correctifs de sécurité. Un écart nécessaire se documente ici.
- Une demande imprécise : poser 3 questions avant d'agir. Tout en français (sauf les fichiers repris du modèle).

## Configuration (tableau de bord Cloudflare, jamais dans le dépôt)

Worker `decap-cms-auth` → Settings → Variables :

- `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET` (le second est un **secret**) ;
- `ALLOWED_DOMAINS` : les domaines du wiki autorisés à ouvrir la connexion.

Le code lit aussi `GITHUB_HOSTNAME` et les variables `GITLAB_*`, inutilisées ici. L'URL de rappel de l'application OAuth GitHub est `https://decap-cms-auth.<compte>.workers.dev/callback` : si le Worker change d'adresse, elle et `base_url` du wiki changent ensemble.

## Build et déploiement

- `wrangler.toml` : `main = "src/index.js"`, et un bloc `[previews]` vide, exigé par `wrangler preview` (aperçus de branche de Workers Builds).
- **Workers Builds** (Cloudflare) construit chaque poussée. `main` = production (`wrangler deploy`), une autre branche = aperçu. Décisions du 28/10/2026, qui ont remis ce build au vert après des échecs depuis l'import :
  - pnpm épinglé par `"packageManager": "pnpm@12.13.0"` dans `package.json`. Sans lui, Cloudflare prend pnpm 9, qui ne lit pas les `overrides` de `pnpm-workspace.yaml` et refuse le lockfile ;
  - le lockfile est écrit par pnpm 12 (il porte sa propre version) : le régénérer avec `pnpm install --lockfile-only` de la même version, jamais à la main ;
  - Node vient de `.nvmrc` (v26) ; `engineStrict: true` dans `pnpm-workspace.yaml`.
- Le journal d'un build en échec n'est **pas** transmis à GitHub (contrôle vide) : il faut le demander à l'utilisateur, depuis l'onglet **Builds** (et non Deployments) du Worker.
- Une session travaille sur sa branche et passe par une PR vers `main` ; fusion seulement sur demande explicite (elle déploie la production).

## Vérifier

```sh
pnpm install --frozen-lockfile        # pnpm 12.13.0 (npx -y pnpm@12.13.0 …)
pnpm run check                        # audit, cspell, prettier, eslint
npx wrangler deploy --dry-run --outdir dist   # le bundle se construit
```

## Sessions Claude Code

- `.claude/hooks/fichiers-sensibles.mjs` (PreToolUse) refuse la lecture et l'écriture des secrets (`.env*`, `.dev.vars`, clés…). Essai : `node .claude/hooks/fichiers-sensibles.essai.mjs`.
- `.claude/hooks/formater.mjs` (PostToolUse) passe prettier sur chaque fichier écrit par une session. Essai : `node .claude/hooks/formater.essai.mjs`.
