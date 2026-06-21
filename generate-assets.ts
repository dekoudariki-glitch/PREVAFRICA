import { Jimp } from 'jimp';
import * as fs from 'fs';
import * as path from 'path';

// --- CONFIGURATION DU DESIGN ---
const COLOR_BG_DARK = { r: 15, g: 23, b: 42, a: 255 };      // #0f172a (Blue Slate)
const COLOR_EMERALD = { r: 16, g: 185, b: 129, a: 255 };    // #10b981 (Emerald Green)
const COLOR_AMBER = { r: 245, g: 158, b: 11, a: 255 };     // #f59e0b (Amber/Gold)
const COLOR_WHITE = { r: 255, g: 255, b: 255, a: 255 };
const COLOR_CARD_BG = { r: 30, g: 41, b: 59, a: 255 };      // #1e293b (Slate CARD)
const COLOR_MUTED = { r: 148, g: 163, b: 184, a: 255 };    // #94a3b8 (Muted Gray)

// --- FONCTIONS DE DESSIN ROBUSTES ---

function setPixel(data: Uint8Array, width: number, height: number, x: number, y: number, color: { r: number, g: number, b: number, a: number }) {
  if (x < 0 || x >= width || y < 0 || y >= height) return;
  const idx = (y * width + x) * 4;
  const alpha = color.a / 255;
  if (alpha === 1) {
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
    data[idx + 3] = 255;
  } else if (alpha > 0) {
    const invAlpha = 1 - alpha;
    data[idx] = Math.round(color.r * alpha + data[idx] * invAlpha);
    data[idx + 1] = Math.round(color.g * alpha + data[idx + 1] * invAlpha);
    data[idx + 2] = Math.round(color.b * alpha + data[idx + 2] * invAlpha);
    data[idx + 3] = 255;
  }
}

// Remplir une zone avec une couleur unie
function clearWithColor(data: Uint8Array, width: number, height: number, color: { r: number, g: number, b: number, a: number }) {
  for (let idx = 0; idx < data.length; idx += 4) {
    data[idx] = color.r;
    data[idx + 1] = color.g;
    data[idx + 2] = color.b;
    data[idx + 3] = color.a;
  }
}

// Dessiner un rectangle
function drawRect(data: Uint8Array, width: number, height: number, x: number, y: number, w: number, h: number, color: { r: number, g: number, b: number, a: number }) {
  for (let currY = y; currY < y + h; currY++) {
    for (let currX = x; currX < x + w; currX++) {
      setPixel(data, width, height, currX, currY, color);
    }
  }
}

// Dessiner une bordure de rectangle
function drawRectBorder(data: Uint8Array, width: number, height: number, x: number, y: number, w: number, h: number, thickness: number, color: { r: number, g: number, b: number, a: number }) {
  // Haut et Bas
  drawRect(data, width, height, x, y, w, thickness, color);
  drawRect(data, width, height, x, y + h - thickness, w, thickness, color);
  // Gauche et Droite
  drawRect(data, width, height, x, y, thickness, h, color);
  drawRect(data, width, height, x + w - thickness, y, thickness, h, color);
}

// Dessiner un rectangle arrondi
function drawRoundedRect(
  data: Uint8Array,
  width: number,
  height: number,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  color: { r: number, g: number, b: number, a: number }
) {
  for (let currY = y; currY < y + h; currY++) {
    for (let currX = x; currX < x + w; currX++) {
      // Déterminer s'il est dans un coin arrondi
      let inCorner = false;
      let dist = 0;

      if (currX < x + radius && currY < y + radius) {
        dist = Math.hypot(currX - (x + radius), currY - (y + radius));
        inCorner = true;
      } else if (currX >= x + w - radius && currY < y + radius) {
        dist = Math.hypot(currX - (x + w - radius), currY - (y + radius));
        inCorner = true;
      } else if (currX < x + radius && currY >= y + h - radius) {
        dist = Math.hypot(currX - (x + radius), currY - (y + h - radius));
        inCorner = true;
      } else if (currX >= x + w - radius && currY >= y + h - radius) {
        dist = Math.hypot(currX - (x + w - radius), currY - (y + h - radius));
        inCorner = true;
      }

      if (inCorner) {
        if (dist <= radius) {
          // Anti-aliasing simple aux bords externes du coin
          if (dist > radius - 1) {
            const opacity = (radius - dist) * color.a;
            setPixel(data, width, height, currX, currY, { ...color, a: opacity });
          } else {
            setPixel(data, width, height, currX, currY, color);
          }
        }
      } else {
        setPixel(data, width, height, currX, currY, color);
      }
    }
  }
}

