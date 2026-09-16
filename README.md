# Futbol Manager Arcade

Juego de futbol para celular que mezcla tres cosas que normalmente vienen separadas:

- **Partido arcade en 3D** (estilo Dream League): jugas vos, apaisado, con joystick virtual y tres botones que cambian de funcion segun tengas o no la pelota.
- **Direccion tecnica** (estilo Football Manager): once titular, formacion, actitud del equipo, lesiones, moral y mercado de pases.
- **Presidencia del club** (estilo Football Chairman): caja, precio de la entrada, socios, estadio, cantera, sponsors y un directorio que te puede echar.
- **Mercado con mercado internacional**: filtros por puesto, media, precio y
  procedencia, con jugadores libres de ocho ligas del exterior.

Web primero, jugable desde el navegador del celular y empaquetable a Android e
iOS con Capacitor.

## Estado

Version jugable de punta a punta: elegis club, jugas la fecha en modo arcade o la simulas,
cobras la taquilla, invertis la plata y la temporada se cierra sola con premios, juveniles y
evaluacion del directorio. La partida se guarda en el navegador.

## Jugar desde el celular

El juego se publica solo en GitHub Pages con cada push a `main`:

**https://maticukier.github.io/futbol-manager-arcade/**

Abri esa direccion en el celular y agregala a la pantalla de inicio. Queda como
una app: arranca sin barra del navegador, en vertical y con su propio icono.

- **Android (Chrome):** menu de tres puntos, "Agregar a la pantalla principal".
- **iPhone (Safari):** boton de compartir, "Agregar a inicio".

Se guarda la partida en el telefono, asi que podes cerrar y seguir despues.

Para que la publicacion funcione hay que habilitarla una sola vez en el repo:
Settings, Pages, y en "Source" elegir **GitHub Actions**.

### Sin publicar, desde la misma red

Con la compu prendida y el celular en el mismo wifi:

```bash
npm run dev -- --host
```

Vite imprime una direccion tipo `http://192.168.0.10:5173`. Esa es la que abris
en el telefono.

## Como correrlo

```bash
npm install
npm run dev        # http://localhost:5173
```

Otros comandos:

```bash
npm run typecheck  # TypeScript en modo estricto
npm run build      # bundle de produccion en dist/
npm run preview    # sirve dist/ para probar el build
```

## Controles del partido

El partido se juega con el telefono acostado. Los tres botones cambian de
funcion segun quien tenga la pelota, como en Dream League:

| Boton | Con la pelota | Sin la pelota | Teclado |
| --- | --- | --- | --- |
| Verde | Pase al ras | Cambiar de jugador | J |
| Rojo | Tiro (mantener carga la potencia) | Barrida | K |
| Azul | Pase bombeado y centros | Presion en bloque | L |
| Amarillo | Correr (mantener) | Correr (mantener) | Shift |

El boton amarillo tiene un anillo que muestra el aire que le queda al jugador.
Esprintar lo gasta rapido y con la pelota se pierde algo de control, asi que no
conviene tenerlo apretado todo el partido.

Para moverte, joystick en la mitad izquierda de la pantalla, o WASD en la compu.
Manejas al jugador mas cercano a la pelota y el cambio es automatico cuando la
perdes; con el boton verde elegis vos a quien manejar.

Tu equipo ataca siempre hacia la derecha, tambien en el segundo tiempo.

### Sobre los reinicios

Los laterales, los corners y los saques de arco no cortan el partido: la pelota
queda en el piso, el que saca ya la tiene y la jugada sigue. Solo se frena de
verdad en el gol, la falta, el entretiempo y el final.

### Sobre la barrida

Sacar la pelota es una decision, no una moneda: la disputa cuerpo a cuerpo es
lenta a proposito y la forma real de recuperarla es tirarse. Si llegas a la
pelota la despejas; si llegas al jugador es falta y tiro libre para el rival.
Despues de barrerte quedas un rato en el piso, asi que errarle se paga.

