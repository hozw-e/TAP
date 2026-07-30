"""Flask application entry point for the Anomaly Detection Engine."""

import logging

from flask import Flask
from flask_cors import CORS

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)


def create_app():
    """Create and configure the Flask application.

    Sets up CORS, registers blueprints for routes, and configures
    the application for the anomaly detection engine.
    """
    app = Flask(__name__)
    CORS(app)

    # Register blueprints
    from src.routes.analyze import analyze_bp
    from src.routes.health import health_bp
    from src.routes.config import config_bp

    app.register_blueprint(analyze_bp)
    app.register_blueprint(health_bp)
    app.register_blueprint(config_bp)

    @app.route("/")
    def index():
        return {"service": "anomaly-engine", "status": "running"}

    return app


if __name__ == "__main__":
    import os
    port = int(os.environ.get("PORT", 5000))
    app = create_app()
    app.run(host="0.0.0.0", port=port, debug=False)
