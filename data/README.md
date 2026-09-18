# data/

Ce dossier documente les **sources** de données utilisées par le projet, pas forcément les jeux de données volumineux eux-mêmes (voir `.gitignore` pour les exclusions).

## Sources

| Thème | Source | Lien | Format |
|---|---|---|---|
| Emploi | Taux de chômage localisé INSEE, via data.gouv.fr | [dataset](https://www.data.gouv.fr/fr/datasets/6a0eb9ef4780a16c39e21b76/) | CSV |
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
- Visualisé dans [`dashboards/dvf_dashboard.py`](../dashboards/dvf_dashboard.py) et
  [`website/index.html`](../website/index.html).

### Emploi (taux de chômage)

Récupéré automatiquement par [`src/extract/build_chomage.py`](../src/extract/build_chomage.py) :

```bash
python -m src.extract.build_chomage
```

- Source : taux de chômage localisé INSEE par département (trimestre en cours, trimestre
  précédent, même trimestre l'année dernière), republié par le Département de Seine-Saint-Denis.
  L'URL de téléchargement est résolue dynamiquement via l'identifiant stable du jeu de données
  data.gouv.fr (le nom du fichier change chaque trimestre).
- Traités (`data/processed/chomage_dept.csv`) : taux par département + variation en points.
- Rafraîchi automatiquement chaque semaine par `.github/workflows/update-data.yml`.
- Visualisé dans [`website/emploi.html`](../website/emploi.html).

## Organisation suggérée

```
data/
├── raw/          # données brutes telles que téléchargées (non versionnées si volumineuses)
├── interim/      # données nettoyées / intermédiaires
└── processed/    # données prêtes pour l'analyse ou le ML
```

Les gros fichiers ne doivent pas être commités directement : privilégier un script dans `src/extract/` qui télécharge les données à la demande, ou Git LFS si le versionnage est nécessaire.
