import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import psycopg2
from psycopg2.extras import RealDictCursor

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "")

def inicializar_banco():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Criação Limpa sem apagar dados do usuário
        cursor.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, name VARCHAR(255), nickname VARCHAR(100), login VARCHAR(100) UNIQUE, password VARCHAR(100));")
        cursor.execute("CREATE TABLE IF NOT EXISTS transactions (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, type VARCHAR(20), amount NUMERIC, category VARCHAR(100), description TEXT, date VARCHAR(50));")
        cursor.execute("CREATE TABLE IF NOT EXISTS recurring_expenses (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, description TEXT, amount NUMERIC, category VARCHAR(100), due_day INT);")
        cursor.execute("CREATE TABLE IF NOT EXISTS financial_goals (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(255), dream TEXT, target_amount NUMERIC, current_amount NUMERIC DEFAULT 0, months INT);")
        cursor.execute("CREATE TABLE IF NOT EXISTS goal_transactions (id SERIAL PRIMARY KEY, goal_id INT REFERENCES financial_goals(id) ON DELETE CASCADE, type VARCHAR(20), amount NUMERIC, description TEXT, date VARCHAR(50));")
        
        cursor.execute("CREATE TABLE IF NOT EXISTS health_goals (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(255), dream TEXT, goal_type VARCHAR(50), current_amount NUMERIC DEFAULT 0, target_amount NUMERIC, unit VARCHAR(20), months INT);")
        cursor.execute("CREATE TABLE IF NOT EXISTS food_logs (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, description VARCHAR(255), category VARCHAR(100), quality_score INT DEFAULT 50, date VARCHAR(50));")
        
        cursor.execute("CREATE TABLE IF NOT EXISTS exercises (id SERIAL PRIMARY KEY, name VARCHAR(255), muscle_group VARCHAR(100), calories_per_minute NUMERIC);")
        cursor.execute("CREATE TABLE IF NOT EXISTS workout_logs (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, exercise_id INT, duration_minutes INT, distance_km NUMERIC DEFAULT 0, rpe INT DEFAULT 5, calories_burned NUMERIC, date VARCHAR(50));")
        cursor.execute("CREATE TABLE IF NOT EXISTS workout_plans (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, day_of_week INT, exercise_name VARCHAR(255), sets INT, reps VARCHAR(50), notes TEXT);")
        cursor.execute("CREATE TABLE IF NOT EXISTS daily_biometrics (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, date VARCHAR(50), water_ml INT DEFAULT 0, sleep_hours NUMERIC DEFAULT 0, sleep_quality VARCHAR(50) DEFAULT 'Regular');")
        
        cursor.execute("CREATE TABLE IF NOT EXISTS tasks (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, title VARCHAR(255), is_completed BOOLEAN DEFAULT FALSE, date VARCHAR(50), tag VARCHAR(50) DEFAULT 'Geral', mental_load INT DEFAULT 1, time_str VARCHAR(10) DEFAULT '', is_recurring BOOLEAN DEFAULT FALSE);")
        
        # 🚨 NOVA COLUNA QUE SALVA O PROBLEMA DA RECORRÊNCIA DE TAREFAS
        try: cursor.execute("ALTER TABLE tasks ADD COLUMN IF NOT EXISTS completed_dates TEXT DEFAULT '';")
        except Exception: pass

        cursor.execute("CREATE TABLE IF NOT EXISTS mental_logs (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, mood VARCHAR(50), energy_level INT, anxiety_level INT, note TEXT, date VARCHAR(50));")
        cursor.execute("CREATE TABLE IF NOT EXISTS journal_logs (id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE, situation TEXT, automatic_thought TEXT, reframe TEXT, gratitude_1 VARCHAR(255), gratitude_2 VARCHAR(255), gratitude_3 VARCHAR(255), date VARCHAR(50));")
        
        cursor.execute("SELECT COUNT(*) FROM exercises;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO exercises (name, muscle_group, calories_per_minute) VALUES ('Musculação', 'Geral', 6.0), ('Corrida', 'Cardio', 11.0), ('Ciclismo', 'Cardio', 8.5), ('Natação', 'Cardio', 10.0);")
            
        conn.commit(); cursor.close(); conn.close()
    except Exception as e:
        print(f"Erro BD: {str(e)}")

