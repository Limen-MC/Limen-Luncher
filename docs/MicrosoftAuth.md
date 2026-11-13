# Identité Microsoft de LIMEN

Le launcher conserve la connexion Microsoft du fork Helios. Pour utiliser ta propre identité d’application, renseigne `azureClientId` dans `app/config/limen.json`.

1. Dans le centre Microsoft Entra, créer une inscription d’application pour **LIMEN Launcher**, compatible avec les comptes Microsoft personnels.
2. Dans **Authentication → Add a platform → Mobile and desktop applications**, ajouter l’URI de redirection exacte :
   `https://login.microsoftonline.com/common/oauth2/nativeclient`
3. Copier **Application (client) ID** dans `azureClientId`. Il s’agit d’un identifiant public.
4. Vérifier la connexion avec un compte de test qui possède Minecraft Java. Une nouvelle application peut nécessiter l’autorisation de Microsoft/Minecraft pour accéder à Minecraft Services ; une inscription Entra seule ne garantit pas cet accès. Suivre les instructions officielles actuelles de Minecraft si une erreur d’enregistrement d’application apparaît.

Un launcher de bureau est un client public : **ne pas y intégrer de secret client**. Ne jamais ajouter un mot de passe ou un token de compte au dépôt.

Si `azureClientId` reste vide, l’ID public d’origine Helios est utilisé comme auparavant. Son autorisation n’a pas été vérifiée ici avec un vrai compte. Pour une distribution publique sous l’identité LIMEN, configurer et valider sa propre application.

Références officielles :

- https://learn.microsoft.com/en-us/entra/identity-platform/scenario-desktop-app-configuration
- https://learn.microsoft.com/en-us/entra/identity-platform/how-to-add-redirect-uri
- https://help.minecraft.net/
