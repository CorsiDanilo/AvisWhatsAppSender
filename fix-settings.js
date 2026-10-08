const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'gui', 'src', 'components', 'SettingsModal.jsx');
let content = fs.readFileSync(filePath, 'utf8');

// Add Lucide imports
if (!content.includes('lucide-react')) {
  content = content.replace(
    "import '../App.css'",
    "import { Folder, FileText, Download, Cake, HelpCircle, ExternalLink, Image, Save, RefreshCw, CheckCircle, Package, ArrowRight, Play, BookOpen } from 'lucide-react'\nimport '../App.css'"
  );
}

// Replace the corrupt text characters
content = content.replace(/Verifica in corso\ufffd/g, 'Verifica in corso...');

// Replace specific emoji artifacts with Lucide icons
content = content.replace(/\?\? Cartelle e Archiviazione/g, '<Folder className="tab-icon" size={16} /> Cartelle e Archiviazione');
content = content.replace(/\?\? Modelli & Preset/g, '<FileText className="tab-icon" size={16} /> Modelli & Preset');
content = content.replace(/\?\? Aggiornamenti/g, '<Download className="tab-icon" size={16} /> Aggiornamenti');
content = content.replace(/\?\? Compleanni/g, '<Cake className="tab-icon" size={16} /> Compleanni');
content = content.replace(/\?\? Guida & Tutorial/g, '<HelpCircle className="tab-icon" size={16} /> Guida & Tutorial');

content = content.replace(/\?\? Apri in Esplora Risorse/g, '<ExternalLink size={16} /> Apri in Esplora Risorse');
content = content.replace(/\?\? Apri cartella log/g, '<ExternalLink size={16} /> Apri cartella log');
content = content.replace(/\?\? Apri cartella dati app/g, '<ExternalLink size={16} /> Apri cartella dati app');

content = content.replace(/"birthday-settings-hero-icon" aria-hidden="true">\?\?</g, '"birthday-settings-hero-icon" aria-hidden="true"><Cake size={48} /><');
content = content.replace(/"birthday-card-icon" aria-hidden="true">\?\?</g, '"birthday-card-icon" aria-hidden="true"><FileText size={24} /><');

content = content.replace(/>\s*\?\?\s*<\/button>/g, '><ExternalLink size={16} /></button>'); // Apri file
content = content.replace(/"preset-attachment-icon" aria-hidden="true">\?\?</g, '"preset-attachment-icon" aria-hidden="true"><Image size={16} /><');
content = content.replace(/\?\? Salva Modello/g, '<Save size={16} /> Salva Modello');

content = content.replace(/\? Verifica in corso.../g, '<RefreshCw size={16} className="spinning" /> Verifica in corso...');
content = content.replace(/\?\? Controlla ora/g, '<RefreshCw size={16} /> Controlla ora');

content = content.replace(/<div className="update-box-icon">\?\?<\/div>/g, '<div className="update-box-icon"><CheckCircle size={32} /></div>');
content = content.replace(/\?\? Scarica e aggiorna/g, '<Download size={16} /> Scarica e aggiorna');

content = content.replace(/\?\? Avvia Tutorial Interattivo/g, '<Play size={16} /> Avvia Tutorial Interattivo');
content = content.replace(/\?\? Leggi il Manuale Operativo/g, '<BookOpen size={16} /> Leggi il Manuale Operativo');

fs.writeFileSync(filePath, content, 'utf8');
console.log('SettingsModal.jsx aggiornato');