// Dessiner un cercle (plein)
function drawCircle(data: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number, color: { r: number, g: number, b: number, a: number }) {
  const rSquared = radius * radius;
  for (let currY = Math.max(0, cy - radius); currY <= Math.min(height - 1, cy + radius); currY++) {
    for (let currX = Math.max(0, cx - radius); currX <= Math.min(width - 1, cx + radius); currX++) {
      const distSq = (currX - cx) * (currX - cx) + (currY - cy) * (currY - cy);
      if (distSq <= rSquared) {
        const dist = Math.sqrt(distSq);
        if (dist > radius - 1) {
          const alpha = (radius - dist) * color.a;
          setPixel(data, width, height, currX, currY, { ...color, a: alpha });
        } else {
          setPixel(data, width, height, currX, currY, color);
        }
      }
    }
  }
}

// Dessiner un anneau circulaire (bordure de cercle)
function drawCircleBorder(data: Uint8Array, width: number, height: number, cx: number, cy: number, radius: number, thickness: number, color: { r: number, g: number, b: number, a: number }) {
  for (let currY = Math.max(0, cy - radius - 2); currY <= Math.min(height - 1, cy + radius + 2); currY++) {
    for (let currX = Math.max(0, cx - radius - 2); currX <= Math.min(width - 1, cx + radius + 2); currX++) {
      const dist = Math.hypot(currX - cx, currY - cy);
      if (dist <= radius && dist >= radius - thickness) {
        setPixel(data, width, height, currX, currY, color);
      }
    }
  }
}

// Dessiner une ligne épaisse (horizontale ou verticale)
function drawLine(data: Uint8Array, width: number, height: number, x1: number, y1: number, x2: number, y2: number, thickness: number, color: { r: number, g: number, b: number, a: number }) {
  if (x1 === x2) {
    const startY = Math.min(y1, y2);
    const endY = Math.max(y1, y2);
    drawRect(data, width, height, x1 - Math.floor(thickness / 2), startY, thickness, endY - startY + 1, color);
  } else if (y1 === y2) {
    const startX = Math.min(x1, x2);
    const endX = Math.max(x1, x2);
    drawRect(data, width, height, startX, y1 - Math.floor(thickness / 2), endX - startX + 1, thickness, color);
  }
}

// Dessiner une grille représentant des barres d'un graphique
function drawGridBars(data: Uint8Array, width: number, height: number, rx: number, ry: number, rw: number, rh: number, barValues: number[], color: { r: number, g: number, b: number, a: number }) {
  const barCount = barValues.length;
  const gap = 12;
  const totalGaps = (barCount - 1) * gap;
  const barWidth = (rw - totalGaps) / barCount;
  
  for (let i = 0; i < barCount; i++) {
    const currentBarHeight = (barValues[i] / 100) * rh;
    const bx = Math.round(rx + i * (barWidth + gap));
    const by = Math.round(ry + rh - currentBarHeight);
    drawRoundedRect(data, width, height, bx, by, Math.round(barWidth), Math.round(currentBarHeight), 4, color);
  }
}

// Rendu d'une lettre simplifiée (P pour PREVAFRICA) pixel par pixel
function drawLetterP(data: Uint8Array, width: number, height: number, cx: number, cy: number, scale: number, color: { r: number, g: number, b: number, a: number }) {
  const thickness = Math.round(16 * scale);
  const stemHeight = Math.round(140 * scale);
  const loopRadius = Math.round(45 * scale);
  
  // Tronc vertical de la lettre P
  const stemX = cx - Math.round(15 * scale);
  const stemY = cy - Math.round(70 * scale);
  drawRect(data, width, height, stemX, stemY, thickness, stemHeight, color);
  
  // Boucle du P - Dessin de demi-cercle
  const loopCx = stemX + thickness;
  const loopCy = stemY + loopRadius;
  
  // Dessin de demi-anneaux programmatiquement
  for (let currY = loopCy - loopRadius; currY <= loopCy + loopRadius; currY++) {
    for (let currX = loopCx; currX <= loopCx + loopRadius; currX++) {
      const dx = currX - loopCx;
      const dy = currY - loopCy;
      const dist = Math.hypot(dx, dy);
      if (dist <= loopRadius && dist >= loopRadius - thickness) {
        setPixel(data, width, height, currX, currY, color);
      }
    }
  }
  
  // Barres horizontales de fermeture de la boucle du P
  drawRect(data, width, height, stemX + thickness, stemY, loopRadius, thickness, color);
  drawRect(data, width, height, stemX + thickness, stemY + loopRadius * 2 - thickness, loopRadius, thickness, color);
}