## Mobile (Capacitor)

Las carpetas nativas no estan versionadas: se generan en tu maquina.

```bash
npx cap add android      # necesita Android Studio
npx cap add ios          # necesita Xcode, solo en macOS
npm run sync:android     # build + copia a la app nativa
npm run open:android
```

## Como esta armado

```
src/
  sim/          Simulacion pura, sin Phaser ni DOM. Corre de memoria.
    types.ts      Modelo de datos (jugadores, clubes, fixture, directorio)
    rng.ts        Aleatoriedad con semilla: misma semilla, misma partida
    jugadores.ts  Generacion de jugadores, medias, valor y salario
    tacticas.ts   Formaciones y posiciones base en la cancha
    liga.ts       Fixture, tabla y simulacion de los partidos de la IA
    finanzas.ts   Taquilla, socios, sponsors, estadio y cantera
    mercado.ts    Compra y venta de jugadores
    juego.ts      Estado global, avance de fecha y cierre de temporada
  game/         Partido arcade en 3D
    match/motor.ts      Reglas, fisica e IA. No sabe que existe el 3D
    match/escena3d.ts   Render con Three.js: cancha, arcos, tribunas, camara
    match/jugador3d.ts  Jugadores armados con primitivas y animados por codigo
    match/interfaz.ts   Marcador, avisos, joystick y botones, en DOM
    match/mundo.ts      Medidas de la cancha, en metros
  ui/           Pantallas de gestion en DOM (sin framework)
```

Hay dos separaciones que importan. La primera es `sim/` contra `game/`: la
simulacion no sabe que existe el 3D, asi que las fechas que no jugas se resuelven
sin abrir el motor grafico, y Three.js se carga recien cuando arranca un partido
(el bundle inicial queda en unos 56 kB). La segunda es, dentro del partido,
`motor.ts` contra `escena3d.ts`: el motor corre sin pantalla, lo que permite
simular partidos enteros en milisegundos para medir el balance.

## Decisiones de diseno

- **La formacion define el partido.** Las posiciones normalizadas de `tacticas.ts` las usan
  tanto la simulacion como el motor arcade, asi que cambiar de 4-4-2 a 5-3-2 se nota en la cancha.
- **Las decisiones de presidente tienen costo.** Subir la entrada da plata ya y hace perder
  socios despues; ampliar el estadio sube el mantenimiento semanal.
- **La economia esta toda en la misma escala.** La masa salarial se come casi
  toda la entrada fija de TV y sponsor, asi que la taquilla es lo que deja
  margen. Un club grande factura unos 55 millones por partido de local contra
  38 de sueldos por semana: si el equipo anda mal se pierden socios, baja la
  recaudacion y el club empieza a perder plata.
- **Los jugadores evolucionan de a poco.** Cada semana suman puntos ocultos
  segun edad, minutos y margen de potencial, y recien al llegar a cien se
  traducen en un punto de atributo. Nadie mejora todas las fechas y despues de
  los treinta se empieza a caer.
- **Todo con semilla.** `Rng` hace que una partida sea reproducible, util para depurar.
- **Sin assets.** Cancha, arcos, tribunas y jugadores se arman con primitivas y
  texturas dibujadas en un lienzo. No hay modelos que descargar ni licencias que
  mirar, y el paquete del partido queda en unos 130 kB comprimidos.
- **Sombras de mancha.** En vez de un mapa de sombras, cada jugador lleva una
  mancha difusa abajo: en un telefono rinde mucho mejor y se lee igual.

## Roadmap

- [ ] Copa nacional en paralelo a la liga
- [ ] Ascensos y descensos con segunda division
- [ ] Cambios y tarjetas durante el partido
- [ ] Barrera y remate en los tiros libres
- [ ] Entrenamiento semanal que suba atributos concretos
- [ ] Negociacion de contratos y jugadores que piden irse
- [ ] Sonido y musica

## Licencia

Proyecto personal. Clubes, jugadores y estadios son inventados.
