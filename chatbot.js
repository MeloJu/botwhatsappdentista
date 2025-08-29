const axios = require('axios');
const db = require('./db');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config();

const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';

const institutoData = JSON.parse(fs.readFileSync('./data.json', 'utf8'));

// Função auxiliar para gerar os horários disponíveis
const listarHorariosDisponiveis = async () => {
    // Exemplo de horários pré-definidos para os próximos dias
    const horarios = [
        { dia: "Terça-feira", data: "25/08/2025", hora: "15:30h" },
        { dia: "Sexta-feira", data: "28/08/2025", hora: "14:00h" },
        { dia: "Terça-feira", data: "01/09/2025", hora: "16:00h" }
    ];
    
    // Filtra os horários que já foram agendados no banco de dados
    const horariosOcupados = await db.getHorariosOcupados(new Date().toLocaleDateString('pt-BR'));
    
    const disponiveis = horarios.filter(h => !horariosOcupados.includes(h.hora));
    
    return disponiveis;
};

// Constrói o prompt para o modelo de IA
const buildPrompt = (historico, sessao, horariosDisponiveis) => {
    const valoresStr = Object.entries(institutoData.valores)
        .map(([key, value]) => `- ${key.replace(/([A-Z])/g, ' $1').toLowerCase()}: R$${value},00`)
        .join('\n');

    const horariosStr = horariosDisponiveis
        .map((h, i) => `${i + 1}. ${h.dia}, ${h.data} às ${h.hora}`)
        .join('\n');
    
    let promptFinal = `
Você é um chatbot assistente do Instituto de Carvalho.
Sua principal função é ajudar com agendamentos de consultas, responder perguntas sobre tratamentos e fornecer informações gerais.

**Instruções de Resposta:**
- Mantenha a conversa natural e amigável.
- Responda apenas com texto. Não use emojis ou formatações de listas.
- Se o usuário perguntar sobre agendamento, responda com as opções de horários disponíveis.
- Se o usuário fornecer nome, email ou telefone, responda confirmando o dado recebido e solicitando o próximo.
- Se todas as informações para agendamento (nome, email, telefone, data e hora) forem fornecidas, responda com uma frase de confirmação específica, como: "✅ Agendamento Confirmado. Te ligaremos em breve para confirmar."
- Use as informações abaixo como suas únicas fontes de verdade.

**Informações do Instituto:**
- Nome: ${institutoData.nome}
- Telefone: ${institutoData.telefone}
- Endereço: ${institutoData.endereco}
- Valores de Consulta:
${valoresStr}
- Horários de Funcionamento:
  - Terça: ${institutoData.horarios.terca}
  - Sexta: ${institutoData.horarios.sexta}

**Horários Disponíveis (para agendamento):**
${horariosStr}
    `;

    // Converte o histórico para o formato de mensagens da API do Groq
    const messages = [{
        role: "system",
        content: promptFinal
    }];

    historico.forEach(msg => {
        messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.text
        });
    });

    if (sessao.slot_esperado) {
        messages.push({
            role: "system",
            content: `Você está atualmente coletando o slot: ${sessao.slot_esperado}.`
        });
    }

    return messages;
};

// Extrai dados da mensagem do usuário usando regex
const extrairDados = (mensagem) => {
    const dados = {};
    const nomeMatch = mensagem.match(/nome\s?completo\s?é\s?(.*)/i) || mensagem.match(/me\s?chamo\s?(.*)/i);
    if (nomeMatch && nomeMatch[1]) dados.nome = nomeMatch[1].trim();

    const emailMatch = mensagem.match(/([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/i);
    if (emailMatch && emailMatch[1]) dados.email = emailMatch[1].trim();

    const telefoneMatch = mensagem.match(/(\d{2}\s?\d{5}\s?\d{4}|\d{11})/);
    if (telefoneMatch && telefoneMatch[1]) dados.telefone = telefoneMatch[1].trim();
    
    return dados;
};

// Função principal de processamento de mensagens
async function processarMensagem(userId, novaMensagem) {
    try {
        const historico = await db.getHistory(userId);
        let sessao = await db.getSession(userId);
        
        // Verifica se é a primeira mensagem do usuário ou uma saudação
        const mensagemMin = novaMensagem.toLowerCase().trim();
        const isSaudacao = ["olá", "oi", "ola", "oi tudo bem", "bom dia", "boa tarde", "boa noite"].includes(mensagemMin);

        if (historico.length === 0 || isSaudacao) {
            const mensagemBoasVindas = `👋 Olá! Seja bem-vindo(a) ao Instituto de Carvalho.

Posso te ajudar com:

1️⃣ Agendar uma consulta 🗓️
2️⃣ Conhecer nossos cursos 🎓
3️⃣ Tirar dúvidas sobre tratamentos 🦷

Como posso te ajudar hoje?`;
            
            await db.saveMessage(userId, 'user', novaMensagem);
            await db.saveMessage(userId, 'model', mensagemBoasVindas);
            return mensagemBoasVindas;
        }

        const horariosDisponiveis = await listarHorariosDisponiveis();

        const dadosExtraidos = extrairDados(novaMensagem);
        let agendamentoTemp = sessao.agendamento_temp || {};

        if (dadosExtraidos.nome) {
            agendamentoTemp.nome = dadosExtraidos.nome;
            await db.updateSession(userId, 'email', agendamentoTemp);
        } else if (dadosExtraidos.email) {
            agendamentoTemp.email = dadosExtraidos.email;
            await db.updateSession(userId, 'telefone', agendamentoTemp);
        } else if (dadosExtraidos.telefone) {
            agendamentoTemp.telefone = dadosExtraidos.telefone;
            await db.updateSession(userId, null, agendamentoTemp);
        }

        const promptMessages = buildPrompt(historico, sessao, horariosDisponiveis);
        promptMessages.push({ role: 'user', content: novaMensagem });

        const groqResponse = await axios.post(
            GROQ_API_URL,
            { model: 'llama3-8b-8192', messages: promptMessages },
            { headers: { 'Authorization': `Bearer ${GROQ_API_KEY}` } }
        );

        const textoResposta = groqResponse.data.choices[0].message.content;
        
        await db.saveMessage(userId, 'user', novaMensagem);
        await db.saveMessage(userId, 'model', textoResposta);

        if (textoResposta.includes("✅ Agendamento Confirmado")) {
            await db.saveAgendamento({
                nome: agendamentoTemp.nome,
                email: agendamentoTemp.email,
                telefone: agendamentoTemp.telefone,
                data: '25/08/2025',
                hora: '15:30h'
            });
            await db.updateSession(userId, null, null);
        }
        
        return textoResposta;
    } catch (erro) {
        console.error('Erro ao processar mensagem:', erro);
        return 'Desculpe, ocorreu um erro. Por favor, tente novamente mais tarde.';
    }
}

module.exports = { processarMensagem };