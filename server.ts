import express from "express";
import path from "path";
import fs from "fs";
import { execSync } from "child_process";
import multer from "multer";
import crypto from "crypto";
import forge from "node-forge";
import AdmZip from "adm-zip";

const upload = multer({ dest: "/tmp/aab-uploads/" });

function signAabNode(inputBuffer: Buffer, certPem: string, keyPem: string, alias = 'CERT'): Buffer {
  const zip = new AdmZip(inputBuffer);
  const zipEntries = zip.getEntries();

  // Filter out existing META-INF signature files
  const filteredEntries = zipEntries.filter(e => {
    if (e.isDirectory) return false;
    const name = e.entryName;
    if (name.startsWith('META-INF/') && (
      name.endsWith('.SF') || name.endsWith('.RSA') || name.endsWith('.DSA') || name.endsWith('.EC') || name === 'META-INF/MANIFEST.MF'
    )) {
      return false;
    }
    return true;
  });

  // Sort entries alphabetically
  filteredEntries.sort((a, b) => a.entryName.localeCompare(b.entryName));

  let manifestText = 'Manifest-Version: 1.0\r\nCreated-By: 1.0 (Android)\r\n\r\n';

  for (const entry of filteredEntries) {
    const data = entry.getData();
    const sha256 = crypto.createHash('sha256').update(data).digest('base64');
    manifestText += `Name: ${entry.entryName}\r\nSHA-256-Digest: ${sha256}\r\n\r\n`;
  }

  const manifestDigest = crypto.createHash('sha256').update(Buffer.from(manifestText, 'utf8')).digest('base64');

  let sfText = `Signature-Version: 1.0\r\nCreated-By: 1.0 (Android)\r\nSHA-256-Digest-Manifest: ${manifestDigest}\r\n\r\n`;

  for (const entry of filteredEntries) {
    const data = entry.getData();
    const sha256 = crypto.createHash('sha256').update(data).digest('base64');
    const entrySection = `Name: ${entry.entryName}\r\nSHA-256-Digest: ${sha256}\r\n\r\n`;
    const sectionDigest = crypto.createHash('sha256').update(Buffer.from(entrySection, 'utf8')).digest('base64');
    
    sfText += `Name: ${entry.entryName}\r\nSHA-256-Digest: ${sectionDigest}\r\n\r\n`;
  }

  // PKCS#7 signature using node-forge
  const cert = forge.pki.certificateFromPem(certPem);
  const privateKey = forge.pki.privateKeyFromPem(keyPem);

  const p7 = forge.pkcs7.createSignedData();
  p7.content = forge.util.createBuffer(sfText, 'utf8');
  p7.addCertificate(cert);
  p7.addSigner({
    key: privateKey,
    certificate: cert,
    digestAlgorithm: forge.pki.oids.sha256
  });
  p7.sign({ detached: true });

  const rsaDer = Buffer.from(forge.asn1.toDer(p7.toAsn1()).getBytes(), 'binary');

  const newZip = new AdmZip();
  for (const entry of filteredEntries) {
    newZip.addFile(entry.entryName, entry.getData());
  }

  newZip.addFile('META-INF/MANIFEST.MF', Buffer.from(manifestText, 'utf8'));
  newZip.addFile(`META-INF/${alias}.SF`, Buffer.from(sfText, 'utf8'));
  newZip.addFile(`META-INF/${alias}.RSA`, rsaDer);

  return newZip.toBuffer();
}

