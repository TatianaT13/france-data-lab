# data/

Ce dossier documente les **sources** de données utilisées par le projet, pas forcément les jeux de données volumineux eux-mêmes (voir `.gitignore` pour les exclusions).

## Sources

| Thème | Source | Lien | Format |
|---|---|---|---|
| Emploi | Taux de chômage localisé INSEE, via data.gouv.fr | [dataset](https://www.data.gouv.fr/fr/datasets/6a0eb9ef4780a16c39e21b76/) | CSV |
| Immobilier | DVF (Demandes de Valeurs Foncières), via geo-dvf/Etalab | [files.data.gouv.fr/geo-dvf](https://files.data.gouv.fr/geo-dvf/latest/csv/) | CSV (gzip) |
| Énergie | éCO2mix RTE (consommation, mix de production, échanges) | [opendata.reseaux-energies.fr](https://opendata.reseaux-energies.fr/) | API (OpenDataSoft) |
| Air | LCSQA / Géod'air (concentrations horaires, stations des AASQA) | [dataset](https://www.data.gouv.fr/datasets/5b98b648634f415309d52a50/) | CSV (un fichier par jour) |
| Fuites de données | Notifications de violations de données à la CNIL | [dataset](https://www.data.gouv.fr/datasets/notifications-a-la-cnil-de-violations-de-donnees-a-caractere-personnel/) | CSV |
| Urgences | Passages aux urgences par département (DREES, 2017-2023) | [dataset](https://www.data.gouv.fr/datasets/675b7bbf79cf8f76c2b02f3f/) | CSV |
| Hôpitaux | Indicateurs qualité des soins par établissement (HAS) | [dataset](https://www.data.gouv.fr/datasets/66e936005e9b27856ef160d1/) | XLSX |
| Accidents | Accidents corporels de la circulation routière, 2019-2024 (ONISR/BAAC) | [dataset](https://www.data.gouv.fr/datasets/53698f4ca3a729239d2036df/) | CSV |

### Immobilier (DVF)

Récupéré et agrégé automatiquement par [`src/extract/build_dataset.py`](../src/extract/build_dataset.py) :

```bash
python -m src.extract.build_dataset          # détecte les années publiées (2021 → aujourd'hui) et régénère data/processed/
```

- Bruts (`data/raw/dvf/*.csv.gz`, non versionnés) : un fichier national par année.
- Traités (`data/processed/`, versionnés) : `dvf_dept_year.csv` (médiane €/m² et nb de
  transactions par département/année/type de bien), `dvf_month.csv` (tendance nationale
  mensuelle), `dvf_meta.json` (date de mise à jour).
- Rafraîchi automatiquement chaque semaine par `.github/workflows/update-data.yml`.
- Visualisé dans [`dashboards/dvf_dashboard.py`](../dashboards/dvf_dashboard.py) et
  [`website/immobilier.html`](../website/immobilier.html).

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

### Énergie (éCO2mix RTE)

Récupéré automatiquement par [`src/extract/build_energie.py`](../src/extract/build_energie.py) :

```bash
python -m src.extract.build_energie
```

- Source : API publique RTE (opendata.reseaux-energies.fr, plateforme OpenDataSoft, sans
  authentification) — consommation nationale/régionale, mix de production par filière,
  intensité carbone, échanges commerciaux avec les pays limitrophes.
- ⚠️ Ces données sont mises à jour en quasi temps réel côté RTE, mais le site ne les
  rafraîchit qu'une fois par semaine (comme les autres pages) — la carte et les courbes
  affichent donc un instantané figé au moment du dernier déploiement, pas du "live".
- Visualisé dans [`website/energie.html`](../website/energie.html).

### Air (LCSQA / Géod'air)

Récupéré par [`src/extract/build_air.py`](../src/extract/build_air.py) :

```bash
python -m src.extract.build_air
```

- Source : fichiers CSV quotidiens (~12 Mo, ~450 stations) de concentrations horaires de NO2, PM10, PM2.5 et ozone.
- Historique : un relevé par mois (le 15) depuis 2021, moyenné par station puis par région (le rattachement régional vient du code de zone ZAS). Instantané : dernier jour complet.
- Limites : échantillon mensuel, donc pas une moyenne mensuelle exacte ; les DOM ne sont pas cartographiés.
- Visualisé dans [`website/air.html`](../website/air.html).

### Fuites de données (CNIL)

Récupéré par [`src/extract/build_fuites.py`](../src/extract/build_fuites.py) :

```bash
python -m src.extract.build_fuites
```

- Source : notifications de violations de données à caractère personnel reçues par la CNIL
  depuis mai 2018 (obligation RGPD), ~43 500 lignes. L'URL du CSV est résolue dynamiquement
  via l'identifiant stable du jeu de données data.gouv.fr (republication irrégulière).
- Traités (`data/processed/fuites_*.json`) : tendance mensuelle, répartition par secteur,
  origine et cause de l'incident, ampleur de la fuite, information des personnes concernées.
- Pas de dimension géographique dans la source : aucune carte sur cette page.
- Limites : certains pics mensuels correspondent à un incident unique chez un sous-traitant
  ayant déclenché de nombreuses notifications distinctes (voir la page pour le détail) ;
  aucun nom d'organisme n'est publié par la CNIL.
- Rafraîchi automatiquement chaque semaine par `.github/workflows/update-dvf.yml`.
- Visualisé dans [`website/fuites.html`](../website/fuites.html).

### Urgences (DREES)

Récupéré par [`src/extract/build_urgences.py`](../src/extract/build_urgences.py) :

```bash
python -m src.extract.build_urgences
```

- Source : séries longues corrigées du nombre quotidien de passages aux urgences par
  département, publiées par la DREES (ministère de la Santé), janvier 2017 à décembre 2023.
- ⚠️ Étude ponctuelle figée (publiée en décembre 2024), pas un flux continu : aucune
  nouvelle donnée n'est attendue tant que la DREES ne publie pas de mise à jour. Le site
  vérifie tout de même la source chaque semaine, via une résolution dynamique de l'URL.
- Traités (`data/processed/urgences_*.json`) : tendance hebdomadaire nationale (semaines
  incomplètes écartées), moyenne journalière par département et par année.
- Limites : valeurs corrigées par la DREES (pas un comptage brut) ; les départements de la
  Lozère (48) et de Mayotte ne sont pas diffusés, la Martinique est exclue pour qualité
  insuffisante ; aucune donnée par établissement. Fenêtres d'observation inégales selon les
  départements (Guyane à partir de 2020, La Réunion/Corse-du-Sud/Haute-Corse/Territoire de
  Belfort à partir de 2018 seulement) — le KPI « département le plus actif » est donc calculé
  sur la dernière année commune plutôt que sur une moyenne pluriannuelle, pour ne pas
  favoriser les départements suivis depuis plus longtemps.
- Rafraîchi automatiquement chaque semaine par `.github/workflows/update-dvf.yml`.
- Visualisé dans [`website/urgences.html`](../website/urgences.html).

### Hôpitaux (HAS)

Récupéré par [`src/extract/build_hopitaux.py`](../src/extract/build_hopitaux.py) :

```bash
python -m src.extract.build_hopitaux
```

- Source : indicateurs de qualité et de sécurité des soins (IQSS) de la Haute Autorité de
  Santé — satisfaction des patients (e-Satis, secteur MCO) et hygiène des mains (ICSHA v4),
  conçus par la HAS pour la comparaison publique entre établissements.
- ⚠️ La HAS republie un nouveau « recueil » chaque année sous un **nouvel identifiant**
  data.gouv.fr : `DATASET_ID` dans `src/extract/hopitaux.py` doit être mis à jour à la main
  lorsqu'un nouveau recueil paraît (pas de résolution dynamique possible ici).
- Traités (`data/processed/hopitaux_*.json`) : classement des 20 meilleurs établissements
  e-Satis, moyennes régionales, répartition par classe officielle (A à D), et une liste
  complète des 993 établissements notés e-Satis (avec score ICSHA quand disponible) pour
  le tableau recherchable de la page.
- Nettoyage important : ~180 établissements e-Satis apparaissaient sur plusieurs lignes
  (unités distinctes d'un même hôpital, parfois avec une région incohérente entre lignes) —
  dédupliqués par FINESS. Le score ICSHA peut dépasser 100 % pour de petites structures :
  aucun classement par score brut n'est publié pour cet indicateur, uniquement la classe
  officielle A à C calculée par la HAS.
- Volontairement absent : la mortalité par établissement, que la HAS ne publie pas en
  raison des écarts de gravité des cas entre établissements (voir la page pour le détail).
- Rafraîchi automatiquement chaque semaine par `.github/workflows/update-dvf.yml`.
- Visualisé dans [`website/hopitaux.html`](../website/hopitaux.html).

### Accidents (ONISR)

Récupéré par [`src/extract/build_accidents.py`](../src/extract/build_accidents.py) :

```bash
python -m src.extract.build_accidents
```

- Source : fichier BAAC (Bulletin d'Analyse des Accidents Corporels) de l'ONISR, un
  enregistrement par accident corporel constaté par les forces de l'ordre, avec un fichier
  « caractéristiques » (date, département) et un fichier « usagers » (gravité) par année.
  Les URLs sont résolues dynamiquement via l'identifiant stable du jeu de données
  data.gouv.fr (les noms de fichiers changent et contiennent des coquilles selon les années,
  ex. « carcteristiques-2022.csv »).
- Limité à **2019-2024** : avant 2019, le format change trop (séparateur, année sur 2
  chiffres, département non zéro-paddé) pour être agrégé de façon fiable avec les années
  récentes.
- Traités (`data/processed/accidents_*.json`) : tendance mensuelle nationale (accidents et
  tués), agrégats par département et par année, répartition des usagers par gravité, par
  catégorie de route, par limitation de vitesse, classement des autoroutes/routes
  nationales les plus meurtrières, manœuvres des véhicules impliqués dans un accident
  mortel, localisation GPS de chaque accident mortel, et tracé géographique des routes du
  classement (pour les calques de la carte).
- Le tracé des routes vient du WFS IGN Géoplateforme (`BDTOPO_V3:route_numerotee_ou_nommee`,
  filtré par numéro de route, simplifié à ~150 points par segment) — interrogé à chaque
  exécution du pipeline pour les routes actuellement en tête du classement.
- Limites : nombre brut, pas de taux par habitant ni par volume de trafic ; seuls les
  accidents corporels sont comptabilisés (pas les accidents matériels) ; le classement par
  route ne couvre que les ~91 % d'accidents où le numéro de route a pu être identifié avec
  certitude dans un champ texte libre ; la « manœuvre » du véhicule n'est pas une cause
  légale de l'accident (le BAAC n'attribue aucune responsabilité) ; pas de classement par
  société d'autoroute car la plupart des grands axes sont partagés entre plusieurs
  gestionnaires sur leur longueur (vérifié route par route, voir la page pour le détail).
- Rafraîchi automatiquement chaque semaine par `.github/workflows/update-dvf.yml`.
- Visualisé dans [`website/accidents.html`](../website/accidents.html).

## Organisation suggérée

```
data/
├── raw/          # données brutes telles que téléchargées (non versionnées si volumineuses)
├── interim/      # données nettoyées / intermédiaires
└── processed/    # données prêtes pour l'analyse ou le ML
```

Les gros fichiers ne doivent pas être commités directement : privilégier un script dans `src/extract/` qui télécharge les données à la demande, ou Git LFS si le versionnage est nécessaire.
