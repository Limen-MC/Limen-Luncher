# LIMEN Launcher 3.4.1 — Nyven intégré

Fabric Loader 0.20.1, Fabric API 0.166.2+26.3 et Nyven 1.6.0 sont inclus dans les sources et dans le package Electron. Aucun déplacement manuel de mod n'est nécessaire chez les joueurs.

## Créer le .exe avec GitHub

1. Décompresser le ZIP.
2. Mettre le **contenu de LIMEN-Launcher/** à la racine du dépôt `Limen-MC/launcher` en remplaçant les anciens fichiers. Ne pas déposer seulement le ZIP ni ajouter un dossier LIMEN-Launcher supplémentaire au-dessus de package.json.
3. Inclure `app/runtime/` et ses JAR, `package-lock.json`, les fichiers JavaScript modifiés, les tests et `.github/workflows/build.yml`.
4. Pousser sur main ou master, ou lancer **Actions → Build LIMEN → Run workflow**.
5. À la fin, télécharger l'artefact **LIMEN-Windows** puis le décompresser pour récupérer `LIMEN Launcher-setup-3.4.1.exe`.

Le workflow construit également macOS et Linux. Il ne publie pas automatiquement de release GitHub.

## Fonctionnement

Au clic sur Jouer, le launcher valide les fichiers Minecraft via le système Mojang existant, vérifie les empreintes du pack embarqué, installe les deux mods dans l'instance limen-main, copie les bibliothèques Fabric dans le cache commun et démarre `KnotClient` avec le vrai client Minecraft 26.3.

Les anciennes copies des mods de même identifiant (`nyven`, `fabric-api`) sont déplacées dans `limen-mod-backups/` à côté du dossier mods. Les autres mods, shaders, mondes et configurations sont conservés. Le chemin de données personnalisé du joueur reste respecté.

Pour mettre à jour les mods à l'avenir, remplacer les JAR dans `app/runtime/mods/` et actualiser les noms/empreintes SHA-256 dans `app/runtime/bundle.json`, puis reconstruire le launcher. Le manifeste Fabric et les bibliothèques sont également dans app/runtime. Leur source est https://meta.fabricmc.net/v2/versions/loader/26.3/0.20.1/profile/json ; les licences originales sont conservées dans les JAR.

## Côté serveur

Le plugin Nyven 1.6 doit toujours être installé dans les plugins du lobby et le bot Nyven 1.6 doit être démarré. Le mod seul ne remplace pas ces composants. Installer également LimenAuth-Proxy et les clés serveur du pack privé. AuthMe/AuthMeVelocity doivent être retirés des plugins.

## Vérifications effectuées

- 14 tests automatisés réussis : fusion Fabric, arguments Java, classpath, installation locale, sauvegarde des doublons et contrôle d'intégrité.
- ESLint réussi.
- Les mods et les bibliothèques Fabric sont réellement inclus dans ce ZIP.
- Build de l'installateur Windows et essai graphique Minecraft non effectués ici. Le workflow GitHub et le premier lancement Windows restent à vérifier.
