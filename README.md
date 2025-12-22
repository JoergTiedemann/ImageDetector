# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh


## React Compiler

The React Compiler is enabled on this template. See [this documentation](https://react.dev/learn/react-compiler) for more information.

Note: This will impact Vite dev & build performances.

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.


# React Projekt erstellen


🚀 Neues Firebase‑Projekt mit einer React‑App erstellen
1. Firebase‑Projekt in der Firebase Console anlegen
1. 	Öffne https://console.firebase.google.com
2. 	„Projekt hinzufügen“
3. 	Namen vergeben → Analytics optional deaktivieren → Projekt erstellen
Damit ist das Backend‑Projekt angelegt.

🧩 2. React‑App erstellen
Ich empfehle Vite, weil es schnell ist und perfekt mit modernen Firebase‑SDKs harmoniert.
```
npm create vite@latest my-app --template react
cd my-app
npm install
``` 

🔥 3. Firebase in der React‑App installieren
```
npm install firebase
```

▶️ 6. React‑App starten
```
npm run dev
```

🌐 Optional: Firebase Hosting einrichten
Falls du die React‑App direkt bei Firebase hosten willst:
```
npm install -g firebase-tools
firebase login
firebase init hosting
firebase deploy
```



firebase.json korrekt einstellen -> Vite macht den build im dist Ordner
Public Ordner aber nicht Löschen !!!

```
{
  "hosting": {
    "public": "dist",
    "ignore": ["firebase.json", "**/.*", "**/node_modules/**"]
  }
}
```

Action sind danach auch schon da aber es braucht noch das Secret

Im Browser die Cloudconsole aufrufen
https://console.cloud.google.com/home/dashboard?project=imagedetector-db6a5



In der Cloud Console:
IAM & Admin → Service Accounts
Klicke auf:
firebase-adminsdk-xxxxx@imagedetector-db6a5.iam.gserviceaccount.com



2. „Schlüssel verwalten“ öffnen
Oben Tabs → Keys oder Schlüssel
Dann:
Add key → Create new key
Format: JSON
→ Datei wird heruntergeladen.
Das ist dein Firebase Service Account Key.

🔥 So trägst du ihn in GitHub ein
- Gehe in dein GitHub‑Repo
- Settings → Secrets and variables → Actions
- New repository secret
Name muss exakt so heißen wie in deiner YAML:
FIREBASE_SERVICE_ACCOUNT_IMAGEDETECTOR_DB6A5


- Öffne die JSON‑Datei
- Kompletten Inhalt kopieren
- In das Secret‑Feld einfügen
- Speichern
