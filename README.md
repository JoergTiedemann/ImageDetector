

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
### Anmerkungen
Man kann das Training unterbrechen mit Ctrl-C
- Ctrl + C ist völlig sicher.
- man verliert keine Epochen.
- best.pt und last.pt werden immer gespeichert.
- man kann jederzeit exportieren.
- man kann jederzeit weitertrainieren.

Wenn man z. B. nach 30 Epochen abbricht:
- best.pt = bestes Modell aus Epoche 1–30
- last.pt = Modell aus Epoche 30
Beide sind voll exportierbar.

Man kann weitertrainieren mit
```
yolo train model=runs/detect/train/weights/last.pt data=data.yaml epochs=50
```

### Ultratiny Modell erzeugen
man brauch die yolov8n_ultra_tiny.yaml Datei  
und man braucht eine Installationsumgebung
``` 
python -m venv venv
``` 
dann
```
venv\Scripts\activate
``` 
dann 
``` 
python -m pip install --upgrade pip
``` 
dann
``` 
pip install --upgrade "pip<24" "setuptools<70" wheel
``` 
dann ultralytics 8.0.73
``` 
pip install ultralytics==8.0.73
``` 
dann das Training im Ordner oberhalb des datasets Ordner
``` 
yolo train model=./fastestiny.yaml data=./datasets/data.yaml imgsz=320 epochs=50 batch=8 save=True

``` 
Die yaml muss im Ordner
c:\Temp\Training\9k_100Epoch\venv\Lib\site-packages\ultralytics\models\v8\ liegen

Dann Gewichte extraieren -> wird nicjht mehr gebraucht
extract_weights.py erzeugen mit diesem Inhalt
ACHTUNG den Pfad richtig setzen
``` 

import torch
from ultralytics import YOLO

# Modell laden
model = YOLO('runs/detect/train3/weights/best.pt')

# Nur die Gewichte extrahieren
torch.save(model.model.state_dict(), 'best_weights.pt')
print("✅ best_weights.pt erfolgreich gespeichert.")
``` 
Dann aufrufen -> wird nicht mehr gebraucht

python extract_weights.py     
``` 

Dann der Export nach onnx
```
python -c "from ultralytics import YOLO; m=YOLO('best.pt'); m.export(format='onnx', imgsz=320, opset=12, dynamic=False, simplify=True)"


```

Zum Test kann man dann auch noch aufrufen 
``` 

python test_onnx.py     
``` 


### Exportieren
nach dem Training wird ein Export in das onnx Format benötigt damit die onnxruntime-web engine das Model laden und verarbeiten kann.  
Hier folgenden Befehl verwenden:
``` 
yolo export model=runs/detect/train/weights/best.pt format=onnx opset=12 simplify=False dynamic=True imgsz=640
```
Wenn dort eine andere Imagesize angegeben wird kann man das Modell verschlanken so das es weniger Speicher verbraucht

# Grundprinzip der Erkennung und Vermeidung von Doppelzählungen bei dauerhaftem Kamerabild
Man braucht kein Tracking, sondern globale Wiedererkennung.  
Jede Beere wird zu einem Cluster, der über die Zeit wächst.
Neue Beobachtungen werden gegen diese Cluster gemachted.  
Jede Beere wird in einem globalen Archiv berryReIdManager.archive gespeichert
Für jede erkannte Beere wird berechnet:
- Embedding (aus einem Extra Modell) Hier wird aber ein Durchschnittsembedding der letzten 20 Erkennungen zum Vergleich herangezogen
- Farb‑Histogramm (HSV, 32–64 bins)
- Größe (bbox area oder sqrt(area))

Dann wird ein Score gebildet:

Cosine Similarity für die Ähnlichkeit der Embeddings
Farbähnlichkeit  
Größenähnlichkeit  
Daraus ergibt sich dann ein Gesamtscore    
![Screenshot](Screen.jpg)

## Entscheidungslogik
Entscheidungslogik wie folgt 
1. Kandidaten filtern
Nur Beeren, die eine bestimmte grösse haben, die nicht mit anderen boxen überlappen und die in den letzten 600 Frames gesehen wurden, werden geprüft.
(Verhindert, dass alte Cluster alles matchen.)
2. Bestes Match wählen
Wenn:
- S > 0.985 → gleiche Beere
- S < 0.965 → neue Beere
- dazwischen → heuristisch (z. B. Größe bevorzugen)

3. Cluster aktualisieren  
Wenn Match:
- Embedding hinzufügen
- meanEmbedding neu berechnen
- colorHist updaten
- sizeStats updaten
- lastSeen = currentFrame

4. Neue ID vergeben
Wenn kein Match → neue ID + neuer Cluster.

Damit eine Beere als gültig erkannt wird muss sie zusätzlich noch mindestens eine Anzahl an Frames gesehen worden sein, diese Anzahl wird aktuell noch in der Konfig über die Oberfläche eingestellt

Damit wird beim laufenden Kamerabild eine Doppelzählung einigermaßen verhindert (aber noch nicht komplett) 

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
