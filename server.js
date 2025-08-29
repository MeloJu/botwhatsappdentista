const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const dotenv = require('dotenv');
dotenv.config();

// Importação necessária para gerar a imagem do QR Code
const qrcode = require('qrcode');
const fs = require('fs');

const { processarMensagem } = require('./chatbot');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Configuração do WhatsApp Web
const client = new Client({
    authStrategy: new LocalAuth()
});

client.on('qr', (qr) => {
    console.log('QR recebido', qr);

    // Gerar e salvar o QR Code como um arquivo de imagem PNG
    qrcode.toFile('qrcode.png', qr, {
        type: 'png'
    }, (err) => {
        if (err) {
            console.error('Erro ao salvar o QR Code como imagem:', err);
        } else {
            console.log('✅ QR Code salvo como qrcode.png. Por favor, escaneie este arquivo para continuar.');
        }
    });
});

client.on('ready', () => {
    console.log('WhatsApp conectado com sucesso!');
});

client.on('message', async (msg) => {
    const userId = msg.from;
    const mensagem = msg.body;
    console.log(`[WHATSAPP] Mensagem de ${userId}: ${mensagem}`);
    const resposta = await processarMensagem(userId, mensagem);
    await msg.reply(resposta);
});

client.initialize();

db.initDb();

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});