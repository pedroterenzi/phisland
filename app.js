const API_URL = "https://phisland.onrender.com"; 

document.addEventListener("DOMContentLoaded", () => {
    carregarHistorico();
});

function toggleTutorial() {
    const tut = document.getElementById('tutorial');
    const btn = document.getElementById('btn-tut');
    if (tut.style.display === 'block') {
        tut.style.display = 'none';
        btn.innerText = 'Ler Instruções';
    } else {
        tut.style.display = 'block';
        btn.innerText = 'Fechar Instruções';
    }
}

async function calcularPrevisao() {
    const btn = document.getElementById('btn-calcular');
    btn.innerText = "Calculando...";
    btn.disabled = true;

    const payload = {
        league_home_goals: parseFloat(document.getElementById('l-home').value) || 1.45,
        league_away_goals: parseFloat(document.getElementById('l-away').value) || 1.15,
        
        home_team_name: document.getElementById('h-name').value || "Mandante",
        home_games_played: parseInt(document.getElementById('h-games').value) || 0,
        home_scored_current: parseFloat(document.getElementById('h-scored-curr').value) || 0,
        home_conceded_current: parseFloat(document.getElementById('h-conceded-curr').value) || 0,
        home_scored_prior: parseFloat(document.getElementById('h-scored-prior').value) || 1.5,
        home_conceded_prior: parseFloat(document.getElementById('h-conceded-prior').value) || 1.0,

        away_team_name: document.getElementById('a-name').value || "Visitante",
        away_games_played: parseInt(document.getElementById('a-games').value) || 0,
        away_scored_current: parseFloat(document.getElementById('a-scored-curr').value) || 0,
        away_conceded_current: parseFloat(document.getElementById('a-conceded-curr').value) || 0,
        away_scored_prior: parseFloat(document.getElementById('a-scored-prior').value) || 1.2,
        away_conceded_prior: parseFloat(document.getElementById('a-conceded-prior').value) || 1.5,

        // Odds
        odd_home: parseFloat(document.getElementById('odd-home').value) || 0,
        odd_draw: parseFloat(document.getElementById('odd-draw').value) || 0,
        odd_away: parseFloat(document.getElementById('odd-away').value) || 0,
        odd_dc_home: parseFloat(document.getElementById('odd-dc-home').value) || 0,
        odd_dc_away: parseFloat(document.getElementById('odd-dc-away').value) || 0
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
            carregarHistorico();
            confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        }
    } catch (error) {
        alert("Erro na conexão. Verifique se o FastAPI está rodando.");
    } finally {
        btn.innerText = "Calcular Algoritmo & Encontrar Valor";
        btn.disabled = false;
    }
}

function exibirResultados(data) {
    document.getElementById('card-resultado').style.display = 'block';
    
    // Atualiza o bloco de EV Principal (Aposta Recomendada)
    const evText = document.getElementById('res-ev');
    evText.innerText = data.recommended_ev_bet;
    
    if (data.recommended_ev_bet.includes("Negativo") || data.recommended_ev_bet.includes("Insira")) {
        evText.style.color = "var(--away-color)";
    } else {
        evText.style.color = "var(--success)";
    }

    // Processa e desenha o Ranking de EVs
    const evContainer = document.getElementById('ev-ranking-container');
    const evList = document.getElementById('ev-list');
    
    if (data.ev_ranking && data.ev_ranking.length > 0) {
        evContainer.style.display = 'block';
        evList.innerHTML = '';
        
        data.ev_ranking.forEach(item => {
            const evPercent = (item.ev * 100).toFixed(2);
            const isPositive = item.ev > 0;
            const signal = isPositive ? '+' : '';
            const textColor = isPositive ? 'var(--success)' : 'var(--away-color)';
            const bgColor = isPositive ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
            
            evList.innerHTML += `
                <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: ${bgColor}; border-radius: 8px; font-size: 13px; font-weight: 600;">
                    <span style="color: var(--text-main);">${item.bet}</span>
                    <span style="color: ${textColor};">${signal}${evPercent}%</span>
                </div>
            `;
        });
    } else {
        evContainer.style.display = 'none';
    }

    // Organiza a visualização do Vencedor e Placar Base
    document.getElementById('res-score').innerHTML = `${data.most_likely_score} <br> <span style="font-size: 14px; color: var(--text-muted);">Favorito Matemático: <strong>${data.predicted_winner}</strong></span>`;
    
    document.getElementById('res-xg-home').innerText = data.home_xg;
    document.getElementById('res-xg-away').innerText = data.away_xg;
    
    document.getElementById('bar-home').style.width = `${data.home_win_pct}%`;
    document.getElementById('bar-draw').style.width = `${data.draw_pct}%`;
    document.getElementById('bar-away').style.width = `${data.away_win_pct}%`;

    document.getElementById('txt-home').innerText = `${data.home_team}: ${data.home_win_pct}%`;
    document.getElementById('txt-draw').innerText = `Empate: ${data.draw_pct}%`;
    document.getElementById('txt-away').innerText = `${data.away_team}: ${data.away_win_pct}%`;
}