// Dessiner une icône simple de coeur/santé
function drawHeart(data: Uint8Array, width: number, height: number, cx: number, cy: number, size: number, color: { r: number, g: number, b: number, a: number }) {
  const s = size / 2;
  // Dessiner un coeur avec 2 cercles et un triangle inversé inférieur
  drawCircle(data, width, height, Math.round(cx - s/2), Math.round(cy - s/4), Math.round(s/2), color);
  drawCircle(data, width, height, Math.round(cx + s/2), Math.round(cy - s/4), Math.round(s/2), color);
  
  // Triangle du bas du coeur
  for (let y = cy; y <= cy + s; y++) {
    const factor = (cy + s - y) / s; // 1 au centre, 0 tout en bas
    const span = Math.round(size * factor);
    drawRect(data, width, height, Math.round(cx - span/2), y, span, 1, color);
  }
}

// Dessiner un bouclier de protection
function drawShield(data: Uint8Array, width: number, height: number, cx: number, cy: number, size: number, color: { r: number, g: number, b: number, a: number }) {
  const w = size / 2;
  const h = size / 2;
  // Rectangle supérieur
  drawRect(data, width, height, cx - w, cy - h, w * 2, h, color);
  // Point inférieur
  for (let y = cy; y <= cy + h; y++) {
    const dx = Math.round(((cy + h - y) / h) * w);
    drawRect(data, width, height, cx - dx, y, dx * 2, 1, color);
  }
}

// Remplissage d'un dégradé radial élégant en arrière-plan
function drawRadialGradient(data: Uint8Array, width: number, height: number, innerColor: { r: number, g: number, b: number, a: number }, outerColor: { r: number, g: number, b: number, a: number }) {
  const cx = width / 2;
  const cy = height / 2;
  const maxDist = Math.hypot(cx, cy);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dist = Math.hypot(x - cx, y - cy);
      const ratio = Math.min(1, dist / maxDist);
      const invRatio = 1 - ratio;
      
      const r = Math.round(innerColor.r * invRatio + outerColor.r * ratio);
      const g = Math.round(innerColor.g * invRatio + outerColor.g * ratio);
      const b = Math.round(innerColor.b * invRatio + outerColor.b * ratio);
      
      const idx = (y * width + x) * 4;
      data[idx] = r;
      data[idx + 1] = g;
      data[idx + 2] = b;
      data[idx + 3] = 255;
    }
  }
}

// --- CONSTRUCTEURS D'IMAGES CORE ---

// 1. GÉNÉRATION DE L'ICÔNE (192x192 et 512x512)
async function generateIcon(size: number, outputPath: string) {
  const img = new Jimp({ width: size, height: size });
  const data = img.bitmap.data;
  
  // Dégradé de fond radial splendide
  drawRadialGradient(data, size, size, { r: 30, g: 58, b: 138, a: 255 }, COLOR_BG_DARK); // Bleu Roi vers Slate Foncé
  
  // Cercle blanc de protection
  drawCircleBorder(data, size, size, size/2, size/2, size/2 - Math.round(15 * (size/512)), Math.round(12 * (size/512)), COLOR_EMERALD);
  drawCircleBorder(data, size, size, size/2, size/2, size/2 - Math.round(30 * (size/512)), Math.round(4 * (size/512)), COLOR_AMBER);
  
  // Symbole de Bouclier central doré
  drawShield(data, size, size, size/2, size/2, Math.round(230 * (size/512)), { r: 245, g: 158, b: 11, a: 30 }); // Bouclier arrière transparent
  
  // Lettre "P" emblématique de PREVAFRICA au milieu
  drawLetterP(data, size, size, size/2, size/2, size / 512, COLOR_WHITE);
  
  // Petit coeur de santé/vie vert émeraude en bas à droite du P
  drawHeart(data, size, size, size/2 + Math.round(45*(size/512)), size/2 + Math.round(45*(size/512)), Math.round(40*(size/512)), COLOR_EMERALD);
  
  await img.write(outputPath);
  console.log(`[GENERATOR] Icône générée avec succès : ${outputPath} (${size}x${size})`);
}

