# data_saver
Application d'enrégistrement de données

Cette application est conçue pour lire un fichier Excel contenant des informations sur des personnes, normaliser les dates de naissance, et insérer ces données dans une base de données PostgreSQL.

# Fonctionnalités

  Lecture de fichiers Excel : L'application lit un fichier Excel au format .xlsx.

  Normalisation des dates : Les dates de naissance sont normalisées au format YYYY-MM-DD.

  Insertion dans PostgreSQL : Les données sont insérées dans une base de données PostgreSQL.

  Gestion des erreurs : L'application gère les erreurs de format de date, les fichiers manquants, et les conflits de base de données.

# Prérequis

  Système d'exploitation : Linux (serveur ou desktop).

  Mémoire RAM : Minimum 6 Go de RAM. (garanti les performances optimales lors du traitement de fichiers Excel volumineux ou de l'insertion de grandes quantités de données dans la base de données)

  Node.js : Version 18 ou supérieure.

  PostgreSQL : Une base de données PostgreSQL doit être configurée.

  Fichier Excel : Un fichier Excel contenant les données à importer.

# Installation

    # 1. Clonez le dépôt :
      git clone https://github.com/votre-utilisateur/votre-projet.git
      cd votre-projet

    # 2. Installez les dépendances :
      sudo apt install zenity (si c'est linux desktop)
      npm install

    # 3. Configurez les variables d'environnement :
     # Créez un fichier .env à la racine du projet et ajoutez les informations de connexion à PostgreSQL :
       DB_HOST=votre_host
       DB_USER=votre_utilisateur
       DB_PASSWORD=votre_mot_de_passe
       DB_DATABASE=votre_base_de_données
       DB_PORT=5432

# Utilisation :

    # 1. Exécutez l'application :
       node index.js # (petite quantité de données)
       node --max-old-space-size=4096 index.js # (grande quantité de données)
    # 2. Suivez les instructions pour sélectionner le fichier Excel et démarrer l'importation.

# Tests

  1.  Tests unitaires

    # Les tests unitaires vérifient que la fonction normalizeDate fonctionne correctement.

    # Exécutez les tests unitaires :
      npm test

  2.  Tests d'intégration

    # Les tests d'intégration vérifient que l'application fonctionne correctement dans son ensemble.

    # Configurez une base de données de test dans .env.test.

    # Exécutez les tests d'intégration :
      npm run test:integration

# Licence

Ce projet est sous licence MIT.

