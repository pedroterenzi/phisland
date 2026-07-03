const API_URL = "https://phisland.onrender.com"; 

let dataHoje = new Date();
const hojeStr = dataHoje.toISOString().split('T')[0];

let startOfWeek = new Date(dataHoje); startOfWeek.setDate(dataHoje.getDate() - (dataHoje.getDay() === 0 ? 6 : dataHoje.getDay() - 1));
let endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
const startStr = startOfWeek.toISOString().split('T')[0]; const endStr = endOfWeek.toISOString().split('T')[0];

let financeChartInstance = null; let foodChartInstance = null;
let currentTransactions = []; let currentCategoryFilter = null; let currentHistoryTab = 'all';

const iconEdit = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>`;
const iconTrash = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const iconIncome = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
const iconExpense = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('filtro-mes-fin').value = `${dataHoje.getFullYear()}-${(dataHoje.getMonth()+1).toString().padStart(2,'0')}`;
    const userIdSalvo = localStorage.getItem("user_id");
    if (userIdSalvo) {
        document.getElementById('tela-autenticacao').classList.add('escondido'); document.getElementById('conteudo-app').classList.remove('escondido');
        document.getElementById('lbl-boas-vindas').innerText = localStorage.getItem("user_nickname");
        recarregarTudo(); carregarCatalogoExercicios();
    }
});

function alternarAbasAuth(aba) {
    ['tab-login','tab-cadastro'].forEach(id => document.getElementById(id).classList.remove('active'));
    ['form-login','form-cadastro'].forEach(id => document.getElementById(id).classList.add('escondido'));
    document.getElementById(`tab-${aba}`).classList.add('active'); document.getElementById(`form-${aba}`).classList.remove('escondido');
}

async function executarCadastro() {
    const obj = { name: document.getElementById('cad-name').value.trim(), nickname: document.getElementById('cad-nickname').value.trim(), login: document.getElementById('cad-user').value.trim(), password: document.getElementById('cad-pass').value };
    if(!obj.login || !obj.password) return;
    const res = await fetch(`${API_URL}/auth/signup`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    if(res.ok) { const user = await res.json(); localStorage.setItem("user_id", user.user_id); localStorage.setItem("user_nickname", user.nickname); window.location.reload(); }
}

async function executarLogin() {
    const obj = { login: document.getElementById('login-user').value.trim(), password: document.getElementById('login-pass').value };
    const res = await fetch(`${API_URL}/auth/login`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    if(res.ok) { const user = await res.json(); localStorage.setItem("user_id", user.id); localStorage.setItem("user_nickname", user.nickname); window.location.reload(); }
}
function fazerLogout() { localStorage.clear(); window.location.reload(); }

function navegar(aba) {
    document.querySelectorAll('section').forEach(s => s.classList.add('escondido')); document.getElementById(`aba-${aba}`).classList.remove('escondido');
    document.querySelectorAll('.nav-item').forEach(b => { b.style.color = "var(--text-muted)"; b.classList.remove('active'); });
    const btn = document.getElementById(`nav-${aba}`);
    if(btn) { btn.classList.add('ativo'); btn.style.color = `var(--${aba.substring(0,3)}-color)`; }
}
function abrirModal(id) { document.getElementById(id).classList.remove('escondido'); }
function fecharModal(id) { document.getElementById(id).classList.add('escondido'); }

async function recarregarTudo() {
    const user_id = localStorage.getItem("user_id"); if(!user_id) return;
    carregarPlannerSemanal_Visual(user_id);
    let selectedMonth = document.getElementById('filtro-mes-fin').value || `${dataHoje.getFullYear()}-${(dataHoje.getMonth()+1).toString().padStart(2,'0')}`;
    
    try {
        const res = await fetch(`${API_URL}/dashboard/unificado?user_id=${user_id}&date=${selectedMonth}-01&start_week=${startStr}&end_week=${endStr}`);
        if(!res.ok) return; const data = await res.json();
        
        // FINANÇAS
        const saldoEl = document.getElementById('lbl-saldo'); saldoEl.innerText = `R$ ${data.financas.saldo.toFixed(2)}`;
        document.getElementById('lbl-rendas').innerText = `R$ ${data.financas.rendas.toFixed(2)}`; document.getElementById('lbl-gastos').innerText = `R$ ${data.financas.gastos.toFixed(2)}`;
        saldoEl.classList.remove('text-danger', 'text-success');
        let max_val = Math.max(data.financas.rendas, data.financas.gastos, 1000); let pct = (Math.abs(data.financas.saldo) / max_val) * 50; if(pct > 50) pct = 50; 
        if (data.financas.saldo < 0) { saldoEl.classList.add('text-danger'); document.getElementById('barra-fin-neg').style.width = `${pct}%`; document.getElementById('barra-fin-pos').style.width = `0%`; } 
        else { saldoEl.classList.add('text-success'); document.getElementById('barra-fin-neg').style.width = `0%`; document.getElementById('barra-fin-pos').style.width = `${pct}%`; }
        renderizarMetasFinanceiras(data.financas.metas); currentTransactions = data.financas.transacoes; renderizarGraficoPizza(currentTransactions); renderizarHistorico(currentTransactions);

        // SAÚDE: Renderizar Multiplas Metas Físicas
        renderizarMetasSaude(data.saude.metas);
        renderizarGraficoComida(data.saude.comidas);
        
    } catch (e) { console.error("Aviso:", e); }
}

// ================= GRÁFICOS INTERATIVOS =================
function renderizarGraficoPizza(transacoes) {
    const ctx = document.getElementById('financeChart').getContext('2d');
    const despesas = transacoes.filter(t => t.type === 'expense'); const categoriasMap = {};
    despesas.forEach(t => { categoriasMap[t.category] = (categoriasMap[t.category] || 0) + t.amount; });
    const labels = Object.keys(categoriasMap); const dataValues = Object.values(categoriasMap);
    const bgColors = ['#3b82f6', '#ef4444', '#f59e0b', '#8b5cf6', '#ec4899', '#f97316', '#6366f1', '#64748b', '#dc2626', '#d97706'];

    if(financeChartInstance) financeChartInstance.destroy();
    const rankC = document.getElementById('ranking-categorias');
    if(labels.length === 0) {
        financeChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sem gastos'], datasets: [{ data: [1], backgroundColor: ['#27272a'] }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: {enabled: false} } } });
        if(rankC) rankC.innerHTML = ''; return;
    }

    const catArr = labels.map(cat => ({ name: cat, amount: categoriasMap[cat] })).sort((a, b) => b.amount - a.amount);
    const total = dataValues.reduce((a, b) => a + b, 0);
    if(rankC) {
        rankC.innerHTML = catArr.map(cat => {
            const idx = labels.indexOf(cat.name); const color = bgColors[idx % bgColors.length]; const pct = ((cat.amount / total) * 100).toFixed(1);
            return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);"><div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; border-radius:4px; background:${color};"></div><span style="font-size:13px; font-weight:600; color:white;">${cat.name}</span></div><div style="display:flex; align-items:center; gap:10px;"><span style="font-size:13px; font-weight:800; color:white;">R$ ${cat.amount.toFixed(2)}</span><span style="font-size:11px; color:var(--text-muted); width:40px; text-align:right;">${pct}%</span></div></div>`;
        }).join('');
    }

    const offsets = labels.map(l => l === currentCategoryFilter ? 15 : 0);
    financeChartInstance = new Chart(ctx, {
        type: 'doughnut', data: { labels: labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 0, hoverOffset: 10, offset: offsets }] },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { position: 'right', labels: { color: '#a1a1aa', font: { family: 'Plus Jakarta Sans', size: 11 } } }, tooltip: { backgroundColor: '#18191c', titleColor: '#fff', bodyColor: '#a1a1aa', padding: 12, cornerRadius: 8, callbacks: { label: function(c) { return ' R$ ' + c.parsed.toFixed(2); } } } },
            onClick: (e, els) => {
                if (els.length > 0) {
                    const catClicada = labels[els[0].index];
                    currentCategoryFilter = (currentCategoryFilter === catClicada) ? null : catClicada;
                    document.getElementById('lbl-filtro-categoria').innerText = currentCategoryFilter ? `(${currentCategoryFilter})` : '';
                    renderizarGraficoPizza(currentTransactions); renderizarHistorico(currentTransactions);
                }
            }
        }
    });
}

