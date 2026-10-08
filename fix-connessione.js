const fs = require('fs');
const path = require('path');
const appPath = path.join(__dirname, 'gui', 'src', 'App.jsx');
let content = fs.readFileSync(appPath, 'utf8');
content = content.replace(/Connessione\.\.\.\ufffd/g, 'Connessione...');
fs.writeFileSync(appPath, content, 'utf8');
console.log('Fixed Connessione...');

