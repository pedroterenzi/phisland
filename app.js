const API_URL = "https://phisland.onrender.com"; 

let dataHoje = new Date();
const hojeStr = dataHoje.toISOString().split('T')[0];

let startOfWeek = new Date(dataHoje);
startOfWeek.setDate(dataHoje.getDate() - (dataHoje.getDay() === 0 ? 6 : dataHoje.getDay() - 1));
let endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 6);
const startStr = startOfWeek.toISOString().split('T')[0];
const endStr = endOfWeek.toISOString().split('T')[0];

document.addEventListener("DOMContentLoaded", () => {
    const userIdSalvo = localStorage.getItem("user_id");
    if (userIdSalvo) {
        document.getElementById('tela-autenticacao').classList.add('escondido');
        document.getElementById('conteudo-app').classList.remove('escondido');
        document.getElementById('lbl-boas-vindas').innerText = localStorage.getItem("user_nickname");
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

async function executarCadastro() {
    const obj = {
        name: document.getElementById('cad-name').value.trim(),
        nickname: document.getElementById('cad-nickname').value.trim(),
        login: document.getElementById('cad-user').value.trim(),
        password: document.getElementById('cad-pass').value
    };
    if(!obj.login || !obj.password) return alert("Preencha login e senha.");
    
    try {
        const res = await fetch(`${API_URL}/auth/signup`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
        if(res.ok) {
            const user = await res.json();
            localStorage.setItem("user_id", user.user_id);
            localStorage.setItem("user_nickname", user.nickname);
            window.location.reload();
        } else { alert("Erro ao cadastrar."); }
    } catch(e) { alert("Servidor indisponível. Aguarde."); }
}

async function executarLogin() {
    const obj = { login: document.getElementById('login-user').value.trim(), password: document.getElementById('login-pass').value };
    try {
        const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
        if(res.ok) {
            const user = await res.json();
            localStorage.setItem("user_id", user.id);
            localStorage.setItem("user_nickname", user.nickname);
            window.location.reload();
        } else { alert("Login ou senha inválidos."); }
    } catch(e) { alert("Erro no servidor."); }
}

function fazerLogout() { localStorage.clear(); window.location.reload(); }

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
function abrirModal(id) { document.getElementById(id).classList.remove('escondido'); }
function fecharModal(id) { document.getElementById(id).classList.add('escondido'); }

// ================= RENDERIZADOR ROBUSTO E DETALHADO =================
async function recarregarTudo() {
    const user_id = localStorage.getItem("user_id");
    if(!user_id) return;
    
    carregarPlannerSemanal_Visual(user_id);

    try {
        const res = await fetch(`${API_URL}/dashboard/unificado?user_id=${user_id}&date=${hojeStr}&start_week=${startStr}&end_week=${endStr}`);
        if(!res.ok) return;
        const data = await res.json();
        
        if(document.getElementById('lbl-global-pct')) {
            document.getElementById('lbl-global-pct').innerText = `${data.global_pct.toFixed(0)}%`;
            document.getElementById('barra-global').style.width = `${data.global_pct}%`;
        }
        
        if(document.getElementById('lbl-saldo')) {
            document.getElementById('lbl-saldo').innerText = `R$ ${data.financas.saldo.toFixed(2)}`;
            document.getElementById('lbl-gastos').innerText = `R$ ${data.financas.gastos.toFixed(2)}`;
            document.getElementById('barra-fin').style.width = `${data.financas.progresso}%`;
            if(document.getElementById('educador-fin')) document.getElementById('educador-fin').innerText = data.financas.msg_educador;
            
            renderizarMetasFinanceiras(data.financas.metas);
        }
        
        if(document.getElementById('box-saude-dados')) {
            if(data.saude.meta) {
                document.getElementById('box-saude-dados').classList.remove('escondido');
                const m = data.saude.meta;
                document.getElementById('educador-sau').innerText = `Foco: "${m.dream}" (${m.title})`;
                
                let diffPeso = parseFloat(m.current_weight) - parseFloat(m.target_weight);
                let faltaMsg = diffPeso > 0 ? `🔥 Faltam ${diffPeso.toFixed(1)}kg para bater sua meta!` : `🎉 Você atingiu sua meta de peso!`;
                
                document.getElementById('lbl-peso-falta').innerText = faltaMsg;
                document.getElementById('lbl-peso-info').innerText = `${m.current_weight}kg ➔ ${m.target_weight}kg (${m.months}m)`;
                
                // Barra de peso simbólica MVP
                let pctPeso = diffPeso <= 0 ? 100 : 10; 
                document.getElementById('barra-peso').style.width = `${pctPeso}%`;
                
                document.getElementById('lbl-cal-meta').innerText = parseFloat(m.daily_calorie_goal).toFixed(0);
                document.getElementById('lbl-cal-hoje').innerText = data.saude.calorias_hoje.toFixed(0);
                document.getElementById('barra-calorias').style.width = `${data.saude.progresso}%`;
            } else {
                document.getElementById('box-saude-dados').classList.add('escondido');
                document.getElementById('educador-sau').innerText = "Você ainda não definiu sua Meta Física. Clique em 'Definir Sonho' para começar e ver seu progresso.";
            }
        }
        
        if(document.getElementById('barra-pro')) {
            document.getElementById('barra-pro').style.width = `${data.produtividade.progresso}%`;
            if(data.produtividade.meta && document.getElementById('educador-prod')) {
                document.getElementById('educador-prod').innerText = `Motivação: "${data.produtividade.meta.dream}"`;
            }
        }
        
    } catch (e) { console.error("Aviso:", e); }
}

async function salvarMetaFin() {
    const obj = {
        user_id: parseInt(localStorage.getItem("user_id")),
        title: document.getElementById('meta-fin-titulo').value,
        dream: document.getElementById('meta-fin-dream').value || "Indefinido",
        target_amount: parseFloat(document.getElementById('meta-fin-valor').value),
        current_amount: parseFloat(document.getElementById('meta-fin-atual').value) || 0,
        months: parseInt(document.getElementById('meta-fin-meses').value) || 12
    };
    if(!obj.title || isNaN(obj.target_amount)) return alert("Preencha título e o Valor Total.");
    await fetch(`${API_URL}/goals/finance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-meta-fin'); recarregarTudo();
}

// ================= RENDERIZAR METAS E MOSTRAR O QUANTO FALTA =================
function renderizarMetasFinanceiras(metas) {
    const container = document.getElementById('lista-metas-fin');
    if(!container) return; container.innerHTML = "";
    
    if(!metas || metas.length === 0) {
        container.innerHTML = "<p style='font-size:12px; color:var(--text-muted); text-align:center;'>Nenhuma meta cadastrada ainda.</p>";
        return;
    }

    metas.forEach(m => {
        let atual = parseFloat(m.current_amount) || 0;
        let alvo = parseFloat(m.target_amount) || 1;
        let pct = Math.min((atual / alvo) * 100, 100);
        let falta = alvo - atual;

        container.innerHTML += `
            <div class="meta-card">
                <div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin-bottom: 5px;">
                    <span>🎯 ${m.title}</span>
                    <span style="color:var(--fin-color);">${pct.toFixed(1)}%</span>
                </div>
                <div style="font-size:11px; color:var(--text-muted); font-style:italic; margin-bottom: 8px;">"${m.dream}"</div>
                
                <div class="prog-container" style="height:8px; margin: 8px 0;"><div class="prog-fill bg-fin" style="width: ${pct}%;"></div></div>
                
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top: 10px;">
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-size:12px; color:white; font-weight: bold;">R$ ${atual.toFixed(2)} de R$ ${alvo.toFixed(2)}</span>
                        <span style="font-size:11px; color:var(--danger-color); font-weight:bold;">Falta: R$ ${falta > 0 ? falta.toFixed(2) : '0.00 (Concluída!)'}</span>
                    </div>
                    <button class="btn-outline" style="padding:6px 12px; border-radius:8px; font-size:12px; font-weight:bold; cursor:pointer; color:white; border-color:var(--fin-color); background: rgba(59, 130, 246, 0.1);" onclick="prepararAporte(${m.id})">+ Aportar</button>
                </div>
            </div>`;
    });
}

function prepararAporte(id) { document.getElementById('aporte-meta-id').value = id; abrirModal('modal-aporte'); }
async function salvarAporte() {
    await fetch(`${API_URL}/financial_goals/${document.getElementById('aporte-meta-id').value}/add`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount: parseFloat(document.getElementById('aporte-valor').value)}) });
    fecharModal('modal-aporte'); recarregarTudo();
}

async function salvarMetaSaude() {
    const obj = {
        user_id: parseInt(localStorage.getItem("user_id")),
        title: document.getElementById('meta-sau-titulo').value,
        dream: document.getElementById('meta-sau-dream').value,
        current_weight: parseFloat(document.getElementById('meta-sau-atual').value),
        target_weight: parseFloat(document.getElementById('meta-sau-alvo').value),
        months: parseInt(document.getElementById('meta-sau-meses').value) || 3
    };
    await fetch(`${API_URL}/goals/health`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-meta-saude'); recarregarTudo();
}

async function salvarMetaProd() {
    const obj = {
        user_id: parseInt(localStorage.getItem("user_id")),
        title: document.getElementById('meta-pro-titulo').value,
        dream: document.getElementById('meta-pro-dream').value,
        months: parseInt(document.getElementById('meta-pro-meses').value) || 1
    };
    await fetch(`${API_URL}/goals/productivity`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-meta-prod'); recarregarTudo();
}

async function salvarTransacao() {
    const obj = { user_id: parseInt(localStorage.getItem("user_id")), type: document.getElementById('fin-type').value, amount: parseFloat(document.getElementById('fin-amount').value), category: document.getElementById('fin-category').value, date: hojeStr };
    await fetch(`${API_URL}/transactions`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-transacao'); recarregarTudo();
}

async function carregarCatalogoExercicios() {
    const res = await fetch(`${API_URL}/exercises`);
    if(res.ok) { const d = await res.json(); if(document.getElementById('saude-exercicio')) document.getElementById('saude-exercicio').innerHTML = d.map(e => `<option value="${e.id}">${e.name}</option>`).join(''); }
}

async function salvarTreino() {
    await fetch(`${API_URL}/workouts`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: parseInt(localStorage.getItem("user_id")), exercise_id: parseInt(document.getElementById('saude-exercicio').value), duration_minutes: parseInt(document.getElementById('saude-tempo').value), date: hojeStr }) });
    recarregarTudo();
}

async function carregarPlannerSemanal_Visual(user_id) {
    const c = document.getElementById('planner-semanal'); if(!c) return;
    let tarefas = [];
    try { const res = await fetch(`${API_URL}/tasks/week?user_id=${user_id}&start=${startStr}&end=${endStr}`); if(res.ok) tarefas = await res.json(); } catch(e){}
    c.innerHTML = ""; const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    
    for(let i=0; i<7; i++) {
        let d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); let loopStr = d.toISOString().split('T')[0];
        let h = tarefas.filter(t => t.date === loopStr).map(t => `<div class="task-item" onclick="toggleTarefa(${t.id})" style="background:#111215; padding:10px; border-radius:8px; margin-bottom:6px; border:1px solid #2a2c32; display:flex; align-items:center; gap:10px;"><div style="width:16px; height:16px; border-radius:4px; border:2px solid ${t.is_completed?'gray':'var(--pro-color)'}; background:${t.is_completed?'gray':'transparent'};"></div><span style="${t.is_completed?'text-decoration:line-through; color:gray;':''}">${t.title}</span></div>`).join('');
        c.innerHTML += `<div class="day-block" style="background:#18191c; border:1px solid ${loopStr===hojeStr?'var(--pro-color)':'var(--border-color)'};"><div class="day-header" style="padding:10px 15px; display:flex; justify-content:space-between; align-items:center;"><div><span style="font-size:10px; font-weight:800; color:var(--text-muted);">${dias[d.getDay()]}</span><br><strong>${d.getDate()}</strong></div><button class="btn-outline" style="width:auto; margin:0; padding:4px 8px; font-size:11px;" onclick="addTarefaNoDia('${loopStr}')">+ Add</button></div><div style="padding:10px;">${h || '<span style="font-size:11px; color:var(--text-muted);">Livre</span>'}</div></div>`;
    }
}

async function addTarefaNoDia(dt) {
    const t = prompt("Nova tarefa:"); if(!t) return;
    await fetch(`${API_URL}/tasks`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user_id: parseInt(localStorage.getItem("user_id")), title: t, date: dt}) });
    recarregarTudo();
}
async function toggleTarefa(id) { await fetch(`${API_URL}/tasks/${id}/toggle`, { method: 'PATCH' }); recarregarTudo(); }