function setHistoryTab(tab) {
    currentHistoryTab = tab;
    ['tab-hist-all','tab-hist-income','tab-hist-expense'].forEach(id => { document.getElementById(id).classList.remove('active'); document.getElementById(id).style.color = "var(--text-muted)"; });
    const btn = document.getElementById(`tab-hist-${tab}`); btn.classList.add('active'); btn.style.color = "white";
    renderizarHistorico(currentTransactions);
}

function renderizarHistorico(transacoes) {
    const c = document.getElementById('lista-transacoes'); c.innerHTML = "";
    let lista = transacoes;
    if(currentHistoryTab === 'income') lista = lista.filter(t => t.type === 'income');
    if(currentHistoryTab === 'expense') lista = lista.filter(t => t.type === 'expense');
    if(currentCategoryFilter) lista = lista.filter(t => t.category === currentCategoryFilter);
    if(lista.length === 0) { c.innerHTML = "<p style='font-size:12px; color:var(--text-muted); text-align:center;'>Nenhuma movimentação.</p>"; return; }
    lista.forEach(t => {
        const isInc = t.type === 'income'; const corStr = isInc ? 'var(--success-color)' : 'var(--danger-color)'; const svg = isInc ? iconIncome : iconExpense;
        c.innerHTML += `<div class="history-item"><div class="history-icon" style="color:${corStr};">${svg}</div><div class="history-details"><div class="history-title">${t.description || t.category}</div><div class="history-sub">${t.date.split('-').reverse().join('/')} • ${t.category}</div></div><div style="text-align: right; margin-right: 10px;"><div class="history-amount" style="color:${corStr};">${isInc?'+':'-'} R$ ${t.amount.toFixed(2)}</div></div><div class="history-actions"><button class="btn-small" style="background:rgba(59,130,246,0.15); color:#3b82f6;" onclick="prepararEdicaoTransacao(${t.id}, '${t.type}', ${t.amount}, '${t.category}', '${t.description}', '${t.date}')">${iconEdit}</button><button class="btn-small" style="background:rgba(239,68,68,0.15); color:#ef4444;" onclick="deletarTransacao(${t.id})">${iconTrash}</button></div></div>`;
    });
}

