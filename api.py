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
        
        # 1. PILAR FINANCEIRO
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                type VARCHAR(20) NOT NULL,
                amount NUMERIC NOT NULL,
                category VARCHAR(100) NOT NULL,
                date VARCHAR(50) NOT NULL
            );
        """)
        
        # 2. PILAR SAÚDE
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS health_profiles (
                id SERIAL PRIMARY KEY,
                current_weight NUMERIC NOT NULL,
                target_weight NUMERIC NOT NULL,
                daily_calorie_goal NUMERIC NOT NULL
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS exercises (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                muscle_group VARCHAR(100) NOT NULL,
                calories_per_minute NUMERIC NOT NULL
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS workout_logs (
                id SERIAL PRIMARY KEY,
                exercise_id INT REFERENCES exercises(id),
                duration_minutes INT NOT NULL,
                calories_burned NUMERIC NOT NULL,
                date VARCHAR(50) NOT NULL
            );
        """)
        
        # 3. PILAR PRODUTIVIDADE
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS tasks (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                is_completed BOOLEAN DEFAULT FALSE,
                date VARCHAR(50) NOT NULL
            );
        """)
        
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS library_content (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                category VARCHAR(100) NOT NULL,
                content_text TEXT NOT NULL
            );
        """)
        
        # Carga Inicial de Exercícios (Se estiver vazia)
        cursor.execute("SELECT COUNT(*) FROM exercises;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO exercises (name, muscle_group, calories_per_minute) VALUES 
                ('Supino Reto', 'Peito', 7.5),
                ('Puxada Alta', 'Costas', 7.0),
                ('Corrida na Esteira', 'Cardio', 11.0),
                ('Bicicleta Ergométrica', 'Cardio', 8.5);
            """)
            
        # Carga Inicial da Biblioteca (Se estiver vazia)
        cursor.execute("SELECT COUNT(*) FROM library_content;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("""
                INSERT INTO library_content (title, category, content_text) VALUES 
                ('Hábitos Atômicos (Resumo)', 'Produtividade', 'Pequenas mudanças de 1% todos os dias geram resultados gigantescos a longo prazo. Foque nos sistemas, não apenas nas metas.'),
                ('Pai Rico, Pai Pobre (Resumo)', 'Finanças', 'A diferença entre ativos e passivos. Ativos põem dinheiro no seu bolso; passivos tiram. Busque a liberdade financeira comprando ativos.');
            """)
            
        # Perfil de saúde inicial padrão se não houver nenhum
        cursor.execute("SELECT COUNT(*) FROM health_profiles;")
        if cursor.fetchone()[0] == 0:
            cursor.execute("INSERT INTO health_profiles (current_weight, target_weight, daily_calorie_goal) VALUES (90.0, 75.0, 2000.0);")
        
        conn.commit()
        cursor.close()
        conn.close()
        print("⚡ Banco de Dados do MVP totalmente estruturado e sincronizado!")
    except Exception as e:
        print(f"❌ Erro ao estruturar banco: {str(e)}")

inicializar_banco()

# --- MODELOS PYDANTIC ---
class ModeloTransacao(BaseModel):
    type: str
    amount: float
    category: str
    date: str

class ModeloPerfilSaude(BaseModel):
    current_weight: float
    target_weight: float
    daily_calorie_goal: float

class ModeloTreino(BaseModel):
    exercise_id: int
    duration_minutes: int
    date: str

class ModeloTarefa(BaseModel):
    title: str
    date: str

# --- ENDPOINTS FINANCEIROS ---
@app.post("/transactions")
def salvar_transacao(obj: ModeloTransacao):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute("INSERT INTO transactions (type, amount, category, date) VALUES (%s, %s, %s, %s);", (obj.type, obj.amount, obj.category, obj.date))
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso"}
    except Exception as e: raise HTTPException(status_code=500, detail=str(e))

# --- ENDPOINTS DE SAÚDE ---
@app.get("/health/profile")
def obter_perfil_saude():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM health_profiles LIMIT 1;")
    perfil = cursor.fetchone()
    cursor.close()
    conn.close()
    return perfil

@app.put("/health/profile")
def atualizar_perfil_saude(obj: ModeloPerfilSaude):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("UPDATE health_profiles SET current_weight = %s, target_weight = %s, daily_calorie_goal = %s WHERE id = 1;", (obj.current_weight, obj.target_weight, obj.daily_calorie_goal))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "atualizado"}

@app.get("/exercises")
def listar_exercicios():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM exercises ORDER BY muscle_group, name;")
    dados = cursor.fetchall()
    cursor.close()
    conn.close()
    return dados

@app.post("/workouts")
def logar_treino(obj: ModeloTreino):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    # Busca gasto calórico por minuto do exercício
    cursor.execute("SELECT calories_per_minute FROM exercises WHERE id = %s;", (obj.exercise_id,))
    cal_por_min = float(cursor.fetchone()[0])
    cal_queimadas = cal_por_min * obj.duration_minutes
    
    cursor.execute("INSERT INTO workout_logs (exercise_id, duration_minutes, calories_burned, date) VALUES (%s, %s, %s, %s);", (obj.exercise_id, obj.duration_minutes, cal_queimadas, obj.date))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "sucesso"}

# --- ENDPOINTS DE PRODUTIVIDADE ---
@app.get("/tasks")
def listar_tarefas(date: str):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM tasks WHERE date = %s ORDER BY id ASC;", (date,))
    dados = cursor.fetchall()
    cursor.close()
    conn.close()
    return dados

@app.post("/tasks")
def criar_tarefa(obj: ModeloTarefa):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("INSERT INTO tasks (title, date) VALUES (%s, %s);", (obj.title, obj.date))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "sucesso"}

@app.patch("/tasks/{id}/toggle")
def alternar_tarefa(id: int):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    cursor.execute("UPDATE tasks SET is_completed = NOT is_completed WHERE id = %s;", (id,))
    conn.commit()
    cursor.close()
    conn.close()
    return {"status": "alterado"}

@app.get("/library")
def obter_biblioteca():
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute("SELECT * FROM library_content;")
    dados = cursor.fetchall()
    cursor.close()
    conn.close()
    return dados

# --- DASHBOARD UNIFICADO (MÉTRICAS DA BARRA GLOBAL) ---
@app.get("/dashboard/unificado")
def obter_dashboard_unificado(date: str):
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Finanças
    cursor.execute("SELECT * FROM transactions;")
    transacoes = cursor.fetchall()
    total_income = sum(t['amount'] for t in transacoes if t['type'] == 'income')
    total_expense = sum(t['amount'] for t in transacoes if t['type'] == 'expense')
    saldo = total_income - total_expense
    limite_mensal = 3000.00
    
    # Saúde
    cursor.execute("SELECT * FROM health_profiles LIMIT 1;")
    perfil = cursor.fetchone()
    cursor.execute("SELECT COALESCE(SUM(calories_burned), 0) FROM workout_logs WHERE date = %s;", (date,))
    cal_queimadas = float(cursor.fetchone()[0])
    
    # Produtividade
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE date = %s;", (date,))
    total_tasks = cursor.fetchone()['count']
    cursor.execute("SELECT COUNT(*) FROM tasks WHERE date = %s AND is_completed = TRUE;", (date,))
    completed_tasks = cursor.fetchone()['count']
    
    cursor.close()
    conn.close()
    
    # Cálculo do Engajamento Global (Barra Unificada)
    progresso_financas = min((total_expense / limite_mensal), 1.0) if total_expense > 0 else 0
    progresso_financas = 1.0 - progresso_financas # Quanto menos gasta, melhor o progresso financeiro
    
    progresso_saude = min((cal_queimadas / 500.0), 1.0) # Meta diária de queimar 500kcal batendo treinos
    progresso_prod = (completed_tasks / total_tasks) if total_tasks > 0 else 0
    
    engajamento_global = ((progresso_financas + progresso_saude + progresso_prod) / 3.0) * 100

    # Mensagem Educador Estático
    if total_expense > limite_mensal: educador = "🚨 Crítico: Limite financeiro estourado!"
    elif completed_tasks == total_tasks and total_tasks > 0: educador = "🏆 Produtividade máxima atingida hoje!"
    elif cal_queimadas > 300: educador = "💪 Excelente ritmo de queima calórica hoje!"
    else: educador = "⚡ Continue executando seus hábitos para evoluir sua barra global!"

    return {
        "saldo": saldo, "gastos": total_expense, "limite": limite_mensal,
        "perfil_saude": perfil, "cal_queimadas": cal_queimadas,
        "total_tarefas": total_tasks, "tarefas_concluidas": completed_tasks,
        "engajamento_global": engajamento_global, "educador": educador
    }
