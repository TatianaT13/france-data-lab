# Dashboards

## Observatoire immobilier (DVF)

Dashboard Plotly/Dash interactif sur les prix de l'immobilier en France (2021-2024).

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
python -m src.extract.build_dataset   # première génération des données (≈15-30s)
python dashboards/dvf_dashboard.py    # http://127.0.0.1:8050
```

- Carte choroplèthe du prix médian au m² par département, courbe de tendance nationale,
  top 15 départements, filtres année / type de bien.
- Bouton **Actualiser** : relance l'extraction depuis data.gouv.fr en direct.
- Mise à jour automatique hebdomadaire via `.github/workflows/update-data.yml`.
