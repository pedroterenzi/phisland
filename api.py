import os
import math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI(title="Predictor IA - Poisson & Histórico")

# Configuração de CORS para o frontend HTML se comunicar
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Conexão com o Banco de Dados (Substitua pela sua URL do Render se estiver em prod)
DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")

def inicializar_banco():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS match_predictions (
                id SERIAL PRIMARY KEY,
                home_team VARCHAR(100),
                away_team VARCHAR(100),
                home_xg NUMERIC,
                away_xg NUMERIC,
                home_win_pct NUMERIC,
                draw_pct NUMERIC,
                away_win_pct NUMERIC,
                most_likely_score VARCHAR(20),
                predicted_winner VARCHAR(100),
                status VARCHAR(50) DEFAULT 'Pendente ⏳'
            );
        """)
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Aviso BD: {str(e)} - Configure a variável DATABASE_URL corretamente.")

inicializar_banco()

# --- MODELOS DE DADOS ---
class MatchData(BaseModel):
    league_home_goals: float
    league_away_goals: float
    home_scored: float
    home_conceded: float
    away_scored: float
    away_conceded: float
    home_team_name: str = "Mandante"
    away_team_name: str = "Visitante"

class StatusUpdate(BaseModel):
    status: str

# --- LÓGICA MATEMÁTICA ---
def poisson(k, lmbda):
    return (math.exp(-lmbda) * (lmbda ** k)) / math.factorial(k)

# --- ROTAS DA API ---
@app.post("/predict")
def predict_match(data: MatchData):
    # 1. Calcular Força (Ajuste caso as médias da liga sejam 0)
    home_attack = data.home_scored / data.league_home_goals if data.league_home_goals > 0 else 1.0
    home_defense = data.home_conceded / data.league_away_goals if data.league_away_goals > 0 else 1.0
    away_attack = data.away_scored / data.league_away_goals if data.league_away_goals > 0 else 1.0
    away_defense = data.away_conceded / data.league_home_goals if data.league_home_goals > 0 else 1.0

    # 2. Gols Esperados (xG)
    home_xg = home_attack * away_defense * data.league_home_goals
    away_xg = away_attack * home_defense * data.league_away_goals

    # 3. Poisson
    max_goals = 7; home_win_prob = 0; draw_prob = 0; away_win_prob = 0
    best_score = "0 x 0"; max_score_prob = 0

    for i in range(max_goals):
        for j in range(max_goals):
            prob = poisson(i, home_xg) * poisson(j, away_xg)
            if prob > max_score_prob:
                max_score_prob = prob
                best_score = f"{i} x {j}"
            if i > j: home_win_prob += prob
            elif i == j: draw_prob += prob
            else: away_win_prob += prob

    # 4. Define o Vencedor e Porcentagens
    winner = data.home_team_name
    if away_win_prob > home_win_prob and away_win_prob > draw_prob: winner = data.away_team_name
    elif draw_prob > home_win_prob and draw_prob > away_win_prob: winner = "Empate"

    h_pct = round(home_win_prob * 100, 2)
    d_pct = round(draw_prob * 100, 2)
    a_pct = round(away_win_prob * 100, 2)

    # 5. Salva no Banco de Dados
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO match_predictions 
            (home_team, away_team, home_xg, away_xg, home_win_pct, draw_pct, away_win_pct, most_likely_score, predicted_winner) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (data.home_team_name, data.away_team_name, round(home_xg,2), round(away_xg,2), h_pct, d_pct, a_pct, best_score, winner))
        new_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        new_id = None
        print("Erro ao salvar:", e)

    return {
        "id": new_id,
        "home_team": data.home_team_name, "away_team": data.away_team_name,
        "home_xg": round(home_xg, 2), "away_xg": round(away_xg, 2),
        "home_win_pct": h_pct, "draw_pct": d_pct, "away_win_pct": a_pct,
        "most_likely_score": best_score, "predicted_winner": winner
    }

@app.get("/predictions")
def get_predictions():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        # Traz as últimas 50 previsões
        cursor.execute("SELECT * FROM match_predictions ORDER BY id DESC LIMIT 50;")
        dados = cursor.fetchall()
        cursor.close()
        conn.close()
        return dados
    except Exception as e:
        return []

@app.patch("/predictions/{pred_id}/status")
def update_status(pred_id: int, payload: StatusUpdate):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("UPDATE match_predictions SET status = %s WHERE id = %s;", (payload.status, pred_id))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "ok"}
    except Exception as e:
        raise HTTPException(status_code=500, detail="Erro ao atualizar.")
