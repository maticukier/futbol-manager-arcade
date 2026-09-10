# Futbol Manager Arcade

Juego de futbol para celular que mezcla tres cosas que normalmente vienen separadas:

- **Partido arcade** (estilo World Soccer Champs): jugas vos, con joystick virtual, pase y tiro.
- **Direccion tecnica** (estilo Football Manager): once titular, formacion, actitud del equipo, lesiones, moral y mercado de pases.
- **Presidencia del club** (estilo Football Chairman): caja, precio de la entrada, socios, estadio, cantera, sponsors y un directorio que te puede echar.

Web primero, empaquetado a Android e iOS con Capacitor.

## Estado

Version jugable de punta a punta: elegis club, jugas la fecha en modo arcade o la simulas,
cobras la taquilla, invertis la plata y la temporada se cierra sola con premios, juveniles y
evaluacion del directorio. La partida se guarda en el navegador.

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

| Accion | Celular | Teclado |
| --- | --- | --- |
| Mover | Joystick (mitad izquierda de la pantalla) | W A S D |
| Pase | Boton verde | J |
| Tiro | Boton rojo (mantener carga la potencia) | K (mantener) |

Manejas siempre al jugador mas cercano a la pelota; el cambio es automatico.
Tu equipo ataca siempre hacia arriba, tambien en el segundo tiempo.

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
  game/         Motor del partido arcade (Phaser 3)
    match/EscenaPartido.ts  11 vs 11, IA, arqueros, goles, reloj
    match/controles.ts      Joystick virtual y botones
  ui/           Pantallas de gestion en DOM (sin framework)
```

La separacion importante es `sim/` contra `game/`: la simulacion no sabe que existe Phaser,
asi que las fechas que no jugas se resuelven sin abrir el motor grafico, y Phaser se carga
recien cuando arranca un partido (el bundle inicial queda en unos 56 kB).

## Decisiones de diseno

- **La formacion define el partido.** Las posiciones normalizadas de `tacticas.ts` las usan
  tanto la simulacion como el motor arcade, asi que cambiar de 4-4-2 a 5-3-2 se nota en la cancha.
- **Las decisiones de presidente tienen costo.** Subir la entrada da plata ya y hace perder
  socios despues; ampliar el estadio sube el mantenimiento semanal.
- **Todo con semilla.** `Rng` hace que una partida sea reproducible, util para depurar.
- **Sin assets.** La cancha y los jugadores se dibujan con primitivas: arranca al instante
  y no hay que mantener sprites todavia.

## Roadmap

- [ ] Copa nacional en paralelo a la liga
- [ ] Ascensos y descensos con segunda division
- [ ] Cambios y tarjetas durante el partido arcade
- [ ] Entrenamiento semanal que suba atributos concretos
- [ ] Negociacion de contratos y jugadores que piden irse
- [ ] Sprites y animacion de los jugadores
- [ ] Sonido y musica

## Licencia

Proyecto personal. Clubes, jugadores y estadios son inventados.
