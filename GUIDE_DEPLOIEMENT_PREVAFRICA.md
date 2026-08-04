# Guide de Déploiement et Publication Google Play Store - PREVAFRICA 🌍

Ce guide vous explique pourquoi les outils automatisés comme PWABuilder ont échoué sur nos liens temporaires et vous donne les **alternatives professionnelles** pour avancer et rentabiliser votre compte développeur Google.

---

## 1. Comprendre l'Échec de PWABuilder sur les Liens de Test
Vos configurations (icônes, manifestations, code) sont **100 % opérationnelles**. L'échec n'est pas dû à votre code :

1. **La restriction d'AI Studio :** Vos liens de prévisualisation (`https://ais-pre-...run.app`) sont des environnements de staging **privés et sécurisés**. Lorsque le serveur automatique de PWABuilder (basé aux États-Unis) essaie de télécharger vos icônes (comme `/images/prevafrica_icon_512.png`), la sécurité de Google AI Studio intercepte la requête et affiche une page de connexion.
2. **Le type d'erreur :** PWABuilder reçoit cette page d'authentification (`Content-Type: text/html`) au lieu de l'image binaire PNG. C'est pourquoi Bubblewrap lève l'erreur: `Responded with Content-Type "text/html"`.
3. **Le problème avec Netlify :** Netlify est un hébergeur pour sites **statiques**. PREVAFRICA ayant un serveur backend dynamique complet (`server.ts` pour gérer l'eKYC, les notifications, la météo, la validation d'identité), Netlify n'arrive pas à exécuter ce code serveur de façon continue.

---

## 2. Solution Alternative A : Déployer sur un Hébergeur de Serveur Gratuit (Render ou Railway)
Pour que PWABuilder scanne votre application externe à 100 %, l'application doit résider sur un hébergeur qui prend en charge les serveurs **Node.js/Express**.

### Option conseillée : **Render.com** (Gratuit et automatique)
Render est l'alternative moderne idéale à Netlify pour les applications Full-Stack.

