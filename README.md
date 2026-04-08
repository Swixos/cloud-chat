# Cloud Chat - Messagerie Instantanee

Systeme de chat en temps reel utilisant **Google Pub/Sub** comme mecanisme de messagerie et une fonction serverless sur **Google Cloud Platform (GCP)** pour le routage des messages, avec **Rocket.Chat** comme backend de messagerie.

## Architecture

### Composants cles

1. **Google Pub/Sub** :
   - `topic_service` : Reception des messages de tous les utilisateurs
   - `{nom_utilisateur}` : Un topic individuel par utilisateur pour recevoir ses messages
   - `common` : Un topic global pour les messages lies aux connexions/deconnexions

2. **Cloud Function (GCP)** :
   - Role : Abonnee (subscriber) du topic `topic_service`, elle analyse chaque message et le publie sur le bon topic de destination

3. **Clients Web** :
   - Chaque utilisateur publie ses messages sur `topic_service` et s'abonne a son propre topic `{nom_utilisateur}`
   - Il ecoute egalement `common` pour recevoir les evenements globaux (connexion/deconnexion)

### Flux de donnees

```
App GUI (UserX) --[Emission]--> Topic Service --[Lecture]--> Function Routage
                                                                    |
                                                    [En fonction de la target]
                                                          |         |        |
                                                    Topic UserX  Topic UserY  Topic Common
                                                          |         |        |
App GUI (UserX) <--[Lecture]---+           +---[Lecture]-->App GUI (UserY)
                               |           |
                          Topic Common (connexions/deconnexions)
```

### Format des messages

Les messages sont transmis en JSON avec la structure suivante :

```json
{
  "CATEGORY": "CNX",
  "TARGET": "COMMON",
  "SOURCE": "TOTO",
  "TIMESTAMP": "ISO8601",
  "PAYLOAD": "BLABLA"
}
```

- **CATEGORY** : Type du message
  - `OPEN` : Connexion
  - `CLOSE` : Deconnexion
  - `EMISSION` : Message utilisateur
  - `ROUTAGE` : Message route par la fonction serverless
- **TARGET** : Nom du topic de destination (`COMMON` pour les messages globaux, `{nom_utilisateur}` pour les messages individuels)
- **SOURCE** : Identifiant de l'expediteur
- **TIMESTAMP** : Date ISO8601 du message
- **PAYLOAD** : Contenu du message

## Technologies utilisees

| Composant | Technologie | Version |
|-----------|-------------|---------|
| Frontend | Angular | 21.x |
| Backend | NestJS | 11.x |
| Messagerie | Rocket.Chat | latest |
| Base de donnees | MongoDB | 6.x |
| WebSocket | Socket.IO | 4.x |
| Conteneurisation | Docker Compose | 3.8 |

## Structure du projet

```
cloud-chat/
├── backend/                    # API NestJS
│   ├── src/
│   │   ├── auth/               # Module d'authentification
│   │   │   ├── auth.module.ts
│   │   │   ├── auth.controller.ts
│   │   │   ├── auth.service.ts
│   │   │   └── auth.dto.ts
│   │   ├── chat/               # Module de chat (WebSocket + REST)
│   │   │   ├── chat.module.ts
│   │   │   ├── chat.gateway.ts # Gateway WebSocket Socket.IO
│   │   │   └── chat.controller.ts
│   │   ├── rocketchat/         # Integration Rocket.Chat
│   │   │   ├── rocketchat.module.ts
│   │   │   └── rocketchat.service.ts
│   │   ├── app.module.ts
│   │   └── main.ts
│   └── .env                    # Configuration
├── frontend/                   # Application Angular
│   ├── src/
│   │   ├── app/
│   │   │   ├── guards/         # Auth guard
│   │   │   ├── models/         # Interfaces TypeScript
│   │   │   ├── pages/
│   │   │   │   ├── login/      # Page de connexion/inscription
│   │   │   │   └── chat/       # Page de chat principale
│   │   │   ├── services/       # Services Angular
│   │   │   │   ├── auth.service.ts
│   │   │   │   ├── chat.service.ts
│   │   │   │   └── socket.service.ts
│   │   │   ├── app.config.ts
│   │   │   ├── app.routes.ts
│   │   │   └── app.ts
│   │   └── styles.scss
├── docker-compose.yml          # Rocket.Chat + MongoDB
└── README.md
```

## Etapes d'implementation

### 1. Lancer l'infrastructure (Rocket.Chat + MongoDB)

```bash
docker-compose up -d
```

Attendre que Rocket.Chat soit pret sur `http://localhost:3100`.

### 2. Lancer le backend NestJS

```bash
cd backend
cp .env.example .env  # Configurer si necessaire
npm install
npm run start:dev
```

Le backend demarre sur `http://localhost:3000`.

### 3. Lancer le frontend Angular

```bash
cd frontend
npm install
npx ng serve
```

Le frontend demarre sur `http://localhost:4200`.

## Comment tester l'application

### Test de connexion
1. Ouvrir `http://localhost:4200` dans le navigateur
2. Creer un compte via le formulaire d'inscription (les credentials sont crees dans Rocket.Chat)
3. Se connecter avec les identifiants crees

### Test de messagerie en temps reel
1. Ouvrir deux navigateurs (ou un normal + un incognito)
2. Se connecter avec deux comptes differents
3. Selectionner un channel commun
4. Envoyer des messages depuis les deux sessions
5. Verifier que les messages apparaissent en temps reel des deux cotes

### Test des evenements de connexion/deconnexion
1. Se connecter avec un utilisateur
2. Observer le message "X s'est connecte" dans le channel
3. Deconnecter l'utilisateur
4. Observer le message "X s'est deconnecte"

### Test de la creation de channels
1. Cliquer sur le bouton "+" dans la sidebar
2. Entrer un nom de channel
3. Verifier que le channel apparait dans la liste

## Exemple de rendu

### Page de connexion
- Formulaire avec champs username/password
- Bouton pour basculer vers l'inscription
- Integration directe avec Rocket.Chat pour l'authentification

### Page de chat
- **Sidebar gauche** : liste des channels, utilisateurs en ligne, bouton de creation de channel
- **Zone centrale** : historique des messages (depuis Rocket.Chat) + messages temps reel (WebSocket)
- **Zone de saisie** : textarea avec envoi sur Enter, indicateur de frappe
- **Messages systeme** : notifications de connexion/deconnexion au format CDC

### WebSocket
- Connexion automatique apres login
- Routage des messages selon le format du CDC (CATEGORY, TARGET, SOURCE, TIMESTAMP, PAYLOAD)
- Diffusion sur le topic `common` pour les evenements de connexion/deconnexion
- Routage vers les topics individuels pour les messages prives
