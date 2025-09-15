from flask import Flask, render_template, jsonify, request, session, redirect, url_for, flash
from flask_cors import CORS
from app.models.database import Database
import os
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__, 
            template_folder='app/templates', 
            static_folder='app/static', 
            static_url_path='/static')

CORS(app)

# Config
app.secret_key = os.getenv("SECRET_KEY", "chave_dev_segura")
db = Database()

# Middleware de autenticação
def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get("logged_in"):
            return redirect(url_for("login"))
        return f(*args, **kwargs)
    return decorated_function


# ROTAS DE AUTENTICAÇÃO
@app.route("/login", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        usuario = request.form.get("usuario")
        senha = request.form.get("senha")
        if usuario == "admin" and senha == "123":
            session["logged_in"] = True
            return redirect(url_for("index"))
        flash("Credenciais inválidas")
    return render_template("login.html")


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("login"))


# ROTAS PRINCIPAIS
@app.route("/")
@login_required
def index():
    return render_template("index.html")


@app.route("/relatorio")
@login_required
def relatorio_view():
    return render_template("relatorio.html")


# API: DESINFECÇÕES
@app.route("/desinfeccoes", methods=["GET"])
@login_required
def listar_desinfeccoes():
    return jsonify(db.get_all_desinfeccoes())


@app.route("/desinfeccoes", methods=["POST"])
@login_required
def criar_desinfeccao():
    dados = request.get_json()
    return jsonify(db.insert_desinfeccao(dados))


@app.route("/desinfeccoes/<int:desinfeccao_id>", methods=["PUT"])
@login_required
def atualizar_desinfeccao(desinfeccao_id):
    dados = request.get_json()
    return jsonify(db.update_desinfeccao(desinfeccao_id, dados))


@app.route("/desinfeccoes/<int:desinfeccao_id>", methods=["DELETE"])
@login_required
def deletar_desinfeccao(desinfeccao_id):
    return jsonify(db.delete_desinfeccao(desinfeccao_id))


# API: AGENDAMENTOS
@app.route("/api/agendamentos", methods=["GET"])
@login_required
def listar_agendamentos():
    return jsonify(db.get_all_agendamentos())


@app.route("/api/agendamentos", methods=["POST"])
@login_required
def criar_agendamento():
    dados = request.get_json()
    return jsonify(db.insert_agendamento(dados))


@app.route("/api/agendamentos/<int:agendamento_id>", methods=["PUT"])
@login_required
def atualizar_agendamento(agendamento_id):
    dados = request.get_json()
    return jsonify(db.update_agendamento(agendamento_id, dados))


@app.route("/api/agendamentos/<int:agendamento_id>", methods=["DELETE"])
@login_required
def deletar_agendamento(agendamento_id):
    return jsonify(db.delete_agendamento(agendamento_id))


@app.route("/api/agendamentos/<int:agendamento_id>/concluir", methods=["PUT"])
@login_required
def concluir_agendamento(agendamento_id):
    return jsonify(db.concluir_agendamento(agendamento_id))


# ✅ NOVA ROTA DE RELATÓRIO
@app.route("/api/relatorio", methods=["GET"])
@login_required
def relatorio_api():
    try:
        desinfeccoes = db.get_all_desinfeccoes()

        # calcular estatísticas
        estatisticas = {
            "total": len(desinfeccoes),
            "ok": sum(1 for d in desinfeccoes if d.get("status") == "ok"),
            "proximo": sum(1 for d in desinfeccoes if d.get("status") == "proximo"),
            "pendente": sum(1 for d in desinfeccoes if d.get("status") == "pendente"),
            "com_erro": sum(1 for d in desinfeccoes if d.get("status") == "erro"),
        }

        return jsonify({
            "estatisticas": estatisticas,
            "desinfeccoes": desinfeccoes
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500


# MAIN
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
