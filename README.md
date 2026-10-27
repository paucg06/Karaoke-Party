# Vocaluxe Web (UltraStar Web Edition)

Juego de karaoke competitivo y afinación vocal en tiempo real ejecutado al 100% en el navegador web mediante **Web Audio API** y **HTML5 Canvas**, sin necesidad de servidores backend. Totalmente compatible con el formato estándar de **UltraStar** y **Vocaluxe**.

Diseñado bajo los estándares de arquitectura y diseño de **EternoDev**:
- Despliegue directo en **GitHub Pages** con `index.html` en la raíz.
- **Cero degradados** (diseño en colores planos sólidos de alto contraste).
- **Cero emojis** (iconografía exclusivamente vectorial en SVG).
- **Minimalismo extremo** (interfaz directa, rápida y sin sobreinformación).

---

## Características

- **Detección de Tono en Tiempo Real:** Detección de frecuencia fundamental ($F_0$) por autocorrelación con microtonos parabólicos y tolerancia de octava para voces graves y agudas.
- **Renderizado a 60 FPS:** Visualización fluida de barras de notas (normales, doradas y estilo libre), cursor temporal, estela vocal del jugador y letra sincronizada con iluminación por sílaba.
- **Sistema de Puntuación:** Hasta 10.000 puntos según precisión, multiplicadores de notas doradas, contador de combos y valoración final (*Estrella, Excelente, Notable, etc.*).
- **Dos Métodos de Canciones:**
  1. **Catálogo Integrado en GitHub:** Subir las carpetas de canciones al repositorio dentro de `songs/` y registrarlas en `songs/songs.json`. Cualquiera que visite tu enlace de GitHub Pages puede jugarlas directamente.
  2. **Carga Local (Arrastrar y Soltar / Selector de Carpeta):** El jugador puede arrastrar cualquier carpeta de canciones UltraStar desde su ordenador (.txt + .mp3 / .mp4 / carátulas). Se procesan en la memoria local del navegador al instante.

---

## Cómo agregar canciones en GitHub Pages

Para que una canción esté disponible en la web para todos los jugadores:

1. Crea una carpeta dentro de `songs/` (ej. `songs/Queen - Bohemian Rhapsody/`).
2. Coloca el archivo `.txt` de partitura UltraStar y el archivo de audio `.mp3` (y opcionalmente `.mp4` y carátula).
3. Añade la entrada en `songs/songs.json`:

```json
[
  {
    "id": "queen-bohemian-rhapsody",
    "title": "Bohemian Rhapsody",
    "artist": "Queen",
    "cover": "songs/Queen - Bohemian Rhapsody/cover.jpg",
    "txt": "songs/Queen - Bohemian Rhapsody/song.txt",
    "audio": "songs/Queen - Bohemian Rhapsody/audio.mp3"
  }
]
```

4. Haz commit y push al repositorio. GitHub Pages servirá la canción inmediatamente.

---

## Estructura del Proyecto

```text
.
├── index.html                   <-- Entrada principal (GitHub Pages ready)
├── README.md                    <-- Documentación
├── songs/                       <-- Canciones públicas y catálogo
│   ├── songs.json               <-- Manifiesto del catálogo
│   └── demo/                    <-- Canción de prueba incluida
└── src/
    ├── css/                     <-- Estilos modulares planos
    │   ├── main.css
    │   └── game.css
    ├── js/                      <-- Módulos ES6
    │   ├── main.js              <-- Orquestador principal
    │   ├── audio/               <-- Captura de micrófono y reproductor
    │   ├── engine/              <-- Lógica de juego y puntuación
    │   ├── parser/              <-- Parser de archivos .txt UltraStar
    │   ├── render/              <-- Renderizador Canvas 60fps
    │   └── ui/                  <-- Interfaz de biblioteca y carga
    └── assets/
        └── images/
            └── svg/             <-- Iconos vectoriales
```
