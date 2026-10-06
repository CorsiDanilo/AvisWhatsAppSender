const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

const inputImg = process.argv[2];
const outputIco = path.join(__dirname, '..', 'build', 'icon.ico');

if (!inputImg) {
  console.error('Specifica il file immagine di input!');
  process.exit(1);
}

async function run() {
  try {
    console.log('Lettura immagine con Jimp...');
    const image = await Jimp.read(inputImg);
    image.resize({ w: 256, h: 256 });
    
    const tempPng = path.join(__dirname, 'temp_icon.png');
    await image.write(tempPng);
    console.log('Convertita in PNG temporaneo.');
    
    const buf = await pngToIco(tempPng);
    fs.writeFileSync(outputIco, buf);
    console.log('Icona ICO creata con successo in build/icon.ico');
    
    fs.unlinkSync(tempPng);
  } catch (err) {
    console.error('Errore:', err);
    process.exit(1);
  }
}

run();