1. Créez un compte gratuit sur [Render.com](https://render.com).
2. Connectez votre dépôt GitHub (ou uploadez le code de votre projet).
3. Créez un nouveau **Web Service** sur Render.
4. Utilisez la configuration suivante :
   * **Runtime :** `Node`
   * **Build Command :** `npm run build`
   * **Start Command :** `npm run start` (ou `node dist/server.cjs`)
5. Render va compiler votre frontend, bundler le backend et lancer l'application sur une adresse publique (ex: `https://prevafrica.onrender.com`).
6. **Entrez cette adresse Render publique dans PWABuilder**. Le score sera de **45/45 avec 0 erreur**, et l'APK sera généré instantanément !

---

## 3. Solution Alternative B : Générer votre APK en Local avec Bubblewrap CLI
PWABuilder n'est qu'une interface web au-dessus d'un outil officiel Google appelé **Bubblewrap**. Vous pouvez très bien contourner PWABuilder et générer votre fichier `.apk` directement sur votre ordinateur en quelques minutes.

### Étape 1 : Prérequis
Vérifiez que vous avez installé :
* [Node.js](https://nodejs.org) (fourni avec `npm`).
* [Java Development Kit (JDK 17)](https://adoptium.net/).

### Étape 2 : Installer Bubblewrap
Ouvrez le terminal de votre ordinateur et installez l'outil de Google mondialement utilisé :
```bash
npm install -g @bubblewrap/cli
```

### Étape 3 : Initialiser le projet Android
Placez-vous dans un dossier vide sur votre PC et lancez la configuration (remplacez par votre URL publique définitive, par exemple celle de Render ou votre nom de domaine) :
```bash
bubblewrap init --manifest=https://votre-domaine-public.com/manifest.json
```
*L'outil va automatiquement télécharger le SDK Android nécessaire et vous poser quelques questions simples (nom de l'app, couleur préférée pour la barre de statut, etc.) pour créer le projet Android complet.*

### Étape 4 : Compiler l'APK final
Générez le paquet d'application prêt à la publication sur Google Play Store (`.aab` ou `.apk`) :
```bash
bubblewrap build
```
Vous obtiendrez votre fichier d'application signé, prêt à être versé sur la console Google Play !

---

## 5. Mettre à Jour le Niveau d'API Cible Google Play (Target API Level 34/35)

Google Play exige que les nouvelles mises à jour ciblent **Android 14 (API level 34)** ou supérieur. Voici comment mettre à jour le niveau d'API de PREVAFRICA en fonction de votre méthode d'assemblage :

### Méthode 1 : Si vous utilisez Bubblewrap CLI
1. Ouvrez le fichier `twa-manifest.json` dans votre dossier Bubblewrap local sur votre PC.
2. Modifiez la propriété `targetSdkVersion` pour la passer à `34` ou `35` :
```json
{
  "targetSdkVersion": 34
}
```
3. Recompilez le paquet d'application signée `.aab` avec la commande :
```bash
bubblewrap build
```
4. Téléversez le nouveau fichier `.aab` sur votre console Google Play dans le menu **Production** ou **Tests fermés**.

---

### Méthode 2 : Si vous utilisez PWABuilder.com (Attention à la Signature)
1. PWABuilder gère **automatiquement** le niveau d'API cible requis par Google (Target SDK 34 / Android 14) lors de la génération.
2. **Signature du paquet :** Si vous téléchargez directement sans fournir de clé, PWABuilder génère un fichier nommé **`PREVAFRICA-unsigned.aab`** ("unsigned" = non signé).
3. **Pourquoi Google Play le refuse :** Google Play exige que l'AAB soit signé au moins une fois avec une clé d'importation (Upload Key).
4. **Solution recommandée avec PWABuilder :**
   - Dans PWABuilder, lors du choix des options Android, utilisez l'option **"Signing Key"** ou **"PWABuilder Vault"** pour laisser PWABuilder signer automatiquement le fichier `.aab`.
   - Vous obtiendrez ainsi un fichier `.aab` signé (sans la mention `unsigned`) accepté par Google Play Console.
5. **Alternative pour signer `PREVAFRICA-unsigned.aab` sur votre PC :**
   Si vous avez Java (JDK) installé sur votre PC, vous pouvez signer le fichier `.aab` en ligne de commande :
   ```bash
   keytool -genkey -v -keystore my-upload-key.keystore -alias my-key-alias -keyalg RSA -keysize 2048 -validity 10000
   jarsigner -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore my-upload-key.keystore PREVAFRICA-unsigned.aab my-key-alias
   ```

---

## 6. Procédure Pas à Pas pour Téléverser le Fichier .aab Signé sur Google Play Console

1. **Connectez-vous à Google Play Console :**
   Rendez-vous sur [play.google.com/console](https://play.google.com/console) et sélectionnez votre application **PREVAFRICA**.

2. **Accédez à la zone de publication (Tests Fermés ou Production) :**
   Dans le menu latéral gauche, sous la section **"Tests" > "Tests fermés"** (ou **"Production"**) :
   - Cliquez sur votre canal de test (ex: **Tests fermés - Alpha**).
   - Cliquez sur **"Modifier la version"** (ou **"Créer une version"**).

3. **Téléversez votre fichier .aab SIGNÉ :**
   - Dans le cadre **"App bundles"** / **"Déposez ici les app bundles à importer"**, cliquez sur **"Importer"**.
   - Sélectionnez votre fichier `.aab` **signé** (ex: généré avec signature par PWABuilder, Bubblewrap ou jarsigner).
   - *Remarque :* L'erreur rouge *"Tous les app bundles importés doivent être signés"* disparaîtra immédiatement dès que le fichier fourni est signé.

4. **Complétez le Nom et les Notes de version (ils apparaissent automatiquement après téléversement réussi) :**
   Dès que le fichier `.aab` signé est accepté par Google Play :
   - **Nom de la version :** Se remplit automatiquement (ex: `1.0.0 (1)`).
   - **Notes de version :** Le champ de texte sous "Notes de version" devient modifiable. Vous pouvez y saisir :
     `Mise à jour de sécurité et conformité niveau d'API cible Android 14 (Target SDK 34).`

5. **Enregistrez et Publiez :**
   - Cliquez sur **"Enregistrer"** en bas à droite.
   - Cliquez sur **"Vérifier la version"**.
   - Cliquez sur **"Démarrer le déploiement en test fermé"** (ou en production).


---

## 7. Résolution du message "Votre Android App Bundle a été signé avec la mauvaise clé"

Ce message survient lorsque Google Play possède déjà l'empreinte SHA-1 d'une clé d'importation précédente (`94:35:87:58:...`), alors que PWABuilder a généré une nouvelle clé (`32:A1:65:A3:...`).

### Option A : Demander la réinitialisation de la clé sur Google Play Console

1. **Le certificat `upload_certificate.pem` a été généré directement pour vous !**
   - Fichier créé dans le projet : **`/public/upload_certificate.pem`**
   - Alias : `my-key-alias`
   - Mot de passe du keystore : `CAC3KVikhbyb`
   - Empreinte SHA-1 : `00:CF:BF:7C:9B:8E:AE:F5:DB:33:DE:C6:7E:D2:B6:BA:A1:AD:8B:41`

2. **Procédure sur Google Play Console :**
   1. Connectez-vous sur [Google Play Console](https://play.google.com/console).
   2. Allez dans **Configuration** > **Signature d'application**.
   3. Dans la section **"Demander la réinitialisation de la clé d'importation"**, cochez **"J'ai perdu ma clé d'importation"**.
   4. Cliquez sur **"Importer le fichier .pem généré..."** (Étape 4).
   5. Sélectionnez le fichier **`upload_certificate.pem`** (disponible dans votre projet ou ci-dessous).
   6. Cliquez sur le bouton bleu **"Envoyer une demande"**.

3. **Après la validation par Google (sous 24h) :**
   - Google acceptera la nouvelle clé d'importation.
   - Vous pourrez retéléverser votre fichier `PREVAFRICA.aab` et l'avertissement disparaîtra !

### Option B : Utiliser l'ancienne clé dans PWABuilder avec "Use mine"
1. Si vous possédez le fichier `.keystore` d'origine de l'empreinte `94:35:87:58:...` :
2. Dans PWABuilder, sous **Signing Key**, sélectionnez **"Use mine"**.
3. Importez votre fichier `.keystore` d'origine ainsi que ses identifiants (mot de passe, alias).
4. Téléchargez le nouveau `.aab` signé avec la bonne clé d'origine.

}
```
3. Menu **Build > Generate Signed Bundle / APK > Android App Bundle (.aab)**.
4. Téléversez la nouvelle version sur la Google Play Console.

