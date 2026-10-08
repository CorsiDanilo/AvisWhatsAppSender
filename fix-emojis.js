const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'gui', 'src', 'App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

// Testo corrotto per encoding
content = content.replace(/gesto  prezioso!/g, 'gesto è prezioso!');
content = content.replace(/gesto  prezioso!/g, 'gesto è prezioso!');
content = content.replace(/si terr una raccolta/g, 'si terrà una raccolta');
content = content.replace(/si terr una raccolta/g, 'si terrà una raccolta');
content = content.replace(/Modalit protetta/g, 'Modalità protetta');
content = content.replace(/Modalit protetta/g, 'Modalità protetta');
content = content.replace(/Modalit tutorial/g, 'Modalità tutorial');
content = content.replace(/Modalit tutorial/g, 'Modalità tutorial');
content = content.replace(/Azione richiesta  WhatsApp/g, 'Azione richiesta • WhatsApp');
content = content.replace(/Azione richiesta  WhatsApp/g, 'Azione richiesta • WhatsApp');
content = content.replace(/Connessione/g, 'Connessione...');
content = content.replace(/Connessione /g, 'Connessione...');

// Emoji in template WhatsApp e console log
content = content.replace(/\?\?(\\n\\nTi ricordiamo)/g, '❤️$1');
content = content.replace(/\[\d{2}:\d{2}:\d{2}\] \? /g, '📨 ');
content = content.replace(/\?\? Sessione simulata/g, '✅ Sessione simulata');

// Icone topbar
content = content.replace(/\? <span className="new-session-label">/g, '<Plus className="topbar-icon" size={18} /> <span className="new-session-label">');
content = content.replace(/\?\? <span>Compleanni<\/span>/g, '<Gift className="topbar-icon" size={18} /> <span>Compleanni</span>');
content = content.replace(/\?\? <span>Guida<\/span>/g, '<HelpCircle className="topbar-icon" size={18} /> <span>Guida</span>');

// Settings e Notifications icon
content = content.replace(/>\s*\?\?\s*\{state\.updater\?/g, '>\n              <Settings className="topbar-icon" size={18} />\n              {state.updater?');
content = content.replace(/>\s*\?\?\s*\{state\.notifications\?/g, '>\n              <Bell className="topbar-icon" size={18} />\n              {state.notifications?');

// Banner icone
content = content.replace(/<span className="tutorial-banner-icon">\?\?<\/span>/g, '<span className="tutorial-banner-icon"><GraduationCap size={24} /></span>');
content = content.replace(/\? Esci dal Tutorial/g, '<X size={16} /> Esci dal Tutorial');
content = content.replace(/<span className="update-banner-icon">\?<\/span>/g, '<span className="update-banner-icon"><Download size={24} /></span>');
content = content.replace(/\? Chiudi/g, '<X size={16} /> Chiudi');
content = content.replace(/<span className="update-banner-icon">\?\?<\/span>/g, '<span className="update-banner-icon"><CheckCircle size={24} /></span>');
content = content.replace(/<span>\?\?<\/span> Rigenera QR code/g, '<span><RefreshCw size={16} /></span> Rigenera QR code');
content = content.replace(/\? Riduci/g, '<ChevronDown size={16} /> Riduci');

fs.writeFileSync(appPath, content, 'utf8');
console.log('App.jsx aggiornato con successo');

