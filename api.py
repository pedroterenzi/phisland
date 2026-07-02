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

# Pega a URL do banco das variáveis de ambiente do Render (Segurança)
DATABASE_URL = os.getenv("DATABASE_URL", "sua_url_neon_aqui_para_testes_locais")

def inicializar_banco():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        
        # Tabela de Transações Financeiras do MVP
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS transactions (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(100) DEFAULT 'admin',
                type VARCHAR(20) NOT NULL, -- 'income' ou 'expense'
                amount NUMERIC NOT NULL,
                category VARCHAR(100) NOT NULL,
                description TEXT,
                date VARCHAR(50) NOT NULL
            );
        """)
        
        conn.commit()
        cursor.close()
        conn.close()
        print("⚡ Tabela de Finanças estruturada no Neon!")
    except Exception as e:
        print(f"❌ Erro ao estruturar banco: {str(e)}")

inicializar_banco()

class ModeloTransacao(BaseModel):
    type: str
    amount: float
    category: str
    description: Optional[str] = ""
    date: str

@app.post("/transactions")
def salvar_transacao(obj: ModeloTransacao):
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor()
        cursor.execute(
            "INSERT INTO transactions (type, amount, category, description, date) VALUES (%s, %s, %s, %s, %s) RETURNING id;",
            (obj.type, obj.amount, obj.category, obj.description, obj.date)
        )
        novo_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()
        return {"status": "sucesso", "id": novo_id}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/dashboard")
def obter_dashboard():
    try:
        conn = psycopg2.connect(DATABASE_URL)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("SELECT * FROM transactions;")
        transacoes = cursor.fetchall()
        cursor.close()
        conn.close()

        total_income = sum(t['amount'] for t in transacoes if t['type'] == 'income')
        total_expense = sum(t['amount'] for t in transacoes if t['type'] == 'expense')
        saldo = total_income - total_expense
        limite_mensal = 3000.00 # Limite estático para o MVP

        # Lógica do Educador Financeiro
        mensagem_educador = ""
        if total_expense > limite_mensal:
            mensagem_educador = f"🚨 Alerta: Você ultrapassou seu limite em R$ {total_expense - limite_mensal:.2f}. Segure os gastos!"
        elif total_expense > (limite_mensal * 0.8):
            mensagem_educador = "⚠️ Atenção: Você já atingiu 80% do seu limite mensal de gastos."
        elif total_expense == 0:
            mensagem_educador = "💡 Dica: Registre seu primeiro gasto ou renda para eu começar a analisar suas finanças."
        else:
            mensagem_educador = "✅ Excelente! Seus gastos estão controlados este mês."

        return {
            "saldo": saldo,
            "gastos": total_expense,
            "limite": limite_mensal,
            "educador": mensagem_educador,
            "transacoes": transacoes
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
