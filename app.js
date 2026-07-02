const API_URL = "https://phisland.onrender.com"; 

let dataHoje = new Date();
const hojeStr = dataHoje.toISOString().split('T')[0];

// Descobre o primeiro e o último dia da semana atual (Segunda a Domingo)
let startOfWeek = new Date(dataHoje);
startOfWeek.setDate(dataHoje.getDate() - (dataHoje.getDay() === 0 ? 6 : dataHoje.getDay() - 1));
let endOfWeek = new Date(startOfWeek);
endOfWeek.setDate(startOfWeek.getDate() + 6);

const startStr = startOfWeek.toISOString().split('T')[0];
const endStr = endOfWeek.toISOString().split('T')[0];

document.addEventListener("DOMContentLoaded", () => {
    recarregarTudo();
    carregarCatalogoExercicios();
});

// NAVEGAÇÃO E MODAIS
function navegar(aba) {
    document.querySelectorAll('section').forEach(s => s.classList.add('escondido'));
    document.getElementById(`aba-${aba}`).classList.remove('escondido');
    
    document.querySelectorAll('.nav-item').forEach(b => {
        b.style.color = "var(--text-muted)"; 
        b.classList.remove('ativo');
    });
    
    const btn = document.getElementById(`nav-${aba}`);
    btn.classList.add('ativo');
    if(aba === 'financas') btn.style.color = "var(--fin-color)";
    if(aba === 'saude') btn.style.color = "var(--sau-color)";
    if(aba === 'produtividade') btn.style.color = "var(--pro-color)";
}

function abrirModal(id) { document.getElementById(id).classList.remove('escondido'); }
function fecharModal(id) { document.getElementById(id).classList.add('escondido'); }

// 🔄 MOTOR DE REATIVIDADE
async function recarregarTudo() {
    try {
        const res = await fetch(`${API_URL}/dashboard/unificado?date=${hojeStr}&start_week=${startStr}&end_week=${endStr}`);
        if(res.ok) {
            const data = await res.json();
            
            // 1. GLOBAL
            document.getElementById('lbl-global-pct').innerText = `${data.global_pct.toFixed(0)}%`;
            document.getElementById('barra-global').style.width = `${data.global_pct}%`;
            
            // 2. FINANÇAS
            document.getElementById('lbl-saldo').innerText = `R$ ${data.financas.saldo.toFixed(2)}`;
            document.getElementById('lbl-gastos').innerText = `R$ ${data.financas.gastos.toFixed(2)}`;
            document.getElementById('barra-fin').style.width = `${data.financas.progresso}%`;
            
            renderizarMetasFinanceiras(data.financas.metas);
            
            // 3. SAÚDE
            document.getElementById('barra-sau').style.width = `${data.saude.progresso}%`;
            document.getElementById('lbl-cal-hoje').innerText = data.saude.calorias_hoje.toFixed(0);
            
            if(data.saude.perfil) {
                const p = data.saude.perfil;
                document.getElementById('lbl-cal-meta').innerText = p.daily_calorie_goal;
                document.getElementById('lbl-peso-info').innerText = `${p.current_weight}kg ➔ ${p.target_weight}kg`;
                
                let totalPerder = p.current_weight - p.target_weight;
                let pctPeso = totalPerder <= 0 ? 100 : 0; 
                document.getElementById('barra-peso').style.width = `${pctPeso}%`;
                document.getElementById('barra-calorias').style.width = `${data.saude.progresso}%`;
                
                document.getElementById('perfil-peso-atual').value = p.current_weight;
                document.getElementById('perfil-peso-alvo').value = p.target_weight;
                document.getElementById('perfil-calorias').value = p.daily_calorie_goal;
            }
            
            // 4. PRODUTIVIDADE
            document.getElementById('barra-pro').style.width = `${data.produtividade.progresso}%`;
            carregarPlannerSemanal();
        }
    } catch (e) { console.error("Erro reatividade:", e); }
}

