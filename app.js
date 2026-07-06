const API_URL = "https://phisland.onrender.com"; 

let dataHoje = new Date();
const hojeStr = dataHoje.toISOString().split('T')[0];

let startOfWeek = new Date(dataHoje); startOfWeek.setDate(dataHoje.getDate() - (dataHoje.getDay() === 0 ? 6 : dataHoje.getDay() - 1));
let endOfWeek = new Date(startOfWeek); endOfWeek.setDate(startOfWeek.getDate() + 6);
const startStr = startOfWeek.toISOString().split('T')[0]; const endStr = endOfWeek.toISOString().split('T')[0];

let financeChartInstance = null; let foodChartInstance = null; let moodChartInstance = null;
let currentTransactions = []; let currentCategoryFilter = null; let currentHistoryTab = 'all';
let estadoHumorAtual = "Neutro"; let workoutPlansGlobal = []; 

const iconEdit = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path></svg>`;
const iconTrash = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
const iconIncome = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>`;
const iconExpense = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>`;

document.addEventListener("DOMContentLoaded", () => {
    document.getElementById('filtro-mes-fin').value = `${dataHoje.getFullYear()}-${(dataHoje.getMonth()+1).toString().padStart(2,'0')}`;
    document.getElementById('fin-date').value = hojeStr;

    const userIdSalvo = localStorage.getItem("user_id");
    if (userIdSalvo) {
        document.getElementById('tela-autenticacao').classList.add('escondido');
        document.getElementById('conteudo-app').classList.remove('escondido');
        document.getElementById('lbl-boas-vindas').innerText = localStorage.getItem("user_nickname");
        document.getElementById('print-name').innerText = localStorage.getItem("user_nickname");
        navegar('financas'); 
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

// ================= MOTOR DE REATIVIDADE CENTRAL =================
async function recarregarTudo() {
    const user_id = localStorage.getItem("user_id"); if(!user_id) return;
    let selectedMonth = document.getElementById('filtro-mes-fin').value || `${dataHoje.getFullYear()}-${(dataHoje.getMonth()+1).toString().padStart(2,'0')}`;
    
    try {
        const res = await fetch(`${API_URL}/dashboard/unificado?user_id=${user_id}&date=${selectedMonth}-01&start_week=${startStr}&end_week=${endStr}`);
        if(!res.ok) return; const data = await res.json();
        
        // --- 🧠 MENTAL E TAREFAS INTELIGENTES ---
        renderizarPlannerInteligente(data.mental.tasks || []); 
        renderizarGraficoHumor(data.mental.history);
        prepararRelatorioTCC(data.mental.journals);
        gerarInsightFoco(data.mental.history);
        gerarInsightGatilhos(data.mental.history, data.mental.journals);
        
        // --- 🏋️ SAÚDE ---
        workoutPlansGlobal = data.saude.workout_plans || [];
        selecionarDiaTreino(dataHoje.getDay() === 0 ? 0 : dataHoje.getDay(), null);
        if(data.saude.biometria) {
            let water = data.saude.biometria.water_ml; let sleep = data.saude.biometria.sleep_hours;
            document.getElementById('lbl-agua').innerText = `${water} ml`; document.getElementById('lbl-sono').innerText = `${sleep} hrs`;
            let batteryPct = Math.min(100, (Math.min(water/3000, 1)*50) + (Math.min(sleep/8, 1)*50));
            let batEl = document.getElementById('battery-level'); batEl.style.width = batteryPct + '%';
            if(batteryPct < 30) batEl.style.backgroundColor = 'var(--danger-color)'; else if(batteryPct < 70) batEl.style.backgroundColor = '#f59e0b'; else batEl.style.backgroundColor = 'var(--success-color)';
            document.getElementById('battery-pct').innerText = batteryPct.toFixed(0) + '%';
        }
        renderizarMetasSaude(data.saude.metas); renderizarGraficoComida(data.saude.comidas);
        if(document.getElementById('lbl-cal-hoje')) { document.getElementById('lbl-cal-hoje').innerText = data.saude.treinos_hoje.calorias.toFixed(0); document.getElementById('lbl-km-hoje').innerText = data.saude.treinos_hoje.kms.toFixed(1); }
        let caloriasIngeridas = 0; data.saude.comidas.forEach(c => { let calSaved = parseInt(localStorage.getItem(`food_cal_${c.id}`)) || 400; caloriasIngeridas += calSaved; });
        let basalEst = 2000; let caloriasQueimadas = data.saude.treinos_hoje.calorias; let saldoEnergetico = basalEst - caloriasIngeridas + caloriasQueimadas;
        if(document.getElementById('lbl-cal-restantes')) { document.getElementById('lbl-cal-restantes').innerText = Math.round(saldoEnergetico) + " kcal"; if(saldoEnergetico < 0) document.getElementById('lbl-cal-restantes').style.color = "var(--danger-color)"; else document.getElementById('lbl-cal-restantes').style.color = "white"; }
        
        let exerciciosPlanejadosHoje = workoutPlansGlobal.filter(p => p.day_of_week === (dataHoje.getDay()===0 ? 0 : dataHoje.getDay())).length;
        if(document.getElementById('health-feedback-box')) {
            if(exerciciosPlanejadosHoje > 0 && caloriasQueimadas > 0) {
                document.getElementById('health-feedback-box').classList.remove('escondido');
                document.getElementById('health-feedback-text').innerHTML = `💡 <strong>Performance:</strong> Você cumpriu seu treino planejado. Continue assim!`;
            } else if (exerciciosPlanejadosHoje > 0) {
                document.getElementById('health-feedback-box').classList.remove('escondido');
                document.getElementById('health-feedback-text').innerHTML = `⏳ <strong>Lembrete:</strong> Você tem ${exerciciosPlanejadosHoje} exercícios planejados para hoje. Registre seu esforço!`;
            } else { document.getElementById('health-feedback-box').classList.add('escondido'); }
        }

        // --- 💰 FINANÇAS ---
        const saldoEl = document.getElementById('lbl-saldo'); saldoEl.innerText = `R$ ${data.financas.saldo.toFixed(2)}`;
        document.getElementById('lbl-rendas').innerText = `R$ ${data.financas.rendas.toFixed(2)}`; document.getElementById('lbl-gastos').innerText = `R$ ${data.financas.gastos.toFixed(2)}`;
        saldoEl.classList.remove('text-danger', 'text-success');
        let max_val = Math.max(data.financas.rendas, data.financas.gastos, 1000); let pct = (Math.abs(data.financas.saldo) / max_val) * 50; if(pct > 50) pct = 50; 
        if (data.financas.saldo < 0) { saldoEl.classList.add('text-danger'); document.getElementById('barra-fin-neg').style.width = `${pct}%`; document.getElementById('barra-fin-pos').style.width = `0%`; } 
        else { saldoEl.classList.add('text-success'); document.getElementById('barra-fin-neg').style.width = `0%`; document.getElementById('barra-fin-pos').style.width = `${pct}%`; }
        renderizarMetasFinanceiras(data.financas.metas); currentTransactions = data.financas.transacoes; renderizarGraficoPizza(currentTransactions); renderizarHistorico(currentTransactions); renderizarRecorrentes(data.financas.recorrentes);
        
    } catch (e) { console.error("Aviso:", e); }
}

// ================= PLANNER: TIMELINE & RECORRÊNCIA =================
async function renderizarPlannerInteligente(tarefasFallback) {
    const c = document.getElementById('planner-semanal'); if(!c) return;
    let tarefas = [];
    try { const res = await fetch(`${API_URL}/tasks/week?user_id=${localStorage.getItem("user_id")}&start=${startStr}&end=${endStr}`); if(res.ok) tarefas = await res.json(); } catch(e){ tarefas = tarefasFallback; }
    
    c.innerHTML = ""; const dias = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
    const isCaotico = document.getElementById('toggle-caotico').checked;
    let sugeriu = false;
    
    for(let i=0; i<7; i++) {
        let d = new Date(startOfWeek); d.setDate(startOfWeek.getDate() + i); 
        let loopStr = d.toISOString().split('T')[0];
        let isHoje = loopStr === hojeStr;
        
        let tarefasDoDia = tarefas.filter(t => t.date === loopStr || (t.is_recurring && new Date(t.date) <= new Date(loopStr)));
        tarefasDoDia.sort((a,b) => (a.time_str || '23:59').localeCompare(b.time_str || '23:59'));
        
        let pendentes = tarefasDoDia.filter(t => !t.is_completed).length;
        let statusTexto = pendentes > 0 ? `<span style="color:var(--danger-color);">${pendentes} pendente(s)</span>` : `<span style="color:var(--text-muted);">Tudo feito</span>`;
        if(tarefasDoDia.length === 0) statusTexto = `<span style="color:var(--text-muted);">Livre</span>`;

        let htmlTarefas = tarefasDoDia.map(t => {
            let tagColor = t.tag === 'Mental' ? 'var(--men-color)' : (t.tag === 'Físico' ? 'var(--sau-color)' : (t.tag === 'Trabalho' ? 'var(--pro-color)' : 'var(--text-muted)'));
            let classPesada = t.mental_load >= 4 ? 'task-pesada' : '';
            
            if (isHoje && !sugeriu && !t.is_completed && !isCaotico && estadoHumorAtual.includes('Calmo') && t.mental_load <= 3) {
                document.getElementById('acao-sugerida-box').classList.remove('escondido');
                document.getElementById('acao-sugerida-text').innerHTML = `Você parece calmo. Ótimo momento para riscar: <strong>${t.title}</strong>.`;
                sugeriu = true;
            }

            return `
            <div class="timeline-item ${classPesada}">
                ${t.time_str ? `<div class="timeline-time">${t.time_str}</div>` : ''}
                <div class="task-item ${t.is_completed ? 'completed' : ''}" style="margin:0;">
                    <div style="display:flex; align-items:center; gap:10px; cursor:pointer;" onclick="toggleTarefa(${t.id}, event)">
                        <div style="width:16px; height:16px; border-radius:4px; border:2px solid ${t.is_completed?'gray':'var(--pro-color)'}; background:${t.is_completed?'gray':'transparent'}; display:flex; align-items:center; justify-content:center;">
                            ${t.is_completed ? '<span style="color:white; font-size:10px;">✔</span>' : ''}
                        </div>
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:600; font-size:14px; color:${t.is_completed?'gray':'white'};">${t.title}</span>
                            <div style="display:flex; gap:5px; font-size:10px; margin-top:2px;">
                                <span style="background:rgba(255,255,255,0.1); padding:2px 6px; border-radius:4px; color:${tagColor};">${t.tag || 'Geral'}</span>
                                <span style="color:#f59e0b;">${'⭐'.repeat(t.mental_load || 1)}</span>
                                ${t.is_recurring ? '<span style="color:var(--text-muted);">🔄 Fixo</span>' : ''}
                            </div>
                        </div>
                    </div>
                </div>
            </div>`;
        }).join('');

        let displayContent = isHoje ? 'block' : 'none';
        let borderColor = isHoje ? 'var(--pro-color)' : 'var(--border-color)';
        
        c.innerHTML += `
        <div class="day-block" style="border-color:${borderColor};">
            <div class="day-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                <div><span style="font-size:10px; font-weight:800; color:var(--text-muted);">${dias[d.getDay()]}</span><br><strong>${d.getDate()}</strong></div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <span style="font-size:11px;">${statusTexto}</span>
                    <button class="btn-outline" style="width:auto; margin:0; padding:4px 8px; font-size:11px;" onclick="event.stopPropagation(); abrirModalTarefa('${loopStr}')">+ Add</button>
                </div>
            </div>
            <div class="day-content" style="display:${displayContent}; padding-left: 20px;">
                ${htmlTarefas || '<div style="text-align:center; padding:10px 0;"><span style="font-size:11px; color:var(--text-muted);">Dia livre. Respire.</span></div>'}
            </div>
        </div>`;
    }
    if(!sugeriu || isCaotico) document.getElementById('acao-sugerida-box').classList.add('escondido');
}

function abrirModalTarefa(data) { document.getElementById('task-date').value = data; document.getElementById('task-title').value = ""; document.getElementById('task-time').value = ""; document.getElementById('task-recurring').checked = false; abrirModal('modal-nova-tarefa'); }

async function salvarTarefaNova() {
    const obj = { user_id: parseInt(localStorage.getItem("user_id")), title: document.getElementById('task-title').value.trim(), date: document.getElementById('task-date').value, tag: document.getElementById('task-tag').value, mental_load: parseInt(document.getElementById('task-load').value), time_str: document.getElementById('task-time').value, is_recurring: document.getElementById('task-recurring').checked };
    if(!obj.title) return;
    await fetch(`${API_URL}/tasks`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); 
    fecharModal('modal-nova-tarefa'); recarregarTudo(); 
}

async function toggleTarefa(id, event) { 
    const el = event.currentTarget; const isAlreadyCompleted = el.parentElement.classList.contains('completed');
    if(!isAlreadyCompleted) {
        let rect = el.getBoundingClientRect(); let x = (rect.left + (rect.width / 2)) / window.innerWidth; let y = (rect.top + (rect.height / 2)) / window.innerHeight;
        confetti({ particleCount: 50, spread: 60, origin: { x: x, y: y }, colors: ['#8b5cf6', '#10b981', '#3b82f6'] });
    }
    await fetch(`${API_URL}/tasks/${id}/toggle`, { method: 'PATCH' }); recarregarTudo(); 
}

function toggleDiaCaotico(checkbox) {
    const appBody = document.getElementById('app-body');
    if(checkbox.checked) { appBody.classList.add('app-caotico'); alert("🌪️ Dia Caótico Ativado.\n\nTarefas com Carga Mental Alta (4 a 5 estrelas) foram ofuscadas.\nNão se culpe. Faremos apenas o essencial hoje."); } 
    else { appBody.classList.remove('app-caotico'); }
    recarregarTudo(); 
}

// ================= INSIGHTS MENTAIS PREDITIVOS =================
function gerarInsightFoco(historico) {
    if(!historico || historico.length < 3) return; 
    let horasFoco = [];
    historico.forEach(h => {
        let score = parseInt(h.mood.split('|')[1]) || 3;
        if(score >= 4) horasFoco.push(14); 
    });
    if(horasFoco.length > 0) {
        document.getElementById('insight-foco-box').classList.remove('escondido');
        document.getElementById('insight-foco-text').innerHTML = `Sua energia atinge picos entre <strong>14h e 16h</strong>. Agende tarefas difíceis para este bloco.`;
    }
}
function gerarInsightGatilhos(historico, diarios) {
    if(!historico || !diarios || diarios.length === 0) return;
    let diasRuins = historico.filter(h => { let s = parseInt(h.mood.split('|')[1]) || 3; return s <= 2; }).map(h => h.date);
    let gatilhos = [];
    diarios.forEach(d => {
        if(diasRuins.includes(d.date)) {
            let t = d.situation.toLowerCase();
            if(t.includes('reunião') || t.includes('chefe')) gatilhos.push('Pressão no Trabalho');
        }
    });
    if(gatilhos.length > 0) {
        let g = [...new Set(gatilhos)][0]; 
        document.getElementById('insight-gaps-box').classList.remove('escondido');
        document.getElementById('insight-gaps-text').innerHTML = `Dias difíceis frequentemente mencionam <strong>"${g}"</strong>. Tente meditar antes desses eventos.`;
    }
}

// ================= BOTÃO SOS (PÂNICO E VIBRAÇÃO) =================
let sosInterval;
function ativarSOS() {
    document.getElementById('tela-sos').classList.remove('escondido'); document.body.classList.add('sos-mode-active');
    let breatheText = document.getElementById('breathe-text'); let state = 0;
    sosInterval = setInterval(() => {
        if(state === 0) { breatheText.innerText = "EXPIRE..."; state = 1; } else { breatheText.innerText = "INSPIRE..."; state = 0; }
        if (navigator.vibrate) navigator.vibrate(4000); 
    }, 4000);
    if (navigator.vibrate) navigator.vibrate(4000); 
}
function desativarSOS() {
    document.getElementById('tela-sos').classList.add('escondido'); document.body.classList.remove('sos-mode-active');
    clearInterval(sosInterval); if (navigator.vibrate) navigator.vibrate(0); 
}

// ================= BRAIN DUMP (VOZ) =================
let tempSpeechText = "";
function iniciarBrainDump() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if(!SpeechRecognition) return alert("Navegador não suporta voz nativa. Use o Chrome ou Safari.");
    const recognition = new SpeechRecognition(); recognition.lang = 'pt-BR'; recognition.interimResults = false; recognition.maxAlternatives = 1;
    let btnTxt = document.getElementById('txt-mic'); let originalTxt = btnTxt.innerText; btnTxt.innerText = "Ouvindo... (Fale agora)";
    recognition.start();
    recognition.onresult = function(event) { tempSpeechText = event.results[0][0].transcript; document.getElementById('txt-capturado').innerText = tempSpeechText; abrirModal('modal-braindump'); };
    recognition.onspeechend = function() { btnTxt.innerText = originalTxt; };
    recognition.onerror = function(event) { btnTxt.innerText = originalTxt; alert("Não consegui ouvir. Tente novamente."); };
}
async function salvarDumpComoTarefa() { const obj = { user_id: parseInt(localStorage.getItem("user_id")), title: tempSpeechText, date: hojeStr, tag: "Mental", mental_load: 2 }; await fetch(`${API_URL}/tasks`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); fecharModal('modal-braindump'); recarregarTudo(); }
async function salvarDumpComoNota() { const obj = { user_id: parseInt(localStorage.getItem("user_id")), mood: "Ansioso/Acelerado|1", energy_level: 5, anxiety_level: 8, note: tempSpeechText, date: hojeStr }; await fetch(`${API_URL}/mental`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); fecharModal('modal-braindump'); recarregarTudo(); }

// ================= RASTREADOR E DIÁRIO TCC =================
function renderizarGraficoHumor(history) {
    const ctx = document.getElementById('moodChart').getContext('2d');
    if(moodChartInstance) moodChartInstance.destroy();
    if(!history || history.length === 0) { moodChartInstance = new Chart(ctx, { type: 'line', data: { labels: ['Sem dados'], datasets: [{ data: [0] }] }, options: { plugins: { legend: { display: false } } } }); return; }
    const labels = history.map(h => h.date.split('-')[2]); const dataValues = history.map(h => parseInt(h.mood.split('|')[1]) || 5); 
    if(history.length > 0) estadoHumorAtual = history[history.length-1].mood.split('|')[0];
    moodChartInstance = new Chart(ctx, { type: 'line', data: { labels: labels, datasets: [{ label: 'Score Emocional', data: dataValues, borderColor: 'var(--men-color)', backgroundColor: 'rgba(244, 63, 94, 0.2)', tension: 0.4, fill: true, borderWidth: 3 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 6, display: false }, x: { grid: { display:false } } }, plugins: { legend: { display: false } } } });
}
async function salvarHumor() { const obj = { user_id: parseInt(localStorage.getItem("user_id")), mood: document.getElementById('mental-mood').value, energy_level: parseInt(document.getElementById('mental-energy').value), anxiety_level: 5, note: "", date: hojeStr }; await fetch(`${API_URL}/mental`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); fecharModal('modal-humor'); recarregarTudo(); }
async function salvarJournal() { const obj = { user_id: parseInt(localStorage.getItem("user_id")), situation: document.getElementById('tcc-sit').value, automatic_thought: document.getElementById('tcc-aut').value, reframe: document.getElementById('tcc-ref').value, gratitude_1: document.getElementById('tcc-g1').value, gratitude_2: document.getElementById('tcc-g2').value, gratitude_3: document.getElementById('tcc-g3').value, date: hojeStr }; await fetch(`${API_URL}/journal`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); fecharModal('modal-journal'); recarregarTudo(); alert("✔ Reflexão salva."); }
function prepararRelatorioTCC(journals) {
    const c = document.getElementById('print-tcc'); c.innerHTML = "";
    if(!journals || journals.length === 0) { c.innerHTML = "O paciente não realizou registros TCC no período."; return; }
    journals.forEach(j => { c.innerHTML += `<div style="margin-bottom: 20px; border-bottom: 1px solid #ccc; padding-bottom: 10px;"><p><strong>Data:</strong> ${j.date}</p><p><strong>Situação Gatilho:</strong> ${j.situation}</p><p><strong>Pensamento:</strong> ${j.automatic_thought}</p><p><strong>Reestruturação:</strong> ${j.reframe}</p></div>`; });
}


// ================= TREINOS (CONSTRUTOR DE SEMANA) =================
let currentWorkoutDay = 1;
function selecionarDiaTreino(day_id, btnElement) {
    currentWorkoutDay = day_id;
    if(btnElement) { document.querySelectorAll('.day-pill').forEach(b => b.classList.remove('active')); btnElement.classList.add('active'); }
    const c = document.getElementById('lista-plano-treino'); if(!c) return; c.innerHTML = "";
    let tDoDia = workoutPlansGlobal.filter(p => p.day_of_week === currentWorkoutDay);
    if(tDoDia.length === 0) { c.innerHTML = "<p style='font-size:12px; color:var(--text-muted); text-align:center;'>Descanso ou livre.</p>"; return; }
    tDoDia.forEach(t => { c.innerHTML += `<div class="history-item" style="border-left: 3px solid var(--sau-color);"><div class="history-details" style="margin-left: 5px;"><div class="history-title">${t.exercise_name}</div><div class="history-sub">${t.sets} Séries x ${t.reps} Reps • ${t.notes}</div></div><button class="btn-small" style="background: rgba(239,68,68,0.15); color:#ef4444;" onclick="deletarPlanoTreino(${t.id})">${iconTrash}</button></div>`; });
}
async function salvarPlanoTreino() { const obj = { user_id: parseInt(localStorage.getItem("user_id")), day_of_week: parseInt(document.getElementById('wp-day').value), exercise_name: document.getElementById('wp-name').value, sets: parseInt(document.getElementById('wp-sets').value) || 3, reps: document.getElementById('wp-reps').value || "10", notes: document.getElementById('wp-notes').value }; if(!obj.exercise_name) return; await fetch(`${API_URL}/workout_plans`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); fecharModal('modal-workout-plan'); recarregarTudo(); }
async function deletarPlanoTreino(id) { await fetch(`${API_URL}/workout_plans/${id}`, { method: 'DELETE' }); recarregarTudo(); }


// ================= FINANÇAS E SAÚDE (RENDERIZADORES MANTIDOS INTACTOS) =================
function renderizarGraficoPizza(t){ const ctx=document.getElementById('financeChart').getContext('2d'); const d=t.filter(x=>x.type==='expense'); const m={}; d.forEach(x=>m[x.category]=(m[x.category]||0)+x.amount); const l=Object.keys(m); const v=Object.values(m); const c=['#3b82f6','#ef4444','#f59e0b','#8b5cf6','#ec4899','#f97316','#6366f1','#64748b','#dc2626','#d97706']; if(financeChartInstance)financeChartInstance.destroy(); const rc=document.getElementById('ranking-categorias'); if(l.length===0){ financeChartInstance=new Chart(ctx,{type:'doughnut',data:{labels:['Sem gastos'],datasets:[{data:[1],backgroundColor:['#27272a']}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{display:false},tooltip:{enabled:false}}}}); if(rc) rc.innerHTML = ''; return; } const a=l.map(x=>({name:x,amount:m[x]})).sort((a,b)=>b.amount-a.amount); const tVal=v.reduce((a,b)=>a+b,0); if(rc){ rc.innerHTML=a.map(x=>{ const idx=l.indexOf(x.name); const col=c[idx%c.length]; const pct=((x.amount/tVal)*100).toFixed(1); return `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid var(--border-color);"><div style="display:flex; align-items:center; gap:10px;"><div style="width:12px; height:12px; border-radius:4px; background:${col};"></div><span style="font-size:13px; font-weight:600; color:white;">${x.name}</span></div><div style="display:flex; align-items:center; gap:10px;"><span style="font-size:13px; font-weight:800; color:white;">R$ ${x.amount.toFixed(2)}</span><span style="font-size:11px; color:var(--text-muted); width:40px; text-align:right;">${pct}%</span></div></div>`;}).join(''); } const off=l.map(x=>x===currentCategoryFilter?15:0); financeChartInstance=new Chart(ctx,{type:'doughnut',data:{labels:l,datasets:[{data:v,backgroundColor:c,borderWidth:0,hoverOffset:10,offset:off}]},options:{responsive:true,maintainAspectRatio:false,animation:false,plugins:{legend:{position:'right',labels:{color:'#a1a1aa',font:{family:'Plus Jakarta Sans',size:11}}},tooltip:{backgroundColor:'#18191c',titleColor:'#fff',bodyColor:'#a1a1aa',padding:12,cornerRadius:8,callbacks:{label:function(c){return ' R$ '+c.parsed.toFixed(2);}}}},onClick:(e,els)=>{if(els.length>0){const cat=l[els[0].index];currentCategoryFilter=(currentCategoryFilter===cat)?null:cat;document.getElementById('lbl-filtro-categoria').innerText=currentCategoryFilter?`(${currentCategoryFilter})`:'';renderizarGraficoPizza(currentTransactions);renderizarHistorico(currentTransactions);}}}}); }
function setHistoryTab(t){ currentHistoryTab=t; ['tab-hist-all','tab-hist-income','tab-hist-expense'].forEach(id=>{document.getElementById(id).classList.remove('active');document.getElementById(id).style.color="var(--text-muted)";}); const b=document.getElementById(`tab-hist-${t}`); b.classList.add('active'); b.style.color="white"; renderizarHistorico(currentTransactions); }
function renderizarHistorico(t){ const c=document.getElementById('lista-transacoes'); c.innerHTML=""; let l=t; if(currentHistoryTab==='income')l=l.filter(x=>x.type==='income'); if(currentHistoryTab==='expense')l=l.filter(x=>x.type==='expense'); if(currentCategoryFilter)l=l.filter(x=>x.category===currentCategoryFilter); if(l.length===0){c.innerHTML="<p style='font-size:12px; color:var(--text-muted); text-align:center;'>Nenhuma movimentação.</p>";return;} l.forEach(x=>{ const isInc=x.type==='income'; const cor=isInc?'var(--success-color)':'var(--danger-color)'; const svg=isInc?iconIncome:iconExpense; const dt=x.date.split('-').reverse().join('/'); c.innerHTML+=`<div class="history-item"><div class="history-icon" style="color:${cor};">${svg}</div><div class="history-details"><div class="history-title">${x.description||x.category}</div><div class="history-sub">${dt} • ${x.category}</div></div><div style="text-align: right; margin-right: 10px;"><div class="history-amount" style="color:${cor};">${isInc?'+':'-'} R$ ${x.amount.toFixed(2)}</div></div><div class="history-actions"><button class="btn-small" style="background:rgba(59,130,246,0.15); color:#3b82f6;" onclick="prepararEdicaoTransacao(${x.id}, '${x.type}', ${x.amount}, '${x.category}', '${x.description}', '${x.date}')">${iconEdit}</button><button class="btn-small" style="background:rgba(239,68,68,0.15); color:#ef4444;" onclick="deletarTransacao(${x.id})">${iconTrash}</button></div></div>`; }); }
function renderizarRecorrentes(recorrentes) { const c = document.getElementById('lista-recorrentes'); c.innerHTML = ""; if(recorrentes.length === 0) return; recorrentes.forEach(r => { c.innerHTML += `<div class="history-item" style="border-left: 3px solid var(--fin-color);"><div class="history-details" style="margin-left: 5px;"><div class="history-title">${r.description}</div><div class="history-sub">Vence dia ${r.due_day} • ${r.category}</div></div><div class="history-amount text-danger" style="margin-right: 10px;">R$ ${r.amount.toFixed(2)}</div><button class="btn-small" style="background: rgba(239,68,68,0.15); color:#ef4444;" onclick="deletarRecorrente(${r.id})">${iconTrash}</button></div>`; }); }
function atualizarCategoriasSelect() { const tipo = document.getElementById('fin-type').value; const catSelect = document.getElementById('fin-category'); if (tipo === 'income') catSelect.innerHTML = `<option value="Salário">Salário</option><option value="Ganho Extra">Ganho Extra</option><option value="Investimentos">Investimentos</option><option value="Rendimento">Rendimento</option><option value="Outros">Outros</option>`; else catSelect.innerHTML = `<option value="Moradia">Moradia</option><option value="Alimentação">Alimentação</option><option value="Transporte">Transporte</option><option value="Saúde">Saúde</option><option value="Educação">Educação</option><option value="Lazer">Lazer</option><option value="Esportes">Esportes</option><option value="Compras">Compras</option><option value="Assinaturas">Assinaturas</option><option value="Outros">Outros</option>`; }
function prepararNovaTransacao() { document.getElementById('fin-id').value = ""; document.getElementById('fin-amount').value = ""; document.getElementById('fin-desc').value = ""; document.getElementById('fin-date').value = hojeStr; atualizarCategoriasSelect(); abrirModal('modal-transacao'); }
function prepararEdicaoTransacao(id, type, amount, category, desc, date) { document.getElementById('fin-id').value = id; document.getElementById('fin-type').value = type; atualizarCategoriasSelect(); document.getElementById('fin-amount').value = amount; document.getElementById('fin-category').value = category; document.getElementById('fin-desc').value = desc; document.getElementById('fin-date').value = date; abrirModal('modal-transacao'); }
async function salvarTransacao() { const id = document.getElementById('fin-id').value; const obj = { user_id: parseInt(localStorage.getItem("user_id")), type: document.getElementById('fin-type').value, amount: parseFloat(document.getElementById('fin-amount').value), category: document.getElementById('fin-category').value, description: document.getElementById('fin-desc').value.trim() || document.getElementById('fin-category').value, date: document.getElementById('fin-date').value }; if(id) { await fetch(`${API_URL}/transactions/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); } else { await fetch(`${API_URL}/transactions`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); } fecharModal('modal-transacao'); recarregarTudo(); }
async function deletarTransacao(id) { await fetch(`${API_URL}/transactions/${id}`, { method: 'DELETE' }); recarregarTudo(); }
async function salvarRecorrente() { const obj = { user_id: parseInt(localStorage.getItem("user_id")), description: document.getElementById('rec-desc').value.trim(), amount: parseFloat(document.getElementById('rec-amount').value), category: document.getElementById('rec-category').value, due_day: parseInt(document.getElementById('rec-day').value) }; await fetch(`${API_URL}/recurring`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); fecharModal('modal-recorrente'); recarregarTudo(); }
async function deletarRecorrente(id) { await fetch(`${API_URL}/recurring/${id}`, { method: 'DELETE' }); recarregarTudo(); }
function prepararNovaMetaFin() { document.getElementById('meta-fin-id').value = ""; abrirModal('modal-meta-fin'); }
async function salvarMetaFin() { const id = document.getElementById('meta-fin-id').value; const obj = { user_id: parseInt(localStorage.getItem("user_id")), title: document.getElementById('meta-fin-titulo').value, dream: document.getElementById('meta-fin-dream').value || "", target_amount: parseFloat(document.getElementById('meta-fin-valor').value), current_amount: parseFloat(document.getElementById('meta-fin-atual').value) || 0, months: parseInt(document.getElementById('meta-fin-meses').value) || 12 }; if(id) { await fetch(`${API_URL}/goals/finance/${id}`, { method: 'PUT', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); } else { await fetch(`${API_URL}/goals/finance`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); } fecharModal('modal-meta-fin'); recarregarTudo(); }
function renderizarMetasFinanceiras(metas) { const c = document.getElementById('lista-metas-fin'); if(!c) return; c.innerHTML = ""; metas.forEach(m => { let atual = parseFloat(m.current_amount) || 0; let alvo = parseFloat(m.target_amount) || 1; let pct = Math.min((atual / alvo) * 100, 100); let falta = alvo - atual; c.innerHTML += `<div class="meta-card"><div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold; margin-bottom:5px;"><span>🎯 ${m.title}</span><span style="color:var(--fin-color);">${pct.toFixed(1)}%</span></div><div class="prog-container" style="height:8px; margin:8px 0;"><div class="prog-fill bg-fin" style="width:${pct}%;"></div></div><div style="display:flex; justify-content:space-between; align-items:center; margin-top:10px;"><div style="display:flex; flex-direction:column;"><span style="font-size:12px; color:white; font-weight:bold;">R$ ${x.current_amount.toFixed(2)} de R$ ${x.target_amount.toFixed(2)}</span><span style="font-size:11px; color:var(--danger-color); font-weight:bold;">Falta: R$ ${f>0?f.toFixed(2):'0.00'}</span></div><button class="btn-small" style="background:rgba(59,130,246,0.2); color:#3b82f6; border:1px solid var(--fin-color);" onclick="prepararTransacaoMeta(${x.id})">+ Aporte</button></div></div>`; }); }
function prepararTransacaoMeta(id){ document.getElementById('meta-tx-id').value=id; document.getElementById('meta-tx-date').value=hojeStr; abrirModal('modal-meta-tx'); }
async function salvarTransacaoMeta(){ const id=document.getElementById('meta-tx-id').value; const obj={type:document.getElementById('meta-tx-type').value,amount:parseFloat(document.getElementById('meta-tx-amount').value),description:document.getElementById('meta-tx-desc').value.trim(),date:document.getElementById('meta-tx-date').value}; await fetch(`${API_URL}/goals/finance/${id}/transaction`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(obj)}); fecharModal('modal-meta-tx'); recarregarTudo(); }
function renderizarMetasSaude(m){ const c=document.getElementById('lista-metas-saude'); if(!c)return; c.innerHTML=""; m.forEach(x=>{ let p=Math.min((x.current_amount/x.target_amount)*100,100); c.innerHTML+=`<div class="meta-card"><div style="display:flex; justify-content:space-between; font-size:14px; font-weight:bold;"><span>🏆 ${x.title}</span><span style="color:var(--sau-color);">${p.toFixed(1)}%</span></div><div class="prog-container" style="height:8px; margin:8px 0;"><div class="prog-fill bg-sau" style="width:${p}%;"></div></div><span style="font-size:12px; font-weight:bold;">Atual: ${x.current_amount} de ${x.target_amount}</span></div>`; }); }
function renderizarGraficoComida(comidas) { const ctx = document.getElementById('foodChart').getContext('2d'); if(foodChartInstance) foodChartInstance.destroy(); if(comidas.length === 0) { foodChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: ['Sem dados'], datasets: [{ data: [1], backgroundColor: ['#27272a'] }] }, options: { plugins: { legend: { display: false } } } }); return; } const catMap = {}; comidas.forEach(c => { let cleanCat = c.category.split('|')[0]; catMap[cleanCat] = (catMap[cleanCat] || 0) + 1; }); const labels = Object.keys(catMap); const dataValues = Object.values(catMap); const colorMap = { "Saudável/Natural": "#10b981", "Carboidrato Simples": "#f59e0b", "Doce/Açúcar": "#ec4899", "Fast Food/Fritura": "#ef4444", "Bebida Alcóolica": "#8b5cf6" }; const bgColors = labels.map(l => colorMap[l] || "#a1a1aa"); foodChartInstance = new Chart(ctx, { type: 'doughnut', data: { labels: labels, datasets: [{ data: dataValues, backgroundColor: bgColors, borderWidth: 0 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: { color: '#a1a1aa', font: { family: 'Plus Jakarta Sans', size: 11 } } } } } }); }
function prepararNovoAlimento() { document.getElementById('food-desc').value = ""; abrirModal('modal-alimento'); }
async function salvarAlimento() { const obj = { user_id: parseInt(localStorage.getItem("user_id")), description: document.getElementById('food-desc').value.trim(), category: document.getElementById('food-cat').value, quality_score: parseInt(document.getElementById('food-cat').value.split('|')[1]) || 50, date: hojeStr }; await fetch(`${API_URL}/food`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); fecharModal('modal-alimento'); recarregarTudo(); }
async function adicionarAgua() { await fetch(`${API_URL}/biometrics`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: parseInt(localStorage.getItem("user_id")), water_ml: 250, sleep_hours: 0, sleep_quality: 'Regular', date: hojeStr }) }); recarregarTudo(); }
async function salvarBiometria() { await fetch(`${API_URL}/biometrics`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: parseInt(localStorage.getItem("user_id")), water_ml: 0, sleep_hours: parseFloat(document.getElementById('sono-horas').value) || 0, sleep_quality: document.getElementById('sono-qualidade').value, date: hojeStr }) }); fecharModal('modal-sono'); recarregarTudo(); }
async function salvarMetaSaude() { await fetch(`${API_URL}/goals/health`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ user_id: parseInt(localStorage.getItem("user_id")), title: document.getElementById('meta-sau-titulo').value, dream: document.getElementById('meta-sau-dream').value, goal_type: document.getElementById('meta-sau-type').value, current_amount: parseFloat(document.getElementById('meta-sau-atual').value), target_amount: parseFloat(document.getElementById('meta-sau-alvo').value), unit: document.getElementById('meta-sau-unit').value, months: parseInt(document.getElementById('meta-sau-meses').value) || 3 }) }); fecharModal('modal-meta-saude'); recarregarTudo(); }
async function carregarCatalogoExercicios() { const res = await fetch(`${API_URL}/exercises`); if(res.ok) { const d = await res.json(); const sel = document.getElementById('saude-exercicio'); if(sel) { sel.innerHTML = d.map(e => `<option value="${e.id}">${e.name}</option>`).join(''); sel.dispatchEvent(new Event('change')); } } }
async function salvarTreino() { const obj = { user_id: parseInt(localStorage.getItem("user_id")), exercise_id: parseInt(document.getElementById('saude-exercicio').value), duration_minutes: parseInt(document.getElementById('saude-tempo').value), distance_km: parseFloat(document.getElementById('saude-distancia').value) || 0.0, rpe: parseInt(document.getElementById('saude-rpe').value) || 5, date: hojeStr }; await fetch(`${API_URL}/workouts`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(obj) }); document.getElementById('saude-tempo').value = ""; document.getElementById('saude-distancia').value = ""; recarregarTudo(); }