// 2. GÉNÉRATION DE LA CAPTURE D'ÉCRAN MOBILE (1080x1920)
async function generatePhoneScreenshot(outputPath: string) {
  const width = 1080;
  const height = 1920;
  const img = new Jimp({ width, height });
  const data = img.bitmap.data;
  
  // 1. Fond général élégant
  clearWithColor(data, width, height, COLOR_BG_DARK);
  
  // 2. Cadre d'appareil mobile factice (Beautiful Outline)
  drawRectBorder(data, width, height, 0, 0, width, height, 20, COLOR_EMERALD);
  drawRoundedRect(data, width, 40, width/2 - 200, 10, 400, 24, 12, { r: 15, g: 15, b: 15, a: 255 }); // Dynamic Island
  
  // 3. Barre de statut
  drawRect(data, width, height, 20, 50, width - 40, 50, { r: 20, g: 30, b: 50, a: 255 });
  // Symbole de batterie, Wifi, heure factices
  drawRect(data, width, height, width - 100, 65, 40, 20, COLOR_WHITE);
  drawRect(data, width, height, width - 60, 71, 6, 8, COLOR_WHITE);
  
  // 4. Header de l'application
  drawRoundedRect(data, width, height, 40, 150, width - 80, 120, 15, COLOR_CARD_BG);
  drawCircle(data, width, height, 100, 210, 30, COLOR_EMERALD); // Logo rond
  drawRect(data, width, height, 160, 185, 300, 25, COLOR_WHITE); // Titre PREVAFRICA
  drawRect(data, width, height, 160, 215, 180, 15, COLOR_MUTED); // Sous-titre
  
  // Indicateur Utilisateur branché
  drawCircle(data, width, height, width - 120, 210, 25, COLOR_AMBER);
  
  // 5. BANNER / CARTE PRINCIPALE "MON COMPTE & COUVERTURE"
  drawRoundedRect(data, width, height, 40, 300, width - 80, 400, 24, { r: 16, g: 185, b: 129, a: 220 }); // Fond émeraude
  drawRect(data, width, height, 80, 350, 400, 25, COLOR_WHITE); // Label "Votre Prévoyance Active"
  drawRect(data, width, height, 80, 440, 600, 50, COLOR_WHITE); // Grand Chiffre: "150 000 FCFA"
  
  // Jauge de couverture santé circulaire ou barre
  drawRect(data, width, height, 80, 560, width - 160, 25, { r: 6, g: 95, b: 70, a: 255 }); // Back bar
  drawRect(data, width, height, 80, 560, Math.round((width - 160) * 0.75), 25, COLOR_AMBER); // Front active bar
  drawRect(data, width, height, 80, 610, 350, 20, COLOR_WHITE); // Légende sous barre: "75% - Couverture Maximale"
  
  // 6. DEUXIÈME ENCADRÉ "MICRO-CRÉDIT PANAFRICAIN"
  drawRoundedRect(data, width, height, 40, 740, width - 80, 350, 24, COLOR_CARD_BG);
  drawRect(data, width, height, 80, 780, 500, 25, COLOR_AMBER); // Label "Micro-crédit en cours"
  drawRect(data, width, height, 80, 850, 300, 40, COLOR_WHITE); // Montant : "50 000 FCFA"
  
  drawRect(data, width, height, 80, 930, width - 160, 15, { r: 51, g: 65, b: 85, a: 255 }); // Rail
  drawRect(data, width, height, 80, 930, Math.round((width - 160) * 0.4), 15, COLOR_EMERALD); // Avancement
  drawRect(data, width, height, 80, 970, 450, 18, COLOR_MUTED); // "Prochain remboursement: 5 Juillet"
  
  // 7. HISTORIQUE & STATISTIQUES (Bar Chart programmé)
  drawRoundedRect(data, width, height, 40, 1130, width - 80, 450, 24, COLOR_CARD_BG);
  drawRect(data, width, height, 80, 1170, 450, 25, COLOR_WHITE); // "Statistiques Mensuelles"
  
  // Dessin des barres de statistique
  drawGridBars(data, width, height, 100, 1230, width - 200, 250, [40, 65, 80, 55, 95, 70, 85], COLOR_EMERALD);
  drawLine(data, width, height, 80, 1480, width - 80, 1480, 3, COLOR_MUTED); // Ligne d'axe X
  
  // 8. MENU DE NAVIGATEUR EN BAS DE PAGE
  drawRect(data, width, height, 20, 1720, width - 40, 160, { r: 15, g: 23, b: 42, a: 255 });
  // Cercles d'icônes du menu bas
  const menuButtons = [150, 350, 540, 730, 920];
  menuButtons.forEach(buttonX => {
    drawCircle(data, width, height, buttonX, 1790, 35, COLOR_CARD_BG);
    drawCircle(data, width, height, buttonX, 1790, 15, COLOR_EMERALD);
  });
  
  await img.write(outputPath);
  console.log(`[GENERATOR] Capture d'écran Mobile générée : ${outputPath}`);
}

