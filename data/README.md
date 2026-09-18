# data/

Ce dossier documente les **sources** de données utilisées par le projet, pas forcément les jeux de données volumineux eux-mêmes (voir `.gitignore` pour les exclusions).

## Sources

| Thème | Source | Lien | Format |
|---|---|---|---|
| Emploi | data.gouv.fr / Pôle Emploi | à compléter | CSV |
| Immobilier | DVF (Demandes de Valeurs Foncières), via geo-dvf/Etalab | [files.data.gouv.fr/geo-dvf](https://files.data.gouv.fr/geo-dvf/latest/csv/) | CSV (gzip) |
| Accidents | Base des accidents corporels de la circulation | à compléter | CSV |

### Immobilier (DVF)

Récupéré et agrégé automatiquement par [`src/extract/build_dataset.py`](../src/extract/build_dataset.py) :

```bash
python -m src.extract.build_dataset          # télécharge 2021-2024 et régénère data/processed/
```

- Bruts (`data/raw/dvf/*.csv.gz`, non versionnés) : un fichier national par année.
- Traités (`data/processed/`, versionnés) : `dvf_dept_year.csv` (médiane €/m² et nb de
  transactions par département/année/type de bien), `dvf_month.csv` (tendance nationale
  mensuelle), `dvf_meta.json` (date de mise à jour).
- Rafraîchi automatiquement chaque semaine par `.github/workflows/update-data.yml`.
- Visualisé dans [`dashboards/dvf_dashboard.py`](../dashboards/dvf_dashboard.py).

## Organisation suggérée

```
data/
├── raw/          # données brutes telles que téléchargées (non versionnées si volumineuses)
├── interim/      # données nettoyées / intermédiaires
└── processed/    # données prêtes pour l'analyse ou le ML
```

Les gros fichiers ne doivent pas être commités directement : privilégier un script dans `src/extract/` qui télécharge les données à la demande, ou Git LFS si le versionnage est nécessaire.