function atualizarCategoriasSelect() {
    const tipo = document.getElementById('fin-type').value; const catSelect = document.getElementById('fin-category');
    if (tipo === 'income') catSelect.innerHTML = `<option value="Salário">Salário</option><option value="Ganho Extra">Ganho Extra</option><option value="Investimentos">Investimentos</option><option value="Rendimento">Rendimento</option><option value="Outros">Outros</option>`;
    else catSelect.innerHTML = `<option value="Moradia">Moradia</option><option value="Alimentação">Alimentação</option><option value="Transporte">Transporte</option><option value="Saúde">Saúde</option><option value="Educação">Educação</option><option value="Lazer">Lazer</option><option value="Esportes">Esportes</option><option value="Compras">Compras</option><option value="Assinaturas">Assinaturas</option><option value="Outros">Outros</option>`;
}
function prepararNovaTransacao() { document.getElementById('fin-id').value = ""; document.getElementById('fin-amount').value = ""; document.getElementById('fin-desc').value = ""; document.getElementById('fin-date').value = hojeStr; atualizarCategoriasSelect(); abrirModal('modal-transacao'); }
function prepararEdicaoTransacao(id, type, amount, category, desc, date) { document.getElementById('fin-id').value = id; document.getElementById('fin-type').value = type; atualizarCategoriasSelect(); document.getElementById('fin-amount').value = amount; document.getElementById('fin-category').value = category; document.getElementById('fin-desc').value = desc; document.getElementById('fin-date').value = date; abrirModal('modal-transacao'); }
async function salvarTransacao() { const id = document.getElementById('fin-id').value; const obj = { user_id: parseInt(localStorage.getItem("user_id")), type: document.getElementById('fin-type').value, amount: parseFloat(document.getElementById('fin-amount').value), category: document.getElementById('fin-category').value, description: document.getElementById('fin-desc').value.trim() || document.getElementById('fin-category').value, date: document.getElementById('fin-date').value }; if(id) { await fetch(`${API_URL}/transactions/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); } else { await fetch(`${API_URL}/transactions`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); } fecharModal('modal-transacao'); recarregarTudo(); }
async function deletarTransacao(id) { await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' }); recarregarTudo(); }

// ================= METAS FINANCEIRAS =================
function renderizarMetasFinanceiras(metas) {
    const c = document.getElementById('lista-metas-fin'); if(!c) return; c.innerHTML = "";
    metas.forEach(m => {
        let pct = Math.min((m.current_amount / m.target_amount) * 100, 100); let falta = m.target_amount - m.current_amount;
        let histHtml = '';
        if(m.history && m.history.length > 0) {
            histHtml = `<div style="margin-top: 15px; border-top: 1px solid #2a2c32; padding-top: 10px;"><span style="font-size:11px; color:var(--text-muted); font-weight:bold;">HISTÓRICO DO SONHO:</span><div style="max-height: 80px; overflow-y: auto; margin-top:5px; padding-right:5px;">`;
            m.history.forEach(tx => { let isDep = tx.type === 'deposit'; let cor = isDep ? 'var(--success-color)' : 'var(--danger-color)'; histHtml += `<div style="display:flex; justify-content:space-between; font-size:11px; margin-bottom:6px; background: #111215; padding:6px; border-radius:6px; border:1px solid #2a2c32;"><span style="color:var(--text-muted);">${tx.date.split('-').reverse().join('/')} • ${tx.description}</span><span style="color:${cor}; font-weight:bold;">${isDep?'+':'-'} R$ ${tx.amount.toFixed(2)}</span></div>`; });
            histHtml += `</div></div>`;
        }
        c.innerHTML += `<div class="meta-card"><div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin-bottom: 5px;"><span>🎯 ${m.title}</span><span style="color:var(--fin-color);">${pct.toFixed(1)}%</span></div><div style="font-size:11px; color:var(--text-muted); font-style:italic; margin-bottom: 8px;">"${m.dream}"</div><div class="prog-container" style="height:8px; margin: 8px 0;"><div class="prog-fill bg-fin" style="width: ${pct}%;"></div></div><div style="display:flex; justify-content:space-between; align-items:center; margin-top: 10px;"><div style="display:flex; flex-direction:column;"><span style="font-size:12px; color:white; font-weight: bold;">R$ ${m.current_amount.toFixed(2)} de R$ ${m.target_amount.toFixed(2)}</span><span style="font-size:11px; color:var(--danger-color); font-weight:bold;">Falta: R$ ${falta > 0 ? falta.toFixed(2) : '0.00'}</span></div><div style="display:flex; gap:5px;"><button class="btn-small" style="background: rgba(255,255,255,0.1); color:white;" onclick="prepararEdicaoMetaFin(${m.id})">${iconEdit}</button><button class="btn-small" style="background: rgba(239,68,68,0.15); color:#ef4444;" onclick="deletarMetaFin(${m.id})">${iconTrash}</button><button class="btn-small" style="background: rgba(59, 130, 246, 0.2); color:#3b82f6; border: 1px solid var(--fin-color);" onclick="prepararTransacaoMeta(${m.id})">+ Aporte</button></div></div>${histHtml}</div>`;
    });
}
function prepararNovaMetaFin() { document.getElementById('meta-fin-id').value = ""; abrirModal('modal-meta-fin'); }
async function salvarMetaFin() { const id = document.getElementById('meta-fin-id').value; const obj = { user_id: parseInt(localStorage.getItem("user_id")), title: document.getElementById('meta-fin-titulo').value, dream: document.getElementById('meta-fin-dream').value || "Sem propósito.", target_amount: parseFloat(document.getElementById('meta-fin-valor').value), current_amount: parseFloat(document.getElementById('meta-fin-atual').value) || 0, months: parseInt(document.getElementById('meta-fin-meses').value) || 12 }; if(!obj.title || isNaN(obj.target_amount)) return; if(id) { await fetch(`${API_URL}/goals/finance/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); } else { await fetch(`${API_URL}/goals/finance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); } fecharModal('modal-meta-fin'); recarregarTudo(); }
async function deletarMetaFin(id) { await fetch(`${API_URL}/goals/finance/${id}`, { method: 'DELETE' }); recarregarTudo(); }
function prepararTransacaoMeta(id) { document.getElementById('meta-tx-id').value = id; document.getElementById('meta-tx-date').value = hojeStr; abrirModal('modal-meta-tx'); }
async function salvarTransacaoMeta() { const id = document.getElementById('meta-tx-id').value; const obj = { type: document.getElementById('meta-tx-type').value, amount: parseFloat(document.getElementById('meta-tx-amount').value), description: document.getElementById('meta-tx-desc').value.trim(), date: document.getElementById('meta-tx-date').value }; await fetch(`${API_URL}/goals/finance/${id}/transaction`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); fecharModal('modal-meta-tx'); recarregarTudo(); }

