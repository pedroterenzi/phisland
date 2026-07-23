// Substitua pela URL do seu servidor FastAPI (Render ou localhost)
const API_URL = "http://127.0.0.1:8000"; 

// Ao carregar a página, já puxamos o histórico
document.addEventListener("DOMContentLoaded", () => {
    carregarHistorico();
});

async function calcularPrevisao() {
    const btn = document.getElementById('btn-calcular');
    btn.innerText = "Calculando...";
    btn.disabled = true;

    const payload = {
        league_home_goals: parseFloat(document.getElementById('l-home').value) || 0,
        league_away_goals: parseFloat(document.getElementById('l-away').value) || 0,
        home_team_name: document.getElementById('h-name').value || "Mandante",
        home_scored: parseFloat(document.getElementById('h-scored').value) || 0,
        home_conceded: parseFloat(document.getElementById('h-conceded').value) || 0,
        away_team_name: document.getElementById('a-name').value || "Visitante",
        away_scored: parseFloat(document.getElementById('a-scored').value) || 0,
        away_conceded: parseFloat(document.getElementById('a-conceded').value) || 0
    };

    try {
        const response = await fetch(`${API_URL}/predict`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (response.ok) {
            const data = await response.json();
            exibirResultados(data);
            carregarHistorico(); // Atualiza a lista na hora
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
    } catch (error) {
        console.error("Erro:", error);
        alert("Erro na API.");
    } finally {
        btn.innerText = "Calcular & Salvar";
        btn.disabled = false;
    }
}

function exibirResultados(data) {
    document.getElementById('card-resultado').classList.remove('escondido');
    document.getElementById('res-winner').innerText = data.predicted_winner;
    document.getElementById('res-score').innerText = data.most_likely_score;
    
    document.getElementById('bar-home').style.width = `${data.home_win_pct}%`;
    document.getElementById('bar-draw').style.width = `${data.draw_pct}%`;
    document.getElementById('bar-away').style.width = `${data.away_win_pct}%`;

    document.getElementById('txt-home').innerText = `Casa: ${data.home_win_pct}%`;
    document.getElementById('txt-draw').innerText = `Empate: ${data.draw_pct}%`;
    document.getElementById('txt-away').innerText = `Fora: ${data.away_win_pct}%`;
}

// === LÓGICA DE HISTÓRICO ===

async function carregarHistorico() {
    try {
        const response = await fetch(`${API_URL}/predictions`);
        if (!response.ok) return;
        const dados = await response.json();
        
        const container = document.getElementById('lista-previsoes');
        container.innerHTML = "";

        if (dados.length === 0) {
            container.innerHTML = "<p style='font-size:12px; color:var(--text-muted); text-align:center;'>Nenhuma previsão registrada.</p>";
            return;
        }

        dados.forEach(p => {
            // Estilizando a cor da borda de acordo com o Status
            let borderColor = "#33353b";
            let statusBadge = `background: rgba(255,255,255,0.1); color: white;`;
            
            if (p.status.includes('Green')) {
                borderColor = "var(--sau-color)";
                statusBadge = `background: rgba(16, 185, 129, 0.2); color: var(--sau-color);`;
            } else if (p.status.includes('Red')) {
                borderColor = "var(--danger-color)";
                statusBadge = `background: rgba(239, 68, 68, 0.2); color: var(--danger-color);`;
            } else {
                borderColor = "var(--warn-color)";
                statusBadge = `background: rgba(245, 158, 11, 0.2); color: var(--warn-color);`;
            }

            container.innerHTML += `
                <div class="history-item" style="border-left: 3px solid ${borderColor};">
                    <div class="history-header">
                        <div class="history-title">${p.home_team} vs ${p.away_team}</div>
                        <span class="badge" style="${statusBadge}">${p.status}</span>
                    </div>
                    <div class="history-sub">
                        🎯 Previsto: <strong>${p.predicted_winner}</strong> (${p.most_likely_score}) <br>
                        📊 Odds Modeladas: C ${p.home_win_pct}% | E ${p.draw_pct}% | F ${p.away_win_pct}%
                    </div>
                    
                    <!-- Botões de Ação para validar se o modelo acertou -->
                    <div style="display: flex; gap: 8px; margin-top: 10px;">
                        <button class="btn-small bg-green" onclick="atualizarStatus(${p.id}, '✅ Green')">Acertou (Green)</button>
                        <button class="btn-small bg-red" onclick="atualizarStatus(${p.id}, '❌ Red')">Errou (Red)</button>
                        <button class="btn-small" style="background: rgba(255,255,255,0.05);" onclick="atualizarStatus(${p.id}, 'Pendente ⏳')">Reset</button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erro ao puxar histórico.", error);
    }
}

async function atualizarStatus(id, novoStatus) {
    try {
        await fetch(`${API_URL}/predictions/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });
        carregarHistorico(); // Atualiza a lista para refletir a nova cor
    } catch (error) {
        alert("Falha ao atualizar o status.");
    }
}
