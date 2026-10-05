const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const fs = require('fs');
const csv = require('csv-parser');

// === IMPOSTAZIONI ANTI-BAN ===
const MIN_DELAY_MS = 15000; // Minimo 15 secondi tra un messaggio e l'altro
const MAX_DELAY_MS = 35000; // Massimo 35 secondi
const PAUSE_AFTER_MESSAGES = 40; // Pausa lunga ogni 40 messaggi
const PAUSE_DURATION_MS = 15 * 60 * 1000; // 15 minuti di pausa lunga

const client = new Client({
    // LocalAuth salva la sessione in una cartella ".wwebjs_auth", 
    // così non devi scannerizzare il QR Code ogni volta.
    authStrategy: new LocalAuth(), 
    puppeteer: {
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    }
});

// Mostra il QR Code nel terminale
client.on('qr', (qr) => {
    qrcode.generate(qr, { small: true });
    console.log('^ Scansiona il QR Code con WhatsApp sul tuo telefono ^');
});

// Quando il client è pronto
client.on('ready', () => {
    console.log('✅ Client WhatsApp connesso con successo!');
    iniziaSpedizione();
});

client.initialize();

// Funzione per creare un ritardo
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
// Funzione per ottenere un ritardo random tra due valori
const getRandomDelay = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

async function iniziaSpedizione() {
    const donatori = [];
    
    // Assicurati che il file donatori.csv esista
    if (!fs.existsSync('donatori.csv')) {
        console.error('❌ Il file donatori.csv non esiste! Crealo prima di avviare.');
        return;
    }

    console.log('Lettura del file donatori.csv...');
    fs.createReadStream('donatori.csv')
        .pipe(csv())
        .on('data', (row) => {
            donatori.push(row);
        })
        .on('end', async () => {
            console.log(`Trovati ${donatori.length} donatori da contattare.`);
            if (donatori.length > 0) {
                await processaCoda(donatori);
            }
        });
}

async function processaCoda(donatori) {
    let count = 0;

    for (const donatore of donatori) {
        const nome = donatore.Nome;

        // Controllo validità telefono
        if (!donatore.Telefono) {
            console.warn(`⚠️ Nessun telefono trovato per ${nome}, salto il contatto.`);
            continue;
        }

        let telefono = donatore.Telefono.replace(/\s+/g, '').replace('+', ''); // Pulisci il numero
        
        // Assicurati che il numero inizi col prefisso italiano se manca (da adattare)
        if (telefono.length === 10) {
            telefono = `39${telefono}`;
        }

        // Suffisso obbligatorio per identificare un numero di telefono su WhatsApp
        const chatId = `${telefono}@c.us`; 

        const messaggio = `Ciao ${nome}, ti ricordiamo che puoi tornare a donare il sangue! Grazie per il tuo supporto. Se non vuoi più ricevere questi messaggi, rispondi STOP.`;

        try {
            console.log(`[${count + 1}/${donatori.length}] Preparazione messaggio per ${nome} (${telefono})...`);
            
            // Anti-Ban: Simula "Sta scrivendo..."
            try {
                const chat = await client.getChatById(chatId);
                await chat.sendStateTyping();
                
                // Aspetta qualche secondo mentre "scrive" proporzionalmente al testo
                await delay(getRandomDelay(2000, 5000));
            } catch (chatError) {
                // Se la chat non esiste (es. numero non su whatsapp), questo potrebbe fallire, lo ignoriamo e proviamo a mandare
            }
            
            // Invia il messaggio
            await client.sendMessage(chatId, messaggio);
            console.log(`✅ Messaggio inviato a ${nome}!`);

        } catch (error) {
            console.error(`❌ Errore invio a ${nome} (${telefono}):`, error.message);
        }

        count++;

        // Controlla se abbiamo finito
        if (count >= donatori.length) {
            console.log('🎉 Spedizione completata con successo!');
            break;
        }

        // Anti-Ban: Controlla se dobbiamo fare la pausa lunga
        if (count % PAUSE_AFTER_MESSAGES === 0) {
            console.log(`⏳ Pausa lunga di ${PAUSE_DURATION_MS / 60000} minuti (Anti-Ban)...`);
            await delay(PAUSE_DURATION_MS);
        } else {
            // Anti-Ban: Pausa randomica tra un messaggio e l'altro
            const pausa = getRandomDelay(MIN_DELAY_MS, MAX_DELAY_MS);
            console.log(`Attesa di ${Math.round(pausa / 1000)} secondi prima del prossimo...`);
            await delay(pausa);
        }
    }
}