// ================= SAÚDE & ALIMENTAÇÃO =================
function renderizarMetasSaude(metas) {
    const c = document.getElementById('lista-metas-saude'); if(!c) return; c.innerHTML = "";
    if(metas.length === 0) { c.innerHTML = "<p style='font-size:12px; color:var(--text-muted); text-align:center;'>Nenhuma meta esportiva cadastrada.</p>"; return; }
    metas.forEach(m => {
        let isWeight = m.goal_type === 'weight';
        let diff = Math.abs(m.target_amount - m.current_amount);
        let pct = 0;
        
        // Logica para perca de peso e corrida livre
        if(isWeight) pct = m.current_amount <= m.target_amount ? 100 : Math.max(0, 100 - ((diff / m.current_amount) * 100));
        else pct = Math.min((m.current_amount / m.target_amount) * 100, 100);

        c.innerHTML += `<div class="meta-card"><div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin-bottom: 5px;"><span>🏆 ${m.title}</span><span style="color:var(--sau-color);">${pct.toFixed(1)}%</span></div><div style="font-size:11px; color:var(--text-muted); font-style:italic; margin-bottom: 8px;">"${m.dream}"</div><div class="prog-container" style="height:8px; margin: 8px 0;"><div class="prog-fill bg-sau" style="width: ${pct}%;"></div></div><div style="display:flex; justify-content:space-between; align-items:center; margin-top: 10px;"><div style="display:flex; flex-direction:column;"><span style="font-size:12px; color:white; font-weight: bold;">Atual: ${m.current_amount} de ${m.target_amount} ${m.unit}</span><span style="font-size:11px; color:var(--danger-color); font-weight:bold;">Falta: ${diff > 0 ? diff.toFixed(1) + ' ' + m.unit : '0.0 (Concluída)'}</span></div><div style="display:flex; gap:5px;"><button class="btn-small" style="background: rgba(239,68,68,0.15); color:#ef4444;" onclick="deletarMetaSaude(${m.id})">${iconTrash}</button></div></div></div>`;
    });
}

