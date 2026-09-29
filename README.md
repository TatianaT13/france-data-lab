# france-data-lab
Open data, interactive dashboards and AI experiments using French public datasets. 🇫🇷

## Dashboards en ligne

Site statique (GitHub Pages, mis à jour chaque jour ou chaque semaine selon la source) : **[tatianat13.github.io/france-data-lab](https://tatianat13.github.io/france-data-lab/)**

| Page | Lien en ligne | Données | Code |
|---|---|---|---|
| Immobilier (DVF) | [Observatoire immobilier](https://tatianat13.github.io/france-data-lab/immobilier.html) | [`data/README.md#immobilier-dvf`](data/README.md#immobilier-dvf) | [`website/immobilier.html`](website/immobilier.html) · [`src/extract/build_dataset.py`](src/extract/build_dataset.py) |
| Emploi (chômage) | [Observatoire de l'emploi](https://tatianat13.github.io/france-data-lab/emploi.html) | [`data/README.md#emploi-taux-de-chômage`](data/README.md#emploi-taux-de-chômage) | [`website/emploi.html`](website/emploi.html) · [`src/extract/build_chomage.py`](src/extract/build_chomage.py) |
| Énergie (RTE éCO2mix) | [Observatoire de l'énergie](https://tatianat13.github.io/france-data-lab/energie.html) | [`data/README.md#énergie-éco2mix-rte`](data/README.md#énergie-éco2mix-rte) | [`website/energie.html`](website/energie.html) · [`src/extract/build_energie.py`](src/extract/build_energie.py) |
| Air (LCSQA / Géod'air) | [Observatoire de la qualité de l'air](https://tatianat13.github.io/france-data-lab/air.html) | [`data/README.md#air-lcsqa--géodair`](data/README.md#air-lcsqa--géodair) | [`website/air.html`](website/air.html) · [`src/extract/build_air.py`](src/extract/build_air.py) |
| Fuites de données (CNIL) | [Observatoire des fuites de données](https://tatianat13.github.io/france-data-lab/fuites.html) | [`data/README.md#fuites-de-données-cnil`](data/README.md#fuites-de-données-cnil) | [`website/fuites.html`](website/fuites.html) · [`src/extract/build_fuites.py`](src/extract/build_fuites.py) |
| Urgences (DREES) | [Observatoire des urgences](https://tatianat13.github.io/france-data-lab/urgences.html) | [`data/README.md#urgences-drees`](data/README.md#urgences-drees) | [`website/urgences.html`](website/urgences.html) · [`src/extract/build_urgences.py`](src/extract/build_urgences.py) |

Dashboard local avec actualisation en direct (Python/Dash) : voir [`dashboards/README.md`](dashboards/README.md).
