/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { initializeApp } from "firebase/app";
import { 
  addDoc, 
  collection, 
  getDocs, 
  getFirestore, 
  orderBy, 
  query, 
  serverTimestamp,
  updateDoc,
  doc 
} from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { jsPDF } from "jspdf";
import { 
  ShieldCheck, 
  MapPin, 
  ChevronRight, 
  Plus, 
  Trash2, 
  Loader2, 
  Camera, 
  CheckCircle, 
  ArrowLeft,
  Smartphone,
  CreditCard,
  Lock,
  ChevronLeft,
  X,
  Download,
  Send,
  MessageCircle,
  TrendingUp,
  FileText,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from './lib/utils';
import SignatureCanvas from 'react-signature-canvas';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend 
} from 'recharts';

// --- CONFIGURATION FIREBASE ---
const firebaseConfig = {
  apiKey: "AIzaSyAIUXBQSUG3mJUCk3LcNdraKtBsLjlB7hw",
  authDomain: "prevafrica.firebaseapp.com",
  projectId: "prevafrica",
  storageBucket: "prevafrica.firebasestorage.app",
  messagingSenderId: "717785890835",
  appId: "1:717785890835:web:55bca69311060d9f163fe6"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map(provider => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// --- TYPES & DATA ---
interface Offre {
  id: string;
  titre: string;
  desc: string;
  coef: number;
  icone: string;
  type?: string;
  categorie: string;
}

const paysConfig: Record<string, { code: string; gateway: string; devise: string }> = {
  'Bénin': { code: '+229', gateway: 'FedaPay', devise: 'FCFA' },
  'Burkina Faso': { code: '+226', gateway: 'CinetPay', devise: 'FCFA' },
  'Cameroun': { code: '+237', gateway: 'Monetbil', devise: 'FCFA' },
  'Centrafrique': { code: '+236', gateway: 'Bizao', devise: 'FCFA' },
  'Congo': { code: '+242', gateway: 'CinetPay', devise: 'FCFA' },
  'Côte d\'Ivoire': { code: '+225', gateway: 'CinetPay', devise: 'FCFA' },
  'Gabon': { code: '+241', gateway: 'Monetbil', devise: 'FCFA' },
  'Guinée': { code: '+224', gateway: 'CinetPay', devise: 'FG' },
  'Guinée-Bissau': { code: '+245', gateway: 'CinetPay', devise: 'FCFA' },
  'Guinée Équatoriale': { code: '+240', gateway: 'Bizao', devise: 'FCFA' },
  'Mali': { code: '+223', gateway: 'CinetPay', devise: 'FCFA' },
  'Niger': { code: '+227', gateway: 'CinetPay', devise: 'FCFA' },
  'Sénégal': { code: '+221', gateway: 'CinetPay', devise: 'FCFA' },
  'Tchad': { code: '+235', gateway: 'Bizao', devise: 'FCFA' },
  'Togo': { code: '+228', gateway: 'FedaPay', devise: 'FCFA' }
};

const offres: Offre[] = [
  { 
    id: 'AVENIR', 
    titre: 'AVENIR', 
    desc: 'Garantissez la scolarité de vos enfants. Versement immédiat d\'un capital étude en cas d\'aléa.', 
    coef: 1200, 
    icone: '🎓', 
    categorie: 'Avenir' 
  },
  { 
    id: 'SANTE_PRO', 
    titre: 'SANTÉ+', 
    desc: 'Prise en charge des frais d\'hospitalisation et évacuation d\'urgence pour toute la famille.', 
    coef: 500, 
    icone: '🏥', 
    categorie: 'Santé' 
  },
  { 
    id: 'AGRICOLE_RICE', 
    titre: 'AGRICOLE', 
    desc: 'Sécurisez vos revenus face au climat. Indemnisation automatique en cas de sécheresse sévère.', 
    coef: 800, 
    icone: '🌾', 
    categorie: 'Agricole' 
  },
  { 
    id: 'RETRAITE_LION', 
    titre: 'RETRAITE', 
    desc: 'Préparez votre repos dès aujourd\'hui. Une rente mensuelle garantie pour une retraite digne.', 
    coef: 2000, 
    icone: '🦁', 
    categorie: 'Retraite' 
  },
  { 
    id: 'LOGISTIQUE_AFRICA', 
    titre: 'LOGISTIQUE', 
    desc: 'Assurance transport et marchandises. Protection totale de votre stock contre tout incident.', 
    coef: 350, 
    icone: '🚚', 
    categorie: 'Logistique' 
  },
  { 
    id: 'MICRO_CREDIT', 
    titre: 'MICRO-CRÉDIT', 
    desc: 'Financement express pour entrepreneurs. Boostez votre stock ou matériel sans paperasse.', 
    type: 'finance', 
    icone: '💰', 
    coef: 0, 
    categorie: 'Micro-crédit' 
  }
];

const categories = ['Toutes les rubriques', 'Avenir', 'Santé', 'Agricole', 'Retraite', 'Logistique', 'Micro-crédit'];

// --- COMPOSANTS UI ---
const Logo = ({ className = "w-12 h-12" }: { className?: string }) => (
  <div className={cn("relative flex items-center justify-center", className)}>
    {/* Fond de l'icône */}
    <div className="absolute inset-0 bg-[#0f172a] rounded-2xl rotate-3 shadow-xl border border-slate-700/50" />
    <div className="absolute inset-0 bg-[#10b981]/10 rounded-2xl -rotate-3 border border-emerald-500/20" />
    
    <svg 
      viewBox="0 0 100 100" 
      className="relative z-10 w-full h-full p-2"
      fill="none" 
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Forme simplifiée de l'Afrique */}
      <path 
        d="M45 20C55 22 65 25 70 30C75 35 72 45 70 50C68 55 70 65 65 75C60 85 50 88 45 80C40 72 35 65 30 55C25 45 28 35 32 28C36 21 40 18 45 20Z" 
        fill="#1e293b" 
        className="opacity-40"
      />
      {/* Deux boucliers entrelacés */}
      <path 
        d="M48 40C48 40 48 55 38 60C48 65 58 60 58 60C58 60 58 45 48 40Z" 
        fill="#10b981" 
        stroke="#0f172a"
        strokeWidth="2"
      />
      <path 
        d="M58 45C58 45 58 60 48 65C58 70 68 65 68 65C68 65 68 50 58 45Z" 
        fill="#10b981"
        stroke="#0f172a"
        strokeWidth="2"
        className="opacity-90"
      />
    </svg>
  </div>
);

export default function App() {
  const [refCode, setRefCode] = useState('');
  const [selectedAmbassadeur, setSelectedAmbassadeur] = useState<any>(null);

  // --- NEW: Referral Tracking & Auto-Country ---
  useEffect(() => {
    // Referral logic
    const params = new URLSearchParams(window.location.search);
    const r = params.get('ref');
    if (r) {
      setRefCode(r);
      const searchAmb = async () => {
        try {
          const qA = query(collection(db, "ambassadeurs"));
          const snapA = await getDocs(qA);
          const amb = snapA.docs.find(d => d.id === r || d.data().code === r);
          if (amb) {
            setSelectedAmbassadeur({ id: amb.id, ...amb.data() });
          }
        } catch (e) { console.error("Error finding ambassador", e); }
      };
      searchAmb();
    }

    // Auto-Country detection (Automatic Filtering)
    const storedPays = localStorage.getItem('prevafrica_pays');
    if (!storedPays) {
      fetch('https://ipapi.co/json/')
        .then(res => res.json())
        .then(data => {
          if (data.country_name && paysConfig[data.country_name]) {
            setPays(data.country_name);
          }
        })
        .catch(() => console.log("Auto-detection failed, using default."));
    }
  }, []);

  const [etape, setEtape] = useState('splash');
  const [partnerSpace, setPartnerSpace] = useState(false);
  const [showPrevention, setShowPrevention] = useState(false);

  const handleDownloadAsset = (key: string) => {
    // Redirige vers notre API locale robuste et permanente plutôt que d'utiliser des liens temporaires expirés
    window.open(`/api/download-assets/${key}`, '_blank');
  };
  const [partnerType, setPartnerType] = useState<'INSURER' | 'BANK'>('INSURER');
  const [produit, setProduit] = useState<Offre | null>(null);
  const [montant, setMontant] = useState('5000');
  const [nom, setNom] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [beneficiaire, setBeneficiaire] = useState('');
  const [otp, setOtp] = useState('');
  const [pays, setPays] = useState(() => localStorage.getItem('prevafrica_pays') || 'Sénégal');
  const [signature, setSignature] = useState('');

  // Persistent country choice
  useEffect(() => {
    localStorage.setItem('prevafrica_pays', pays);
  }, [pays]);

  // Auto-fetch for Partner Space
  useEffect(() => {
    if (partnerSpace && adminData.length === 0) {
      fetchGlobalData();
    }
  }, [partnerSpace]);
  const [cniFile, setCniFile] = useState<File | null>(null);
  const [documentOK, setDocumentOK] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [adminPass, setAdminPass] = useState('');
  const [adminData, setAdminData] = useState<any[]>([]);
  const [adminSinistres, setAdminSinistres] = useState<any[]>([]);
  const [adminAmbassadeurs, setAdminAmbassadeurs] = useState<any[]>([]);
  const [adminTab, setAdminTab] = useState<'souscriptions' | 'sinistres' | 'strategie' | 'ambassadeurs'>('souscriptions');
  const [sinistreType, setSinistreType] = useState('');
  const [sinistreDesc, setSinistreDesc] = useState('');
  const [filtreCategorie, setFiltreCategorie] = useState('Toutes les rubriques');
  const signatureRef = React.useRef<any>(null);

  // --- NEW: Micro-credit & Weather ---
  const [dureeCredit, setDureeCredit] = useState(6);
  const [meteo, setMeteo] = useState<any>(null);

  const [ambassadeurNom, setAmbassadeurNom] = useState('');
  const [ambassadeurWhatsApp, setAmbassadeurWhatsApp] = useState('');
  const [ambassadeurVille, setAmbassadeurVille] = useState('');
  const [ambassadeurKey, setAmbassadeurKey] = useState('');

  const rejoindreAmbassadeur = async () => {
    if (!ambassadeurNom || !ambassadeurWhatsApp) return alert("Veuillez remplir les informations.");
    setChargement(true);
    try {
      const code = "AMB-" + Math.random().toString(36).substring(7).toUpperCase();
      await addDoc(collection(db, "ambassadeurs"), {
        nom: ambassadeurNom,
        whatsapp: ambassadeurWhatsApp,
        ville: ambassadeurVille,
        code: code,
        date: serverTimestamp(),
        statut: 'Actif'
      });
      setAmbassadeurKey(code);
      setEtape('ambassadeur_confirmation');
    } catch (e: any) { alert(e.message); }
    setChargement(false);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setCniFile(e.target.files[0]);
      setDocumentOK(true);
    }
  };

  // Fetch Weather Data for Agriculture Product
  useEffect(() => {
    if (produit?.id === 'AGRICOLE_RICE') {
      // Demo logic: in real-world, we'd use navigator.geolocation
      const city = pays === 'Côte d\'Ivoire' ? 'Abidjan' : pays === 'Sénégal' ? 'Dakar' : pays === 'Cameroun' ? 'Douala' : 'Lomé';
      fetch(`https://api.openweathermap.org/data/2.5/weather?q=${city}&units=metric&appid=895284fb2d2c1d87c422f8c2e646271c`) // Key for demo purposes
        .then(res => res.json())
        .then(data => setMeteo(data))
        .catch(() => setMeteo({ main: { temp: 28 }, weather: [{ description: 'Ensoleillé' }] }));
    }
  }, [produit, pays]);

  useEffect(() => {
    if (etape === 'splash') {
      const timer = setTimeout(() => setEtape('catalogue'), 2000);
      return () => clearTimeout(timer);
    }
  }, [etape]);

  const m = parseInt(montant) || 500;
  
  // Advanced Micro-credit logic (6-36 months)
  const getTaux = (d: number) => {
    if (d <= 6) return 0.12;
    if (d <= 12) return 0.15;
    if (d <= 24) return 0.18;
    return 0.22;
  };

  const capital = produit?.type === 'finance' 
    ? Math.round((m * (1 + getTaux(dureeCredit))) / dureeCredit)
    : m * (produit?.coef || 1);

  const totalPayable = Math.round(m * 1.05);

  const telechargerContrat = () => {
    try {
      const doc = new jsPDF();
      
      // Header Logo-like
      doc.setFontSize(22);
      doc.setTextColor(16, 185, 129); // Emerald-500
      doc.setFont("helvetica", "bold");
      doc.text("PRÉVAFRICA", 105, 20, { align: "center" });
      
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // Slate-400
      doc.setFont("helvetica", "normal");
      doc.text(`ATTESTATION DE DÉPÔT & CONTRAT DE MICRO-ASSURANCE`, 105, 28, { align: "center" });
      
      doc.setDrawColor(226, 232, 240); // Slate-200
      doc.line(20, 35, 190, 35);
      
      // Certificate ID
      const certId = `PREV-${Math.floor(Math.random() * 9000 + 1000)}`;
      doc.setFontSize(9);
      doc.text(`Identifiant: ${certId} | Date: ${new Date().toLocaleDateString('fr-FR')}`, 105, 42, { align: "center" });

      // Client Section
      doc.setFillColor(248, 250, 252); // Slate-50
      doc.rect(20, 50, 170, 45, 'F');
      doc.setDrawColor(241, 245, 249); // Slate-100
      doc.rect(20, 50, 170, 45, 'D');

      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42); // Slate-900
      doc.setFont("helvetica", "bold");
      doc.text("IDENTITÉ DU BÉNÉFICIAIRE", 25, 60);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(`NOM COMPLET: ${nom.toUpperCase()}`, 25, 70);
      doc.text(`PAYS: ${pays?.toUpperCase()}`, 25, 77);
      doc.text(`WHATSAPP: ${paysConfig[pays]?.code || ''} ${whatsapp}`, 25, 84);

      // Product Section
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("DÉTAILS DE LA COUVERTURE", 25, 110);
      
      doc.setFontSize(11);
      doc.setFont("helvetica", "normal");
      doc.text(` OFFRE: ${produit?.titre}`, 25, 120);
      doc.text(` PRIME PAYÉE: ${parseInt(montant).toLocaleString()} FCFA`, 25, 127);
      doc.text(` CAPITAL GARANTI: ${capital.toLocaleString()} FCFA`, 25, 134);
      doc.text(` MODE DE PAIEMENT: MOBILE MONEY (PAYÉ)`, 25, 141);

      // Conditions Table (Simplified)
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.text("RÉSUMÉ DES CONDITIONS", 25, 155);
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      const conditions = [
        "- Délai de carence: 30 jours (sauf accident).",
        "- Validité: 12 mois renouvelables.",
        "- Versement: Sous 48h après validation du sinistre."
      ];
      doc.text(conditions, 25, 162);

      // Signature (if exists)
      if (signature) {
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text("SIGNATURE ÉLECTRONIQUE DU CLIENT", 105, 190, { align: "center" });
        try {
          doc.addImage(signature, 'PNG', 75, 195, 60, 30);
        } catch (e) {
          console.error("Signature image error", e);
        }
      }

      // Partner stamp area
      doc.setDrawColor(16, 185, 129);
      doc.setLineWidth(0.5);
      doc.circle(160, 230, 20, 'D');
      doc.setFontSize(7);
      doc.setTextColor(16, 185, 129);
      doc.text("VALIDE", 160, 228, { align: "center" });
      doc.text("PREVAFRICA", 160, 232, { align: "center" });
      doc.text("SECURE", 160, 236, { align: "center" });

      // Footer
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate-400
      const footerTxt = "PRÉVAFRICA est une plateforme d'intermédiation numérique. " +
                        "La garantie est portée par nos partenaires assureurs locaux agréés par la CIMA. " +
                        "Ce certificat vaut contrat après validation du paiement.";
      doc.text(footerTxt, 105, 285, { align: "center", maxWidth: 160 });

      doc.save(`PrevAfrica_Contrat_${nom.replace(/\s+/g, '_')}.pdf`);
    } catch (error) {
      console.error("PDF generation failed", error);
      alert("Erreur lors de la génération du PDF. Assurez-vous que votre navigateur autorise les téléchargements.");
    }
  };

  const handleSinistre = async () => {
    if (!sinistreType || !sinistreDesc) return alert("Veuillez décrire le sinistre.");
    setChargement(true);
    try {
      await addDoc(collection(db, "sinistres"), {
        client: nom || "Client Anonyme",
        whatsapp: whatsapp,
        type: sinistreType,
        description: sinistreDesc,
        date: serverTimestamp(),
        statut: "Reçu"
      });
      alert("Votre déclaration a été transmise au service juridique de PREVAFRICA.");
      setEtape('catalogue');
    } catch (e: any) { alert(e.message); }
    setChargement(false);
  };

  const initierPaiement = async (methode: string) => {
    setChargement(true);
    const config = paysConfig[pays];
    const amount = totalPayable;
    
    // Simulate Gateway initialization logic
    console.log(`[PAYMENT] Initiating with ${config.gateway} for ${amount} ${config.devise}`);
    
    // Structure for real integration (placeholder for SDK calls)
    try {
      if (config.gateway === 'FedaPay') {
        // Example FedaPay flow (simulation)
        // const widget = FedaPay.init({ ... });
        // widget.open();
        console.log("FedaPay integration ready for API keys.");
      } else if (config.gateway === 'CinetPay') {
        // Example CinetPay flow (simulation)
        // CinetPay.setConfig({ ... });
        // CinetPay.getCheckout({ ... });
        console.log("CinetPay integration ready for API keys.");
      }

      // Simulation delay to mimic a real transaction
      setTimeout(async () => {
        try {
          await addDoc(collection(db, "souscriptions"), {
            client: nom, 
            pays: pays, 
            devise: config.devise || 'FCFA',
            whatsapp: (config.code || '') + " " + whatsapp, 
            offre: produit?.titre, 
            montant: m, 
            resultat: capital,
            modePaiement: methode,
            gateway: config.gateway,
            signature: signature,
            referralCode: refCode || null,
            statut: 'Payé', 
            date: serverTimestamp()
          });
          setEtape('attestation');
        } catch (e: any) { 
          alert(e.message); 
        }
        setChargement(false);
      }, 3000);

    } catch (err: any) {
      alert("Erreur d'initialisation du paiement : " + err.message);
      setChargement(false);
    }
  };

  const fetchGlobalData = async () => {
    try {
      const qS = query(collection(db, "souscriptions"), orderBy("date", "desc"));
      const snapS = await getDocs(qS);
      setAdminData(snapS.docs.map(d => ({ id: d.id, ...d.data() })));

      const qX = query(collection(db, "sinistres"), orderBy("date", "desc"));
      const snapX = await getDocs(qX);
      setAdminSinistres(snapX.docs.map(d => ({ id: d.id, ...d.data() })));

      const qAmb = query(collection(db, "ambassadeurs"), orderBy("date", "desc"));
      const snapAmb = await getDocs(qAmb);
      setAdminAmbassadeurs(snapAmb.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (err: any) {
      console.error("[FETCH] Sync error:", err);
    }
  };

  const chargerAdmin = async () => {
    if (adminPass.trim() !== '2026') {
      alert("Accès refusé. Le code de direction est incorrect.");
      return;
    }
    setChargement(true);
    await fetchGlobalData();
    setEtape('admin_list');
    setChargement(false);
  };

  const updateStatutSinistre = async (id: string, nouveauStatut: string) => {
    try {
      await updateDoc(doc(db, "sinistres", id), { statut: nouveauStatut });
      // Update local state
      setAdminSinistres(prev => 
        prev.map(s => s.id === id ? { ...s, statut: nouveauStatut } : s)
      );
      alert("Statut mis à jour !");
    } catch (e: any) { alert(e.message); }
  };

  const exportVersCSV = (type: 'souscriptions' | 'sinistres' | 'strategie' | 'ambassadeurs') => {
    if (type === 'strategie') return alert("L'exportation de la stratégie n'est pas disponible sous format CSV pour le moment.");
    const data = type === 'souscriptions' ? adminData : type === 'ambassadeurs' ? adminAmbassadeurs : adminSinistres;
    if (data.length === 0) return alert("Pas de données à exporter.");

    let header = type === 'souscriptions' 
      ? "ID,Client,Pays,WhatsApp,Offre,Montant,Mode,Signature,Parrainage,Date\n"
      : type === 'ambassadeurs'
        ? "ID,Nom,WhatsApp,Ville,Code,Statut,Date\n"
        : "ID,Client,WhatsApp,Type,Description,Statut,Date\n";
    
    let csv = data.map(item => {
      if (type === 'souscriptions') {
        return `${item.id},"${item.client}","${item.pays}","${item.whatsapp}","${item.offre}",${item.montant},"${item.modePaiement}","${item.signature}","${item.referralCode || '-'}","${item.date?.toDate?.().toLocaleString() || ''}"`;
      } else if (type === 'ambassadeurs') {
        return `${item.id},"${item.nom}","${item.whatsapp}","${item.ville}","${item.code}","${item.statut}","${item.date?.toDate?.().toLocaleString() || ''}"`;
      } else {
        return `${item.id},"${item.client}","${item.whatsapp}","${item.type}","${item.description}","${item.statut}","${item.date?.toDate?.().toLocaleString() || ''}"`;
      }
    }).join("\n");

    const blob = new Blob([header + csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `prevafrica_${type}_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const envoyerWhatsApp = (num: string, message: string) => {
    const cleanNum = num.replace(/\s/g, '').replace('+', '');
    const url = `https://wa.me/${cleanNum}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
  };

  const getAnalyticsData = () => {
    // 1. Chart by Offer
    const byOffreMap: Record<string, number> = {};
    adminData.forEach(d => {
      const o = d.offre || 'Standard';
      byOffreMap[o] = (byOffreMap[o] || 0) + (Number(d.montant) || 0);
    });
    const byOffre = Object.entries(byOffreMap).map(([name, value]) => ({ name, value }));

    // 2. Chart by Pays
    const byPaysMap: Record<string, number> = {};
    adminData.forEach(d => {
      const p = d.pays || 'Inconnu';
      byPaysMap[p] = (byPaysMap[p] || 0) + 1;
    });
    const byPays = Object.entries(byPaysMap).map(([name, value]) => ({ name, value }));

    // 3. Stats by Sinistre Status
    const sinsByStatus: Record<string, number> = {};
    adminSinistres.forEach(s => {
      const st = s.statut || 'Reçu';
      sinsByStatus[st] = (sinsByStatus[st] || 0) + 1;
    });
    const sinsStatus = Object.entries(sinsByStatus).map(([name, value]) => ({ name, value }));

    return { byOffre, byPays, sinsStatus };
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  // --- RENDERS ---
  const renderPartnerPortal = () => {
    const volumeClients = adminData.length;
    const volumeFinancier = adminData.reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0);
    const commissionsPrev = Math.round(volumeFinancier * 0.15);

    return (
      <div className="min-h-screen bg-slate-900 text-white p-6 font-sans overflow-x-hidden">
        <header className="flex justify-between items-center mb-10 max-w-4xl mx-auto">
          <div>
            <h1 className="text-2xl font-black tracking-tighter flex items-center gap-2">
              <span className="text-emerald-400">PREV</span>AFRICA <span className="bg-emerald-500 text-[10px] text-white px-2 py-0.5 rounded-full font-bold">PRO</span>
            </h1>
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mt-1">Espace Partenaire Institutionnel</p>
          </div>
          <button 
            onClick={() => setPartnerSpace(false)}
            className="w-10 h-10 bg-slate-800 rounded-2xl flex items-center justify-center text-xl hover:bg-slate-700 transition-all shadow-xl"
          >
            ✕
          </button>
        </header>

        <div className="max-w-4xl mx-auto space-y-10 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-8 bg-slate-800 rounded-[40px] border border-slate-700 shadow-2xl transition-transform hover:scale-[1.02]">
              <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-2">Volume d'Affaires</p>
              <h3 className="text-3xl font-black">{volumeFinancier.toLocaleString()} <span className="text-sm text-slate-500">FCFA</span></h3>
            </div>
            <div className="p-8 bg-slate-800 rounded-[40px] border border-slate-700 shadow-2xl transition-transform hover:scale-[1.02]">
              <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2">Portefeuille Clients</p>
              <h3 className="text-3xl font-black">{volumeClients} <span className="text-sm text-slate-500">Assurés</span></h3>
            </div>
            <div className="p-8 bg-emerald-500 rounded-[40px] shadow-2xl text-white transition-transform hover:scale-[1.02]">
              <p className="text-[10px] font-black text-emerald-100 uppercase tracking-widest mb-2">Commissions PREV</p>
              <h3 className="text-3xl font-black">{commissionsPrev.toLocaleString()} <span className="text-sm text-emerald-200">FCFA</span></h3>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-800 rounded-[48px] p-8 border border-slate-700 flex flex-col h-full">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-xl font-black italic">Validations Sinistres</h3>
                <span className="px-3 py-1 bg-amber-500/20 text-amber-500 text-[8px] font-black rounded-full uppercase tracking-widest">Action Immédiate</span>
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto max-h-[300px] pr-2 custom-scrollbar">
                {(adminSinistres || []).filter(s => s.statut === 'En cours').length === 0 ? (
                  <div className="h-full flex items-center justify-center text-slate-500 italic text-sm py-10">Aucun dossier en attente.</div>
                ) : (
                  adminSinistres.filter(s => s.statut === 'En cours').map(s => (
                    <div key={s.id} className="p-5 bg-slate-900 rounded-[32px] border border-slate-700 space-y-3 shadow-inner">
                      <div className="flex justify-between items-start">
                         <div>
                            <h4 className="font-bold text-slate-100 text-sm tracking-tight">{s.client}</h4>
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{s.type}</p>
                         </div>
                         <div className="w-8 h-8 bg-slate-800 rounded-xl flex items-center justify-center text-sm shadow-sm">📄</div>
                      </div>
                      <div className="flex gap-2">
                        <button onClick={() => updateStatutSinistre(s.id, 'Validé')} className="flex-1 py-3 bg-emerald-600 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-emerald-500 transition-colors">Valider le Paiement</button>
                        <button onClick={() => updateStatutSinistre(s.id, 'Rejeté')} className="flex-1 py-3 bg-slate-800 rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-700 hover:bg-slate-700 transition-colors">Rejeter</button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-800 rounded-[40px] p-8 border border-slate-700 shadow-xl overflow-hidden relative group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-3xl rounded-full" />
                <h3 className="text-lg font-black mb-6 flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                  Service de Micro-crédit
                </h3>
                <div className="space-y-4 relative z-10">
                  <div className="p-4 bg-slate-900/50 rounded-2xl flex justify-between items-center border border-slate-700">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Demandes / jour</span>
                    <span className="font-black text-emerald-500 text-sm">12</span>
                  </div>
                  <div className="p-4 bg-slate-900/50 rounded-2xl flex justify-between items-center border border-slate-700">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Taux de Risque</span>
                    <span className="font-black text-red-400 text-sm">1.2%</span>
                  </div>
                  <button className="w-full py-4 bg-blue-600 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg hover:bg-blue-500 transition-all transform active:scale-95">Piloter les Décaissements</button>
                </div>
              </div>

              <div className="bg-slate-800 rounded-[40px] p-8 border border-slate-700 shadow-xl">
                <h3 className="text-lg font-black mb-6">Connectivité Systèmes</h3>
                <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-2xl border border-slate-700">
                  <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 font-mono text-xs border border-emerald-500/20">OK</div>
                  <div>
                    <h5 className="font-bold text-sm">Gateway Intégrée</h5>
                    <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wider">{paysConfig[pays]?.gateway || 'Payment Hub'} v2.4</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderPreventionPortal = () => (
    <div className="fixed inset-0 z-[100] bg-white overflow-y-auto font-sans">
      <header className="sticky top-0 bg-white/80 backdrop-blur-md z-20 px-6 py-6 border-b border-slate-100 flex items-center justify-between">
        <button onClick={() => setShowPrevention(false)} className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500">
          <ChevronLeft size={20} />
        </button>
        <div className="text-center">
          <h2 className="text-xl font-black italic tracking-tight">PRÉV<span className="text-emerald-500">SANTÉ</span></h2>
          <p className="text-[8px] font-black text-emerald-500 uppercase tracking-widest">Journal de Prévention</p>
        </div>
        <div className="w-10 h-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
          <ShieldCheck size={20} />
        </div>
      </header>

      <main className="max-w-2xl mx-auto p-6 space-y-10 pb-24">
        {/* News Feed */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-900 italic">Actualités Sanitaires</h3>
            <span className="h-2 w-2 bg-red-500 rounded-full animate-ping" />
          </div>
          
          <div className="space-y-4">
            {[
              { t: "Campagne de Vaccination", d: "La campagne nationale contre la poliomyélite débute ce lundi dans tous les centres de santé agréés.", c: "Info", i: "💉" },
              { t: "Prévention Paludisme", d: "Les fortes pluies augmentent le risque. Dormez sous une moustiquaire imprégnée et videz les eaux stagnantes.", c: "Alerte", i: "🦟" },
              { t: "Hygiène Alimentaire", d: "Lavage des mains systématique avant les repas : le geste barrière n°1 contre le choléra.", c: "Conseil", i: "🧼" }
            ].map((news, i) => (
              <motion.div 
                key={i}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.1 }}
                className="p-6 bg-slate-50 rounded-[32px] border border-slate-100 flex gap-4"
              >
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-2xl shadow-sm shrink-0">
                  {news.i}
                </div>
                <div className="space-y-1">
                  <span className="text-[9px] font-black text-emerald-600 uppercase tracking-widest">{news.c}</span>
                  <h4 className="font-bold text-slate-900 leading-tight">{news.t}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed font-medium">{news.d}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Health Tools */}
        <div className="space-y-6">
          <h3 className="text-xl font-black text-slate-900 italic">Outils Pratiques</h3>
          <div className="grid grid-cols-2 gap-4">
            <div className="p-6 bg-emerald-500 rounded-[32px] text-white space-y-3 shadow-lg shadow-emerald-500/20">
              <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center">
                <CheckCircle size={20} />
              </div>
              <div>
                <h5 className="font-black text-sm">Carnet de Vaccins</h5>
                <p className="text-[10px] opacity-80 font-bold uppercase">Suivi digital gratuit</p>
              </div>
            </div>
            <div className="p-6 bg-slate-900 rounded-[32px] text-white space-y-3 shadow-lg shadow-slate-900/20">
              <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                <Smartphone size={20} />
              </div>
              <div>
                <h5 className="font-black text-sm">Télé-conseil</h5>
                <p className="text-[10px] opacity-60 font-bold uppercase">Disponible 24h/7j</p>
              </div>
            </div>
          </div>
        </div>

        {/* Education Section */}
        <div className="bg-emerald-50 rounded-[48px] p-10 space-y-6 border border-emerald-100">
          <div className="space-y-2">
            <h4 className="text-2xl font-black text-emerald-900">Le Saviez-vous ?</h4>
            <p className="text-emerald-700/70 text-sm font-medium">L'eau potable est le premier médicament de la famille.</p>
          </div>
          <div className="h-px bg-emerald-200" />
          <p className="text-sm text-emerald-800 leading-relaxed font-medium">
            Faire bouillir son eau pendant 1 minute permet d'éliminer 99% des bactéries responsables des maladies diarrhéiques. Un geste simple qui sauve des vies chaque jour.
          </p>
          <button className="w-full h-14 bg-emerald-600 text-white font-black rounded-2xl text-xs uppercase tracking-widest shadow-xl shadow-emerald-600/20">
            LIRE PLUS D'ASTUCES
          </button>
        </div>
      </main>
    </div>
  );

  if (partnerSpace) return renderPartnerPortal();
  if (showPrevention) return renderPreventionPortal();

  if (etape === 'splash') {
    return (
      <div className="min-h-screen bg-white flex flex-col items-center justify-center gap-8 relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[80%] h-[50%] bg-emerald-100 blur-[120px] rounded-full opacity-50" />
        <div className="flex flex-col items-center gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
          >
            <Logo className="w-24 h-24" />
          </motion.div>
          <div className="flex flex-col items-center gap-1">
            <motion.h1 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="text-4xl font-black text-slate-900 tracking-[0.2em]"
            >
              PREVAFRICA
            </motion.h1>
            <p className="text-[10px] font-black text-emerald-500 tracking-[0.5em] uppercase">Solutions Panafricaines</p>
          </div>
        </div>
        <Loader2 className="w-10 h-10 text-emerald-500 animate-spin mt-10" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 relative flex flex-col font-sans selection:bg-emerald-400/20">
      {/* Background Blobs - Aurora Boreale Effect */}
      <div className="atmosphere" />

      <main className="relative z-10 flex-1 flex flex-col max-w-2xl mx-auto w-full p-6">
        {/* Header Logo */}
        <header className="py-8 flex flex-col items-center gap-4">
          <button onClick={() => setEtape('admin_login')} className="hover:opacity-80 transition-all flex flex-col items-center gap-3">
            <Logo className="w-16 h-16" />
            <div className="text-center">
              <h2 className="text-3xl font-black italic tracking-tight text-slate-900">
                PREV<span className="text-emerald-500">AFRICA</span>
              </h2>
              <p className="text-[9px] font-black text-emerald-500 tracking-[0.3em] mt-1 uppercase">Solutions Panafricaines</p>
            </div>
          </button>
        </header>

        {/* Content Screens */}
        <div className="flex-1">
          {etape === 'catalogue' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              {/* Country Picker & Sinistre Alert */}
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Votre Localisation</p>
                   <button 
                    onClick={() => setEtape('sinistre')}
                    className="flex items-center gap-2 text-red-500 text-[10px] font-black uppercase tracking-widest hover:opacity-70 transition-all"
                   >
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                    Déclarer un Sinistre
                   </button>
                </div>
                <div className="flex gap-3 overflow-x-auto pb-4 no-scrollbar -mx-2 px-2">
                  {Object.keys(paysConfig).map(p => (
                    <button
                      key={p}
                      onClick={() => setPays(p)}
                      className={cn(
                        "px-6 py-2 rounded-full border text-sm font-bold whitespace-nowrap transition-all shadow-sm",
                        pays === p 
                          ? "bg-emerald-500 border-emerald-500 text-white" 
                          : "bg-white border-slate-200 text-slate-500 hover:bg-slate-50"
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>

                {/* --- NEW: Referral Welcome --- */}
                {selectedAmbassadeur && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-4"
                  >
                    <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-xl shadow-sm">
                      🤝
                    </div>
                    <div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Recommandé par</p>
                      <p className="text-sm font-bold text-slate-900">{selectedAmbassadeur.nom}</p>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* Title Section */}
              <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div className="space-y-1">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Protégez votre monde.</h3>
                  <p className="text-sm text-slate-500 font-medium">Choisissez votre garantie pour commencer.</p>
                </div>
                
                {/* Category Dropdown Filter */}
                <div className="relative min-w-[200px]">
                  <p className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-2 px-1">Filtrer par Rubrique</p>
                  <div className="relative">
                    <select 
                      value={filtreCategorie}
                      onChange={(e) => setFiltreCategorie(e.target.value)}
                      className="w-full h-12 bg-white border border-slate-200 rounded-xl px-4 appearance-none font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 cursor-pointer shadow-sm pr-10 italic"
                    >
                      {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                    </select>
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                      <Filter size={16} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Grid of Cards */}
              <div className="grid grid-cols-1 gap-4">
                {offres
                  .filter(o => filtreCategorie === 'Toutes les rubriques' || o.categorie === filtreCategorie)
                  .map((o) => (
                  <motion.button
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.98 }}
                    key={o.id}
                    onClick={() => { setProduit(o); setEtape('simulation'); }}
                    className="flex items-center gap-5 p-5 bg-white rounded-[24px] text-left group transition-all border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-500/20"
                  >
                    <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-3xl group-hover:scale-110 transition-transform">
                      {o.icone}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-xl font-bold text-slate-800">{o.titre}</h4>
                      <p className="text-slate-400 text-sm font-medium">{o.desc}</p>
                    </div>
                    <ChevronRight className="text-slate-300 group-hover:text-emerald-500 transition-colors" />
                  </motion.button>
                ))}
              </div>

              {/* Recruitment & Prevention Banners */}
              <div className="space-y-4">
                <motion.button
                  onClick={() => setShowPrevention(true)}
                  className="w-full p-6 bg-emerald-600 rounded-[32px] text-white flex items-center justify-between group overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-white/20 blur-[50px] rounded-full" />
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center text-2xl">
                      📖
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black italic">Journal de Prévention</p>
                      <p className="text-[10px] text-emerald-100 font-bold uppercase tracking-widest">Conseils santé & Alertes sanitaires</p>
                    </div>
                  </div>
                  <ChevronRight className="relative z-10 text-white group-hover:translate-x-1 transition-transform" />
                </motion.button>

                <motion.button
                  onClick={() => setEtape('ambassadeur_rejoindre')}
                  className="w-full p-6 bg-slate-900 rounded-[32px] text-white flex items-center justify-between group overflow-hidden relative"
                >
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-[50px] rounded-full" />
                  <div className="relative z-10 flex items-center gap-4">
                    <div className="w-12 h-12 bg-white/10 rounded-2xl flex items-center justify-center text-2xl">
                      🦁
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-black italic">Devenir Ambassadeur</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gagnez des commissions sur chaque contrat</p>
                    </div>
                  </div>
                  <ChevronRight className="relative z-10 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                </motion.button>
              </div>
            </div>
          )}

          {etape === 'ambassadeur_rejoindre' && (
            <div className="glass rounded-[32px] p-8 space-y-8 animate-in slide-in-from-bottom-5 duration-500">
               <button onClick={() => setEtape('catalogue')} className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                 <ChevronLeft size={20} /> Retour
               </button>
               <div className="text-center space-y-2">
                 <h3 className="text-2xl font-black text-slate-800">Rejoindre le Réseau <span className="text-emerald-500">Lion</span></h3>
                 <p className="text-slate-400 text-xs">Devenez un pilier de la protection sociale dans votre communauté.</p>
               </div>

               <div className="space-y-4">
                 <div className="space-y-2">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Votre Identité</p>
                   <input 
                    type="text"
                    placeholder="Nom complet"
                    value={ambassadeurNom}
                    onChange={(e) => setAmbassadeurNom(e.target.value)}
                    className="w-full h-14 bg-slate-50 rounded-xl px-5 focus:outline-none border border-slate-100 text-slate-900"
                   />
                 </div>

                 <div className="space-y-2">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Contact WhatsApp</p>
                   <input 
                    type="tel"
                    placeholder="+225 00000000"
                    value={ambassadeurWhatsApp}
                    onChange={(e) => setAmbassadeurWhatsApp(e.target.value)}
                    className="w-full h-14 bg-slate-50 rounded-xl px-5 focus:outline-none border border-slate-100 text-slate-900"
                   />
                 </div>

                 <div className="space-y-2">
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Ville / Marché</p>
                   <input 
                    type="text"
                    placeholder="Abidjan / Marché de Cocody"
                    value={ambassadeurVille}
                    onChange={(e) => setAmbassadeurVille(e.target.value)}
                    className="w-full h-14 bg-slate-50 rounded-xl px-5 focus:outline-none border border-slate-100 text-slate-900"
                   />
                 </div>
               </div>

               <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-100 space-y-2">
                 <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Avantages</p>
                 <ul className="text-[11px] text-slate-600 space-y-1 font-medium">
                   <li>• Commission de 10% sur chaque prime collectée.</li>
                   <li>• Bonus de performance mensuel.</li>
                   <li>• Accréditation officielle PREVAFRICA.</li>
                 </ul>
               </div>

               <button 
                onClick={rejoindreAmbassadeur}
                disabled={chargement}
                className="w-full h-16 bg-slate-900 text-white font-black rounded-2xl shadow-xl shadow-slate-900/10 flex items-center justify-center"
               >
                 {chargement ? <Loader2 className="animate-spin" /> : "GÉNÉRER MON CODE AMBASSADEUR"}
               </button>
            </div>
          )}

          {etape === 'ambassadeur_confirmation' && (
            <div className="glass rounded-[40px] p-10 text-center space-y-8 animate-in zoom-in-95 duration-500 border-4 border-emerald-500/20">
               <div className="w-20 h-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-xl shadow-emerald-500/20">
                 <CheckCircle size={40} />
               </div>
               <div className="space-y-2">
                 <h3 className="text-3xl font-black text-slate-900">Bienvenue, Lion !</h3>
                 <p className="text-slate-500 font-medium">Votre profil ambassadeur est activé.</p>
               </div>

               <div className="bg-slate-50 p-8 rounded-[32px] border-2 border-dashed border-emerald-200 space-y-4">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em]">VOTRE CODE UNIQUE</p>
                 <p className="text-4xl font-black text-emerald-600 tracking-wider">{ambassadeurKey}</p>
                 <div className="h-px bg-slate-200 w-full" />
                 <p className="text-[10px] text-slate-400 font-bold leading-relaxed px-4">
                   Partagez ce code avec vos clients. Ils recevront une assistance prioritaire et vous toucherez vos commissions.
                 </p>
               </div>

               <div className="space-y-4">
                 <button 
                  onClick={() => {
                    const text = `Rejoignez PREVAFRICA avec mon code ambassadeur : ${ambassadeurKey} \nSouscrivez ici : ${window.location.origin}/?ref=${ambassadeurKey}`;
                    navigator.clipboard.writeText(text);
                    alert("Copié dans le presse-papier ! Envoyez-le sur vos groupes WhatsApp.");
                  }}
                  className="w-full h-16 bg-emerald-500 text-white font-black rounded-2xl flex items-center justify-center gap-3 shadow-lg"
                 >
                   <Send size={20} />
                   COPIER MON LIEN DE PARRAINAGE
                 </button>
                 <button 
                  onClick={() => setEtape('catalogue')}
                  className="w-full text-slate-400 text-[10px] font-black uppercase tracking-widest"
                 >
                   RETOUR AU CATALOGUE
                 </button>
               </div>
            </div>
          )}

          {etape === 'simulation' && produit && (
            <div className="glass rounded-[32px] p-8 space-y-8 animate-in slide-in-from-bottom-5 duration-500">
              <button 
                onClick={() => setEtape('catalogue')}
                className="flex items-center gap-2 text-emerald-400 font-bold text-sm"
              >
                <ChevronLeft size={20} />
                Retour
              </button>

              <div className="text-center">
                <h3 className="text-2xl font-black mb-2 text-slate-800">{produit.titre}</h3>
                <p className="text-slate-400 text-sm">Garantie active pour : {pays}</p>
                
                {/* Weather Alert for Agricole */}
                {produit.id === 'AGRICOLE_RICE' && meteo && (
                  <motion.div 
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-3 bg-blue-50 border border-blue-100 rounded-xl flex items-center justify-center gap-3"
                  >
                    <div className="text-left">
                      <p className="text-[10px] font-black text-blue-500 uppercase tracking-widest leading-none">Indice Météo Local</p>
                      <p className="text-xs font-bold text-slate-800 uppercase">{meteo.weather[0].description} • {Math.round(meteo.main.temp)}°C</p>
                    </div>
                    <div className="h-8 w-px bg-slate-200" />
                    <p className="text-[8px] text-slate-500 font-medium max-w-[150px] leading-tight text-left">
                      Protection active contre le risque climatique ({meteo.main.temp > 35 ? 'Alerte Sécheresse' : 'Risque Modéré'}).
                    </p>
                  </motion.div>
                )}
              </div>

              {/* Simulation Result Box */}
              <div className="bg-slate-50 rounded-2xl p-6 space-y-2 border border-slate-100 shadow-sm">
                <p className="text-[10px] font-black tracking-widest text-emerald-500 text-center uppercase">
                  {produit.type === 'finance' ? "MENSUALITÉ ESTIMÉE" : "CAPITAL ESTIMÉ"}
                </p>
                <p className="text-3xl font-black text-slate-900 text-center">
                  {capital.toLocaleString()} <span className="text-sm font-bold text-slate-400">{paysConfig[pays]?.devise || 'FCFA'}</span>
                </p>
              </div>

              {/* Montant Input - Curseur Dynamique (Point 4.2) */}
              <div className="space-y-6">
                <div className="space-y-4">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                    {produit.type === 'finance' ? `MONTANT DU PRÊT SOUHAITÉ (${paysConfig[pays]?.devise || 'FCFA'})` : `MA COTISATION MENSUELLE (${paysConfig[pays]?.devise || 'FCFA'})`}
                  </p>
                  
                  <div className="px-4">
                    <input 
                      type="range"
                      min={produit.type === 'finance' ? "20000" : "500"}
                      max={produit.type === 'finance' ? "500000" : "50000"}
                      step={produit.type === 'finance' ? "5000" : "500"}
                      value={montant}
                      onChange={(e) => setMontant(e.target.value)}
                      className="w-full h-1.5 bg-slate-200 rounded-full appearance-none cursor-pointer accent-emerald-500"
                    />
                    <div className="flex justify-between mt-2 text-[10px] font-bold text-slate-600">
                      <span>{produit.type === 'finance' ? "20k" : "500"}</span>
                      <span>{produit.type === 'finance' ? "500k" : "50k"}</span>
                    </div>
                  </div>

                  <div className="h-16 bg-slate-50 rounded-2xl flex items-center justify-center border border-slate-100">
                    <p className="text-3xl font-black text-emerald-500">
                      {parseInt(montant).toLocaleString()} <span className="text-xs font-bold text-slate-400">{paysConfig[pays]?.devise || 'FCFA'}</span>
                    </p>
                  </div>
                </div>

                {/* Duration Picker for Micro-credit */}
                {produit.type === 'finance' && (
                  <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">
                      DURÉE DU CRÉDIT
                    </p>
                    <div className="grid grid-cols-4 gap-2">
                      {[6, 12, 24, 36].map(m => (
                        <button
                          key={m}
                          onClick={() => setDureeCredit(m)}
                          className={cn(
                            "py-3 rounded-xl border font-bold text-xs transition-all",
                            dureeCredit === m 
                              ? "bg-blue-500 border-blue-500 text-white shadow-lg shadow-blue-500/20" 
                              : "bg-white border-slate-100 text-slate-400 hover:bg-slate-50"
                          )}
                        >
                          {m}M
                        </button>
                      ))}
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] text-blue-500 font-bold uppercase tracking-wider">
                        Taux Annuel : {(getTaux(dureeCredit) * 100).toFixed(0)}% • Remboursement total
                      </p>
                    </div>
                  </div>
                )}
              
              {/* eKYC Box - Option 2: Document Management */}
              <div className="bg-slate-50 rounded-2xl p-6 space-y-4 border border-slate-100 relative overflow-hidden group">
                <p className="text-[10px] font-black tracking-widest text-emerald-500 text-center uppercase relative z-10">VÉRIFICATION CNI (eKYC)</p>
                <div className="relative z-10">
                  {!documentOK ? (
                    <label className="cursor-pointer">
                      <div className="w-full h-32 bg-white rounded-xl flex flex-col items-center justify-center gap-3 font-bold hover:bg-slate-50 transition-all border-2 border-dashed border-slate-200 hover:border-emerald-500/50 text-center px-4">
                        {chargement ? (
                          <Loader2 className="animate-spin text-emerald-500" />
                        ) : (
                          <>
                            <Camera size={32} className="text-slate-400 group-hover:text-emerald-500" />
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-tighter">CLIQUEZ POUR PHOTOGRAPHIER OU TÉLÉCHARGER VOTRE PIÈCE</p>
                          </>
                        )}
                      </div>
                      <input 
                        type="file" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        className="hidden" 
                      />
                    </label>
                  ) : (
                    <div className="w-full h-24 bg-emerald-50 rounded-xl flex items-center justify-center gap-3 text-emerald-600 font-black border border-emerald-100 overflow-hidden px-4">
                      <div className="flex flex-col items-center flex-1 truncate">
                        <CheckCircle size={24} />
                        <p className="text-[10px] mt-1 uppercase truncate w-full text-center">{cniFile?.name || "IDENTITÉ REÇUE"}</p>
                      </div>
                      <button 
                        onClick={() => { setDocumentOK(false); setCniFile(null); }}
                        className="p-2 bg-white rounded-full hover:bg-slate-100 transition-all text-slate-400 hover:text-red-500 shadow-sm"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                <input 
                  type="text"
                  placeholder="Nom & Prénom"
                  value={nom}
                  onChange={(e) => setNom(e.target.value)}
                  className="w-full h-14 bg-slate-50 rounded-xl px-5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 border border-slate-100 text-slate-900"
                />
                <div className="flex gap-2">
                  <div className="h-14 aspect-square bg-slate-100 rounded-xl flex items-center justify-center font-bold text-emerald-600 border border-slate-200">
                    {paysConfig[pays].code}
                  </div>
                  <input 
                    type="tel"
                    placeholder="Mobile WhatsApp"
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    className="flex-1 h-14 bg-slate-50 rounded-xl px-5 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 border border-slate-100 text-slate-900"
                  />
                </div>
                
                <div className="space-y-2">
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Signature Électronique Avancée</p>
                  <div className="bg-slate-50 rounded-xl border border-dotted border-slate-300 overflow-hidden h-40 relative group">
                    <SignatureCanvas 
                      ref={signatureRef}
                      penColor='#059669'
                      canvasProps={{ className: 'sigCanvas w-full h-full' }}
                      onEnd={() => setSignature(signatureRef.current.toDataURL())}
                    />
                    <button 
                      onClick={() => { signatureRef.current.clear(); setSignature(''); }}
                      className="absolute bottom-2 right-2 text-[9px] font-black bg-white/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-200 text-slate-400 uppercase tracking-tighter"
                    >
                      Effacer
                    </button>
                    <div className="absolute top-2 left-2 pointer-events-none opacity-20 transform -rotate-3 select-none">
                      <p className="text-[10px] font-mono leading-none">ID-SESSION: {Math.random().toString(36).substring(7)}</p>
                      <p className="text-[10px] font-mono leading-none">HORODATAGE-SERVEUR: {new Date().toLocaleTimeString()}</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 font-medium italic text-center">Utilisez votre doigt ou un stylet pour signer numériquement.</p>
                </div>
              </div>

              {/* Compliance Clause */}
              <div className="flex gap-3 items-start px-2">
                <input type="checkbox" className="mt-1 accent-emerald-400" required defaultChecked />
                <p className="text-[10px] text-slate-500 leading-tight">
                  J'accepte les conditions générales de PREVAFRICA et je certifie l'exactitude des informations fournies conformément aux règles de conformité CIMA.
                </p>
              </div>

              <button 
                onClick={() => { if(documentOK && nom && signature) setEtape('otp'); else alert("Complétez le KYC, votre nom et votre signature"); }}
                className="w-full h-16 bg-emerald-400 rounded-2xl text-slate-950 font-black text-lg shadow-xl shadow-emerald-400/20 hover:scale-[1.02] active:scale-95 transition-all"
              >
                GÉNÉRER MON CONTRAT & VÉRIFIER
              </button>
            </div>
            </div>
          )}

          {etape === 'otp' && (
            <div className="glass rounded-[32px] p-8 space-y-8 animate-in zoom-in-95 duration-300">
               <div className="text-center space-y-4">
                 <div className="w-20 h-20 bg-blue-50 rounded-full flex items-center justify-center mx-auto border border-blue-100">
                    <Smartphone size={32} className="text-blue-500" />
                 </div>
                 <h3 className="text-2xl font-black italic text-slate-800">Vérification SMS</h3>
                 <p className="text-slate-500 text-sm">
                   Un code de sécurité a été envoyé au <span className="text-emerald-500 font-bold">{paysConfig[pays].code} {whatsapp}</span>
                 </p>
               </div>

               <div className="space-y-6">
                 <input 
                  type="text"
                  placeholder="0 0 0 0"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={4}
                  className="w-full h-20 bg-slate-50 rounded-2xl px-6 focus:outline-none border-2 border-slate-100 focus:border-emerald-500/30 text-center text-4xl font-black tracking-[0.5em] text-emerald-500"
                 />
                 
                 <div className="text-center">
                    <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Code de démonstration: 1234</p>
                 </div>

                 <button 
                  onClick={() => { if(otp === '1234') setEtape('paiement'); else alert("Code incorrect (Essayez 1234)"); }}
                  className="w-full h-16 bg-emerald-500 text-white font-black rounded-2xl shadow-xl shadow-emerald-500/20 transition-all active:scale-95"
                 >
                   VALIDER MON NUMÉRO
                 </button>
                 
                 <button onClick={() => setEtape('simulation')} className="w-full text-slate-400 font-bold text-sm">Modifier mes informations</button>
               </div>
            </div>
          )}

          {etape === 'paiement' && (
            <div className="glass rounded-[32px] p-8 space-y-10 animate-in slide-in-from-bottom-5 duration-500">
               <div className="text-center space-y-4">
                 <h3 className="text-xl font-bold text-slate-800">PAIEMENT SÉCURISÉ</h3>
                 <div className="space-y-1">
                   <p className="text-slate-400 text-xs uppercase tracking-widest">Total à payer ({pays})</p>
                   <p className="text-4xl font-black text-emerald-500">{totalPayable.toLocaleString()} FCFA</p>
                 </div>
               </div>

               {chargement ? (
                 <div className="py-12 flex flex-col items-center gap-6">
                    <Loader2 className="w-12 h-12 text-emerald-500 animate-spin" />
                    <p className="text-slate-500 text-center font-medium">Connexion à la passerelle {paysConfig[pays].gateway}...</p>
                 </div>
               ) : (
                 <div className="space-y-4">
                   <button 
                    onClick={() => initierPaiement('Mobile Money')}
                    className="w-full p-6 bg-slate-50 rounded-2xl text-left flex items-center justify-between group hover:bg-emerald-50 transition-all border border-slate-100"
                   >
                     <div className="space-y-1">
                       <p className="text-slate-900 font-black flex items-center gap-2">
                         <Smartphone size={20} className="text-blue-500" />
                         MOBILE MONEY
                       </p>
                       <p className="text-slate-400 text-[10px]">Orange, MTN, Moov, Wave, Free</p>
                     </div>
                     <ChevronRight className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                   </button>

                   <button 
                    onClick={() => initierPaiement('Carte Bancaire')}
                    className="w-full p-6 bg-slate-50 rounded-2xl text-left flex items-center justify-between group hover:bg-emerald-50 transition-all border border-slate-100"
                   >
                     <div className="space-y-1">
                       <p className="text-slate-900 font-black flex items-center gap-2">
                         <CreditCard size={20} className="text-orange-500" />
                         CARTE BANCAIRE
                       </p>
                       <p className="text-slate-400 text-[10px]">Visa, Mastercard, AMEX</p>
                     </div>
                     <ChevronRight className="text-slate-300 group-hover:text-orange-500 transition-colors" />
                   </button>
                 </div>
               )}

               <div className="flex items-center justify-center gap-2 py-4 px-6 bg-slate-50 rounded-full border border-slate-100">
                 <Lock size={14} className="text-slate-400" />
                 <p className="text-[10px] text-slate-400 uppercase tracking-tight font-medium">Paiement crypté SSL via {paysConfig[pays].gateway}</p>
               </div>
            </div>
          )}

          {etape === 'attestation' && produit && (
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-[40px] overflow-hidden text-slate-900 shadow-2xl relative border-8 border-slate-50"
            >
              {/* --- BACKGROUND DECORATION --- */}
              <div className="absolute inset-0 pointer-events-none opacity-[0.03] flex items-center justify-center overflow-hidden">
                <p className="text-[15rem] font-black rotate-12 select-none">PREV</p>
              </div>

              {/* --- HEADER STRIPE --- */}
              <div className="bg-emerald-500 h-3 w-full flex">
                {[...Array(20)].map((_, i) => (
                   <div key={i} className="flex-1 border-r border-emerald-400 opacity-30" />
                ))}
              </div>

              <div className="p-10 space-y-10 relative z-10">
                {/* --- LOGO & ID --- */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <h3 className="text-2xl font-black italic tracking-tighter text-slate-900">PRÉV<span className="text-emerald-500">AFRICA</span></h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">Attestation Officielle</p>
                  </div>
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                    <div className="w-12 h-12 flex flex-wrap gap-1">
                       {[...Array(9)].map((_, i) => (
                         <div key={i} className={cn("w-3 h-3 rounded-sm", Math.random() > 0.5 ? "bg-slate-900" : "bg-slate-200")} />
                       ))}
                    </div>
                  </div>
                </div>

                <div className="h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent w-full" />

                <div className="grid grid-cols-2 gap-x-10 gap-y-8">
                  <div className="space-y-1.5">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">ID CERTIFICAT</p>
                    <p className="text-xs font-mono font-bold text-slate-800">#PREV-{(Math.random()*10000).toFixed(0).padStart(4, '0')}</p>
                  </div>
                  <div className="space-y-1.5 text-right">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">PAYS D'ÉMISSION</p>
                    <p className="text-xs font-bold text-slate-800">{pays.toUpperCase()}</p>
                  </div>
                  
                  <div className="col-span-2 p-6 bg-slate-50 rounded-[28px] border border-slate-100 flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">BÉNÉFICIAIRE GARANTI</p>
                      <p className="text-xl font-black text-slate-900">{nom.toUpperCase()}</p>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Contact: {whatsapp}</p>
                    </div>
                    <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center border-4 border-white shadow-sm">
                      <ShieldCheck className="text-emerald-600" size={28} />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">PRODUIT SÉLECTIONNÉ</p>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-900 text-white rounded-lg flex items-center justify-center text-xs">
                        {produit.icone}
                      </div>
                      <p className="text-lg font-black text-slate-900">{produit.titre}</p>
                    </div>
                  </div>

                  <div className="space-y-2 text-right">
                    <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">MONTANT SOUSCRIT</p>
                    <p className="text-xl font-black text-emerald-600">{parseInt(montant).toLocaleString()} FCFA</p>
                    <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-tighter">Payé intégralement ✅</p>
                  </div>
                </div>

                <div className="flex items-end justify-between pt-4 border-t border-slate-50">
                   <div className="space-y-1">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">SCEAU DIGITAL</p>
                      <div className="w-20 h-20 rounded-full border-4 border-emerald-500/20 flex items-center justify-center rotate-[-15deg] relative">
                        <div className="text-[7px] font-black text-emerald-500/40 text-center uppercase leading-none">
                          CONFIRMÉ<br/>PREVAFRICA<br/>SECURE
                        </div>
                        <CheckCircle size={16} className="text-emerald-500 absolute -top-1 -right-1" />
                      </div>
                   </div>
                   <div className="space-y-4 text-right">
                      <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest">SIGNATURE DU SOUSCRIPTEUR</p>
                      <div className="h-16 flex items-end justify-end">
                        {signature ? (
                          <img src={signature} alt="Signature" className="h-full object-contain filter grayscale contrast-125 pt-2" />
                        ) : (
                          <p className="text-sm font-bold text-slate-300 italic">Signature absente</p>
                        )}
                      </div>
                   </div>
                </div>

                <div className="pt-6 space-y-4">
                  <button 
                    onClick={telechargerContrat}
                    className="w-full h-16 bg-emerald-500 text-white rounded-2xl font-black tracking-[0.2em] hover:bg-emerald-600 transition-all shadow-xl shadow-emerald-500/20 flex items-center justify-center gap-3"
                  >
                    <Download size={20} />
                    TÉLÉCHARGER MON CONTRAT PDF
                  </button>
                  <button 
                    onClick={() => setEtape('catalogue')}
                    className="w-full h-12 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] tracking-[0.2em] hover:bg-slate-200 transition-all uppercase"
                  >
                    Fermer
                  </button>
                  <p className="text-center mt-6 text-[8px] text-slate-400 font-bold uppercase tracking-widest">Document officiel généré numériquement par PREVAFRICA</p>
                </div>
              </div>
            </motion.div>
          )}

          {etape === 'sinistre' && (
            <div className="glass rounded-[32px] p-8 space-y-8 animate-in slide-in-from-bottom-5 duration-500">
               <button onClick={() => setEtape('catalogue')} className="flex items-center gap-2 text-emerald-600 font-bold text-sm">
                 <ChevronLeft size={20} /> Retour
               </button>
               <div className="text-center space-y-2">
                 <h3 className="text-2xl font-black text-slate-800">Déclaration de <span className="text-red-500">Sinistre</span></h3>
                 <p className="text-slate-400 text-xs">Signalez un événement pour l'ouverture de votre dossier.</p>
               </div>

               <div className="space-y-4">
                 <select 
                  value={sinistreType}
                  onChange={(e) => setSinistreType(e.target.value)}
                  className="w-full h-14 bg-slate-50 rounded-xl px-5 focus:outline-none border border-slate-100 text-slate-700 font-bold"
                 >
                   <option value="">Type d'événement</option>
                   <option value="Accès Hospitalisation">Hospitalisation</option>
                   <option value="Perte de Récolte">Perte de Récolte (Agricole)</option>
                   <option value="Décès">Décès /Obsèques</option>
                   <option value="Accident Logistique">Accident Logistique</option>
                 </select>

                 <textarea 
                  placeholder="Décrivez l'événement avec précision..."
                  value={sinistreDesc}
                  onChange={(e) => setSinistreDesc(e.target.value)}
                  className="w-full min-h-[120px] bg-slate-50 rounded-xl p-5 focus:outline-none border border-slate-100 text-slate-700"
                 />
               </div>

               {/* Photo Upload for Proofs */}
               <div className="bg-slate-50 rounded-2xl p-6 space-y-3 border border-slate-100 text-center">
                  <Camera size={24} className="mx-auto text-slate-400" />
                  <p className="text-[10px] font-medium text-slate-400 uppercase">Preuves (CNI, Certificat médical...)</p>
                  <button className="text-xs font-black text-emerald-600 px-4 py-2 bg-white rounded-lg border border-slate-100 shadow-sm">TÉLÉCHARGER DES DOCUMENTS</button>
               </div>

               <button 
                onClick={handleSinistre}
                disabled={chargement}
                className="w-full h-16 bg-red-500 text-white font-black rounded-2xl shadow-xl shadow-red-500/20"
               >
                 {chargement ? <Loader2 className="animate-spin mx-auto" /> : "TRANSMETTRE LE DOSSIER"}
               </button>
            </div>
          )}

          {etape === 'admin_login' && (
            <div className="bg-white rounded-[40px] p-10 shadow-2xl border border-slate-100 max-w-md w-full mx-auto space-y-8 animate-in zoom-in-95 duration-300">
               <div className="text-center space-y-4">
                 <div className="w-16 h-16 bg-emerald-50 rounded-2xl flex items-center justify-center mx-auto border border-emerald-100">
                    <ShieldCheck size={32} className="text-emerald-500" />
                 </div>
                 <h3 className="text-2xl font-black text-slate-800 tracking-tight">Espace Direction</h3>
                 <p className="text-slate-400 text-sm font-medium">Accès restreint aux administrateurs de PREVAFRICA.</p>
               </div>

               <div className="space-y-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest px-1">Code de Direction</label>
                   <input 
                    type="password"
                    value={adminPass}
                    onChange={(e) => setAdminPass(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && chargerAdmin()}
                    placeholder="••••"
                    className="w-full h-16 bg-slate-50 rounded-2xl px-6 focus:outline-none border-2 border-slate-100 focus:border-emerald-500/30 text-center text-2xl tracking-[0.6em] text-slate-800"
                   />
                 </div>
                 
                 <button 
                  onClick={chargerAdmin}
                  disabled={chargement}
                  className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-[0.2em] shadow-lg shadow-slate-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                 >
                   {chargement ? (
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                   ) : "Débloquer l'accès"}
                 </button>

                 <button 
                  onClick={() => setEtape('catalogue')}
                  className="w-full text-slate-400 text-[10px] font-bold uppercase tracking-widest hover:text-slate-600 transition-colors"
                 >
                   Retour à l'accueil
                 </button>
               </div>
            </div>
          )}

          {etape === 'admin_list' && (
            <div className="space-y-8 animate-in slide-in-from-right-10 duration-500 pb-12">
               <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="space-y-1">
                   <h3 className="text-3xl font-black italic">Poste de <span className="text-emerald-400">Pilotage</span></h3>
                   <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Tableau de Bord PDG • PREVAFRICA</p>
                 </div>
                 <div className="flex items-center gap-3">
                   <button 
                     onClick={() => exportVersCSV(adminTab)}
                     className="px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center gap-2 shadow-lg"
                   >
                     <Download size={14} />
                     Exporter CSV
                   </button>
                   <button onClick={() => setEtape('catalogue')} className="p-3 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all">
                     <X className="text-slate-400" />
                   </button>
                 </div>
               </div>

               {/* --- ANALYTICS DASHBOARD --- */}
               <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                 <div className="glass rounded-[32px] p-8 border border-slate-100 shadow-xl space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                        <TrendingUp size={18} className="text-emerald-500" />
                        Volume par Offre (FCFA)
                      </h4>
                    </div>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={getAnalyticsData().byOffre}
                            cx="50%"
                            cy="50%"
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {getAnalyticsData().byOffre.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend verticalAlign="bottom" height={36}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                 </div>

                 <div className="glass rounded-[32px] p-8 border border-slate-100 shadow-xl space-y-6">
                    <div className="flex items-center justify-between">
                      <h4 className="font-black text-slate-800 text-sm uppercase tracking-widest flex items-center gap-2">
                        <MapPin size={18} className="text-blue-500" />
                        Pénétration par Pays
                      </h4>
                    </div>
                    <div className="h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={getAnalyticsData().byPays}>
                          <XAxis dataKey="name" fontSize={10} fontWeight="bold" />
                          <YAxis fontSize={10} />
                          <Tooltip cursor={{fill: '#f8fafc'}} contentStyle={{ borderRadius: '16px', border: 'none' }} />
                          <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                 </div>
               </div>

               {/* --- ADMIN TABS --- */}
               <div className="flex bg-slate-100 p-1 rounded-2xl border border-slate-200/50 shadow-inner">
                 <button 
                   onClick={() => setAdminTab('souscriptions')}
                   className={cn(
                     "flex-1 py-3 rounded-xl font-black text-xs transition-all tracking-widest",
                     adminTab === 'souscriptions' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                   )}
                 >
                   SOUSCRIPTIONS
                 </button>
                  <button 
                    onClick={() => setAdminTab('ambassadeurs')}
                    className={cn(
                      "flex-1 py-3 rounded-xl font-black text-xs transition-all tracking-widest",
                      adminTab === 'ambassadeurs' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    LIONS ({(adminAmbassadeurs || []).length})
                  </button>
                 <button 
                   onClick={() => setAdminTab('sinistres')}
                   className={cn(
                     "flex-1 py-3 rounded-xl font-black text-xs transition-all tracking-widest",
                     adminTab === 'sinistres' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                   )}
                 >
                   SINISTRES ({(adminSinistres || []).length})
                 </button>
                 <button 
                   onClick={() => setAdminTab('strategie')}
                   className={cn(
                     "flex-1 py-3 rounded-xl font-black text-xs transition-all tracking-widest",
                     adminTab === 'strategie' ? "bg-white text-emerald-600 shadow-sm" : "text-slate-400 hover:text-slate-600"
                    )}
                  >
                    STRATÉGIE 🚀
                  </button>
                </div>

                {adminTab === 'souscriptions' ? (
                 <>
                   {/* --- STATS GRID --- */}
                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="glass p-6 rounded-[28px] border-l-4 border-l-emerald-500 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Primes Collectées</p>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-black text-slate-800">
                            {(adminData || []).reduce((acc: any, curr: any) => acc + (Number(curr?.montant) || 0), 0).toLocaleString()}
                          </span>
                          <span className="text-emerald-500 font-bold text-sm mb-1">FCFA</span>
                        </div>
                     </div>
                     <div className="glass p-6 rounded-[28px] border-l-4 border-l-blue-500 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Nombre de Souscripteurs</p>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-black text-slate-800">{(adminData || []).length}</span>
                          <span className="text-blue-500 font-bold text-sm mb-1">Membres</span>
                        </div>
                     </div>
                     <div className="glass p-6 rounded-[28px] border-l-4 border-l-amber-500 shadow-sm">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Prime Moyenne</p>
                        <div className="flex items-end gap-2">
                          <span className="text-3xl font-black text-slate-800">
                            {(adminData || []).length > 0 
                              ? Math.round((adminData || []).reduce((acc: any, curr: any) => acc + (Number(curr?.montant) || 0), 0) / adminData.length).toLocaleString()
                              : 0
                            }
                          </span>
                          <span className="text-amber-400 font-bold text-sm mb-1">FCFA</span>
                        </div>
                     </div>
                   </div>

                   {/* --- BREAKDOWN BY COUNTRY --- */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                     <div className="glass rounded-[32px] p-6 space-y-4">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2">
                          <MapPin size={18} className="text-emerald-500" />
                          Revenus par Pays
                        </h4>
                        <div className="space-y-3">
                          {Array.from(new Set((adminData || []).map(d => d?.pays || 'Inconnu'))).map(p => {
                            const totalCountry = (adminData || []).filter(d => (d?.pays || 'Inconnu') === p).reduce((acc: any, curr: any) => acc + (Number(curr?.montant) || 0), 0);
                            const countCountry = (adminData || []).filter(d => (d?.pays || 'Inconnu') === p).length;
                            return (
                              <div key={p} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                <span className="font-bold text-sm text-slate-700">{p} ({countCountry})</span>
                                <span className="text-emerald-600 font-black">{totalCountry.toLocaleString()} FCFA</span>
                              </div>
                            )
                          })}
                          {(adminData || []).length === 0 && <p className="text-slate-400 text-xs italic">En attente de données...</p>}
                        </div>
                     </div>

                     <div className="glass rounded-[32px] p-6 space-y-4">
                        <h4 className="font-bold text-slate-700 flex items-center gap-2">
                          <ShieldCheck size={18} className="text-blue-500" />
                          Garanties demandées
                        </h4>
                        <div className="space-y-3">
                          {Array.from(new Set((adminData || []).map(d => d?.offre || 'Standard'))).map(o => {
                            const countOffre = (adminData || []).filter(d => (d?.offre || 'Standard') === o).length;
                            const percentage = (adminData || []).length > 0 ? Math.round((countOffre / adminData.length) * 100) : 0;
                            return (
                              <div key={o} className="space-y-1">
                                <div className="flex justify-between text-xs font-bold">
                                  <span className="text-slate-600">{o}</span>
                                  <span className="text-blue-600">{countOffre}</span>
                                </div>
                                <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                  <div className="h-full bg-blue-500" style={{ width: `${percentage}%` }} />
                                </div>
                              </div>
                            )
                          })}
                          {(adminData || []).length === 0 && <p className="text-slate-400 text-xs italic">En attente de données...</p>}
                        </div>
                     </div>
                   </div>
                   
                   {/* --- LIST TABLE --- */}
                   <div className="space-y-4">
                     <h4 className="font-bold text-slate-800 px-2 mt-8">Flux des dernières transactions</h4>
                     {(adminData || []).length === 0 && <p className="text-slate-400 text-center py-20 bg-slate-50 rounded-[32px] border border-slate-100">Aucune souscription enregistrée.</p>}
                     <div className="flex flex-col gap-3">
                       {(adminData || []).map(item => (
                         <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          key={item?.id} 
                          className="p-6 bg-white rounded-[24px] shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 border border-emerald-100 hover:border-emerald-300 transition-all cursor-default"
                         >
                           <div className="flex items-center gap-4">
                             <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center font-bold text-emerald-600">
                               {(item?.pays || '??').substring(0, 2).toUpperCase()}
                             </div>
                             <div className="space-y-0.5">
                               <h4 className="text-slate-900 font-black text-lg">{item?.client || 'Client'}</h4>
                               <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">{item?.offre || 'Contrat'} • {item?.whatsapp || '-'}</p>
                               {item?.referralCode && (
                                 <p className="text-emerald-500 text-[9px] font-black uppercase tracking-tighter italic">🦁 Apporté par: {item.referralCode}</p>
                               )}
                             </div>
                           </div>
                           <div className="flex items-center gap-6">
                              <div className="text-right">
                                <p className="text-slate-900 font-black text-xl">{(Number(item?.montant) || 0).toLocaleString()} FCFA</p>
                                <p className="text-slate-400 text-[9px] font-bold uppercase tracking-widest">{item?.modePaiement || 'Mobile'}</p>
                                {item?.signature && <p className="text-slate-400 text-[8px] font-medium italic">Signé: {item.signature}</p>}
                              </div>
                            <div className="flex items-center gap-2">
                               <button 
                                 onClick={() => envoyerWhatsApp(item?.whatsapp || '', `Bonjour ${item?.client}, votre souscription PREVAFRICA pour l'offre ${item?.offre} a bien été validée. Merci de votre confiance.`)}
                                 className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center hover:bg-emerald-100 transition-all border border-emerald-100"
                                 title="Notification WhatsApp"
                               >
                                 <MessageCircle size={18} />
                               </button>
                               <div className="px-4 py-1.5 bg-emerald-500 text-white rounded-full text-[10px] font-black shadow-lg shadow-emerald-500/20 uppercase">PAYÉ ✅</div>
                            </div>
                           </div>
                         </motion.div>
                       ))}
                     </div>
                   </div>
                 </>
                ) : adminTab === 'ambassadeurs' ? (
                  <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
                    <div className="px-2">
                      <h4 className="font-bold text-slate-800">Réseau des Ambassadeurs (Lions)</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Partenaires de proximité</p>
                    </div>

                    {(adminAmbassadeurs || []).length === 0 && (
                      <div className="py-20 text-center bg-slate-50 rounded-[40px] border border-slate-100">
                        <p className="text-slate-400 font-medium italic">Aucun ambassadeur inscrit.</p>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {(adminAmbassadeurs || []).map(item => {
                        const directReferrals = adminData.filter(d => d.referralCode === item.code).length;
                        const totalVolume = adminData.filter(d => d.referralCode === item.code).reduce((acc, curr) => acc + (Number(curr.montant) || 0), 0);
                        const commission = Math.round(totalVolume * 0.1);

                        return (
                          <div key={item.id} className="p-6 bg-white rounded-[32px] shadow-lg border border-slate-100 space-y-4">
                            <div className="flex justify-between items-start">
                              <div className="w-12 h-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-xl shadow-sm">
                                🦁
                              </div>
                              <span className="px-3 py-1 bg-slate-100 text-slate-500 text-[9px] font-black rounded-full">{item.code}</span>
                            </div>
                            <div>
                               <h4 className="text-xl font-black text-slate-900">{item.nom}</h4>
                               <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">{item.ville}</p>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                               <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                 <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Recrutés</p>
                                 <p className="text-lg font-black text-slate-800">{directReferrals}</p>
                               </div>
                               <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                                 <p className="text-[8px] font-black text-emerald-600 uppercase tracking-widest">Commissions</p>
                                 <p className="text-lg font-black text-emerald-600">{commission.toLocaleString()} <span className="text-[8px]">F</span></p>
                               </div>
                            </div>
                            <button 
                              onClick={() => {
                                // @ts-ignore
                                envoyerWhatsApp(item.whatsapp, "Bonjour Lion " + item.nom + ", voici le point sur vos commissions : " + commission + " FCFA pour " + directReferrals + " clients recrutés.");
                              }}
                              className="w-full py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-600 transition-all flex items-center justify-center gap-2"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" className="lucide lucide-message-circle"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/><path d="M8 12h.01"/><path d="M12 12h.01"/><path d="M16 12h.01"/></svg>
                              Contacter via WhatsApp
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                
               ) : adminTab === 'sinistres' ? (
                 <div className="space-y-6 animate-in slide-in-from-bottom-4 duration-500 pb-12">
                   <div className="px-2">
                     <h4 className="font-bold text-slate-800">Réclamations & Sinistres</h4>
                     <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Dernières déclarations reçues</p>
                   </div>

                   {(adminSinistres || []).length === 0 && (
                     <div className="py-20 text-center bg-slate-50 rounded-[40px] border border-slate-100 space-y-3">
                       <ShieldCheck size={48} className="mx-auto text-slate-200" />
                       <p className="text-slate-400 font-medium italic">Aucun sinistre déclaré pour le moment.</p>
                     </div>
                   )}

                   <div className="flex flex-col gap-4">
                     {(adminSinistres || []).map(item => (
                       <motion.div 
                         initial={{ opacity: 0, scale: 0.98 }}
                         animate={{ opacity: 1, scale: 1 }}
                         key={item?.id} 
                         className="p-8 bg-white rounded-[32px] shadow-lg border border-red-50 hover:border-red-200 transition-all group"
                       >
                         <div className="flex justify-between items-start mb-6">
                           <div className="flex items-center gap-2">
                             <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                             <span className="px-3 py-1 bg-red-50 text-red-600 text-[10px] font-black rounded-full tracking-tighter">SINISTRE ACTIF</span>
                           </div>
                           <span className="text-slate-400 text-[10px] font-bold italic">
                             {item?.date && typeof item.date.toDate === 'function' 
                                ? item.date.toDate().toLocaleDateString('fr-FR') 
                                : 'Date inconnue'}
                           </span>
                         </div>

                         <div className="space-y-4">
                            <div className="flex items-center justify-between">
                              <h4 className="text-2xl font-black text-slate-900 group-hover:text-red-600 transition-colors">{item?.client || 'Client'}</h4>
                              <span className="font-black text-emerald-600 text-[10px] bg-emerald-50 px-3 py-1 rounded-lg uppercase tracking-[0.2em]">{item?.type || 'Inconnu'}</span>
                            </div>
                            
                            <p className="text-slate-600 text-sm leading-relaxed bg-slate-50 p-6 rounded-2xl italic border border-slate-100">
                              "{item?.description || 'Pas de description.'}"
                            </p>

                            <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center">
                                  <Smartphone size={16} className="text-slate-400" />
                                </div>
                                <span className="text-sm font-black text-slate-700">{item?.whatsapp || '-'}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <select 
                                  value={item?.statut || 'Reçu'} 
                                  onChange={(e) => updateStatutSinistre(item.id, e.target.value)}
                                  className={cn(
                                    "text-[10px] font-black px-4 py-2.5 rounded-xl border outline-none transition-all uppercase tracking-widest cursor-pointer",
                                    item?.statut === 'Réglé' ? "bg-emerald-50 text-emerald-600 border-emerald-100" :
                                    item?.statut === 'En cours' ? "bg-blue-50 text-blue-600 border-blue-100" :
                                    item?.statut === 'Rejeté' ? "bg-slate-50 text-slate-400 border-slate-100" :
                                    "bg-red-50 text-red-600 border-red-100"
                                  )}
                                >
                                  <option value="Reçu">Nouveau</option>
                                  <option value="En cours">En Charge</option>
                                  <option value="Réglé">Réglé</option>
                                  <option value="Rejeté">Classé</option>
                                </select>
                                <button 
                                  onClick={() => updateStatutSinistre(item.id, 'En cours')}
                                  className="text-[10px] font-black text-white bg-slate-900 px-6 py-3 rounded-xl hover:bg-slate-800 transition-all uppercase tracking-widest disabled:opacity-50"
                                  disabled={item?.statut === 'En cours' || item?.statut === 'Réglé'}
                                >
                                  {item?.statut === 'En cours' ? 'En charge' : item?.statut === 'Réglé' ? 'Términé' : 'Prendre en charge'}
                                </button>
                              </div>
                            </div>
                         </div>
                       </motion.div>
                     ))}
                   </div>
                 </div>
               ) : (
                 <div className="space-y-10 animate-in fade-in duration-700 pb-20 px-2 outline-none">
                    {/* --- STRATEGY SECTION (Point 5.1, 5.2, 5.3) --- */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                       {/* Plan de Monétisation */}
                       <div className="glass p-8 rounded-[40px] border border-emerald-100 shadow-xl space-y-6">
                         <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                             <TrendingUp size={24} />
                           </div>
                           <div>
                             <h4 className="font-black text-slate-800 text-lg">Monétisation 2026</h4>
                             <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Maximiser la Rentabilité</p>
                           </div>
                         </div>
                         <ul className="space-y-4">
                           <li className="flex gap-3">
                             <div className="w-5 h-5 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                               <CheckCircle size={12} className="text-emerald-500" />
                             </div>
                             <p className="text-sm text-slate-600 font-medium leading-relaxed">
                               <span className="font-black text-slate-800">Commissions Directes (12%)</span>: Prélevées sur chaque prime collectée via Mobile Money.
                             </p>
                           </li>
                           <li className="flex gap-3">
                             <div className="w-5 h-5 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                               <CheckCircle size={12} className="text-emerald-500" />
                             </div>
                             <p className="text-sm text-slate-600 font-medium leading-relaxed">
                               <span className="font-black text-slate-800">Frais de Dossier eKYC</span>: 500 FCFA par nouvelle souscription pour couvrir les coûts technologiques.
                             </p>
                           </li>
                         </ul>
                       </div>

                       {/* Plan de Sensibilisation */}
                       <div className="glass p-8 rounded-[40px] border border-blue-100 shadow-xl space-y-6">
                         <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-blue-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-500/20">
                             <MessageCircle size={24} />
                           </div>
                           <div>
                             <h4 className="font-black text-slate-800 text-lg">Sensibilisation</h4>
                             <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Stratégie de Croissance</p>
                           </div>
                         </div>
                         <ul className="space-y-4">
                           <li className="flex gap-3">
                             <div className="w-5 h-5 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                               <Plus size={12} className="text-blue-500" />
                             </div>
                             <p className="text-sm text-slate-600 font-medium leading-relaxed">
                               <span className="font-black text-slate-800">Réseau d'Ambassadeurs</span>: Agents de proximité dans les marchés (points relais PREVAFRICA).
                             </p>
                           </li>
                           <li className="flex gap-3">
                             <div className="w-5 h-5 bg-blue-50 rounded-full flex items-center justify-center shrink-0">
                               <Plus size={12} className="text-blue-500" />
                             </div>
                             <p className="text-sm text-slate-600 font-medium leading-relaxed">
                               <span className="font-black text-slate-800">Campagnes WhatsApp</span>: Diffusion de mini-vidéos éducatives en langues locales.
                             </p>
                           </li>
                         </ul>
                       </div>

                       {/* Guide Android & Play Console */}
                       <div className="md:col-span-2 bg-slate-900 rounded-[40px] p-10 text-white space-y-10 shadow-2xl relative overflow-hidden">
                          <div className="absolute top-0 right-0 w-96 h-96 bg-emerald-500/10 blur-[100px] rounded-full" />
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                            <div className="space-y-2">
                              <h4 className="text-3xl font-black italic">Guide Déploiement Android</h4>
                              <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.4em]">PREVAFRICA App Store Readiness</p>
                            </div>
                            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center backdrop-blur shadow-inner">
                              <Smartphone size={32} className="text-emerald-400" />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative z-10">
                             <div className="p-8 bg-white/5 rounded-[32px] border border-white/10 space-y-4 hover:border-emerald-500/30 transition-all group">
                               <div className="w-10 h-10 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center font-black text-sm">1</div>
                               <h5 className="font-black text-lg">Validation PWA</h5>
                               <p className="text-[11px] text-slate-400 leading-relaxed font-medium">L'infrastructure est déjà configurée como une "Progressive Web App". Vos utilisateurs peuvent l'installer directement via Chrome sans passer par un store.</p>
                             </div>
                             <div className="p-8 bg-white/5 rounded-[32px] border border-white/10 space-y-4 hover:border-emerald-500/30 transition-all group">
                               <div className="w-10 h-10 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center font-black text-sm">2</div>
                               <h5 className="font-black text-lg">TWA Wrapping</h5>
                               <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Utilisez l'outil <span className="text-emerald-400">Bubblewrap</span> de Google pour encapsuler l'URL https://prevafrica.web.app en 1 minute.</p>
                             </div>
                             <div className="p-8 bg-white/5 rounded-[32px] border border-white/10 space-y-4 hover:border-emerald-500/30 transition-all group">
                               <div className="w-10 h-10 bg-emerald-500 text-slate-950 rounded-full flex items-center justify-center font-black text-sm">3</div>
                               <h5 className="font-black text-lg">Google Play</h5>
                               <p className="text-[11px] text-slate-400 leading-relaxed font-medium">Uploadez votre fichier .aab sur la Console Play Store. Votre application sera validée et téléchargeable partout en Afrique.</p>
                             </div>
                          </div>

                          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 relative z-10">
                            <div className="flex items-center gap-3">
                               <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                               <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest italic">Certificat SSL & PWA Manifest Actifs</p>
                            </div>
                            <button 
                              onClick={() => window.open('https://play.google.com/console', '_blank')}
                              className="w-full md:w-auto px-10 py-5 bg-emerald-500 text-slate-950 font-black text-xs rounded-2xl uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-xl shadow-emerald-500/20"
                            >
                              Accéder à Google Play Console
                            </button>
                          </div>
                       </div>

                       {/* Centre de Téléchargement des Visuels Play Store */}
                       <div className="md:col-span-2 glass rounded-[40px] p-8 border border-slate-100 shadow-xl space-y-6">
                         <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center border border-emerald-100">
                             <Download size={24} />
                           </div>
                           <div>
                             <h4 className="font-black text-slate-800 text-lg">Centre de Téléchargement - Visuels Play Store</h4>
                             <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest">Actifs Graphiques HD Prêts</p>
                           </div>
                         </div>
                         
                         <p className="text-sm text-slate-500 font-medium leading-relaxed">
                           Téléchargez directement les visuels requis par Google Play sur votre appareil. Ces fichiers respectent scrupuleusement les contraintes de dimensions imposées par la Play Console.
                         </p>

                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           {[
                             { key: 'icon', name: 'Icône officielle', desc: 'Format PNG HD, exactement 512x512 pixels.', size: '512x512 px', color: 'text-emerald-500 bg-emerald-50' },
                             { key: 'feature', name: 'Graphique de présentation', desc: 'Bannière promotionnelle en 1024x500 requise par Google.', size: '1024x500 px', color: 'text-blue-500 bg-blue-50' },
                             { key: 'phone', name: 'Capture Téléphone #1', desc: 'Premier aperçu du tableau de bord (9:16).', size: 'Aspect 9:16', color: 'text-purple-500 bg-purple-50' },
                             { key: 'phone2', name: 'Capture Téléphone #2', desc: 'Deuxième vue de l\'interface de souscription (9:16).', size: 'Aspect 9:16', color: 'text-purple-500 bg-purple-50' },
                             { key: 'phone3', name: 'Capture Téléphone #3', desc: 'Troisième vue affichant l\'historique des sinistres et remboursements (9:16).', size: 'Aspect 9:16', color: 'text-purple-500 bg-purple-50' },
                             { key: 'phone4', name: 'Capture Téléphone #4', desc: 'Quatrième vue présentant les conseils de prévention santé (9:16).', size: 'Aspect 9:16', color: 'text-purple-500 bg-purple-50' },
                             { key: 'tablet7', name: 'Capture Tablette 7" #1', desc: 'Premier aperçu d\'analyse financière (3:4).', size: 'Aspect 3:4', color: 'text-amber-500 bg-amber-50' },
                             { key: 'tablet7_2', name: 'Capture Tablette 7" #2', desc: 'Deuxième vue de la gestion d\'épargne (3:4).', size: 'Aspect 3:4', color: 'text-amber-500 bg-amber-50' },
                             { key: 'tablet7_3', name: 'Capture Tablette 7" #3', desc: 'Troisième vue de l\'optimiseur de prévoyance (3:4).', size: 'Aspect 3:4', color: 'text-amber-500 bg-amber-50' },
                             { key: 'tablet7_4', name: 'Capture Tablette 7" #4', desc: 'Quatrième vue récapitulative des contrats actifs (3:4).', size: 'Aspect 3:4', color: 'text-amber-500 bg-amber-50' },
                             { key: 'tablet10', name: 'Capture Tablette 10" #1', desc: 'Premier aperçu en mode paysage large (4:3).', size: 'Aspect 4:3', color: 'text-pink-500 bg-pink-50' },
                             { key: 'tablet10_2', name: 'Capture Tablette 10" #2', desc: 'Deuxième vue récapitulative des contrats (4:3).', size: 'Aspect 4:3', color: 'text-pink-500 bg-pink-50' },
                             { key: 'tablet10_3', name: 'Capture Tablette 10" #3', desc: 'Troisième vue d\'admission d\'urgence avec code QR (4:3).', size: 'Aspect 4:3', color: 'text-pink-500 bg-pink-50' },
                             { key: 'tablet10_4', name: 'Capture Tablette 10" #4', desc: 'Quatrième vue d\'historique et synchronisation hors-ligne (4:3).', size: 'Aspect 4:3', color: 'text-pink-500 bg-pink-50' }
                           ].map((asset, i) => (
                             <div key={i} className="p-5 bg-slate-50 rounded-2xl border border-slate-100 flex flex-col justify-between gap-4">
                               <div className="space-y-1">
                                 <div className="flex items-center justify-between">
                                   <span className={cn("text-[8px] font-black px-2 py-0.5 rounded-md uppercase tracking-wide", asset.color)}>
                                     {asset.size}
                                   </span>
                                   <span className="text-slate-400 font-bold text-[9px]">PNG</span>
                                 </div>
                                 <h5 className="font-black text-slate-800 text-sm leading-tight">{asset.name}</h5>
                                 <p className="text-xs text-slate-400 font-medium">{asset.desc}</p>
                               </div>
                               <button 
                                 onClick={() => handleDownloadAsset(asset.key)}
                                 className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white font-black text-[9px] rounded-xl uppercase tracking-widest transition-all flex items-center justify-center gap-2 shadow-sm"
                                >
                                 <Download size={12} />
                                 Télécharger en HD
                               </button>
                             </div>
                           ))}
                         </div>
                       </div>
                    </div>
                  </div>
                )}
            </div>
          )}
          {etape === 'manifeste' && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-10 py-4 animate-in fade-in duration-700"
            >
              <div className="flex items-center justify-between">
                <button 
                  onClick={() => setEtape('catalogue')}
                  className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200 transition-all"
                >
                  <ArrowLeft size={18} />
                </button>
                <div className="text-right">
                  <span className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.3em]">Vision Strategique</span>
                  <p className="text-slate-400 text-[9px] font-bold">Version 1.0 — 2026</p>
                </div>
              </div>

              <div className="space-y-4">
                <h2 className="text-4xl font-black text-slate-900 leading-tight">
                  Le Lion de la <br />
                  <span className="text-emerald-500">Fintech Africaine</span>
                </h2>
                <div className="h-1.5 w-20 bg-emerald-500 rounded-full" />
              </div>

              <section className="bg-white p-8 rounded-[40px] shadow-xl shadow-emerald-500/5 border border-emerald-50 space-y-6">
                <p className="text-lg text-slate-700 font-medium leading-relaxed italic">
                  "Démocratiser la protection sociale en Afrique francophone en combinant technologie mobile et micro-assurance."
                </p>
                <p className="text-slate-500 leading-relaxed text-sm">
                  PREVAFRICA n'est pas seulement une application, c'est un filet de sécurité numérique pour les millions de professionnels du secteur informel (commerçants, agriculteurs, transporteurs) qui constituent le cœur de notre économie.
                </p>
              </section>

              <div className="grid grid-cols-1 gap-6">
                {[
                  { t: "🦁 Héritage", d: "Prévoyance Décès et Frais Funéraires avec capital garanti x500." },
                  { t: "🎓 Avenir", d: "Épargne éducation pour garantir la scolarité de vos enfants." },
                  { t: "🏥 Santé", d: "Indemnités journalières directes en cas d'hospitalisation." },
                  { t: "🌾 Agricole", d: "Protection des récoltes connectée aux stations météo par IA." }
                ].map((p, i) => (
                  <div key={i} className="flex gap-4 p-5 bg-slate-50 rounded-3xl border border-slate-100">
                    <div className="space-y-1">
                      <h4 className="font-black text-slate-900">{p.t}</h4>
                      <p className="text-slate-500 text-sm">{p.d}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-6 pt-6 pb-12 text-center border-t border-slate-100">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">Innovation Technologique</h4>
                <div className="flex flex-wrap justify-center gap-3">
                  {["eKYC Instantané", "OTP Security", "Météo IA", "Panafricanisme"].map(tag => (
                    <span key={tag} className="px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full text-[10px] font-black border border-emerald-100">
                      {tag}
                    </span>
                  ))}
                </div>
                <button 
                  onClick={() => setEtape('catalogue')}
                  className="mt-8 bg-slate-900 text-white font-black text-xs px-12 py-5 rounded-2xl shadow-xl hover:bg-slate-800 transition-all uppercase tracking-widest"
                >
                  Découvrir nos offres
                </button>
              </div>
            </motion.div>
          )}
        </div>

        <footer className="py-12 mt-auto flex flex-col items-center gap-6">
          <div className="flex flex-wrap justify-center gap-4">
            <button 
              onClick={() => setEtape('manifeste')}
              className="text-[10px] font-black text-emerald-600 hover:text-emerald-700 uppercase tracking-widest bg-emerald-50 px-4 py-2 rounded-full transition-all border border-emerald-100 hover:border-emerald-200"
            >
              NOTRE MANIFESTE STRATÉGIQUE 🌍
            </button>
            <button 
              onClick={() => {
                setPartnerSpace(true);
                window.scrollTo(0, 0);
              }}
              className="text-[10px] font-black text-blue-600 hover:text-blue-700 uppercase tracking-widest bg-blue-50 px-4 py-2 rounded-full transition-all border border-blue-100 hover:border-blue-200"
            >
              PORTAIL PARTENAIRES 🤝
            </button>
          </div>
          
          <div className="flex flex-wrap justify-center gap-6">
            <a 
              href="/privacy" 
              target="_blank" 
              className="text-[9px] font-bold text-slate-400 hover:text-emerald-500 uppercase tracking-widest transition-colors"
            >
              Confidentialité
            </a>
            <span className="text-slate-200">•</span>
            <a 
              href="/delete-account" 
              target="_blank" 
              className="text-[9px] font-bold text-slate-400 hover:text-emerald-500 uppercase tracking-widest transition-colors"
            >
              Suppression de compte
            </a>
          </div>

          <p className="text-slate-600 text-[10px] text-center uppercase tracking-[0.2em] font-medium opacity-60">
            © 2026 PREVAFRICA — Vision 2.4 — Octobre 2026 • Sécurité SSL 256-bit
          </p>
        </footer>
      </main>
    </div>
  );
}
