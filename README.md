# Mise à jour 3.4.1 — Nyven et Fabric intégrés

Voir **INSTALLER-MODS-LIMEN.md** pour la construction GitHub et les mods embarqués.

# LIMEN Launcher 3.1.2

Launcher Electron pour **LIMEN Serveur**, basé sur Helios Launcher. Interface française, palette bordeaux / ivoire / or, médias LIMEN fournis et connexion Microsoft.

## Version 3.1.2 — interface simplifiée

L'adresse du serveur n'est plus affichée ni copiable sur l'accueil. La connexion automatique conserve la destination configurée dans le projet. L'identifiant de l'application Discord est intégré à `app/config/limen.json` ; aucun champ dans l'interface ne permet de le remplacer et l'ancien fichier local `limen-presence.json` est ignoré.

Les boutons Actualités, Tout voir et la carte des nouvelles ouvrent une page dédiée : liste des articles, lecture, recherche et retour à l'accueil. Le contenu se gère dans `news` de `app/config/limen.json` : `label`, `title`, `text` (résumé) et facultativement `body` (texte complet ou liste de paragraphes). Les textes sont affichés sans interprétation HTML.

## Correctif 3.1.1 — disposition

Paramètres : menu fixe, marges communes, colonnes alignées, panneaux Discord et chemins de fichiers contenus dans la fenêtre. Nom du joueur remis dans son badge, bannière des actualités alignée en haut, logo LIMEN réparé dans Mods / Java. Dialogue d'erreur élargi, texte lisible et défilant, bouton toujours accessible. Contrôles des sept onglets à 1920×1032, 1280×820 et 1000×720 ; captures dans `docs/layout/`.

Démarrage : les fichiers natifs sont maintenant extraits complètement avant de lancer Java. Les JAR natifs restent dans le classpath. Cette correction traite un défaut réel de préparation susceptible de produire l'erreur LWJGL montrée dans les captures ; le lancement réel reste à confirmer sur Windows.

## Démarrer sous Windows

1. Installer **Node.js 22 LTS** depuis <https://nodejs.org>.
2. Extraire **tout** le ZIP dans un dossier, par exemple `Bureau\LIMEN-Launcher`.
3. Double-cliquer sur **LANCER_LIMEN.bat**. La première ouverture télécharge les dépendances.
4. Se connecter avec un compte Microsoft possédant Minecraft Java.
5. Cliquer sur **Jouer à LIMEN**. Java peut être installé automatiquement après confirmation dans le launcher.

Le profil fourni cible **Minecraft Java 26.3 / Java 25**, selon la version de serveur indiquée pour ce projet. Le serveur configuré est **txadmin.sanna.studio:30121**. Si ton proxy utilise une autre version, modifier `server.minecraftVersion` et `server.javaMajor` dans `app/config/limen.json`. Aucun changement n’a été effectué sur le serveur lui-même.

## Fabriquer l’installateur Windows

Double-cliquer sur **CONSTRUIRE_WINDOWS.bat**. Le `.exe` est créé dans `dist/`. Ce ZIP est le **projet source complet**, pas un installateur Windows précompilé. Une signature Windows nécessite ton propre certificat ; le projet n’en inclut pas.

En ligne de commande :

```sh
npm ci
npm test
npm run lint
npm start
npm run dist:win
```

Le workflow GitHub **Build LIMEN** peut aussi générer les artefacts Windows, macOS et Linux après dépôt des fichiers dans ton repository. Il ne publie pas de release automatiquement. Les mises à jour automatiques sont désactivées par défaut tant qu’aucune release LIMEN n’est prête.

## Discord : afficher « LIMEN Serveur »

L’intégration est **native au launcher** : aucun plugin serveur et aucun mod ne sont nécessaires si le launcher reste ouvert pendant le jeu.

L'application Discord du projet est déjà configurée avec l'identifiant fourni par le propriétaire. Les joueurs n'ont rien à saisir dans le launcher. Ouvrir Discord Desktop, autoriser le partage d'activité dans ses réglages et laisser le launcher ouvert pendant Minecraft.

Pour le propriétaire : les paramètres se modifient uniquement dans `app/config/limen.json`, avant compilation. Dans l'application Discord correspondante, utiliser le nom **LIMEN Serveur** et l'image `app/assets/brand/logos/embleme.png` comme asset **limen**. La modification du nom ou des assets se fait depuis le compte Discord propriétaire de cette application.

Si Discord est lancé après Minecraft, le launcher réessaie la connexion toutes les 15 secondes. Les erreurs de présence ne bloquent pas le jeu. La présence s’arrête à la fermeture de Minecraft.

Discord peut continuer à détecter Minecraft comme application enregistrée distincte. Au besoin, désactiver son affichage dans **Jeux enregistrés** tout en laissant le partage d’activité autorisé. Le launcher ne modifie pas les préférences personnelles de Discord.