function renderizarGraficoComida(comidas) {
    const ctx = document.getElementById('foodChart').getContext('2d');
    const catMap = {}; comidas.forEach(c => { catMap[c.category] = (catMap[c.category] || 0) + 1; });
    const labels = Object.keys(catMap); const dataValues = Object.values(catMap);
    const bgColors = ['#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#6366f1']; // Verde pra saúde, vermelho pra junk food

    if(foodChartInstance) foodChartInstance.destroy();
    
    const rankC = document.getElementById('ranking-comidas');
    const listaC = document.getElementById('lista-comidas');
    listaC.innerHTML = comidas.map(c => `<div class="history-item"><div class="history-details" style="margin-left:5px;"><div class="history-title">${c.description}</div><div class="history-sub">${c.date.split('-').reverse().join('/')} • ${c.category}</div></div><button class="btn-small" style="background: rgba(239,68,68,0.15); color:#ef4444;" onclick="deletarComida(${c.id})">${iconTrash}</button></div>`).join('');

    if(labels.length === 0) {
        foodChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sem dados'], datasets: [{ data: [1], backgroundColor: ['#27272a'] }] }, options: { plugins: { legend: { display: false } } } });
        if(rankC) rankC.innerHTML = ''; return;
    }

    foodChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: { labels: labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 0 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#a1a1aa', font: { family: 'Plus Jakarta Sans', size: 10 } } } } }
    });
}

