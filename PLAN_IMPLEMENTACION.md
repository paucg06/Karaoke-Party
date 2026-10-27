# Plan de Arquitectura e Implementación: Eterno Karaoke
## Motor de 4 Jugadores, Micrófonos Móviles (QR / WebRTC) y Sincronización Multimedia

---

## 1. Visión General del Sistema
El objetivo es transformar el proyecto en una experiencia de karaoke de nivel profesional equivalente a **Lips** (Xbox 360), **SingStar** (PlayStation) y **Vocaluxe** (PC), operando al 100% en navegadores web y desplegable en **GitHub Pages** sin costes de servidor.

```
                                  [ Pantalla Principal (Host / PC / TV) ]
                                            GitHub Pages
                                    ┌────────────────────────────┐
                                    │ Motor Gráfico 60fps Canvas │
                                    │ Parser UltraStar & Timing  │
                                    │ Vídeo MP4 Sincronizado     │
                                    └──────────────┬─────────────┘
                                                   │
               ┌───────────────────────────────────┼───────────────────────────────────┐
               │ WebRTC DataChannel (P2P)          │ WebRTC DataChannel                │ WebRTC DataChannel
               ▼                                   ▼                                   ▼
      [ Móvil 1 - Micrófono ]             [ Móvil 2 - Micrófono ]             [ Móvil 3 y 4 - Mics ]
      - Escaneo de código QR              - Web Audio API                     - Detección de pitch local
      - Web Audio API (P1 Azul)           - Buffer ultraligero (P2 Rojo)      - Cero latencia de red (<10ms)
```

---

## 2. Solución para 4 Micrófonos Simultáneos: "Smartphone Mic" vía QR

### El Desafío del Hardware
Conectar 4 micrófonos físicos por cable a un PC o consola requiere tarjetas de sonido dedicadas multicanal o adaptadores USB cuádruples, lo cual es costoso e impráctico para reuniones sociales.

### La Solución WebRTC P2P (Serverless)
Los smartphones modernos cuentan con micrófonos de alta fidelidad con cancelación de ruido de hardware y procesadores de sobra.

#### Arquitectura Técnica Paso a Paso:
1. **Generación de Sala y QR en Pantalla:**
   * La pantalla principal genera un código de sala único de 4 letras (ej. `K-7B9A`).
   * Muestra un código QR en pantalla con la URL: `https://tu-usuario.github.io/karaoke/mic.html?room=K-7B9A&p=1`.
2. **Conexión P2P Serverless (WebRTC + STUN Público):**
   * El móvil escanea el QR con la cámara y abre la web del micrófono en su navegador (Safari/Chrome).
   * Se establece un enlace directo Peer-to-Peer mediante **WebRTC DataChannels** utilizando servidores STUN públicos gratuitos de Google (`stun:stun.l.google.com:19302`).
   * **Cero coste de servidor:** Una vez conectado el WebRTC, los datos viajan directamente de móvil a PC por la red WiFi local sin pasar por ningún servidor.
3. **Procesamiento de Audio en el Cliente (Optimización Extrema):**
   * *Opción A (Recomendada - Cero Latencia):* El móvil ejecuta el algoritmo de autocorrelación en su propio navegador y solo envía un paquete JSON minúsculo cada 16ms:
     `{ p: 1, pitch: 8.2, vol: 0.7 }`
     * Consumo de ancho de banda: Menos de 1 KB/s.
     * Latencia percibida: **< 10 milisegundos**.
   * *Opción B:* Enviar paquetes de audio comprimidos en PCM de 16-bit por WebRTC DataChannel.

---

## 3. Motor de Detección de Afinación Profesional

Para que la experiencia sea justa y satisfactoria (sin frustración al cantar pero premiando a quien afina bien):

1. **Autocorrelación con Interpolación Parabólica:**
   * Detección precisa de la frecuencia fundamental ($F_0$) en Hz, evitando armónicos de octava falsa mediante prefiltrado paso banda (75 Hz a 1100 Hz).
2. **Ajuste Dinámico de Octava (Octave Folding):**
   * Vocalistas masculinos cantando canciones femeninas (o viceversa) cantan naturalmente una o dos octavas por debajo o por encima.
   * La fórmula compara:
     $$\Delta = |(\text{pitch}_{\text{cantado}} - \text{pitch}_{\text{esperado}}) \pmod{12}|$$
   * Si la nota relativa es la misma (mismo semitono dentro de la escala), se otorga la puntuación completa.
3. **Tolerancia por Dificultad (Easy / Normal / Hard):**
   * **Fácil:** Margen de $\pm 1.8$ semitonos (ideal para fiestas y principiantes).
   * **Normal:** Margen de $\pm 1.1$ semitonos (estándar de SingStar y Vocaluxe).
   * **Difícil:** Margen de $\pm 0.6$ semitonos (precisión milimétrica).

---

## 4. Fondo de Vídeo MP4 Sincronizado

Para evitar fondos negros planos y reproducir el videoclip original:
1. El archivo `song.txt` define la etiqueta `#VIDEO:nombre_video.mp4`.
2. El elemento `<video>` nativo de HTML5 se monta detrás del Canvas (`z-index: 1`) con `object-fit: cover`.
3. Para asegurar la visibilidad perfecta de las notas y las letras:
   * Se aplica una capa de oscurecimiento plano sobre el vídeo (`background: rgba(7, 11, 20, 0.6)`).
   * El audio del vídeo se silencia automáticamente (`video.muted = true`) para utilizar la pista de audio de alta fidelidad (`audio.mp3`) como reloj maestro de sincronización (`currentTime`).

---

## 5. Diseño de Interfaz estilo *Lips* (Minimalismo de Cuadrículas Cuadradas)

Inspirado en la pantalla de selección de **Lips** (Xbox 360):
* Cuadrícula limpia de portadas **100% cuadradas (aspect-ratio: 1/1)**.
* Distintivo alfabético en la esquina superior izquierda de cada carátula (A, B, C...).
* Debajo de cada portada: Nombre de la canción en negrita compacta y Autor en texto secundario.
* Sin paneles laterales invasivos ni botones de carga gigantescos.