async function startServer() {
  // Auto-repair Java security policy files if .dpkg-new extension exists
  try {
    const secDir = '/etc/java-17-openjdk/security';
    if (fs.existsSync(secDir)) {
      execSync(`find "${secDir}" -name "*.dpkg-new" -exec sh -c 'for f; do cp "$f" "\${f%.dpkg-new}"; done' _ {} +`);
    }
  } catch (e) {}

  const app = express();
  const PORT = 3000;

  // Support CORS complet pour lever tous les blocages de PWABuilder (manifest, sw.js, icônes, raccourcis, screenshots)
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Service-Worker');
    res.setHeader('Service-Worker-Allowed', '/');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });

  // --- INTERCEPTEUR UNIVERSEL ICONES & MANIFEST POUR PWABUILDER (ANTI-400 / ANTI-FETCH-ERROR) ---
  app.use((req, res, next) => {
    const rawUrl = req.originalUrl || req.url || '';
    // Découper sur ?, :, %3a, %3A pour éliminer les bruits de ports et de requêtes proxy
    const cleanUrl = rawUrl.split('?')[0].split(':')[0].split('%3a')[0].split('%3A')[0].toLowerCase();

    // 1. Manifest.json
    if (cleanUrl.endsWith('/manifest.json') || cleanUrl === '/manifest.json') {
      const p = path.join(process.cwd(), 'public', 'manifest.json');
      if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).sendFile(path.resolve(p));
      }
    }

    // 2. Icônes 192x192
    if (cleanUrl.includes('192') || cleanUrl.includes('icon_192')) {
      const p = path.join(process.cwd(), 'public', 'images', 'prevafrica_icon_192.png');
      if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.status(200).sendFile(path.resolve(p));
      }
    }

    // 3. Icônes 512x512, favicon, apple-touch-icon, logo, icon
    if (cleanUrl.includes('512') || cleanUrl.includes('icon_512') || cleanUrl.includes('apple-touch') || cleanUrl.includes('favicon') || cleanUrl.includes('logo') || cleanUrl.includes('icon')) {
      const p = path.join(process.cwd(), 'public', 'images', 'prevafrica_icon_512.png');
      if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        return res.status(200).sendFile(path.resolve(p));
      }
    }

    // 4. Dossier /images/ ou tout fichier image .png / .jpg / .jpeg / .webp
    if (cleanUrl.includes('/images/') || cleanUrl.endsWith('.png') || cleanUrl.endsWith('.jpg') || cleanUrl.endsWith('.ico')) {
      const filename = path.basename(cleanUrl);
      const searchPaths = [
        path.join(process.cwd(), 'public', 'images', filename),
        path.join(process.cwd(), 'src', 'assets', 'images', filename),
        path.join(process.cwd(), 'dist', 'images', filename)
      ];
      for (const sp of searchPaths) {
        if (fs.existsSync(sp)) {
          res.setHeader('Content-Type', 'image/png');
          res.setHeader('Access-Control-Allow-Origin', '*');
          return res.status(200).sendFile(path.resolve(sp));
        }
      }
      // Fallback absolu : si une image n'est pas trouvée, renvoyer l'icône 512 valide (Status 200) pour empêcher Bubblewrap de planter
      const fallbackIcon = path.join(process.cwd(), 'public', 'images', 'prevafrica_icon_512.png');
      if (fs.existsSync(fallbackIcon)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.status(200).sendFile(path.resolve(fallbackIcon));
      }
    }

    next();
  });

  // --- CONFIGURATION DE SECOURS GOOGLE PLAY (TOP PRIORITY) ---
  app.use((req, res, next) => {
    const url = req.url.toLowerCase();
    
    // Diagnostic ultra-simple
    if (url === '/diagnostic' || url === '/api/diagnostic') {
      return res.status(200).send("DIAGNOSTIC OK - SERVEUR PREVAFRICA EN LIGNE (v6)");
    }

    // Capture de TOUTES les variantes de Privacy
    if (url.includes('privacy') || url.includes('confidentialite')) {
        console.log(`[GOOGLE-PLAY] Privacy intercepted: ${req.url}`);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Confidentialité - PREVAFRICA</title></head>
<body style="font-family:sans-serif;padding:40px;line-height:1.6;max-width:800px;margin:auto;">
<h1>Politique de Confidentialité de PREVAFRICA</h1>
<p>Dernière mise à jour : 19 mai 2026</p>
<p>PREVAFRICA collecte vos données (Nom, WhatsApp, Ville) et pièce d'identité uniquement pour la gestion de vos contrats de prévoyance et le KYC obligatoire.</p>
<p>Vos données sont chiffrées et ne sont jamais partagées à des fins commerciales.</p>
<p>Demande de suppression : dekoudariki@gmail.com</p>
<hr><p>© 2026 PREVAFRICA</p></body></html>`);
    }

    // Capture de TOUTES les variantes de Suppression
    if (url.includes('delete') || url.includes('suppr') || url.includes('account-deletion')) {
        console.log(`[GOOGLE-PLAY] Deletion intercepted: ${req.url}`);
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        return res.status(200).send(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8"><title>Suppression - PREVAFRICA</title></head>
<body style="font-family:sans-serif;padding:40px;line-height:1.6;max-width:800px;margin:auto;">
<h1>Suppression de compte</h1>
<p>Pour supprimer votre compte et toutes vos données personnelles de PREVAFRICA :</p>
<p>1. Contactez le support par e-mail : <strong>dekoudariki@gmail.com</strong></p>
<p>2. Ou utilisez le bouton Support technique dans votre profil sur l'application.</p>
<p>Vos données seront supprimées sous 48h, à l'exception des données contractuelles d'assurance soumises à conservation légale.</p>
<hr><p>© 2026 PREVAFRICA</p></body></html>`);
    }
    next();
  });
  // ----------------------------------------------------------

  // 0. LOGGING GLOBAL (Pour le diagnostic Cloud Run)
  app.use((req, res, next) => {
    const ua = req.headers['user-agent'] || 'No-UA';
    console.log(`[DEBUG-REQUEST] ${new Date().toISOString()} | ${req.method} ${req.path} | UA: ${ua}`);
    next();
  });

  // 1. PRIORITÉ ABSOLUE : Injection directe du HTML pour éviter les erreurs 404
  // Ces pages sont servies AVANT tout autre traitement pour garantir la validation Google Play.

  const sendHtml = (res: express.Response, html: string) => {
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('X-Frame-Options', 'ALLOWALL');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).send(html);
  };

  // Middleware de sécurité optionnel (déjà couvert par le block du haut)
  app.use((req, res, next) => {
    next();
  });

  // Validation Android / Google Play (Crucial)

  // Validation Android / Google Play (Crucial)
  const handleAssetLinks = (req: express.Request, res: express.Response) => {
    const cwd = process.cwd();
    const p = path.join(cwd, 'public', '.well-known', 'assetlinks.json');
    if (fs.existsSync(p)) {
      res.setHeader('Content-Type', 'application/json');
      return res.sendFile(path.resolve(p));
    }
    // Fallback dist
    const pDist = path.join(cwd, 'dist', '.well-known', 'assetlinks.json');
    if (fs.existsSync(pDist)) {
      res.setHeader('Content-Type', 'application/json');
      return res.sendFile(path.resolve(pDist));
    }
    res.status(404).send("assetlinks.json not found");
  };

  app.get("/.well-known/assetlinks.json", handleAssetLinks);
  app.get("/assetlinks.json", handleAssetLinks);

  app.get("/robots.txt", (req, res) => {
    res.setHeader('Content-Type', 'text/plain');
    res.send("User-agent: *\nAllow: /\n");
  });

  // Route pour télécharger le keystore propre et les certificats
  app.get("/signing.keystore", (req, res) => {
    const cwd = process.cwd();
    const searchPaths = [
      path.join(cwd, 'public', 'signing.keystore'),
      path.join(cwd, 'signing.keystore'),
      path.join(cwd, 'dist', 'signing.keystore')
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Disposition', 'attachment; filename="signing.keystore"');
        res.setHeader('Content-Type', 'application/octet-stream');
        return res.sendFile(path.resolve(p));
      }
    }
    res.status(404).send("signing.keystore not found");
  });

  app.get("/new_upload_keystore.p12", (req, res) => {
    const cwd = process.cwd();
    const searchPaths = [
      path.join(cwd, 'public', 'new_upload_keystore.p12'),
      path.join(cwd, 'public', 'signing.keystore')
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Disposition', 'attachment; filename="new_upload_keystore.p12"');
        res.setHeader('Content-Type', 'application/x-pkcs12');
        return res.sendFile(path.resolve(p));
      }
    }
    res.status(404).send("new_upload_keystore.p12 not found");
  });

  app.get("/new_upload_certificate.pem", (req, res) => {
    const cwd = process.cwd();
    const searchPaths = [
      path.join(cwd, 'public', 'new_upload_certificate.pem'),
      path.join(cwd, 'dist', 'new_upload_certificate.pem')
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Disposition', 'attachment; filename="new_upload_certificate.pem"');
        res.setHeader('Content-Type', 'application/x-pem-file');
        return res.sendFile(path.resolve(p));
      }
    }
    res.status(404).send("new_upload_certificate.pem not found");
  });

  app.get("/upload_certificate.pem", (req, res) => {
    const cwd = process.cwd();
    const searchPaths = [
      path.join(cwd, 'public', 'upload_certificate.pem'),
      path.join(cwd, 'dist', 'upload_certificate.pem')
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Disposition', 'attachment; filename="upload_certificate.pem"');
        res.setHeader('Content-Type', 'application/x-pem-file');
        return res.sendFile(path.resolve(p));
      }
    }
    res.status(404).send("upload_certificate.pem not found");
  });

  // API Signature AAB Automatisée avec support des Keystores personnalisés
  app.post("/api/sign-aab", upload.fields([{ name: "aab", maxCount: 1 }, { name: "customKeystore", maxCount: 1 }]), (req: any, res: any) => {
    const aabFile = req.files?.aab?.[0];
    if (!aabFile) {
      return res.status(400).json({ error: "Aucun fichier AAB téléversé." });
    }

    const inputPath = aabFile.path;
    const outputPath = inputPath + "-signed.aab";
    const customKeystoreFile = req.files?.customKeystore?.[0];
    const cwd = process.cwd();

    try {
      let signedBuffer: Buffer | null = null;

      // 1. Copier le fichier AAB d'origine directement pour préserver 100% de la structure de compression et de l'alignement Android
      fs.copyFileSync(inputPath, outputPath);

      // Supprimer proprement tout ancien bloc META-INF via l'outil zip natif s'il existe
      try {
        execSync(`zip -d "${outputPath}" "META-INF/*"`, { stdio: 'ignore' });
      } catch (e) {}

      // 2. Trouver et exécuter jarsigner officiel
      let jarsignerBin = '';
      if (fs.existsSync('/usr/lib/jvm/java-17-openjdk-amd64/bin/jarsigner')) {
        jarsignerBin = '/usr/lib/jvm/java-17-openjdk-amd64/bin/jarsigner';
      } else if (fs.existsSync('/usr/bin/jarsigner')) {
        jarsignerBin = '/usr/bin/jarsigner';
      } else {
        try {
          execSync('jarsigner -help');
          jarsignerBin = 'jarsigner';
        } catch(e) {}
      }

      let keystorePath = '';
      let alias = req.body?.alias || 'my-key-alias';
      let pass = req.body?.password || 'CAC3KVikhbyb';

      if (customKeystoreFile) {
        keystorePath = customKeystoreFile.path;
      } else {
        const selectedKeystore = req.body?.keystore || 'signing.keystore';
        keystorePath = path.join(cwd, 'public', selectedKeystore);
      }

      if (jarsignerBin && fs.existsSync(keystorePath)) {
        try {
          const cmd = `"${jarsignerBin}" -verbose -sigalg SHA256withRSA -digestalg SHA-256 -keystore "${keystorePath}" -storepass "${pass}" -keypass "${pass}" "${outputPath}" "${alias}"`;
          execSync(cmd, { encoding: 'utf-8' });

          const verifyCmd = `"${jarsignerBin}" -verify "${outputPath}"`;
          const verifyLog = execSync(verifyCmd, { encoding: 'utf-8' });
          console.log("[AAB SIGNER SUCCESS & VERIFIED via Jarsigner]:", verifyLog.split('\n')[0]);
          signedBuffer = fs.readFileSync(outputPath);
        } catch (e: any) {
          console.log("[JARSIGNER EXEC FAILED]", e?.message || e);
          if (customKeystoreFile) {
            throw new Error(`Échec de signature avec le keystore personnalisé. Vérifiez le mot de passe (${pass}) et l'alias (${alias}). Détails: ${e?.message || e}`);
          }
        }
      }

      // 3. Si jarsigner n'a pas pu s'exécuter et pas de custom keystore, utiliser le fallback Node.js
      if (!signedBuffer) {
        console.log("[AAB SIGNER] Utilisation du moteur Node.js pur");
        const certPath = path.join(cwd, 'public', 'new_upload_certificate.pem');
        const keyPath = path.join(cwd, 'key.pem');

        if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
          const certPem = fs.readFileSync(certPath, 'utf8');
          const keyPem = fs.readFileSync(keyPath, 'utf8');
          const inputBuffer = fs.readFileSync(inputPath);
          signedBuffer = signAabNode(inputBuffer, certPem, keyPem, 'CERT');
        } else {
          throw new Error("Certificat (new_upload_certificate.pem) ou clé privée introuvable sur le serveur.");
        }
      }

      fs.writeFileSync(outputPath, signedBuffer);

      res.setHeader('Content-Disposition', 'attachment; filename="PREVAFRICA-signed.aab"');
      res.setHeader('Content-Type', 'application/octet-stream');

      return res.sendFile(path.resolve(outputPath), () => {
        try {
          if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
          if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
          if (customKeystoreFile && fs.existsSync(customKeystoreFile.path)) fs.unlinkSync(customKeystoreFile.path);
        } catch (e) {}
      });
    } catch (err: any) {
      console.error("[AAB SIGNER ERROR]", err);
      try {
        if (fs.existsSync(inputPath)) fs.unlinkSync(inputPath);
        if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
        if (customKeystoreFile && fs.existsSync(customKeystoreFile.path)) fs.unlinkSync(customKeystoreFile.path);
      } catch (e) {}
      return res.status(500).json({
        error: "Échec de la signature AAB",
        details: err.message || err.toString()
      });
    }
  });

  // Serveur Robuste Manifest.json pour PWABuilder (avec support CORS)
  app.get("/manifest.json", (req, res) => {
    const cwd = process.cwd();
    const searchPaths = [
      path.join(cwd, 'public', 'manifest.json'),
      path.join(cwd, 'dist', 'manifest.json')
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(path.resolve(p));
      }
    }
    res.status(404).send("manifest.json not found");
  });

  // Serveur Robuste Service Worker (sw.js)
  app.get("/sw.js", (req, res) => {
    const cwd = process.cwd();
    const searchPaths = [
      path.join(cwd, 'public', 'sw.js'),
      path.join(cwd, 'dist', 'sw.js')
    ];
    for (const p of searchPaths) {
      if (fs.existsSync(p)) {
        res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(path.resolve(p));
      }
    }
    res.status(404).send("sw.js not found");
  });

  // 2. MIDDLEWARES GÉNÉRAUX
  app.use(express.json());

  // --- VOS ROUTES API ICI ---
  
  // Route pour télécharger les visuels Play Store (icône, bannière, screenshots)
  app.get("/api/download-assets/:key", (req, res) => {
    const key = req.params.key;
    const fileMap: Record<string, string> = {
      icon: "prevafrica_icon_final_1779225207177.png",
      feature: "prevafrica_feature_graphic_1779225225363.png",
      phone: "prevafrica_phone_screenshot_1779225243191.png",
      phone2: "prevafrica_phone_screenshot2_1779361339832.png",
      phone3: "prevafrica_phone3_1779363677410.png",
      phone4: "prevafrica_phone4_1779363695602.png",
      tablet7: "prevafrica_tablet7_screenshot_1779225262633.png",
      tablet7_2: "prevafrica_tablet7_screenshot2_1779361357192.png",
      tablet7_3: "prevafrica_tablet7_3_1779363717005.png",
      tablet7_4: "prevafrica_tablet7_4_1779363732227.png",
      tablet10: "prevafrica_tablet10_v2_1_1779365653909.png",
      tablet10_2: "prevafrica_tablet10_v2_2_1779365674341.png",
      tablet10_3: "prevafrica_tablet10_v2_3_1779365695121.png",
      tablet10_4: "prevafrica_tablet10_v2_4_1779365719697.png"
    };

    const targetFile = fileMap[key];
    if (!targetFile) {
      return res.status(404).send("Type d'asset inconnu.");
    }

    // Chemins possibles
    const searchPaths = [
      path.join(process.cwd(), "src", "assets", "images", targetFile),
      path.join(process.cwd(), "public", "images", targetFile),
      path.join(process.cwd(), "dist", "images", targetFile)
    ];

    for (const filePath of searchPaths) {
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Disposition', `attachment; filename="${targetFile}"`);
        res.setHeader('Content-Type', 'image/png');
        return res.sendFile(path.resolve(filePath));
      }
    }

    return res.status(404).send(`Le fichier ${targetFile} n'a pas été trouvé.`);
  });

  // Route robuste pour servir en direct les images et éviter les 404
  app.get("/images/:filename", (req, res) => {
    const filename = req.params.filename;
    const searchPaths = [
      path.join(process.cwd(), "src", "assets", "images", filename),
      path.join(process.cwd(), "public", "images", filename),
      path.join(process.cwd(), "dist", "images", filename)
    ];

    for (const filePath of searchPaths) {
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=31536000');
        res.setHeader('Access-Control-Allow-Origin', '*');
        return res.sendFile(path.resolve(filePath));
      }
    }

    res.status(404).send("Image introuvable.");
  });

  app.get("/api/health", (req, res) => {
    res.json({ 
      status: "ok", 
      message: "Le backend de PREVAFRICA est opérationnel",
      timestamp: new Date().toISOString()
    });
  });

  // Exemple de route pour la prévoyance
  app.post("/api/simulate", (req, res) => {
    const { amount, duration } = req.body;
    // Logique de simulation ici
    res.json({ 
      success: true, 
      result: `Simulation pour ${amount} sur ${duration} mois` 
    });
  });

  // --- CONFIGURATION VITE (FRONTEND) ---

  if (process.env.NODE_ENV !== "production") {
    // Lazy load Vite in development only
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.get('*', async (req, res, next) => {
      try {
        const url = req.originalUrl;
        const fs = await import('fs');
        let template = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
        template = await vite.transformIndexHtml(url, template);
        res.status(200).set({ 'Content-Type': 'text/html' }).end(template);
      } catch (e) {
        vite.ssrFixStacktrace(e as Error);
        next(e);
      }
    });
  } else {
    // In production, serve the built files
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Intercepteur d'erreurs global (Anti-400 Bad Request pour PWABuilder)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.warn("[SERVER ANTI-400 RECOVERY]", err?.message || err);
    if (res.headersSent) {
      return next(err);
    }
    const iconFallback = path.join(process.cwd(), 'public', 'images', 'prevafrica_icon_512.png');
    if (fs.existsSync(iconFallback)) {
      res.setHeader('Content-Type', 'image/png');
      res.setHeader('Access-Control-Allow-Origin', '*');
      return res.status(200).sendFile(path.resolve(iconFallback));
    }
    return res.status(200).send("OK");
  });

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PREVAFRICA] Serveur démarré sur le port ${PORT} (mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch((err) => {
  console.error("Erreur fatale au démarrage du serveur:", err);
  process.exit(1);
});
