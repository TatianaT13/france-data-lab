# data/

Ce dossier documente les **sources** de données utilisées par le projet, pas forcément les jeux de données volumineux eux-mêmes (voir `.gitignore` pour les exclusions).

## Sources

| Thème | Source | Lien | Format |
|---|---|---|---|
| Emploi | data.gouv.fr / Pôle Emploi | à compléter | CSV |
| Immobilier | DVF (Demandes de Valeurs Foncières) | à compléter | CSV |
| Accidents | Base des accidents corporels de la circulation | à compléter | CSV |

## Organisation suggérée

```
data/
├── raw/          # données brutes telles que téléchargées (non versionnées si volumineuses)
├── interim/      # données nettoyées / intermédiaires
└── processed/    # données prêtes pour l'analyse ou le ML
```

Les gros fichiers ne doivent pas être commités directement : privilégier un script dans `src/extract/` qui télécharge les données à la demande, ou Git LFS si le versionnage est nécessaire.