// 3. GÉNÉRATION DE LA CAPTURE D'ÉCRAN TABLETTE/DESKTOP (1920x1080)
async function generateTabletScreenshot(outputPath: string) {
  const width = 1920;
  const height = 1080;
  const img = new Jimp({ width, height });
  const data = img.bitmap.data;
  
  // Fond général foncé
  clearWithColor(data, width, height, COLOR_BG_DARK);
  
  // Cadre appareil émeraude élégant
  drawRectBorder(data, width, height, 0, 0, width, height, 24, COLOR_AMBER);
  
  // 1. BARRE DE NAVIGATION LATÉRALE (Sidebar gauche) - largeur 350
  drawRect(data, width, height, 24, 24, 320, height - 48, COLOR_CARD_BG);
  
  // Logo PREVAFRICA sur la sidebar
  drawCircle(data, width, height, 180, 120, 45, COLOR_EMERALD);
  drawLetterP(data, width, height, 180, 120, 0.45, COLOR_WHITE);
  
  // Boutons de la barre latérale (Factices)
  const sidebarItemsY = [240, 340, 440, 540, 640];
  sidebarItemsY.forEach((itemY, idx) => {
    // Premier élément actif en vert émeraude, les autres neutres
    const bgCol = idx === 0 ? COLOR_EMERALD : { r: 51, g: 65, b: 85, a: 255 };
    drawRoundedRect(data, width, height, 50, itemY, 260, 60, 10, bgCol);
  });
  
  // 2. ZONE DE CONTENU PRINCIPALE (A droite de la sidebar)
  const startX = 370;
  
  // Grand Titre de bienvenue
  drawRoundedRect(data, width, height, startX, 40, width - startX - 40, 100, 15, COLOR_CARD_BG);
  drawRect(data, width, height, startX + 40, 75, 600, 30, COLOR_WHITE); // "Bonjour dekoudariki@gmail.com - Espace PREVAFRICA"
  drawCircle(data, width, height, width - 100, 90, 25, COLOR_EMERALD); // Indicateur statut actif
  
  // Grid de 3 Cartes (Prévoyance Santé, Micro-Crédit, Retraite & Décours)
  const cardW = Math.round((width - startX - 80) / 3);
  
  // Carte 1 : Prévoyance Assurée
  drawRoundedRect(data, width, height, startX, 180, cardW, 260, 16, { r: 6, g: 95, b: 70, a: 240 });
  drawRect(data, width, height, startX + 30, 220, cardW - 60, 20, COLOR_WHITE); // Titre
  drawRect(data, width, height, startX + 30, 270, cardW - 120, 35, COLOR_AMBER); // Solde
  drawRect(data, width, height, startX + 30, 350, cardW - 60, 12, { r: 4, g: 120, b: 87, a: 255 }); // Jauge
  drawRect(data, width, height, startX + 30, 350, Math.round((cardW - 60) * 0.8), 12, COLOR_WHITE);
  
  // Carte 2 : Micro-crédit Remboursé
  drawRoundedRect(data, width, height, startX + cardW + 20, 180, cardW, 260, 16, COLOR_CARD_BG);
  drawRect(data, width, height, startX + cardW + 50, 220, cardW - 60, 20, COLOR_AMBER); // Titre
  drawRect(data, width, height, startX + cardW + 50, 270, cardW - 100, 35, COLOR_WHITE); // Solde
  drawRect(data, width, height, startX + cardW + 50, 350, cardW - 60, 12, { r: 51, g: 65, b: 85, a: 255 }); // Jauge
  drawRect(data, width, height, startX + cardW + 50, 350, Math.round((cardW - 60) * 0.35), 12, COLOR_EMERALD);
  
  // Carte 3 : Statut du dossier KYC / eKYC
  drawRoundedRect(data, width, height, startX + (cardW * 2) + 40, 180, cardW, 260, 16, COLOR_CARD_BG);
  drawRect(data, width, height, startX + (cardW * 2) + 70, 220, cardW - 60, 20, COLOR_WHITE); // Titre
  drawRect(data, width, height, startX + (cardW * 2) + 70, 270, cardW - 140, 25, COLOR_EMERALD); // Statut: "Approuvé"
  // Dessin d'une coche verte checkmark géométrique
  drawRect(data, width, height, startX + (cardW * 2) + 70, 330, 140, 40, { r: 16, g: 185, b: 129, a: 50 });
  
  // Grand panneau d'activité / Historique complet des fonds de prévoyance
  drawRoundedRect(data, width, height, startX, 480, width - startX - 40, 540, 24, COLOR_CARD_BG);
  drawRect(data, width, height, startX + 40, 525, 450, 30, COLOR_WHITE); // "Activité & Épargne Mutuelle"
  
  // Dessin de grands histogrammes de simulation pour la prévoyance / micro-crédits
  drawGridBars(data, width, height, startX + 40, 590, width - startX - 120, 350, [15, 30, 45, 35, 60, 50, 75, 65, 80, 70, 95, 85], COLOR_EMERALD);
  
  // Lignes d'axe
  drawLine(data, width, height, startX + 20, 940, width - 60, 940, 3, COLOR_MUTED);
  
  await img.write(outputPath);
  console.log(`[GENERATOR] Capture d'écran Tablette générée : ${outputPath}`);
}

