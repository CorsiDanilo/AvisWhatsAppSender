const fs = require('fs');
const path = require('path');

const appPath = path.join(__dirname, 'gui', 'src', 'App.jsx');
let content = fs.readFileSync(appPath, 'utf8');

content = content.replace(/gesto \ufffd prezioso/g, 'gesto è prezioso');
content = content.replace(/si terr\ufffd una raccolta/g, 'si terrà una raccolta');
content = content.replace(/Modalit\ufffd /g, 'Modalità ');

fs.writeFileSync(appPath, content, 'utf8');

