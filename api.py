import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional, List
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
        
        # 1. TABELA DE USUÁRIOS (Nova)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                nickname VARCHAR(100) NOT NULL,
                login VARCHAR(100) UNIQUE NOT NULL,
                password VARCHAR(100) NOT NULL,
                current_weight NUMERIC NOT NULL,
                height NUMERIC NOT NULL,
                target_weight NUMERIC NOT NULL,
                target_months INT NOT NULL,
                daily_calorie_goal NUMERIC NOT NULL
            );
        """)
        
        # 2. SEPARAÇÃO DE DADOS POR USER_ID (Ajustadas com FK)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                type VARCHAR(20), amount NUMERIC, category VARCHAR(100), date VARCHAR(50)
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS financial_goals (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255), target_amount NUMERIC, current_amount NUMERIC DEFAULT 0, deadline VARCHAR(50)
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workout_logs (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                exercise_id INT, duration_minutes INT, calories_burned NUMERIC, date VARCHAR(50)
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                user_id INT REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255), is_completed BOOLEAN DEFAULT FALSE, date VARCHAR(50)
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS exercises (
                id SERIAL PRIMARY KEY, name VARCHAR(255), muscle_group VARCHAR(100), calories_per_minute NUMERIC
            );
        """)
        
        cursor.execute("SELECT COUNT(*) FROM exercises;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO exercises (name, muscle_group, calories_per_minute) VALUES ('Musculação', 'Geral', 6.0), ('Corrida', 'Cardio', 11.0), ('Bicicleta', 'Cardio', 8.0);")
            
        conn.commit()
        cursor.close()
        conn.close()
        print("⚡ Banco de Dados Multi-usuário Sincronizado com Sucesso!")
    except Exception as e:
        print(f"Erro Infra Banco: {str(e)}")

inicializar_banco()

# --- MODELOS PYDANTIC ---
class ModeloCadastro(BaseModel):
    name: str; nickname: str; login: str; password: str
    current_weight: float; height: float; target_weight: float; target_months: int

class ModeloLogin(BaseModel):
    login: str; password: str

class ModeloTransacao(BaseModel): user_id: int; type: str; amount: float; category: str; date: str
class ModeloMetaFin(BaseModel): user_id: int; title: str; target_amount: float; deadline: str
class ModeloAporte(BaseModel): amount: float
class ModeloTreino(BaseModel): user_id: int; exercise_id: int; duration_minutes: int; date: str
class ModeloTarefa(BaseModel): user_id: int; title: str; date: str

# --- SESSÃO AUTENTICAÇÃO ---
@app.post("/auth/signup")
def cadastrar_usuario(obj: ModeloCadastro):
    try:
        # LÓGICA MATEMÁTICA AUTOMATIZADA DE CALORIAS (MVP)
        # 1kg de gordura = ~7700 kcal. Dias totais = meses * 30
        peso_para_perder = obj.current_weight - obj.target_weight
        dias_totais = obj.target_months * 30
        
        if peso_para_perder <= 0 or dias_totais <= 0:
            daily_goal = 400.0 # Meta padrão mínima se já estiver no peso alvo
        else:
            daily_goal = (peso_para_perder * 7700) / dias_totais

        conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO users (name, nickname, login, password, current_weight, height, target_weight, target_months, daily_calorie_goal)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s) RETURNING id;
        """, (obj.name, obj.nickname, obj.login.strip().lower(), obj.password, obj.current_weight, obj.height, obj.target_weight, obj.target_months, daily_goal))
        
        novo_id = cursor.fetchone()[0]
        conn.commit(); cursor.close(); conn.close()
        return {"status": "ok", "user_id": novo_id, "nickname": obj.nickname}
    except Exception as e:
        if "unique" in str(e).lower(): raise HTTPException(status_code=400, detail="Este login já existe.")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/auth/login")
def logar_usuario(obj: ModeloLogin):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT id, name, nickname, login FROM users WHERE login = %s AND password = %s;", (obj.login.strip().lower(), obj.password))
    user = cursor.fetchone()
    cursor.close(); conn.close()
    if user: return user
    raise HTTPException(status_code=401, detail="Usuário ou senha incorretos.")

# --- ENDPOINTS COM FILTRO DE USER_ID ---
@app.post("/transactions")
def salvar_transacao(obj: ModeloTransacao):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO transactions (user_id, type, amount, category, date) VALUES (%s, %s, %s, %s, %s);", (obj.user_id, obj.type, obj.amount, obj.category, obj.date))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.post("/financial_goals")
def criar_meta(obj: ModeloMetaFin):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO financial_goals (user_id, title, target_amount, deadline) VALUES (%s, %s, %s, %s);", (obj.user_id, obj.title, obj.target_amount, obj.deadline))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.put("/financial_goals/{id}/add")
def aportar_meta(id: int, obj: ModeloAporte):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("UPDATE financial_goals SET current_amount = current_amount + %s WHERE id = %s;", (obj.amount, id))
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

# --- PROCESSADOR CENTRAL FILTRADO POR USUÁRIO ---
@app.get("/dashboard/unificado")
def dashboard_unificado(user_id: int, date: str, start_week: str, end_week: str):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Busca dados básicos e configurações do usuário alvo
    cursor.execute("SELECT * FROM users WHERE id = %s;", (user_id,))
    perfil = cursor.fetchone()
    if not perfil: raise HTTPException(status_code=404, detail="User not found")

    cursor.execute("SELECT * FROM transactions WHERE user_id = %s AND date LIKE %s;", (user_id, date[:7]+'%'))
    transacoes = cursor.fetchall()
    total_income = sum(t['amount'] for t in transacoes if t['type'] == 'income')
    total_expense = sum(t['amount'] for t in transacoes if t['type'] == 'expense')
    
    cursor.execute("SELECT * FROM financial_goals WHERE user_id = %s;", (user_id,))
    metas_fin = cursor.fetchall()
    
    cursor.execute("SELECT COALESCE(SUM(calories_burned), 0) FROM workout_logs WHERE user_id = %s AND date = %s;", (user_id, date))
    cal_hoje = float(cursor.fetchone()[0])
    
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE user_id = %s AND date >= %s AND date <= %s;", (user_id, start_week, end_week))
    total_tasks = cursor.fetchone()['count']
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE user_id = %s AND date >= %s AND date <= %s AND is_completed = TRUE;", (user_id, start_week, end_week))
    completed_tasks = cursor.fetchone()['count']
    
    cursor.close(); conn.close()
    
    # Cálculos reativos customizados para ESSE usuário
    prog_financas = 100 if total_expense == 0 else max(0, 100 - ((total_expense / (total_income if total_income > 0 else 3000)) * 100))
    prog_saude = min((cal_hoje / float(perfil['daily_calorie_goal'])) * 100, 100)
    prog_produtividade = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    engajamento_global = (prog_financas + prog_saude + prog_produtividade) / 3.0

    return {
        "nickname": perfil['nickname'],
        "financas": {"saldo": total_income - total_expense, "gastos": total_expense, "metas": metas_fin, "progresso": prog_financas},
        "saude": {"perfil": perfil, "calorias_hoje": cal_hoje, "progresso": prog_saude},
        "produtividade": {"progresso": prog_produtividade},
        "global_pct": engajamento_global
    }
