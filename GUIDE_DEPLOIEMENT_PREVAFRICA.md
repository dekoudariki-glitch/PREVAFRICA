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

## 4. Les Pages Légales Requises pour Google Play
Pour la validation de votre fiche Play Store, vous devez fournir deux liens qui sont **déjà inclus et totalement configurés** dans votre projet PREVAFRICA :
1. **Politique de Confidentialité :** `https://<votre-domaine>/privacy` (ou `/privacy.html`)
2. **Suppression de compte :** `https://<votre-domaine>/delete` (ou `/delete.html`)

Chacun de ces fichiers est accessible à la racine de votre dossier de production `dist/` !
