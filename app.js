const API_URL = "https://phisland.onrender.com"; 

const hojeStr = new Date().toISOString().split('T')[0];

document.addEventListener("DOMContentLoaded", () => {
    carregarDashboardUnificado();
    carregarCatalogoExercicios();
    carregarBiblioteca();
    carregarTarefas();
});

// Navegação do Menu Inferior
function navegarAba(abaAlvo) {
    document.getElementById('aba-financas').classList.add('escondido');
    document.getElementById('aba-saude').classList.add('escondido');
    document.getElementById('aba-produtividade').classList.add('escondido');
    
    document.getElementById(`aba-${abaAlvo}`).classList.remove('escondido');
    
    document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('ativo'));
    if(abaAlvo === 'financas') document.getElementById('btn-nav-financas').classList.add('ativo');
    if(abaAlvo === 'saude') document.getElementById('btn-nav-saude').classList.add('ativo');
    if(abaAlvo === 'produtividade') document.getElementById('btn-nav-produtividade').classList.add('ativo');
}

function alternarSubTela(idSub) {
    const el = document.getElementById(idSub);
    el.classList.toggle('escondido');
}

// Consome o Endpoint do Mecanismo Unificado / Barra de Progresso Global
async function carregarDashboardUnificado() {
    try {
        const res = await fetch(`${API_URL}/dashboard/unificado?date=${hojeStr}`);
        if(res.ok) {
            const data = await res.json();
            
            // Renderiza Bloco Financeiro
            document.getElementById('lbl-saldo').innerText = `R$ ${data.saldo.toFixed(2)}`;
            document.getElementById('lbl-gastos').innerText = `R$ ${data.gastos.toFixed(2)} / R$ ${data.limite.toFixed(2)}`;
            
            // Renderiza Bloco Saúde
            document.getElementById('lbl-calorias').innerText = `${data.cal_queimadas.toFixed(0)} Kcal`;
            if(data.perfil_saude) {
                document.getElementById('lbl-meta-peso').innerText = `Meta: Peso sair de ${data.perfil_saude.current_weight}kg para ${data.perfil_saude.target_weight}kg`;
            }

            // Renderiza Mecanismo do Educador e Barra de Engajamento Global
            document.getElementById('lbl-global-pct').innerText = `${data.engajamento_global.toFixed(0)}%`;
            document.getElementById('barra-global').style.width = `${data.engajamento_global}%`;
            document.getElementById('lbl-educador-topo').innerText = data.educador;
        }
    } catch (e) {
        console.log("Erro ao carregar Dashboard Unificado", e);
    }
}

// OPERAÇÕES DO PILAR FINANCEIRO
async function salvarTransacao() {
    const type = document.getElementById('fin-type').value;
    const amount = parseFloat(document.getElementById('fin-amount').value);
    const category = document.getElementById('fin-category').value;

    if(isNaN(amount) || amount <= 0) return alert("Insira um valor válido.");

    const res = await fetch(`${API_URL}/transactions`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ type, amount, category, date: hojeStr })
    });

    if(res.ok) {
        document.getElementById('fin-amount').value = "";
        document.getElementById('modal-financeiro').classList.add('escondido');
        carregarDashboardUnificado();
    }
}

// OPERAÇÕES DO PILAR DE SAÚDE
async function carregarCatalogoExercicios() {
    const res = await fetch(`${API_URL}/exercises`);
    if(res.ok) {
        const dados = await res.json();
        const select = document.getElementById('saude-exercicio');
        select.innerHTML = dados.map(e => `<option value="${e.id}">[${e.muscle_group}] ${e.name} (${e.calories_per_minute} kcal/min)</option>`).join('');
    }
}

async function salvarTreino() {
    const exercise_id = parseInt(document.getElementById('saude-exercicio').value);
    const duration_minutes = parseInt(document.getElementById('saude-tempo').value);

    if(isNaN(duration_minutes) || duration_minutes <= 0) return alert("Insira os minutos praticados.");

    const res = await fetch(`${API_URL}/workouts`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ exercise_id, duration_minutes, date: hojeStr })
    });

    if(res.ok) {
        document.getElementById('saude-tempo').value = "";
        carregarDashboardUnificado();
    }
}

// OPERAÇÕES DO PILAR DE PRODUTIVIDADE (TO-DO)
async function carregarTarefas() {
    const res = await fetch(`${API_URL}/tasks?date=${hojeStr}`);
    if(res.ok) {
        const tarefas = await res.json();
        const container = document.getElementById('lista-tarefas');
        container.innerHTML = tarefas.map(t => `
            <div class="task-item ${t.is_completed ? 'completed' : ''}">
                <span>${t.title}</span>
                <input type="checkbox" class="checkbox-todo" ${t.is_completed ? 'checked' : ''} onclick="toggleTarefa(${t.id})">
            </div>
        `).join('');
    }
}

async function salvarTarefa() {
    const title = document.getElementById('todo-titulo').value.trim();
    if(!title) return;

    const res = await fetch(`${API_URL}/tasks`, {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({ title, date: hojeStr })
    });

    if(res.ok) {
        document.getElementById('todo-titulo').value = "";
        carregarTarefas();
        carregarDashboardUnificado();
    }
}

async function toggleTarefa(id) {
    const res = await fetch(`${API_URL}/tasks/${id}/toggle`, { method: 'PATCH' });
    if(res.ok) {
        carregarTarefas();
        carregarDashboardUnificado();
    }
}

// CARREGA ARTIGOS PRÓPRIOS DA BIBLIOTECA
async function carregarBiblioteca() {
    const res = await fetch(`${API_URL}/library`);
    if(res.ok) {
        const artigos = await res.json();
        const container = document.getElementById('lista-biblioteca');
        container.innerHTML = artigos.map(a => `
            <div style="background: #18191c; padding: 14px; border-radius: 12px; border: 1px solid var(--border-color);">
                <span style="font-size: 11px; background: rgba(59, 130, 246, 0.15); color: var(--accent-color); padding: 2px 6px; border-radius: 4px; font-weight: bold;">${a.category}</span>
                <h4 style="margin: 8px 0 4px 0; font-size:15px;">${a.title}</h4>
                <p style="margin: 0; font-size: 13px; color: var(--text-muted); line-height: 1.4;">${a.content_text}</p>
            </div>
        `).join('');
    }
}
