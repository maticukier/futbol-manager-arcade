# Vision del juego

Este documento existe para que cualquiera que agarre el proyecto sepa hacia
donde apunta, y para que las decisiones tecnicas se tomen a favor de ese norte
y no en contra. Si una feature es divertida pero rema contra el norte, no va.

## El norte

**Que el usuario se encarine con sus jugadores y con su club.**

No es un juego de futbol con un modo carrera pegado. Es un juego sobre
construir un proyecto, donde los partidos son el momento en que ves a la gente
que venis construyendo. El objetivo es que el usuario pueda decir *"ese es
Peralta, subio de la cantera a los 17, lo aguante dos temporadas malas y hoy es
el capitan"*, y que lo reconozca cuando lo ve en la cancha.

De ahi salen tres consecuencias que valen mas que cualquier feature suelta:

1. **Un jugador tiene que ser alguien, no una fila de numeros.** Tiene historia,
   tiene algo propio jugando, y se lo distingue en la cancha.
2. **El tiempo tiene que dejar marca.** Las temporadas se acumulan, los
   jugadores envejecen, las decisiones se pagan o se cobran mas adelante.
3. **El club tiene que tener vida alrededor:** hinchada, prensa, directorio,
   mercado. Contexto que reaccione a lo que hacer el usuario.

## Que significa para el codigo

- **La historia se guarda desde el dia uno.** Los datos que no se registran no
  se pueden reconstruir despues. Antes de construir la feature que muestra la
  historia, hay que estar guardando la historia.
- **La simulacion va separada del render.** Ya es asi y no se toca: permite
  simular sin pantalla, testear y medir el balance.
- **Todo lo que agregue identidad al jugador pasa por `sim/`,** que es la capa
  testeada. El partido lee esos datos, no los inventa.
- **Sin servidor.** Es una app web estatica: no hay backend, no hay IA en
  tiempo de ejecucion. Lo que parezca redaccion (noticias, declaraciones) sale
  de plantillas con mucha variacion, no de un modelo.

## Decisiones tomadas

1. **Genero.** Arcade jugable en 3D mas gestion profunda. Ni simulador puro ni
   juego de botones sueltos.
2. **Plataforma.** Web primero, pensado para telefono. Partido apaisado, menus
   en las dos orientaciones. Se empaqueta con Capacitor y se publica en Pages.
3. **Sin licencias.** Clubes, jugadores, estadios y ligas inventados.
4. **Sin assets descargados.** Geometria y texturas generadas por codigo.
5. **Idioma.** Todo en espanol rioplatense, codigo y comentarios incluidos, sin
   tildes en el codigo.
6. **Una sola partida guardada,** en el navegador, que se migra y no se
   descarta cuando cambia el formato.
7. **Balance objetivo del partido.** Alrededor de 3,5 goles y 14 remates por
   partido, con 25 por ciento de conversion. La reputacion del club se tiene
   que notar en los resultados.
8. **La economia tiene tension.** Un club chico pierde plata si no lo maneja
   bien. La caja no es decorativa.
9. **Los tests frenan el deploy.** Si el balance se sale de rango, no se
   publica.

## Decisiones abiertas

Cada una cambia codigo, no solo texto. La recomendacion es una opinion, no una
decision tomada.

### 1. Alcance del mundo
Una liga con dos divisiones, o varios paises con sus ligas.
**Recomendado:** empezar jugando solo en un pais, pero que el modelo de datos
tenga pais y liga desde ahora. Meterle una dimension de pais despues al
fixture, la copa, los ascensos y el mercado es caro.

### 2. Cuantos jugadores tiene el mundo
Pocos y todos con identidad, o muchos y la mayoria anonimos.
**Recomendado:** profundidad en tu club y en los que te rodean; el resto del
mundo se genera cuando hace falta. Un mercado global gigante y el "conocer a
tus jugadores" se pelean entre si.

### 3. Que hace especial a un jugador
Caracteristicas visibles en la ficha, ocultas que se descubren jugando, o las
dos.
**Recomendado:** las dos. Un par visibles que sirven para planificar, y una
oculta que aparece despues de varios partidos. Lo oculto es lo que genera
apego, pero si es todo oculto el usuario no puede decidir nada.

### 4. Numeros o sensaciones
Mostrar los atributos como numeros, o describirlos con palabras.
**Recomendado:** numeros en tu plantel, palabras en los jugadores de afuera
hasta que los observes. Asi el ojeador tiene sentido y el mercado tiene riesgo.

### 5. El peso de la cantera
Fuente barata de jugadores, o el corazon emocional del juego.
**Recomendado:** el corazon. Un pibe que debuta a los 17 y se queda diez
temporadas es la historia mas fuerte que puede contar el juego.

### 6. El usuario como personaje
Un director tecnico anonimo, o alguien con nombre, historia y reputacion que
viaja entre clubes.
**Recomendado:** con nombre e historia. Hoy, cuando te echan, se termina la
carrera; deberia empezar un capitulo nuevo con ofertas segun lo que hiciste.

### 7. Consecuencia y permanencia
Una sola carrera sin vuelta atras, o poder rehacer un partido que salio mal.
**Recomendado:** una sola, sin undo. El apego necesita que las cosas duelan.

### 8. Largo de una carrera
Cuantas temporadas tiene que aguantar el juego antes de aburrir.
**Recomendado:** apuntar a diez o quince temporadas. Eso obliga a que el
partido sea corto o salteable, y a que el cambio de temporada tenga momentos
fuertes.

### 9. Que pasa con el que se va
Desaparece, o lo seguis viendo en otros clubes y tu historia con el queda.
**Recomendado:** queda. Cruzarte con el pibe que vendiste es una de las cosas
mas baratas de implementar y de las que mas pegan.

### 10. La hinchada opina de jugadores concretos
Un solo numero de animo general, o opiniones sobre nombres propios.
**Recomendado:** nombres propios. "Los hinchas quieren que juegue el pibe" vale
mas que una barra de animo.

### 11. Lesiones
Molestias de dos semanas, o lesiones graves que cuestan media temporada.
**Recomendado:** que existan las dos, con las graves poco frecuentes. Una
rodilla rota es una historia; un golpe de dos semanas es ruido.

### 12. Idioma y publico
Solo espanol, o preparado para traducir.
**Recomendado:** espanol solo por ahora, pero sin meter texto suelto en el
codigo del juego cuando sea facil evitarlo.

## Como se usa este documento

- Antes de agregar una feature, mirar si empuja el norte.
- Si una decision abierta bloquea el trabajo, se decide y se mueve a
  "decisiones tomadas" con una linea de por que.
- Si la realidad contradice una decision tomada, se cambia y se anota. El
  documento sirve si esta vivo.
