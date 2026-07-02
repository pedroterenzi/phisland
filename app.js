const API_URL = "https://phisland.onrender.com"; 

let dataHoje = new Date();
const hojeStr = dataHoje.toISOString().split('T')[0];

let startOfWeek = new Date(dataHoje);
startOfWeek.setDate(dataHoje.getDate() - (dataHoje.getDay() === 0 ? 6 : dataHoje.getDay() - 1));
let endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 6);

const startStr = startOfWeek.toISOString().split('T')[0];
const endStr = endOfWeek.toISOString().split('T')[0];

// MOTOR DE VERIFICAÇÃO DE SESSÃO PERSISTENTE (Corrige a perda de dados no F5)
document.addEventListener("DOMContentLoaded", () => {
    const userIdSalvo = localStorage.getItem("user_id");
    const nicknameSalvo = localStorage.getItem("user_nickname");
    
    if (userIdSalvo) {
        document.getElementById('tela-autenticacao').classList.add('escondido');
        document.getElementById('conteudo-app').classList.remove('escondido');
        document.getElementById('lbl-boas-vindas').innerText = nicknameSalvo;
        
        recarregarTudo();
        carregarCatalogoExercicios();
    }
});

function alternarAbasAuth(aba) {
    document.getElementById('tab-login').classList.remove('active');
    document.getElementById('tab-cadastro').classList.remove('active');
    document.getElementById('form-login').classList.add('escondido');
    document.getElementById('form-cadastro').classList.add('escondido');
    
    document.getElementById(`tab-${aba}`).classList.add('active');
    document.getElementById(`form-${aba}`).classList.remove('escondido');
}

