const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('chatbot.db');

const initDb = () => {
    db.serialize(() => {
        db.run(`
            CREATE TABLE IF NOT EXISTS conversations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id TEXT NOT NULL,
                role TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        `);
        db.run(`
            CREATE TABLE IF NOT EXISTS sessions (
                user_id TEXT PRIMARY KEY,
                slot_esperado TEXT,
                agendamento_temp TEXT
            );
        `);
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
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("INSERT INTO conversations (user_id, role, message) VALUES (?, ?, ?)");
        stmt.run(userId, role, message, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        stmt.finalize();
    });
};

const getHistory = (userId) => {
    return new Promise((resolve, reject) => {
        db.all("SELECT role, message FROM conversations WHERE user_id = ? ORDER BY timestamp ASC", [userId], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                const history = rows.map(row => ({
                    role: row.role === 'user' ? 'user' : 'model',
                    text: row.message
                }));
                resolve(history);
            }
        });
    });
};

const updateSession = (userId, slotEsperado = null, agendamentoTemp = null) => {
    return new Promise((resolve, reject) => {
        const stmt = db.prepare("INSERT OR REPLACE INTO sessions (user_id, slot_esperado, agendamento_temp) VALUES (?, ?, ?)");
        stmt.run(userId, slotEsperado, agendamentoTemp ? JSON.stringify(agendamentoTemp) : null, function(err) {
            if (err) {
                reject(err);
            } else {
                resolve(this.lastID);
            }
        });
        stmt.finalize();
    });
};

const getSession = (userId) => {
    return new Promise((resolve, reject) => {
        db.get("SELECT slot_esperado, agendamento_temp FROM sessions WHERE user_id = ?", [userId], (err, row) => {
            if (err) {
                reject(err);
            } else {
                if (row && row.agendamento_temp) {
                    row.agendamento_temp = JSON.parse(row.agendamento_temp);
                }
                resolve(row || {});
            }
        });
    });
};

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

const getAllAgendamentos = () => {
    return new Promise((resolve, reject) => {
        db.all("SELECT * FROM agendamentos ORDER BY id DESC", [], (err, rows) => {
            if (err) {
                reject(err);
            } else {
                resolve(rows);
            }
        });
    });
};


module.exports = {
    initDb,
    saveMessage,
    getHistory,
    updateSession,
    getSession,
    saveAgendamento,
    getHorariosOcupados,
    getAllAgendamentos
};