Les MP4 de ton pack sont utilisés **dans le launcher**, pas comme assets animés de Rich Presence. Les assets téléversés à Discord pour cette intégration sont des images statiques.

### Si tu veux jouer sans garder le launcher ouvert

Option facultative : **CraftPresence**, à installer côté **client**, dans le dossier `mods` d’un profil avec Fabric / Forge / NeoForge compatible avec la version exacte de Minecraft : <https://modrinth.com/mod/craftpresence>. Ce n’est pas un plugin Paper / Velocity à mettre sur le serveur. Le profil livré ici est vanilla ; il n’installe ni Fabric ni CraftPresence. Éviter de faire fonctionner deux émetteurs Rich Presence concurrents pour la même session.

## Personnalisation centralisée

Modifier **app/config/limen.json** :

- `server.address` : IP et port de jeu.
- `server.minecraftVersion` / `server.javaMajor` : version du client et Java.
- `discord.clientId` : identité publique intégrée au projet, sans remplacement par un réglage local.
- `discordInvite`, `websiteUrl`, `shopUrl` : tes liens réels. Les liens Discord et boutique sont volontairement vides, aucun lien n’ayant été fourni.
- `news` : nouvelles locales, sans chargement de contenu HTML externe.
- `azureClientId` : ID public de ton application Microsoft Entra.

**Microsoft :** le mécanisme et l’ID client public Helios du projet original sont conservés comme repli si `azureClientId` est vide. Pour distribuer LIMEN avec ta propre identité Microsoft, créer/enregistrer ta propre application et renseigner son ID, en suivant `docs/MicrosoftAuth.md`. Aucun secret Microsoft ou token de bot Discord ne doit être ajouté au projet. Le fonctionnement de l’autorisation dépend de Microsoft et n’a pas été validé avec un compte réel dans cet environnement.

## Visuels et animations

- `app/assets/brand/portail-limen.png` : décor original créé pour LIMEN, intégré en plein écran.
- `Logo_Alpha.webm` : logo horizontal flottant, 720×200, boucle 4 secondes.
- `Embleme_Alpha.webm` : emblème, 512×280, boucle 4 secondes.
- `Particules_Alpha.webm` : particules dorées, 1280×720, boucle 6 secondes.

Ces trois WebM VP9 ont un véritable canal alpha, vérifié après décodage. Les PNG des logos servent de repli. La présence Discord conserve une image statique. Les MP4 du pack précédent sont conservés ; ils n'ont pas de transparence. L'introduction et le chargement utilisent encore ces MP4. Le bouton de pause et la préférence de réduction des animations sont respectés.

## Si Minecraft ne démarre pas

Le bouton **Journal de lancement** ouvre le dossier des diagnostics. Le fichier `dernier-lancement.log` est réécrit à chaque tentative, limité à environ 2 Mo et masque les jetons du compte. Un arrêt anormal affiche son code et les dernières lignes. Ne publie pas de journaux sans les relire : ils peuvent contenir ton pseudo et des chemins locaux.

Cette révision corrige des défauts du code : absence de configuration de mods en Vanilla, exception sur avertissements de dépréciation Node, temporisation de chargement toujours active après fermeture du jeu, erreurs de préparation non affichées et fermeture anormale sans explication. Les arguments de résolution ne modifient plus le manifeste de jeu en mémoire. Les messages d'erreur sont affichés comme texte, sans interprétation HTML.

Les vidéos de référence montrent surtout Paladium, notamment son jeu qui ne répond plus. Elles ne donnent pas le journal de la panne LIMEN. La cause exacte sur ton PC reste donc à confirmer avec le nouveau journal ; aucun lancement Minecraft réel n'est certifié ici.

## Références de style

Disposition inspirée de tes captures (navigation latérale, décor plein écran, connexion Microsoft centrée). Logos LIMEN fournis, décor original et animations créées pour cette révision. Aucun logo, vidéo, illustration ou texte juridique Paladium n'est intégré. Les liens CGU/CGV fournis servent de référence ; ils ne constituent pas les conditions de LIMEN.

## Validation et limites

- Tests unitaires : catalogue local, adresse/port, arguments vanilla, client.jar, manifeste non modifié, vérification des hashes, reconnexion Discord, rendu EJS et références de médias.
- Analyse ESLint.
- Captures de l’accueil dans Electron et parcours des vues de démarrage, compte et paramètres.
- Assemblage Linux non installable (`--dir`) vérifié ; l’installateur Windows doit être construit et testé sous Windows ou via le workflow.
- Connexion à Minecraft et présence sur un vrai compte Discord : **à vérifier sur ton PC**. Aucun compte utilisateur n’a été utilisé et le serveur n’a pas pu être interrogé depuis cet environnement.

La base Helios est conservée pour l’authentification, la gestion des fichiers et de Java. Les crédits et licences amont sont conservés dans `LICENSE.txt`. Aucune modification n’a été poussée sur GitHub depuis cette livraison.