// ================= GESTÃO DE ACESSO SESSÃO =================
async function executarCadastro() {
    const obj = {
        name: document.getElementById('cad-name').value.trim(),
        nickname: document.getElementById('cad-nickname').value.trim(),
        login: document.getElementById('cad-user').value.trim(),
        password: document.getElementById('cad-pass').value,
        current_weight: parseFloat(document.getElementById('cad-weight').value),
        height: parseFloat(document.getElementById('cad-height').value),
        target_weight: parseFloat(document.getElementById('cad-target-weight').value),
        target_months: parseInt(document.getElementById('cad-months').value)
    };

    if(!obj.login || !obj.password || isNaN(obj.current_weight)) {
        return alert("Por favor, preencha todos os dados de cadastro e metas.");
    }

    const res = await fetch(`${API_URL}/auth/signup`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    if(res.ok) {
        const user = await res.json();
        localStorage.setItem("user_id", user.user_id);
        localStorage.setItem("user_nickname", user.nickname);
        window.location.reload(); // Aciona o gatilho inicializador
    } else {
        const err = await res.json();
        alert(err.detail || "Erro ao cadastrar.");
    }
}

async function executarLogin() {
    const obj = {
        login: document.getElementById('login-user').value.trim(),
        password: document.getElementById('login-pass').value
    };

    const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    if(res.ok) {
        const user = await res.json();
        localStorage.setItem("user_id", user.id);
        localStorage.setItem("user_nickname", user.nickname);
        window.location.reload();
    } else {
        alert("Usuário ou senha inválidos.");
    }
}

function fazerLogout() {
    localStorage.clear();
    window.location.reload();
}

// ================= LÓGICA DE ATUALIZAÇÃO REATIVA DO USUÁRIO =================
function navegar(aba) {
    document.querySelectorAll('section').forEach(s => s.classList.add('escondido'));
    document.getElementById(`aba-${aba}`).classList.remove('escondido');
    document.querySelectorAll('.nav-item').forEach(b => { b.style.color = "var(--text-muted)"; b.classList.remove('active'); });
    
    const btn = document.getElementById(`nav-${aba}`);
    if(btn) {
        btn.classList.add('ativo');
        if(aba === 'financas') btn.style.color = "var(--fin-color)";
        if(aba === 'saude') btn.style.color = "var(--sau-color)";
        if(aba === 'produtividade') btn.style.color = "var(--pro-color)";
    }
}

async function recarregarTudo() {
    const user_id = localStorage.getItem("user_id");
    if(!user_id) return;

    carregarPlannerSemanal_Visual(user_id);

    try {
        const res = await fetch(`${API_URL}/dashboard/unificado?user_id=${user_id}&date=${hojeStr}&start_week=${startStr}&end_week=${endStr}`);
        if(!res.ok) return;
        const data = await res.json();
        
        // 1. ATUALIZAÇÃO GLOBAL
        document.getElementById('lbl-global-pct').innerText = `${data.global_pct.toFixed(0)}%`;
        document.getElementById('barra-global').style.width = `${data.global_pct}%`;
        
        // 2. ATUALIZAÇÃO FINANCEIRA
        document.getElementById('lbl-saldo').innerText = `R$ ${data.financas.saldo.toFixed(2)}`;
        document.getElementById('lbl-gastos').innerText = `R$ ${data.financas.gastos.toFixed(2)}`;
        document.getElementById('barra-fin').style.width = `${data.financas.progresso}%`;
        renderizarMetasFinanceiras(data.financas.metas);
        
        // 3. ATUALIZAÇÃO DE SAÚDE DIRECIONADA
        document.getElementById('lbl-cal-hoje').innerText = data.saude.calorias_hoje.toFixed(0);
        if(data.saude.perfil) {
            const p = data.saude.perfil;
            document.getElementById('lbl-cal-meta').innerText = parseFloat(p.daily_calorie_goal).toFixed(0);
            document.getElementById('lbl-peso-info').innerText = `${p.current_weight}kg ➔ ${p.target_weight}kg (Foco: ${p.target_months}m)`;
            
            let totalPerder = p.current_weight - p.target_weight;
            let pctPeso = totalPerder <= 0 ? 100 : 0;
            document.getElementById('barra-peso').style.width = `${pctPeso}%`;
            document.getElementById('barra-calorias').style.width = `${data.saude.progresso}%`;
        }
        
    } catch (e) { console.error("Erro sincronização de dados:", e); }
}

// --- CORE TRANSAÇÕES ---
async function salvarTransacao() {
    const user_id = localStorage.getItem("user_id");
    const obj = {
        user_id: parseInt(user_id),
        type: document.getElementById('fin-type').value,
        amount: parseFloat(document.getElementById('fin-amount').value),
        category: document.getElementById('fin-category').value,
        date: hojeStr
    };
    await fetch(`${API_URL}/transactions`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    document.getElementById('fin-amount').value = "";
    fecharModal('modal-transacao');
    recarregarTudo();
}

async function salvarMetaFin() {
    const user_id = localStorage.getItem("user_id");
    const obj = {
        user_id: parseInt(user_id),
        title: document.getElementById('meta-titulo').value,
        target_amount: parseFloat(document.getElementById('meta-valor').value),
        deadline: document.getElementById('meta-prazo').value || hojeStr
    };
    await fetch(`${API_URL}/financial_goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-meta-fin');
    recarregarTudo();
}

function renderizarMetasFinanceiras(metas) {
    const container = document.getElementById('lista-metas-fin');
    if(!container) return; container.innerHTML = "";
    metas.forEach(m => {
        let pct = Math.min((m.current_amount / m.target_amount) * 100, 100);
        container.innerHTML += `
            <div class="meta-card">
                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold;"><span>🎯 ${m.title}</span><span>${pct.toFixed(0)}%</span></div>
                <div class="prog-container" style="height:6px; margin: 8px 0;"><div class="prog-fill bg-fin" style="width: ${pct}%;"></div></div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:11px; color:var(--text-muted);">R$ ${m.current_amount} de R$ ${m.target_amount}</span>
                    <button class="btn-outline" style="padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer; color:white;" onclick="prepararAporte(${m.id})">+ Guardar</button>
                </div>
            </div>`;
    });
}

function prepararAporte(id) { document.getElementById('aporte-meta-id').value = id; abrirModal('modal-aporte'); }
async function salvarAporte() {
    const id = document.getElementById('aporte-meta-id').value;
    const val = parseFloat(document.getElementById('aporte-valor').value);
    await fetch(`${API_URL}/financial_goals/${id}/add`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount: val}) });
    document.getElementById('aporte-valor').value = "";
    fecharModal('modal-aporte');
    recarregarTudo();
}

// --- CORE TREINOS ---
async function carregarCatalogoExercicios() {
    const res = await fetch(`${API_URL}/exercises`);
    if(res.ok) {
        const dados = await res.json();
        document.getElementById('saude-exercicio').innerHTML = dados.map(e => `<option value="${e.id}">${e.name}</option>`).join('');
    }
}

async function salvarTreino() {
    const user_id = localStorage.getItem("user_id");
    const obj = { user_id: parseInt(user_id), exercise_id: parseInt(document.getElementById('saude-exercicio').value), duration_minutes: parseInt(document.getElementById('saude-tempo').value), date: hojeStr };
    await fetch(`${API_URL}/workouts`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    document.getElementById('saude-tempo').value = "";
    recarregarTudo();
}

// --- PLANNER SEMANAL SEPARADO POR SESSÃO ---
async function carregarPlannerSemanal_Visual(user_id) {
    const container = document.getElementById('planner-semanal');
    if(!container) return;

    let tarefasSemana = [];
    try {
        const res = await fetch(`${API_URL}/tasks/week?user_id=${user_id}&start=${startStr}&end=${endStr}`);
        if(res.ok) tarefasSemana = await res.json();
    } catch (e) { console.log(e); }

    container.innerHTML = "";
    const diasNomes = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
    
    for(let i = 0; i < 7; i++) {
        let loopDate = new Date(startOfWeek); loopDate.setDate(startOfWeek.getDate() + i);
        let loopStr = loopDate.toISOString().split('T')[0];
        let isHoje = loopStr === hojeStr;
        let tarefasDoDia = tarefasSemana.filter(t => t.date === loopStr);
        
        let htmlTarefas = tarefasDoDia.map(t => `
            <div class="task-item" onclick="toggleTarefa(${t.id})" style="background:#111215; padding:10px; border-radius:8px; margin-bottom:6px; border:1px solid #2a2c32; display:flex; align-items:center; gap:10px;">
                <div style="width:16px; height:16px; border-radius:4px; border:2px solid ${t.is_completed?'gray':'var(--pro-color)'}; background:${t.is_completed?'gray':'transparent'};"></div>
                <span style="${t.is_completed?'text-decoration:line-through; color:gray;':''}">${t.title}</span>
            </div>`).join('');
            
        container.innerHTML += `
            <div class="day-block" style="background:#18191c; border:1px solid ${isHoje?'var(--pro-color)':'var(--border-color)'}; border-radius:12px; margin-bottom:10px; overflow:hidden;">
                <div class="day-header" style="padding:10px 15px; display:flex; justify-content:space-between; align-items:center;">
                    <div><span style="font-size:10px; font-weight:800; color:var(--text-muted);">${diasNomes[loopDate.getDay()]}</span><br><strong>${loopDate.getDate()}</strong></div>
                    <button class="btn-outline" style="width:auto; margin:0; padding:4px 8px; font-size:11px;" onclick="addTarefaNoDia('${loopStr}')">+ Add</button>
                </div>
                <div style="padding:10px;">${htmlTarefas || '<span style="font-size:11px; color:var(--text-muted);">Livre</span>'}</div>
            </div>`;
    }
}

async function addTarefaNoDia(dataStr) {
    const user_id = localStorage.getItem("user_id");
    const titulo = prompt("Nova tarefa:");
    if(!titulo) return;
    await fetch(`${API_URL}/tasks`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user_id: parseInt(user_id), title: titulo, date: dataStr}) });
    recarregarTudo();
}

async function toggleTarefa(id) {
    await fetch(`${API_URL}/tasks/${id}/toggle`, { method: 'PATCH' });
    recarregarTudo();
}
