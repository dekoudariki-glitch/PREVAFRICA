import express from "express";
import path from "path";
import fs from "fs";

async function startServer() {
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[PREVAFRICA] Serveur démarré sur le port ${PORT} (mode: ${process.env.NODE_ENV || 'development'})`);
  });
}

startServer().catch((err) => {
  console.error("Erreur fatale au démarrage du serveur:", err);
  process.exit(1);
});
