import os
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
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
        
        # TABELAS FINANCEIRAS
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY, type VARCHAR(20), amount NUMERIC, category VARCHAR(100), date VARCHAR(50)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS financial_goals (
                id SERIAL PRIMARY KEY, title VARCHAR(255), target_amount NUMERIC, current_amount NUMERIC DEFAULT 0, deadline VARCHAR(50)
            );
        """)
        
        # TABELAS DE SAÚDE
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS health_profiles (
                id SERIAL PRIMARY KEY, current_weight NUMERIC, target_weight NUMERIC, daily_calorie_goal NUMERIC
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS exercises (
                id SERIAL PRIMARY KEY, name VARCHAR(255), muscle_group VARCHAR(100), calories_per_minute NUMERIC
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workout_logs (
                id SERIAL PRIMARY KEY, exercise_id INT, duration_minutes INT, calories_burned NUMERIC, date VARCHAR(50)
            );
        """)
        
        # TABELAS DE PRODUTIVIDADE
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY, title VARCHAR(255), is_completed BOOLEAN DEFAULT FALSE, date VARCHAR(50)
            );
        """)
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS library_content (
                id SERIAL PRIMARY KEY, title VARCHAR(255), category VARCHAR(100), content_text TEXT
            );
        """)
        
        # Cargas Iniciais Padrão
        cursor.execute("SELECT COUNT(*) FROM exercises;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO exercises (name, muscle_group, calories_per_minute) VALUES ('Musculação', 'Geral', 6.0), ('Corrida', 'Cardio', 11.0), ('Bicicleta', 'Cardio', 8.0);")
            
        cursor.execute("SELECT COUNT(*) FROM library_content;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO library_content (title, category, content_text) VALUES ('Hábitos Atômicos', 'Produtividade', 'Seja 1% melhor todos os dias.'), ('Pai Rico, Pai Pobre', 'Finanças', 'Compre ativos, não passivos.');")
            
        cursor.execute("SELECT COUNT(*) FROM health_profiles;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO health_profiles (current_weight, target_weight, daily_calorie_goal) VALUES (90.0, 75.0, 500.0);")
        
        conn.commit()
        cursor.close()
        conn.close()
    except Exception as e:
        print(f"Erro BD: {str(e)}")

inicializar_banco()

# --- MODELOS ---
class ModeloTransacao(BaseModel): type: str; amount: float; category: str; date: str
class ModeloMetaFin(BaseModel): title: str; target_amount: float; deadline: str
class ModeloAporte(BaseModel): amount: float
class ModeloPerfilSaude(BaseModel): current_weight: float; target_weight: float; daily_calorie_goal: float
class ModeloTreino(BaseModel): exercise_id: int; duration_minutes: int; date: str
class ModeloTarefa(BaseModel): title: str; date: str

# --- ENDPOINTS FINANCEIROS ---
@app.post("/transactions")
def salvar_transacao(obj: ModeloTransacao):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO transactions (type, amount, category, date) VALUES (%s, %s, %s, %s);", (obj.type, obj.amount, obj.category, obj.date))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.post("/financial_goals")
def criar_meta(obj: ModeloMetaFin):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO financial_goals (title, target_amount, deadline) VALUES (%s, %s, %s);", (obj.title, obj.target_amount, obj.deadline))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.put("/financial_goals/{id}/add")
def aportar_meta(id: int, obj: ModeloAporte):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("UPDATE financial_goals SET current_amount = current_amount + %s WHERE id = %s;", (obj.amount, id))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

# --- ENDPOINTS SAÚDE ---
@app.put("/health/profile")
def atualizar_perfil(obj: ModeloPerfilSaude):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("UPDATE health_profiles SET current_weight = %s, target_weight = %s, daily_calorie_goal = %s WHERE id = 1;", (obj.current_weight, obj.target_weight, obj.daily_calorie_goal))
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
    cursor.execute("INSERT INTO workout_logs (exercise_id, duration_minutes, calories_burned, date) VALUES (%s, %s, %s, %s);", (obj.exercise_id, obj.duration_minutes, cal, obj.date))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

# --- ENDPOINTS PRODUTIVIDADE ---
@app.get("/tasks/week")
def listar_tarefas_semana(start: str, end: str):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM tasks WHERE date >= %s AND date <= %s ORDER BY date ASC, id ASC;", (start, end))
    dados = cursor.fetchall(); cursor.close(); conn.close()
    return dados

@app.post("/tasks")
def criar_tarefa(obj: ModeloTarefa):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("INSERT INTO tasks (title, date) VALUES (%s, %s);", (obj.title, obj.date))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.patch("/tasks/{id}/toggle")
def alternar_tarefa(id: int):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor()
    cursor.execute("UPDATE tasks SET is_completed = NOT is_completed WHERE id = %s;", (id,))
    conn.commit(); cursor.close(); conn.close()
    return {"status": "ok"}

@app.get("/library")
def obter_biblioteca():
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM library_content;")
    dados = cursor.fetchall(); cursor.close(); conn.close()
    return dados

# --- ENDPOINT GLOBAL UNIFICADO ---
@app.get("/dashboard/unificado")
def dashboard_unificado(date: str, start_week: str, end_week: str):
    conn = psycopg2.connect(DATABASE_URL); cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Finanças
    cursor.execute("SELECT * FROM transactions WHERE date LIKE %s;", (date[:7]+'%',)) # Puxa do mês
    transacoes = cursor.fetchall()
    total_income = sum(t['amount'] for t in transacoes if t['type'] == 'income')
    total_expense = sum(t['amount'] for t in transacoes if t['type'] == 'expense')
    cursor.execute("SELECT * FROM financial_goals;")
    metas_fin = cursor.fetchall()
    
    # Saúde
    cursor.execute("SELECT * FROM health_profiles LIMIT 1;")
    perfil = cursor.fetchone()
    cursor.execute("SELECT COALESCE(SUM(calories_burned), 0) FROM workout_logs WHERE date = %s;", (date,))
    cal_hoje = float(cursor.fetchone()[0])
    
    # Produtividade (Métricas da Semana)
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE date >= %s AND date <= %s;", (start_week, end_week))
    total_tasks = cursor.fetchone()['count']
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE date >= %s AND date <= %s AND is_completed = TRUE;", (start_week, end_week))
    completed_tasks = cursor.fetchone()['count']
    
    cursor.close(); conn.close()
    
    # Progressos Individuais (0 a 100)
    prog_financas = 100 if total_expense == 0 else max(0, 100 - ((total_expense / (total_income if total_income > 0 else 3000)) * 100))
    prog_saude = min((cal_hoje / float(perfil['daily_calorie_goal'])) * 100, 100) if perfil else 0
    prog_produtividade = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
    
    engajamento_global = (prog_financas + prog_saude + prog_produtividade) / 3.0

    return {
        "financas": {"saldo": total_income - total_expense, "gastos": total_expense, "rendas": total_income, "metas": metas_fin, "progresso": prog_financas},
        "saude": {"perfil": perfil, "calorias_hoje": cal_hoje, "progresso": prog_saude},
        "produtividade": {"total": total_tasks, "concluidas": completed_tasks, "progresso": prog_produtividade},
        "global_pct": engajamento_global
    }