// ================= FINANÇAS =================
async function salvarTransacao() {
    const obj = {
        type: document.getElementById('fin-type').value,
        amount: parseFloat(document.getElementById('fin-amount').value),
        category: document.getElementById('fin-category').value,
        date: hojeStr
    };
    if(!obj.amount) return alert("Insira o valor.");
    
    await fetch(`${API_URL}/transactions`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    document.getElementById('fin-amount').value = "";
    fecharModal('modal-transacao');
    recarregarTudo();
}

async function salvarMetaFin() {
    const obj = {
        title: document.getElementById('meta-titulo').value,
        target_amount: parseFloat(document.getElementById('meta-valor').value),
        deadline: document.getElementById('meta-prazo').value
    };
    if(!obj.title || !obj.target_amount) return alert("Preencha título e valor.");
    
    await fetch(`${API_URL}/financial_goals`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-meta-fin');
    recarregarTudo();
}

function renderizarMetasFinanceiras(metas) {
    const container = document.getElementById('lista-metas-fin');
    container.innerHTML = "";
    metas.forEach(m => {
        let pct = Math.min((m.current_amount / m.target_amount) * 100, 100);
        container.innerHTML += `
            <div class="meta-card">
                <div style="display:flex; justify-content:space-between; font-size:13px; font-weight:bold;">
                    <span>🎯 ${m.title}</span>
                    <span style="color:var(--fin-color);">${pct.toFixed(0)}%</span>
                </div>
                <div class="prog-container" style="height:6px; margin: 8px 0;"><div class="prog-fill bg-fin" style="width: ${pct}%;"></div></div>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:11px; color:var(--text-muted);">R$ ${m.current_amount} de R$ ${m.target_amount}</span>
                    <button class="btn-outline" style="padding:4px 8px; border-radius:6px; font-size:11px; cursor:pointer;" onclick="prepararAporte(${m.id})">+ Guardar</button>
                </div>
            </div>
        `;
    });
}

function prepararAporte(id) {
    document.getElementById('aporte-meta-id').value = id;
    abrirModal('modal-aporte');
}

async function salvarAporte() {
    const id = document.getElementById('aporte-meta-id').value;
    const val = parseFloat(document.getElementById('aporte-valor').value);
    if(!val) return;
    
    await fetch(`${API_URL}/financial_goals/${id}/add`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({amount: val}) });
    document.getElementById('aporte-valor').value = "";
    fecharModal('modal-aporte');
    recarregarTudo();
}

// ================= SAÚDE =================
async function carregarCatalogoExercicios() {
    const res = await fetch(`${API_URL}/exercises`);
    if(res.ok) {
        const dados = await res.json();
        document.getElementById('saude-exercicio').innerHTML = dados.map(e => `<option value="${e.id}">${e.name} (${e.calories_per_minute} kcal/min)</option>`).join('');
    }
}

async function salvarPerfilSaude() {
    const obj = {
        current_weight: parseFloat(document.getElementById('perfil-peso-atual').value),
        target_weight: parseFloat(document.getElementById('perfil-peso-alvo').value),
        daily_calorie_goal: parseFloat(document.getElementById('perfil-calorias').value)
    };
    await fetch(`${API_URL}/health/profile`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-perfil-saude');
    recarregarTudo();
}

async function salvarTreino() {
    const obj = { exercise_id: parseInt(document.getElementById('saude-exercicio').value), duration_minutes: parseInt(document.getElementById('saude-tempo').value), date: hojeStr };
    if(!obj.duration_minutes) return alert("Insira os minutos.");
    await fetch(`${API_URL}/workouts`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    document.getElementById('saude-tempo').value = "";
    recarregarTudo();
}

// ================= PLANNER DE PRODUTIVIDADE =================
async function carregarPlannerSemanal() {
    const res = await fetch(`${API_URL}/tasks/week?start=${startStr}&end=${endStr}`);
    if(!res.ok) return;
    const tarefasSemana = await res.json();
    
    const container = document.getElementById('planner-semanal');
    container.innerHTML = "";
    
    const diasNomes = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];
    
    for(let i = 0; i < 7; i++) {
        let loopDate = new Date(startOfWeek);
        loopDate.setDate(startOfWeek.getDate() + i);
        let loopStr = loopDate.toISOString().split('T')[0];
        let diaFormatado = `${loopDate.getDate().toString().padStart(2,'0')}/${(loopDate.getMonth()+1).toString().padStart(2,'0')}`;
        
        let tarefasDoDia = tarefasSemana.filter(t => t.date === loopStr);
        let htmlTarefas = tarefasDoDia.map(t => `
            <div class="task-item ${t.is_completed ? 'completed' : ''}">
                <span onclick="toggleTarefa(${t.id})" style="flex:1; cursor:pointer;">${t.title}</span>
            </div>
        `).join('');
        
        container.innerHTML += `
            <div class="day-block">
                <div class="day-header">
                    <span style="color:${loopStr === hojeStr ? 'var(--pro-color)' : 'white'}">${diasNomes[loopDate.getDay()]} - ${diaFormatado}</span>
                    <button class="btn-outline" style="border:none; padding:4px 8px; border-radius:6px; cursor:pointer; font-weight:bold; background: rgba(139, 92, 246, 0.1); color: var(--pro-color);" onclick="addTarefaNoDia('${loopStr}')">+ Add</button>
                </div>
                <div class="day-content" id="content-${loopStr}">
                    ${htmlTarefas || '<span style="font-size:11px; color:var(--text-muted);">Dia livre. Nenhuma tarefa.</span>'}
                </div>
            </div>
        `;
    }
}

async function addTarefaNoDia(dataStr) {
    const titulo = prompt("Digite a nova tarefa para esta data:");
    if(!titulo) return;
    await fetch(`${API_URL}/tasks`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({title: titulo, date: dataStr}) });
    recarregarTudo();
}

async function toggleTarefa(id) {
    await fetch(`${API_URL}/tasks/${id}/toggle`, { method: 'PATCH' });
    recarregarTudo();
}
