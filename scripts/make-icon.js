const fs = require('fs');
const path = require('path');
const { Jimp } = require('jimp');
const pngToIco = require('png-to-ico').default || require('png-to-ico');

const inputImg = process.argv[2];
const outputIcoBuild = path.join(__dirname, '..', 'build', 'icon.ico');
const outputIcoRes = path.join(__dirname, '..', 'resources', 'icon.ico');
const outputNotificationIcoBuild = path.join(__dirname, '..', 'build', 'icon-notification.ico');
const outputNotificationIcoRes = path.join(__dirname, '..', 'resources', 'icon-notification.ico');



if (!inputImg) {
  console.error('Specifica il file immagine di input!');
  process.exit(1);
}

async function run() {
  try {
    console.log('Lettura immagine con Jimp...');
    const logo = await Jimp.read(inputImg);
    const scale = Math.min(216 / logo.width, 216 / logo.height);
    const targetW = Math.max(1, Math.round(logo.width * scale));
    const targetH = Math.max(1, Math.round(logo.height * scale));
    logo.resize({ w: targetW, h: targetH });

    const canvas = new Jimp({ width: 256, height: 256, color: 0x00000000 });
    const r = 44;
    const padding = 8;
    const x0 = padding, y0 = padding, x1 = 256 - padding, y1 = 256 - padding;

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        if (x >= x0 && x < x1 && y >= y0 && y < y1) {
          let inside = true;
          let dx = 0, dy = 0;
          if (x < x0 + r && y < y0 + r) { dx = (x0 + r) - x; dy = (y0 + r) - y; }
          else if (x >= x1 - r && y < y0 + r) { dx = x - (x1 - r - 1); dy = (y0 + r) - y; }
          else if (x < x0 + r && y >= y1 - r) { dx = (x0 + r) - x; dy = y - (y1 - r - 1); }
          else if (x >= x1 - r && y >= y1 - r) { dx = x - (x1 - r - 1); dy = y - (y1 - r - 1); }

          if (dx > 0 && dy > 0 && Math.sqrt(dx * dx + dy * dy) > r) {
            inside = false;
          }
          if (inside) {
            canvas.setPixelColor(0xffffffff, x, y);
          }
        }
      }
    }

    const posX = Math.round((256 - targetW) / 2);
    const posY = Math.round((256 - targetH) / 2);
    canvas.composite(logo, posX, posY);

    const notificationCanvas = canvas.clone();
    const circle = (centerX, centerY, radius, color) => {
      for (let y = centerY - radius; y <= centerY + radius; y++) {
        for (let x = centerX - radius; x <= centerX + radius; x++) {
          const dx = x - centerX;
          const dy = y - centerY;
          if (dx * dx + dy * dy <= radius * radius) notificationCanvas.setPixelColor(color, x, y);
        }
      }
    };
        circle(204, 52, 42, 0xffffffff);
    circle(204, 52, 32, 0xc92c2cff);

    const tempPng = path.join(__dirname, 'temp_icon.png');
    const tempNotificationPng = path.join(__dirname, 'temp_notification_icon.png');
    await canvas.write(tempPng);
    await notificationCanvas.write(tempNotificationPng);
    console.log('Convertita in PNG temporaneo.');

    const buf = await pngToIco(tempPng);
    const notificationBuf = await pngToIco(tempNotificationPng);
    fs.mkdirSync(path.dirname(outputIcoBuild), { recursive: true });
    fs.writeFileSync(outputIcoBuild, buf);
    fs.mkdirSync(path.dirname(outputIcoRes), { recursive: true });
    fs.writeFileSync(outputIcoRes, buf);
    fs.writeFileSync(outputNotificationIcoBuild, notificationBuf);
    fs.writeFileSync(outputNotificationIcoRes, notificationBuf);
    console.log('Icone create con successo nelle cartelle build e resources.');

    fs.unlinkSync(tempPng);
    fs.unlinkSync(tempNotificationPng);
  } catch (err) {
    console.error('Errore:', err);
    process.exit(1);
  }
}

run();
