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
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

DATABASE_URL = os.getenv("DATABASE_URL", "")

def inicializar_banco():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # 1. USUÁRIOS (Simplificado)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY, name VARCHAR(255), nickname VARCHAR(100), login VARCHAR(100) UNIQUE, password VARCHAR(100)
            );
        """)
        
        # 2. TRANSAÇÕES E METAS FINANCEIRAS
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(20), amount NUMERIC, category VARCHAR(100), date VARCHAR(50)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS financial_goals (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255), dream TEXT, target_amount NUMERIC, current_amount NUMERIC DEFAULT 0, months INT
            );
        """)
        
        # 3. METAS DE SAÚDE E TREINOS
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS health_goals (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255), dream TEXT, current_weight NUMERIC, target_weight NUMERIC, months INT, daily_calorie_goal NUMERIC
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS exercises (
                id SERIAL PRIMARY KEY, name VARCHAR(255), muscle_group VARCHAR(100), calories_per_minute NUMERIC
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workout_logs (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                exercise_id INT, duration_minutes INT, calories_burned NUMERIC, date VARCHAR(50)
            );
        """)
        
        # 4. METAS DE PRODUTIVIDADE E TAREFAS
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS productivity_goals (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255), dream TEXT, months INT
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY, user_id INT REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255), is_completed BOOLEAN DEFAULT FALSE, date VARCHAR(50)
            );
        """)
        
        cursor.execute("SELECT COUNT(*) FROM exercises;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO exercises (name, muscle_group, calories_per_minute) VALUES ('Musculação', 'Geral', 6.0), ('Corrida', 'Cardio', 11.0);")
            
        conn.commit(); cursor.close(); conn.close()
    except Exception as e:
        print(f"Erro BD: {str(e)}")

inicializar_banco()

# --- MODELOS ---
class ModeloCadastro(BaseModel): name: str; nickname: str; login: str; password: str
class ModeloLogin(BaseModel): login: str; password: str
class ModeloTransacao(BaseModel): user_id: int; type: str; amount: float; category: str; date: str
class ModeloMetaFin(BaseModel): user_id: int; title: str; dream: str; target_amount: float; months: int
class ModeloAporte(BaseModel): amount: float
class ModeloMetaSaude(BaseModel): user_id: int; title: str; dream: str; current_weight: float; target_weight: float; months: int
class ModeloMetaProd(BaseModel): user_id: int; title: str; dream: str; months: int
class ModeloTreino(BaseModel): user_id: int; exercise_id: int; duration_minutes: int; date: str
class ModeloTarefa(BaseModel): user_id: int; title: str; date: str

# --- AUTENTICAÇÃO ---
@app.post("/auth/signup")
def cadastrar_usuario(obj: ModeloCadastro):
    try:
        conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
        cursor.execute("INSERT INTO users (name, nickname, login, password) VALUES (%s, %s, %s, %s) RETURNING id;", 
                       (obj.name, obj.nickname, obj.login.strip().lower(), obj.password))
        novo_id = cursor.fetchone()[0]
        conn.commit(); cursor.close(); conn.close()
        return {"status": "ok", "user_id": novo_id, "nickname": obj.nickname}
    except Exception as e:
        raise HTTPException(status_code=400, detail="Erro no cadastro.")

@app.post("/auth/login")
def logar_usuario(obj: ModeloLogin):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id, nickname FROM users WHERE login = %s AND password = %s;", (obj.login.strip().lower(), obj.password))
    user = cursor.fetchone()
    cursor.close(); conn.close()
    if user: return user
    raise HTTPException(status_code=401, detail="Credenciais inválidas.")

# --- ENDPOINTS METAS ---
@app.post("/goals/finance")
def criar_meta_fin(obj: ModeloMetaFin):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO financial_goals (user_id, title, dream, target_amount, months) VALUES (%s, %s, %s, %s, %s);", 
                   (obj.user_id, obj.title, obj.dream, obj.target_amount, obj.months))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.put("/goals/finance/{id}/add")
def aportar_meta(id: int, obj: ModeloAporte):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("UPDATE financial_goals SET current_amount = current_amount + %s WHERE id = %s;", (obj.amount, id))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.post("/goals/health")
def criar_meta_saude(obj: ModeloMetaSaude):
    peso_perder = obj.current_weight - obj.target_weight
    dias = obj.months * 30
    daily_goal = (peso_perder * 7700) / dias if peso_perder > 0 and dias > 0 else 400.0
    
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO health_goals (user_id, title, dream, current_weight, target_weight, months, daily_calorie_goal) VALUES (%s, %s, %s, %s, %s, %s, %s);", 
                   (obj.user_id, obj.title, obj.dream, obj.current_weight, obj.target_weight, obj.months, daily_goal))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.post("/goals/productivity")
