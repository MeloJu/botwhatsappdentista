const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('chatbot.db');

const initDb = () => {
    db.serialize(() => {
        // Tabela para o histórico da conversa
        db.run(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        // Tabela para gerenciar sessões
        db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                user_id TEXT PRIMARY KEY,
                slot_esperado TEXT,
                agendamento_temp TEXT
            );
        `);
        // Nova tabela para os agendamentos internos
        db.run(`
            CREATE TABLE IF NOT EXISTS agendamentos (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nome TEXT NOT NULL,
                email TEXT,
                telefone TEXT,
                data TEXT NOT NULL,
                hora TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
    });
};

const saveMessage = (userId, role, message) => {
    // ... (A função saveMessage permanece a mesma)
};

const getHistory = (userId) => {
    // ... (A função getHistory permanece a mesma)
};

const updateSession = (userId, slotEsperado = null, agendamentoTemp = null) => {
    // ... (A função updateSession permanece a mesma)
};

const getSession = (userId) => {
    // ... (A função getSession permanece a mesma)
};

// Nova função para salvar um agendamento
const saveAgendamento = (agendamento) => {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare(`
            INSERT INTO agendamentos (nome, email, telefone, data, hora)
            VALUES (?, ?, ?, ?, ?)
        `);
        stmt.run(
            agendamento.nome,
            agendamento.email,
            agendamento.telefone,
            agendamento.data,
            agendamento.hora,
            function(err) {
                if (err) {
                    reject(err);
                } else {
                    resolve(this.lastID);
                }
            }
        );
        stmt.finalize();
    });
};

// Nova função para listar horários ocupados
const getHorariosOcupados = (data) => {
    return new Promise((resolve, reject) => {
        db.all("SELECT hora FROM agendamentos WHERE data = ?", [data], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const horariosOcupados = rows.map(row => row.hora);
                resolve(horariosOcupados);
            }
        });
    });
};

module.exports = { initDb, saveMessage, getHistory, updateSession, getSession, saveAgendamento, getHorariosOcupados };