import os
import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.connection_string = "postgresql://baiasdb_user:k8QB6ATquB1OY4OQmlyGlczl3gFwuwlf@dpg-d326ejripnbc73cuqelg-a.oregon-postgres.render.com/baiasdb"
        self.init_db()
    
    def get_connection(self):
        """Estabelece conexão com o PostgreSQL"""
        try:
            conn = psycopg2.connect(
                self.connection_string,
                sslmode='require',
                cursor_factory=RealDictCursor
            )
            logger.info("Conectado ao PostgreSQL com sucesso!")
            return conn
        except Exception as e:
            logger.error(f"Erro ao conectar com PostgreSQL: {e}")
            raise
    
    def init_db(self):
        """Inicializa as tabelas no PostgreSQL"""
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Tabela de desinfecções
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS baias_desinfeccao (
                    id SERIAL PRIMARY KEY,
                    numero_baia INTEGER NOT NULL,
                    data_desinfeccao DATE NOT NULL,
                    metodo TEXT NOT NULL,
                    observacao TEXT,
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            # Tabela de agendamentos
            cursor.execute('''
                CREATE TABLE IF NOT EXISTS agendamentos_desinfeccao (
                    id SERIAL PRIMARY KEY,
                    numero_baia INTEGER NOT NULL,
                    data_agendamento DATE NOT NULL,
                    metodo TEXT NOT NULL,
                    observacao TEXT,
                    status TEXT DEFAULT 'pendente',
                    criado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    atualizado_em TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            ''')
            
            conn.commit()
            logger.info("Tabelas verificadas/criadas com sucesso!")
            
        except Exception as e:
            logger.error(f"Erro ao criar tabelas: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def _rows_to_dict_list(self, rows):
        """Converte múltiplas linhas para lista de dicionários"""
        if not rows:
            return []
        return [dict(row) for row in rows]
    
    # Métodos para desinfecções
    def get_all_desinfeccoes(self):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM baias_desinfeccao ORDER BY data_desinfeccao DESC')
            rows = cursor.fetchall()
            
            result = self._rows_to_dict_list(rows)
            return result
            
        except Exception as e:
            logger.error(f"Error getting desinfeccoes: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def insert_desinfeccao(self, numero_baia, data_desinfeccao, metodo, observacao):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO baias_desinfeccao (numero_baia, data_desinfeccao, metodo, observacao)
                VALUES (%s, %s, %s, %s) RETURNING id
            ''', (numero_baia, data_desinfeccao, metodo, observacao))
            
            result = cursor.fetchone()
            last_id = result['id']
            
            conn.commit()
            return last_id
            
        except Exception as e:
            logger.error(f"Error inserting desinfeccao: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def update_desinfeccao(self, id, numero_baia, data_desinfeccao, metodo, observacao):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE baias_desinfeccao 
                SET numero_baia = %s, data_desinfeccao = %s, metodo = %s, observacao = %s, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (numero_baia, data_desinfeccao, metodo, observacao, id))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Error updating desinfeccao: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def delete_desinfeccao(self, id):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM baias_desinfeccao WHERE id = %s', (id,))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Error deleting desinfeccao: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    # Métodos para agendamentos
    def get_all_agendamentos(self):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM agendamentos_desinfeccao ORDER BY data_agendamento ASC')
            rows = cursor.fetchall()
            
            result = self._rows_to_dict_list(rows)
            return result
            
        except Exception as e:
            logger.error(f"Error getting agendamentos: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def insert_agendamento(self, numero_baia, data_agendamento, metodo, observacao):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO agendamentos_desinfeccao (numero_baia, data_agendamento, metodo, observacao)
                VALUES (%s, %s, %s, %s) RETURNING id
            ''', (numero_baia, data_agendamento, metodo, observacao))
            
            result = cursor.fetchone()
            last_id = result['id']
            
            conn.commit()
            return last_id
            
        except Exception as e:
            logger.error(f"Error inserting agendamento: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def update_agendamento_status(self, id, status):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('''
                UPDATE agendamentos_desinfeccao 
                SET status = %s, atualizado_em = CURRENT_TIMESTAMP
                WHERE id = %s
            ''', (status, id))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Error updating agendamento status: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()
    
    def delete_agendamento(self, id):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('DELETE FROM agendamentos_desinfeccao WHERE id = %s', (id,))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Error deleting agendamento: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()