async function carregarHistorico() {
    try {
        const response = await fetch(`${API_URL}/predictions`);
        if (!response.ok) return;
        const dados = await response.json();
        
        const container = document.getElementById('lista-previsoes');
        container.innerHTML = "";

        if (dados.length === 0) {
            container.innerHTML = "<p style='font-size:13px; color:var(--text-muted); text-align:center;'>Nenhum histórico.</p>";
            return;
        }

        dados.forEach(p => {
            let borderColor = "#e5e7eb";
            let badgeStyle = "background: #f3f4f6; color: #4b5563;";
            
            if (p.status.includes('Green')) {
                borderColor = "var(--success)";
                badgeStyle = "background: #d1fae5; color: #047857;";
            } else if (p.status.includes('Red')) {
                borderColor = "var(--away-color)";
                badgeStyle = "background: #fee2e2; color: #b91c1c;";
            } else if (p.status.includes('Void')) {
                borderColor = "var(--draw-color)";
                badgeStyle = "background: #fef3c7; color: #b45309;";
            }

            container.innerHTML += `
                <div class="history-item" style="border-left: 4px solid ${borderColor};">
                    <div style="display: flex; justify-content: space-between; align-items: center;">
                        <span style="font-weight: 700; font-size: 14px; color: var(--text-main);">${p.home_team} x ${p.away_team}</span>
                        <span class="badge" style="${badgeStyle}">${p.status}</span>
                    </div>
                    <div style="font-size: 12px; color: var(--text-muted);">
                        Sugestão (EV+): <strong style="color: var(--primary);">${p.predicted_winner}</strong> <br>
                        Odds: Casa ${p.home_win_pct}% | Empate ${p.draw_pct}% | Fora ${p.away_win_pct}% <br>
                        Placar Base: ${p.most_likely_score}
                    </div>
                    
                    <div style="display: flex; gap: 8px; margin-top: 5px;">
                        <button class="btn-small" style="background: #10b981; color: white;" onclick="atualizarStatus(${p.id}, '✅ Green')">Green</button>
                        <button class="btn-small" style="background: #ef4444; color: white;" onclick="atualizarStatus(${p.id}, '❌ Red')">Red</button>
                        <button class="btn-small" style="background: #f59e0b; color: white;" onclick="atualizarStatus(${p.id}, '➖ Void')">Devolvida</button>
                        <button class="btn-small" style="background: #e5e7eb; color: #4b5563;" onclick="atualizarStatus(${p.id}, 'Pendente ⏳')">Reset</button>
                    </div>
                </div>
            `;
        });
    } catch (error) {
        console.error("Erro histórico:", error);
    }
}

async function atualizarStatus(id, novoStatus) {
    try {
        await fetch(`${API_URL}/predictions/${id}/status`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: novoStatus })
        });
        carregarHistorico(); 
    } catch (error) {}
}