inicializar_banco()

class ModeloCadastro(BaseModel): name: str; nickname: str; login: str; password: str
class ModeloLogin(BaseModel): login: str; password: str
class ModeloTransacao(BaseModel): user_id: int; type: str; amount: float; category: str; description: str; date: str
class ModeloEdicaoTransacao(BaseModel): type: str; amount: float; category: str; description: str; date: str
class ModeloRecorrente(BaseModel): user_id: int; description: str; amount: float; category: str; due_day: int
class ModeloMetaFin(BaseModel): user_id: int; title: str; dream: str; target_amount: float; current_amount: float; months: int
class ModeloEdicaoMetaFin(BaseModel): title: str; dream: str; target_amount: float; current_amount: float; months: int
class ModeloMetaTransacao(BaseModel): type: str; amount: float; description: str; date: str
class ModeloAporte(BaseModel): amount: float 
class ModeloMetaSaude(BaseModel): user_id: int; title: str; dream: str; goal_type: str; current_amount: float; target_amount: float; unit: str; months: int
class ModeloTreino(BaseModel): user_id: int; exercise_id: int; duration_minutes: int; distance_km: float; rpe: int; date: str
class ModeloWorkoutPlan(BaseModel): user_id: int; day_of_week: int; exercise_name: str; sets: int; reps: str; notes: str
class ModeloAlimento(BaseModel): user_id: int; description: str; category: str; quality_score: int; date: str
class ModeloBiometrics(BaseModel): user_id: int; water_ml: int; sleep_hours: float; sleep_quality: str; date: str
class ModeloTarefa(BaseModel): user_id: int; title: str; date: str; tag: str = 'Geral'; mental_load: int = 1; time_str: str = ''; is_recurring: bool = False
class ModeloToggleTarefa(BaseModel): date: str # Novo Modelo para receber a data da tarefa ticada
class ModeloMentalLog(BaseModel): user_id: int; mood: str; energy_level: int; anxiety_level: int; note: str; date: str
class ModeloJournal(BaseModel): user_id: int; situation: str; automatic_thought: str; reframe: str; gratitude_1: str; gratitude_2: str; gratitude_3: str; date: str

# ROTAS INTACTAS OMITIDAS AQUI POR ESPAÇO...
@app.post("/auth/signup")
def cadastrar_usuario(obj: ModeloCadastro):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO users (name, nickname, login, password) VALUES (%s, %s, %s, %s) RETURNING id;", (obj.name, obj.nickname, obj.login.strip().lower(), obj.password)); novo_id = cursor.fetchone()[0]; conn.commit(); cursor.close(); conn.close(); return {"status": "ok", "user_id": novo_id, "nickname": obj.nickname}
@app.post("/auth/login")
def logar_usuario(obj: ModeloLogin):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor); cursor.execute("SELECT id, nickname FROM users WHERE login = %s AND password = %s;", (obj.login.strip().lower(), obj.password)); user = cursor.fetchone(); cursor.close(); conn.close()
    if user: return user
    raise HTTPException(status_code=401, detail="Credenciais inválidas.")

