const express = require('express');
const { Client, LocalAuth } = require('whatsapp-web.js');
const dotenv = require('dotenv');
const path = require('path');
const fs = require('fs');
const qrcode = require('qrcode');

dotenv.config();

const { processarMensagem } = require('./chatbot');
const db = require('./db');

const app = express();
const port = process.env.PORT || 3000;

// Configuração do WhatsApp Web
const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: './.wwebjs_auth/'
    })
});

let isBotRunning = false;
let qrCodeData = null;

// === Eventos do Cliente WhatsApp (sempre ativos) ===
client.on('qr', (qr) => {
    console.log('QR recebido', qr);
    qrCodeData = qr;
});

client.on('ready', () => {
    isBotRunning = true;
    console.log('WhatsApp conectado com sucesso!');
});

client.on('message', async (msg) => {
    const userId = msg.from;
    const mensagem = msg.body;
    console.log(`[WHATSAPP] Mensagem de ${userId}: ${mensagem}`);
    const resposta = await processarMensagem(userId, mensagem);
    await msg.reply(resposta);
});

// === Rotas do Servidor ===
// Serve a pasta 'public' para arquivos estáticos (index.html, agenda.html, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// Rota da API para ligar o bot
app.get('/start-bot', (req, res) => {
    if (isBotRunning) {
        return res.status(200).send('Bot já está em execução.');
    }
    
    client.initialize()
        .then(() => {
            res.status(200).send('Bot iniciado. Verifique o terminal para o QR Code.');
        })
        .catch(err => {
            console.error('Erro na inicialização do bot:', err);
            res.status(500).send('Erro ao iniciar o bot.');
        });
});

// Rota da API para obter o QR Code
app.get('/api/qrcode', async (req, res) => {
    if (qrCodeData) {
        const qrUrl = await qrcode.toDataURL(qrCodeData);
        res.status(200).send(qrUrl);
    } else {
        res.status(404).send('QR Code não gerado.');
    }
});

// Rota da API para fornecer os dados da agenda
app.get('/api/agenda', async (req, res) => {
    try {
        const agendamentos = await db.getAllAgendamentos();
        res.json(agendamentos);
    } catch (error) {
        console.error('Erro ao buscar agendamentos:', error);
        res.status(500).send('Erro ao carregar a agenda.');
    }
});

app.listen(port, () => {
    console.log(`Servidor rodando na porta ${port}`);
});