# france-data-lab
Open data, interactive dashboards and AI experiments using French public datasets. 🇫🇷

## Dashboards en ligne

Site statique (GitHub Pages, mis à jour chaque semaine) : **[tatianat13.github.io/france-data-lab](https://tatianat13.github.io/france-data-lab/)**

| Page | Lien en ligne | Données | Code |
|---|---|---|---|
| 🏠 Immobilier (DVF) | [Observatoire immobilier](https://tatianat13.github.io/france-data-lab/index.html) | [`data/README.md#immobilier-dvf`](data/README.md#immobilier-dvf) | [`website/index.html`](website/index.html) · [`src/extract/build_dataset.py`](src/extract/build_dataset.py) |
| 💼 Emploi (chômage) | [Observatoire de l'emploi](https://tatianat13.github.io/france-data-lab/emploi.html) | [`data/README.md#emploi-taux-de-chômage`](data/README.md#emploi-taux-de-chômage) | [`website/emploi.html`](website/emploi.html) · [`src/extract/build_chomage.py`](src/extract/build_chomage.py) |
| ⚡ Énergie (RTE éCO2mix) | [Observatoire de l'énergie](https://tatianat13.github.io/france-data-lab/energie.html) | [`data/README.md#énergie-éco2mix-rte`](data/README.md#énergie-éco2mix-rte) | [`website/energie.html`](website/energie.html) · [`src/extract/build_energie.py`](src/extract/build_energie.py) |

Dashboard local avec actualisation en direct (Python/Dash) : voir [`dashboards/README.md`](dashboards/README.md).
