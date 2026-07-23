import os
import math
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI(title="Predictor IA - Poisson + EV")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://postgres:postgres@localhost:5432/postgres")

def inicializar_banco():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS match_predictions_v2 (
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
        ''')
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Aviso BD: {str(e)}")

inicializar_banco()

class MatchData(BaseModel):
    league_home_goals: float
    league_away_goals: float
    
    home_team_name: str
    home_games_played: int
    home_scored_current: float
    home_conceded_current: float
    home_scored_prior: float
    home_conceded_prior: float
    
    away_team_name: str
    away_games_played: int
    away_scored_current: float
    away_conceded_current: float
    away_scored_prior: float
    away_conceded_prior: float

    # Novas variáveis para as Odds
    odd_home: float = 0.0
    odd_draw: float = 0.0
    odd_away: float = 0.0
    odd_dc_home: float = 0.0
    odd_dc_away: float = 0.0

class StatusUpdate(BaseModel):
    status: str

def poisson(k, lmbda):
    return (math.exp(-lmbda) * (lmbda ** k)) / math.factorial(k)

def bayesian_average(current_total, current_games, prior_avg, prior_weight=10):
    if current_games == 0:
        return prior_avg
    current_avg = current_total / current_games
    return ((current_avg * current_games) + (prior_avg * prior_weight)) / (current_games + prior_weight)

@app.post("/predict")
def predict_match(data: MatchData):
    # 1. Calcular Força Efetiva (Média Bayesiana)
    eff_home_scored = bayesian_average(data.home_scored_current, data.home_games_played, data.home_scored_prior)
    eff_home_conceded = bayesian_average(data.home_conceded_current, data.home_games_played, data.home_conceded_prior)
    
    eff_away_scored = bayesian_average(data.away_scored_current, data.away_games_played, data.away_scored_prior)
    eff_away_conceded = bayesian_average(data.away_conceded_current, data.away_games_played, data.away_conceded_prior)

    # 2. Força de Ataque e Defesa
    home_attack = eff_home_scored / data.league_home_goals if data.league_home_goals > 0 else 1.0
    home_defense = eff_home_conceded / data.league_away_goals if data.league_away_goals > 0 else 1.0
    
    away_attack = eff_away_scored / data.league_away_goals if data.league_away_goals > 0 else 1.0
    away_defense = eff_away_conceded / data.league_home_goals if data.league_home_goals > 0 else 1.0

    # 3. Gols Esperados (xG)
    home_xg = home_attack * away_defense * data.league_home_goals
    away_xg = away_attack * home_defense * data.league_away_goals

    # 4. Poisson
    max_goals = 7
    home_win_prob = 0; draw_prob = 0; away_win_prob = 0
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

    # 5. Cálculo do Expected Value (EV)
    # Fórmula: (Probabilidade_Decimal * Odd) - 1
    evs = {
        f"Vitória {data.home_team_name}": (home_win_prob * data.odd_home) - 1 if data.odd_home > 0 else -1,
        "Empate": (draw_prob * data.odd_draw) - 1 if data.odd_draw > 0 else -1,
        f"Vitória {data.away_team_name}": (away_win_prob * data.odd_away) - 1 if data.odd_away > 0 else -1,
        f"1X ({data.home_team_name})": ((home_win_prob + draw_prob) * data.odd_dc_home) - 1 if data.odd_dc_home > 0 else -1,
        f"X2 ({data.away_team_name})": ((away_win_prob + draw_prob) * data.odd_dc_away) - 1 if data.odd_dc_away > 0 else -1
    }

    best_bet_name = max(evs, key=evs.get)
    best_ev = evs[best_bet_name]

    # Decide a sugestão baseada no EV
    if best_ev > 0:
        recommended_bet = f"{best_bet_name} (EV: +{round(best_ev * 100, 2)}%)"
    else:
        # Fallback caso não tenha inserido odds ou todas sejam EV negativo
        if all(v == -1 for v in evs.values()):
            recommended_bet = "Preencha as Odds para calcular o EV"
        else:
            recommended_bet = "EV Negativo (Fique de fora)"

    h_pct = round(home_win_prob * 100, 2)
    d_pct = round(draw_prob * 100, 2)
    a_pct = round(away_win_prob * 100, 2)

    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute('''
            INSERT INTO match_predictions_v2 
            (home_team, away_team, home_xg, away_xg, home_win_pct, draw_pct, away_win_pct, most_likely_score, predicted_winner) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        ''', (data.home_team_name, data.away_team_name, round(home_xg,2), round(away_xg,2), h_pct, d_pct, a_pct, best_score, recommended_bet))
        new_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close(); conn.close()
    except Exception:
        new_id = None

    return {
        "id": new_id, "home_team": data.home_team_name, "away_team": data.away_team_name,
        "home_xg": round(home_xg, 2), "away_xg": round(away_xg, 2),
        "home_win_pct": h_pct, "draw_pct": d_pct, "away_win_pct": a_pct,
        "most_likely_score": best_score, "predicted_winner": recommended_bet
    }

@app.get("/predictions")
def get_predictions():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM match_predictions_v2 ORDER BY id DESC LIMIT 50;")
        dados = cursor.fetchall()
        cursor.close(); conn.close()
        return dados
    except Exception:
        return []

@app.patch("/predictions/{pred_id}/status")
def update_status(pred_id: int, payload: StatusUpdate):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("UPDATE match_predictions_v2 SET status = %s WHERE id = %s;", (payload.status, pred_id))
        conn.commit()
        cursor.close(); conn.close()
        return {"status": "ok"}
    except Exception:
        raise HTTPException(status_code=500, detail="Erro ao atualizar.")
