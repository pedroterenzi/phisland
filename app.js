// Substitua pela URL gerada pelo seu back-end no Render depois!
const API_URL = "https://phisland.onrender.com"; 

document.addEventListener("DOMContentLoaded", () => {
    // Seta a data de hoje no input por padrão
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('input-data').value = today;
    
    // Carrega os dados assim que o app abre
    carregarDashboard();
});

function alternarTela(idTela) {
    document.getElementById('tela-dashboard').classList.add('escondido');
    document.getElementById('tela-nova-transacao').classList.add('escondido');
    document.getElementById(idTela).classList.remove('escondido');
}

async function carregarDashboard() {
    try {
        const res = await fetch(`${API_URL}/dashboard`);
        if (res.ok) {
            const data = await res.json();
            
            // Atualiza Saldo
            document.getElementById('lbl-saldo').innerText = `R$ ${data.saldo.toFixed(2)}`;
            
            // Atualiza Gastos vs Limite
            document.getElementById('lbl-gastos').innerText = `R$ ${data.gastos.toFixed(2)} / R$ ${data.limite.toFixed(2)}`;
            
            // Calcula Barra de Progresso
            let pct = (data.gastos / data.limite) * 100;
            if (pct > 100) pct = 100;
            const barra = document.getElementById('barra-progresso');
            barra.style.width = `${pct}%`;
            barra.style.backgroundColor = pct > 80 ? 'var(--danger-color)' : 'var(--accent-color)';

            // Atualiza Educador Financeiro
            document.getElementById('lbl-educador').innerText = data.educador;
        }
    } catch (error) {
        console.error("Erro ao conectar com a API:", error);
        document.getElementById('lbl-educador').innerText = "Servidor offline ou inicializando...";
    }
}

async function salvarTransacao() {
    const tipo = document.getElementById('input-tipo').value;
    const valor = parseFloat(document.getElementById('input-valor').value);
    const categoria = document.getElementById('input-categoria').value;
    const data = document.getElementById('input-data').value;
    const btnSalvar = document.getElementById('btn-salvar');

    if (isNaN(valor) || valor <= 0 || !data) {
        return alert("Por favor, preencha o valor e a data corretamente.");
    }

    btnSalvar.innerText = "Salvando...";
    btnSalvar.disabled = true;

    const payload = {
        type: tipo,
        amount: valor,
        category: categoria,
        description: "",
        date: data
    };

    try {
        const res = await fetch(`${API_URL}/transactions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (res.ok) {
            alert("Lançamento salvo com sucesso!");
            document.getElementById('input-valor').value = ""; // Limpa o campo
            alternarTela('tela-dashboard');
            carregarDashboard(); // Recarrega os gráficos atualizados
        } else {
            alert("Erro ao salvar no banco de dados.");
        }
    } catch (error) {
        alert("Erro de comunicação com o servidor.");
    } finally {
        btnSalvar.innerText = "Salvar Lançamento";
        btnSalvar.disabled = false;
    }
}
