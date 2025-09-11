from flask import Flask

def create_app():
    app = Flask(__name__, template_folder='app/templates', static_folder='app/static')
    return app