function prepararNovoAlimento() { document.getElementById('food-desc').value = ""; abrirModal('modal-alimento'); }
async function salvarAlimento() {
    const obj = { user_id: parseInt(localStorage.getItem("user_id")), description: document.getElementById('food-desc').value.trim(), category: document.getElementById('food-cat').value, date: hojeStr };
    if(!obj.description) return;
    await fetch(`${API_URL}/food`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-alimento'); recarregarTudo();
}
async function deletarComida(id) { await fetch(`${API_URL}/food/${id}`, { method: 'DELETE' }); recarregarTudo(); }

async function salvarMetaSaude() {
    const obj = { user_id: parseInt(localStorage.getItem("user_id")), title: document.getElementById('meta-sau-titulo').value, dream: document.getElementById('meta-sau-dream').value, goal_type: document.getElementById('meta-sau-type').value, current_amount: parseFloat(document.getElementById('meta-sau-atual').value), target_amount: parseFloat(document.getElementById('meta-sau-alvo').value), unit: document.getElementById('meta-sau-unit').value, months: parseInt(document.getElementById('meta-sau-meses').value) || 3 };
    await fetch(`${API_URL}/goals/health`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) });
    fecharModal('modal-meta-saude'); recarregarTudo();
}
async function deletarMetaSaude(id) { await fetch(`${API_URL}/goals/health/${id}`, { method: 'DELETE' }); recarregarTudo(); }

async function carregarCatalogoExercicios() { const res = await fetch(`${API_URL}/exercises`); if(res.ok) { const d = await res.json(); if(document.getElementById('saude-exercicio')) document.getElementById('saude-exercicio').innerHTML = d.map(e => `<option value="${e.id}">${e.name}</option>`).join(''); } }
async function salvarTreino() {
    const obj = { user_id: parseInt(localStorage.getItem("user_id")), exercise_id: parseInt(document.getElementById('saude-exercicio').value), duration_minutes: parseInt(document.getElementById('saude-tempo').value), distance_km: parseFloat(document.getElementById('saude-distancia').value) || 0.0, date: hojeStr };
    await fetch(`${API_URL}/workouts`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); document.getElementById('saude-tempo').value = ""; document.getElementById('saude-distancia').value = ""; recarregarTudo(); 
}

// --- PLANNER (Mantido do Original) ---
async function carregarPlannerSemanal_Visual(user_id) {
    const c = document.getElementById('planner-semanal'); if(!c) return; let tarefas = [];
    try { const res = await fetch(`${API_URL}/tasks/week?user_id=${user_id}&start=${startStr}&end=${endStr}`); if(res.ok) tarefas = await res.json(); } catch(e){}
    c.innerHTML = ""; const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    for(let i=0; i<7; i++) {
        let d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); let loopStr = d.toISOString().split('T')[0];
        let h = tarefas.filter(t => t.date === loopStr).map(t => `<div class="task-item" onclick="toggleTarefa(${t.id})" style="background:#111215; padding:10px; border-radius:8px; margin-bottom:6px; border:1px solid #2a2c32; display:flex; align-items:center; gap:10px;"><div style="width:16px; height:16px; border-radius:4px; border:2px solid ${t.is_completed?'gray':'var(--pro-color)'}; background:${t.is_completed?'gray':'transparent'};"></div><span style="${t.is_completed?'text-decoration:line-through; color:gray;':''}">${t.title}</span></div>`).join('');
        c.innerHTML += `<div class="day-block" style="background:#18191c; border:1px solid ${loopStr===hojeStr?'var(--pro-color)':'var(--border-color)'};"><div class="day-header" style="padding:10px 15px; display:flex; justify-content:space-between; align-items:center;"><div><span style="font-size:10px; font-weight:800; color:var(--text-muted);">${dias[d.getDay()]}</span><br><strong>${d.getDate()}</strong></div><button class="btn-outline" style="width:auto; margin:0; padding:4px 8px; font-size:11px;" onclick="addTarefaNoDia('${loopStr}')">+ Add</button></div><div style="padding:10px;">${h || '<span style="font-size:11px; color:var(--text-muted);">Livre</span>'}</div></div>`;
    }
}
async function addTarefaNoDia(dt) { const t = prompt("Nova tarefa:"); if(!t) return; await fetch(`${API_URL}/tasks`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({user_id: parseInt(localStorage.getItem("user_id")), title: t, date: dt}) }); recarregarTudo(); }
async function toggleTarefa(id) { await fetch(`${API_URL}/tasks/${id}/toggle`, { method: 'PATCH' }); recarregarTudo(); }
