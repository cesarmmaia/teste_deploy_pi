import sqlite3
import os
from datetime import datetime
import psycopg2
from urllib.parse import urlparse
import logging

# Configurar logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class Database:
    def __init__(self):
        self.db_url = os.environ.get('DATABASE_URL')
        logger.info(f"Database URL: {self.db_url}")
        self.init_db()
    
    def get_connection(self):
        try:
            if self.db_url and self.db_url.startswith('postgres://'):
                # Converter URL do PostgreSQL para formato aceito pelo psycopg2
                if self.db_url.startswith('postgres://'):
                    self.db_url = self.db_url.replace('postgres://', 'postgresql://')
                
                parsed_url = urlparse(self.db_url)
                dbname = parsed_url.path[1:]
                user = parsed_url.username
                password = parsed_url.password
                host = parsed_url.hostname
                port = parsed_url.port
                
                logger.info(f"Connecting to PostgreSQL: {host}:{port}/{dbname}")
                return psycopg2.connect(
                    dbname=dbname,
                    user=user,
                    password=password,
                    host=host,
                    port=port,
                    sslmode='require' if host != 'localhost' else 'disable'
                )
            else:
                # SQLite para desenvolvimento local
                db_path = os.path.join(os.path.dirname(__file__), '..', '..', 'database.db')
                logger.info(f"Connecting to SQLite: {db_path}")
                return sqlite3.connect(db_path)
                
        except Exception as e:
            logger.error(f"Error connecting to database: {e}")
            raise
    
    def init_db(self):
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            # Tabela de desinfecções
            if self.db_url and 'postgresql' in self.db_url:
                # PostgreSQL
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
            else:
                # SQLite
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS baias_desinfeccao (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        numero_baia INTEGER NOT NULL,
                        data_desinfeccao DATE NOT NULL,
                        metodo TEXT NOT NULL,
                        observacao TEXT,
                        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                cursor.execute('''
                    CREATE TABLE IF NOT EXISTS agendamentos_desinfeccao (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        numero_baia INTEGER NOT NULL,
                        data_agendamento DATE NOT NULL,
                        metodo TEXT NOT NULL,
                        observacao TEXT,
                        status TEXT DEFAULT 'pendente',
                        criado_em DATETIME DEFAULT CURRENT_TIMESTAMP,
                        atualizado_em DATETIME DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
            
            conn.commit()
            logger.info("Database tables created successfully")
            
        except Exception as e:
            logger.error(f"Error initializing database: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def _row_to_dict(self, cursor, row):
        """Converte uma linha do banco para dicionário"""
        if row is None:
            return None
        
        if hasattr(cursor, 'description'):
            # PostgreSQL
            columns = [desc[0] for desc in cursor.description]
            return dict(zip(columns, row))
        else:
            # SQLite
            return dict(row)
    
    def _rows_to_dict_list(self, cursor, rows):
        """Converte múltiplas linhas para lista de dicionários"""
        if not rows:
            return []
        
        if hasattr(cursor, 'description'):
            # PostgreSQL
            columns = [desc[0] for desc in cursor.description]
            return [dict(zip(columns, row)) for row in rows]
        else:
            # SQLite
            return [dict(row) for row in rows]
    
    # Métodos para desinfecções
    def get_all_desinfeccoes(self):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            cursor.execute('SELECT * FROM baias_desinfeccao ORDER BY data_desinfeccao DESC')
            rows = cursor.fetchall()
            
            result = self._rows_to_dict_list(cursor, rows)
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
            
            if self.db_url and 'postgresql' in self.db_url:
                cursor.execute('''
                    INSERT INTO baias_desinfeccao (numero_baia, data_desinfeccao, metodo, observacao)
                    VALUES (%s, %s, %s, %s) RETURNING id
                ''', (numero_baia, data_desinfeccao, metodo, observacao))
                last_id = cursor.fetchone()[0]
            else:
                cursor.execute('''
                    INSERT INTO baias_desinfeccao (numero_baia, data_desinfeccao, metodo, observacao)
                    VALUES (?, ?, ?, ?)
                ''', (numero_baia, data_desinfeccao, metodo, observacao))
                last_id = cursor.lastrowid
            
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
            
            if self.db_url and 'postgresql' in self.db_url:
                cursor.execute('''
                    UPDATE baias_desinfeccao 
                    SET numero_baia = %s, data_desinfeccao = %s, metodo = %s, observacao = %s, atualizado_em = CURRENT_TIMESTAMP
                    WHERE id = %s
                ''', (numero_baia, data_desinfeccao, metodo, observacao, id))
            else:
                cursor.execute('''
                    UPDATE baias_desinfeccao 
                    SET numero_baia = ?, data_desinfeccao = ?, metodo = ?, observacao = ?, atualizado_em = CURRENT_TIMESTAMP
                    WHERE id = ?
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
            
            if self.db_url and 'postgresql' in self.db_url:
                cursor.execute('DELETE FROM baias_desinfeccao WHERE id = %s', (id,))
            else:
                cursor.execute('DELETE FROM baias_desinfeccao WHERE id = ?', (id,))
            
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
            
            result = self._rows_to_dict_list(cursor, rows)
            return result
            
        except Exception as e:
            logger.error(f"Error getting agendamentos: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def get_agendamento_by_id(self, id):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            if self.db_url and 'postgresql' in self.db_url:
                cursor.execute('SELECT * FROM agendamentos_desinfeccao WHERE id = %s', (id,))
            else:
                cursor.execute('SELECT * FROM agendamentos_desinfeccao WHERE id = ?', (id,))
            
            row = cursor.fetchone()
            return self._row_to_dict(cursor, row)
            
        except Exception as e:
            logger.error(f"Error getting agendamento by id: {e}")
            raise
        finally:
            if conn:
                conn.close()
    
    def insert_agendamento(self, numero_baia, data_agendamento, metodo, observacao):
        conn = None
        try:
            conn = self.get_connection()
            cursor = conn.cursor()
            
            if self.db_url and 'postgresql' in self.db_url:
                cursor.execute('''
                    INSERT INTO agendamentos_desinfeccao (numero_baia, data_agendamento, metodo, observacao)
                    VALUES (%s, %s, %s, %s) RETURNING id
                ''', (numero_baia, data_agendamento, metodo, observacao))
                last_id = cursor.fetchone()[0]
            else:
                cursor.execute('''
                    INSERT INTO agendamentos_desinfeccao (numero_baia, data_agendamento, metodo, observacao)
                    VALUES (?, ?, ?, ?)
                ''', (numero_baia, data_agendamento, metodo, observacao))
                last_id = cursor.lastrowid
            
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
            
            if self.db_url and 'postgresql' in self.db_url:
                cursor.execute('''
                    UPDATE agendamentos_desinfeccao 
                    SET status = %s, atualizado_em = CURRENT_TIMESTAMP
                    WHERE id = %s
                ''', (status, id))
            else:
                cursor.execute('''
                    UPDATE agendamentos_desinfeccao 
                    SET status = ?, atualizado_em = CURRENT_TIMESTAMP
                    WHERE id = ?
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
            
            if self.db_url and 'postgresql' in self.db_url:
                cursor.execute('DELETE FROM agendamentos_desinfeccao WHERE id = %s', (id,))
            else:
                cursor.execute('DELETE FROM agendamentos_desinfeccao WHERE id = ?', (id,))
            
            conn.commit()
            
        except Exception as e:
            logger.error(f"Error deleting agendamento: {e}")
            if conn:
                conn.rollback()
            raise
        finally:
            if conn:
                conn.close()