def criar_meta_prod(obj: ModeloMetaProd):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO productivity_goals (user_id, title, dream, months) VALUES (%s, %s, %s, %s);", 
                   (obj.user_id, obj.title, obj.dream, obj.months))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

# --- TRANSAÇÕES, TREINOS E TAREFAS (Igual versão anterior) ---
@app.post("/transactions")
def salvar_transacao(obj: ModeloTransacao):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO transactions (user_id, type, amount, category, date) VALUES (%s, %s, %s, %s, %s);", (obj.user_id, obj.type, obj.amount, obj.category, obj.date))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.get("/exercises")
def listar_exercicios():
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM exercises;")
    dados = cursor.fetchall(); cursor.close(); conn.close()
    return dados

@app.post("/workouts")
def logar_treino(obj: ModeloTreino):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("SELECT calories_per_minute FROM exercises WHERE id = %s;", (obj.exercise_id,))
    cal = float(cursor.fetchone()[0]) * obj.duration_minutes
    cursor.execute("INSERT INTO workout_logs (user_id, exercise_id, duration_minutes, calories_burned, date) VALUES (%s, %s, %s, %s, %s);", (obj.user_id, obj.exercise_id, obj.duration_minutes, cal, obj.date))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.get("/tasks/week")
def listar_tarefas_semana(user_id: int, start: str, end: str):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM tasks WHERE user_id = %s AND date >= %s AND date <= %s ORDER BY date ASC, id ASC;", (user_id, start, end))
    dados = cursor.fetchall(); cursor.close(); conn.close()
    return dados

@app.post("/tasks")
def criar_tarefa(obj: ModeloTarefa):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO tasks (user_id, title, date) VALUES (%s, %s, %s);", (obj.user_id, obj.title, obj.date))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.patch("/tasks/{id}/toggle")
def alternar_tarefa(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("UPDATE tasks SET is_completed = NOT is_completed WHERE id = %s;", (id,))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

# --- DASHBOARD UNIFICADO COM EDUCADOR BASEADO NO SONHO ---
@app.get("/dashboard/unificado")
def dashboard_unificado(user_id: int, date: str, start_week: str, end_week: str):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Busca Metas Ativas para compor o painel de Sonhos
    cursor.execute("SELECT * FROM financial_goals WHERE user_id = %s ORDER BY id DESC;", (user_id,))
    metas_fin = cursor.fetchall()
    
    cursor.execute("SELECT * FROM health_goals WHERE user_id = %s ORDER BY id DESC LIMIT 1;", (user_id,))
    meta_saude = cursor.fetchone()
    
    cursor.execute("SELECT * FROM productivity_goals WHERE user_id = %s ORDER BY id DESC LIMIT 1;", (user_id,))
    meta_prod = cursor.fetchone()

    # Movimentações Finanças
    cursor.execute("SELECT * FROM transactions WHERE user_id = %s AND date LIKE %s;", (user_id, date[:7]+'%'))
    transacoes = cursor.fetchall()
    total_income = sum(t['amount'] for t in transacoes if t['type'] == 'income')
    total_expense = sum(t['amount'] for t in transacoes if t['type'] == 'expense')
    
    # Calorias Saúde
    cursor.execute("SELECT COALESCE(SUM(calories_burned), 0) FROM workout_logs WHERE user_id = %s AND date = %s;", (user_id, date))
    cal_hoje = float(cursor.fetchone()[0])
    
    # Produtividade
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE user_id = %s AND date >= %s AND date <= %s;", (user_id, start_week, end_week))
    total_tasks = cursor.fetchone()['count']
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE user_id = %s AND date >= %s AND date <= %s AND is_completed = TRUE;", (user_id, start_week, end_week))
    completed_tasks = cursor.fetchone()['count']
    
    cursor.close(); conn.close()
    
    prog_financas = 100 if total_expense == 0 else max(0, 100 - ((total_expense / (total_income if total_income > 0 else 3000)) * 100))
    prog_saude = min((cal_hoje / float(meta_saude['daily_calorie_goal'])) * 100, 100) if meta_saude else 0
    prog_produtividade = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    engajamento_global = (prog_financas + prog_saude + prog_produtividade) / 3.0

    # Lógica do Educador Emocional
    educador_fin = f"Lembre-se do seu sonho: {metas_fin[0]['dream']}. Mantenha o controle!" if metas_fin else "Defina uma meta para acompanhar seus gastos."
    
    return {
        "financas": {"saldo": total_income - total_expense, "gastos": total_expense, "metas": metas_fin, "progresso": prog_financas, "msg_educador": educador_fin},
        "saude": {"meta": meta_saude, "calorias_hoje": cal_hoje, "progresso": prog_saude},
        "produtividade": {"meta": meta_prod, "progresso": prog_produtividade},
        "global_pct": engajamento_global
    }