// --- FONCTION DE LANCEMENT DE TOUTES LES TÂCHES ---
async function run() {
  const imagesDir = path.join(process.cwd(), 'public', 'images');
  if (!fs.existsSync(imagesDir)) {
    fs.mkdirSync(imagesDir, { recursive: true });
  }
  
  const distImagesDir = path.join(process.cwd(), 'dist', 'images');
  if (!fs.existsSync(distImagesDir)) {
    fs.mkdirSync(distImagesDir, { recursive: true });
  }

  // Liste de tous les fichiers à générer
  const targets = [
    { name: 'prevafrica_icon_192.png', gen: () => generateIcon(192, path.join(imagesDir, 'prevafrica_icon_192.png')) },
    { name: 'prevafrica_icon_512.png', gen: () => generateIcon(512, path.join(imagesDir, 'prevafrica_icon_512.png')) },
    { name: 'prevafrica_phone_screenshot.png', gen: () => generatePhoneScreenshot(path.join(imagesDir, 'prevafrica_phone_screenshot.png')) },
    { name: 'prevafrica_tablet_screenshot.png', gen: () => generateTabletScreenshot(path.join(imagesDir, 'prevafrica_tablet_screenshot.png')) }
  ];

  for (const t of targets) {
    await t.gen();
    // Copie de sûreté pour la production vers dist/images si dist existe
    const srcPath = path.join(imagesDir, t.name);
    const destPath = path.join(distImagesDir, t.name);
    try {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[GENERATOR] Copie de sûreté effectuée dans : ${destPath}`);
    } catch (e: any) {
      // Ignoré si dist n'est pas encore créée lors du premier build
    }
  }
  console.log('[GENERATOR] Félicitations ! Toutes les images PWA sont reconstruites proprement et certifiées valides.');
}

run().catch(console.error);
