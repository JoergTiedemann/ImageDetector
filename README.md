# Smart Fruit Finder
Anwendung zu Detektierung von Obst und Beeren mit Vorhersage des Reifegrades und des möglichen Ernteertrags
## Funktion
Die Videoverarbeitung (nur MP4 Dateien) wurde bei iphoneSE ausgeblendet. Die Verarbeitung erfolgt in einem separaten video_process_worker und dort wird ein Yolomodell geladen und eine neue Session aufgemacht und dazu sollte webgpu verqendet werden. Das führt auf dem iphoneSE zu Memory Overflow und ist auch sonst von iOS nicht wirklich supportet (webgpu in workern wird offiziell nicht unterstützt)

## Yolo Modelle
Es werden Datensätze von universe.roboflow.com verwendet die nach dem download selbst trainiert werden kömnnen. Dabei werden Yolov8n Modelle erzeugt

### Trainieren
Zu trainieren folgenden Befehl verwenden
``` 
yolo detect train data=c:\Users\joerg\Documents\Git\ImageDetector\home\data.yaml model=yolov8n.pt epochs=50 imgsz=640 batch=8
```
Die Anzahl der Epochen bestimmt die Genauigkeit des Modells epochs=50 ist das absolute Minimum, 100 sind in jedem Fall besser. Die Batchgröße bestimmt wieviel Images bei einer Iteration verwendet werden, 8 hat sich als guter Wert erwiesen, 12 gehen auch noch unterhalb von 8 sollte man nicht gehen.
Die Imagesize sollte bei 640 gelassen werden 
Man kann auch auf google Colab trainieren, da stehen leistungsfähige Rechner zur Verfügiung aber nur eingeschränkte Rechenzeit von ca. 1-2Stunden pro Tag
Ein entsprechend konfiguriertes Colab Notbook befindet sich im Ordner Colab

### Exportieren
nach dem Training wird ein Export in das onnx Format benötigt damit die onnxruntime-web engine das Model laden und verarbeiten kann.  
Hier folgenden Befehl verwenden:
``` 
yolo export model=runs/detect/train/weights/best.pt format=onnx opset=12 simplify=False dynamic=True imgsz=640
```




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