@app.post("/goals/finance")
def criar_meta_fin(obj: ModeloMetaFin):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO financial_goals (user_id, title, dream, target_amount, current_amount, months) VALUES (%s, %s, %s, %s, %s, %s);", (obj.user_id, obj.title, obj.dream, obj.target_amount, obj.current_amount, obj.months)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.put("/goals/finance/{id}")
def editar_meta_fin(id: int, obj: ModeloEdicaoMetaFin):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("UPDATE financial_goals SET title=%s, dream=%s, target_amount=%s, current_amount=%s, months=%s WHERE id=%s;", (obj.title, obj.dream, obj.target_amount, obj.current_amount, obj.months, id)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.delete("/goals/finance/{id}")
def deletar_meta_fin(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("DELETE FROM financial_goals WHERE id=%s;", (id,)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.post("/goals/finance/{id}/transaction")
def transacao_meta(id: int, obj: ModeloMetaTransacao):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("UPDATE financial_goals SET current_amount = current_amount {} %s WHERE id = %s;".format('+' if obj.type=='deposit' else '-'), (obj.amount, id)); cursor.execute("INSERT INTO goal_transactions (goal_id, type, amount, description, date) VALUES (%s, %s, %s, %s, %s);", (id, obj.type, obj.amount, obj.description, obj.date)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.post("/transactions")
def salvar_transacao(obj: ModeloTransacao):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO transactions (user_id, type, amount, category, description, date) VALUES (%s, %s, %s, %s, %s, %s);", (obj.user_id, obj.type, obj.amount, obj.category, obj.description, obj.date)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.put("/transactions/{id}")
def editar_transacao(id: int, obj: ModeloEdicaoTransacao):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("UPDATE transactions SET type=%s, amount=%s, category=%s, description=%s, date=%s WHERE id=%s;", (obj.type, obj.amount, obj.category, obj.description, obj.date, id)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.delete("/transactions/{id}")
def deletar_transacao(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("DELETE FROM transactions WHERE id = %s;", (id,)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.post("/recurring")
def salvar_recorrente(obj: ModeloRecorrente):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO recurring_expenses (user_id, description, amount, category, due_day) VALUES (%s, %s, %s, %s, %s);", (obj.user_id, obj.description, obj.amount, obj.category, obj.due_day)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.delete("/recurring/{id}")
def deletar_recorrente(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("DELETE FROM recurring_expenses WHERE id = %s;", (id,)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.post("/goals/health")
def criar_meta_saude(obj: ModeloMetaSaude):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO health_goals (user_id, title, dream, goal_type, current_amount, target_amount, unit, months) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);", (obj.user_id, obj.title, obj.dream, obj.goal_type, obj.current_amount, obj.target_amount, obj.unit, obj.months)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.delete("/goals/health/{id}")
def deletar_meta_saude(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("DELETE FROM health_goals WHERE id=%s;", (id,)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.post("/food")
def logar_alimento(obj: ModeloAlimento):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO food_logs (user_id, description, category, quality_score, date) VALUES (%s, %s, %s, %s, %s);", (obj.user_id, obj.description, obj.category, obj.quality_score, obj.date)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.delete("/food/{id}")
def deletar_alimento(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("DELETE FROM food_logs WHERE id = %s;", (id,)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.get("/exercises")
def listar_exercicios():
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor); cursor.execute("SELECT * FROM exercises;")
    dados = [{"id": d["id"], "name": d["name"], "calories_per_minute": float(d["calories_per_minute"])} for d in cursor.fetchall()]; cursor.close(); conn.close(); return dados

# 🚨 LÓGICA DE CALORIAS INTELIGENTE ATUALIZADA
@app.post("/workouts")
def logar_treino(obj: ModeloTreino):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    
    # Busca Peso do Usuário para cálculo preciso (usa 75kg se não tiver meta registrada)
    cursor.execute("SELECT current_weight FROM health_goals WHERE user_id = %s ORDER BY id DESC LIMIT 1;", (obj.user_id,))
    weight_row = cursor.fetchone()
    peso_real = float(weight_row[0]) if weight_row else 75.0

    cursor.execute("SELECT calories_per_minute FROM exercises WHERE id = %s;", (obj.exercise_id,))
    base_cal = float(cursor.fetchone()[0])
    
    # Multiplicador metabólico: Base cal * proporção do peso * Fator de Esforço (RPE 5 é base)
    fator_rpe = 1.0 + ((obj.rpe - 5) * 0.05)
    calorias_queimadas = base_cal * (peso_real / 75.0) * fator_rpe * obj.duration_minutes

    cursor.execute("INSERT INTO workout_logs (user_id, exercise_id, duration_minutes, distance_km, rpe, calories_burned, date) VALUES (%s, %s, %s, %s, %s, %s, %s);", 
                   (obj.user_id, obj.exercise_id, obj.duration_minutes, obj.distance_km, obj.rpe, calorias_queimadas, obj.date))
    conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.delete("/workouts/{id}")
def deletar_treino(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("DELETE FROM workout_logs WHERE id = %s;", (id,)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.post("/biometrics")
def salvar_biometrics(obj: ModeloBiometrics):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("SELECT id FROM daily_biometrics WHERE user_id = %s AND date = %s;", (obj.user_id, obj.date)); existe = cursor.fetchone()
    if existe: cursor.execute("UPDATE daily_biometrics SET water_ml = water_ml + %s, sleep_hours = %s, sleep_quality = %s WHERE id = %s;", (obj.water_ml, obj.sleep_hours, obj.sleep_quality, existe[0]))
    else: cursor.execute("INSERT INTO daily_biometrics (user_id, water_ml, sleep_hours, sleep_quality, date) VALUES (%s, %s, %s, %s, %s);", (obj.user_id, obj.water_ml, obj.sleep_hours, obj.sleep_quality, obj.date))
    conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.post("/workout_plans")
def criar_plano_treino(obj: ModeloWorkoutPlan):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO workout_plans (user_id, day_of_week, exercise_name, sets, reps, notes) VALUES (%s, %s, %s, %s, %s, %s);", (obj.user_id, obj.day_of_week, obj.exercise_name, obj.sets, obj.reps, obj.notes)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.delete("/workout_plans/{id}")
def deletar_plano_treino(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("DELETE FROM workout_plans WHERE id = %s;", (id,)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

@app.get("/tasks/week")
def listar_tarefas_semana(user_id: int, start: str, end: str):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM tasks WHERE user_id = %s AND (is_recurring = TRUE OR (date >= %s AND date <= %s)) ORDER BY time_str ASC, id ASC;", (user_id, start, end))
    dados = cursor.fetchall(); cursor.close(); conn.close(); return dados

@app.post("/tasks")
def criar_tarefa(obj: ModeloTarefa):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO tasks (user_id, title, date, tag, mental_load, time_str, is_recurring) VALUES (%s, %s, %s, %s, %s, %s, %s);", (obj.user_id, obj.title, obj.date, obj.tag, obj.mental_load, obj.time_str, obj.is_recurring))
    conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

# 🚨 LÓGICA DE TAREFAS RECORRENTES CORRIGIDA
@app.patch("/tasks/{id}/toggle")
def alternar_tarefa(id: int, obj: ModeloToggleTarefa):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT completed_dates FROM tasks WHERE id = %s;", (id,))
    task = cursor.fetchone()
    if task:
        dates = task['completed_dates'].split(',') if task['completed_dates'] else []
        if obj.date in dates: dates.remove(obj.date)
        else: dates.append(obj.date)
        new_dates = ",".join(dates)
        cursor.execute("UPDATE tasks SET completed_dates = %s WHERE id = %s;", (new_dates, id))
        conn.commit()
    cursor.close(); conn.close(); return {"status": "ok"}

@app.post("/mental")
def registrar_humor(obj: ModeloMentalLog):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO mental_logs (user_id, mood, energy_level, anxiety_level, note, date) VALUES (%s, %s, %s, %s, %s, %s);", (obj.user_id, obj.mood, obj.energy_level, obj.anxiety_level, obj.note, obj.date)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}
@app.post("/journal")
def registrar_diario(obj: ModeloJournal):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(); cursor.execute("INSERT INTO journal_logs (user_id, situation, automatic_thought, reframe, gratitude_1, gratitude_2, gratitude_3, date) VALUES (%s, %s, %s, %s, %s, %s, %s, %s);", (obj.user_id, obj.situation, obj.automatic_thought, obj.reframe, obj.gratitude_1, obj.gratitude_2, obj.gratitude_3, obj.date)); conn.commit(); cursor.close(); conn.close(); return {"status": "ok"}

# 🚨 DASHBOARD OTIMIZADO PARA ACEITAR A "MÁQUINA DO TEMPO"
@app.get("/dashboard/unificado")
def dashboard_unificado(user_id: int, date: str, hoje: str, start_week: str, end_week: str):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Finanças (Sempre o Mês da Data selecionada)
    cursor.execute("SELECT * FROM goal_transactions ORDER BY date DESC, id DESC;"); all_gtx = cursor.fetchall()
    cursor.execute("SELECT * FROM financial_goals WHERE user_id = %s ORDER BY id DESC;", (user_id,)); metas_fin = []
    for m in cursor.fetchall():
        m_dict = dict(m); m_dict['target_amount'] = float(m_dict['target_amount']); m_dict['current_amount'] = float(m_dict['current_amount'])
        m_dict['history'] = [{"type": tx["type"], "amount": float(tx["amount"]), "description": tx["description"], "date": tx["date"]} for tx in all_gtx if tx["goal_id"] == m["id"]]
        metas_fin.append(m_dict)
    
    cursor.execute("SELECT * FROM transactions WHERE user_id = %s AND date LIKE %s ORDER BY date DESC, id DESC;", (user_id, date[:7]+'%'))
    transacoes = [{"id": t["id"], "type": t["type"], "amount": float(t["amount"]), "category": t["category"], "description": t["description"], "date": t["date"]} for t in cursor.fetchall()]
    
    cursor.execute("SELECT * FROM recurring_expenses WHERE user_id = %s ORDER BY due_day ASC;", (user_id,))
    recorrentes = [{"id": r["id"], "description": r["description"], "amount": float(r["amount"]), "category": r["category"], "due_day": r["due_day"]} for r in cursor.fetchall()]

    # 2. Saúde e Performance Física
    cursor.execute("SELECT * FROM health_goals WHERE user_id = %s ORDER BY id DESC;", (user_id,))
    metas_saude = [{"id": h["id"], "title": h["title"], "dream": h["dream"], "goal_type": h["goal_type"], "current_amount": float(h["current_amount"]), "target_amount": float(h["target_amount"]), "unit": h["unit"]} for h in cursor.fetchall()]
    
    # Usa a "Data do Calendário Superior"
    cursor.execute("SELECT * FROM food_logs WHERE user_id = %s AND date = %s ORDER BY id DESC;", (user_id, hoje)); comidas = cursor.fetchall()
    
    cursor.execute("SELECT COALESCE(SUM(calories_burned), 0) AS total_cal, COALESCE(SUM(distance_km), 0) AS total_km FROM workout_logs WHERE user_id = %s AND date = %s;", (user_id, hoje))
    treinos_hoje = cursor.fetchone()
    
    cursor.execute("""
        SELECT w.id, w.duration_minutes, w.distance_km, w.calories_burned, w.rpe, e.name as exercise_name
        FROM workout_logs w JOIN exercises e ON w.exercise_id = e.id
        WHERE w.user_id = %s AND w.date = %s ORDER BY w.id DESC;
    """, (user_id, hoje))
    treinos_lista = [{"id": t["id"], "duration_minutes": t["duration_minutes"], "distance_km": float(t["distance_km"]), "calories_burned": float(t["calories_burned"]), "rpe": t["rpe"], "exercise_name": t["exercise_name"]} for t in cursor.fetchall()]

    cursor.execute("SELECT * FROM daily_biometrics WHERE user_id = %s AND date = %s;", (user_id, hoje)); biometria = cursor.fetchone()
    if not biometria: biometria = {"water_ml": 0, "sleep_hours": 0, "sleep_quality": "Sem dados"}
    cursor.execute("SELECT * FROM workout_plans WHERE user_id = %s ORDER BY day_of_week ASC, id ASC;", (user_id,)); workout_plans = cursor.fetchall()

    # 3. Saúde Mental
    cursor.execute("SELECT * FROM mental_logs WHERE user_id = %s ORDER BY date DESC LIMIT 30;", (user_id,)); mental_history = cursor.fetchall()
    cursor.execute("SELECT * FROM journal_logs WHERE user_id = %s ORDER BY date DESC LIMIT 10;", (user_id,)); journals = cursor.fetchall()

    cursor.close(); conn.close()
    
    total_income = sum(t['amount'] for t in transacoes if t['type'] == 'income'); total_expense = sum(t['amount'] for t in transacoes if t['type'] == 'expense')
    prog_financas = 100.0 if total_expense == 0 else max(0.0, 100.0 - ((total_expense / (total_income if total_income > 0 else 3000.0)) * 100.0))

    return {
        "financas": {"saldo": total_income - total_expense, "rendas": total_income, "gastos": total_expense, "metas": metas_fin, "progresso": prog_financas, "transacoes": transacoes, "recorrentes": recorrentes},
        "saude": {"metas": metas_saude, "treinos_hoje": {"calorias": float(treinos_hoje['total_cal']), "kms": float(treinos_hoje['total_km'])}, "treinos_lista": treinos_lista, "comidas": comidas, "biometria": biometria, "workout_plans": workout_plans},
        "mental": {"history": mental_history, "journals": journals},
        "global_pct": prog_financas
    }
