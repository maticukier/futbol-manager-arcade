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
- **El guardado no entra en localStorage.** Medido: hoy la partida pesa 274 kB
  con 592 jugadores, unos 387 bytes por jugador. Con juveniles de 12 a 18 en
  cada club se va a 0,4 MB en un solo pais, y con diez paises a 4 MB, contra un
  limite de alrededor de 5 MB. Antes de sumar juveniles o paises hay que mudar
  el guardado a IndexedDB, que no tiene ese techo.

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

## Sistemas que definen el juego

Estos no son decisiones abiertas: son la direccion que quiere el proyecto.
Estan escritos con el detalle suficiente para implementarlos, y con las
consecuencias tecnicas que traen.

### Reputacion de jugadores y clubes
Cada jugador y cada club tienen reputacion, que sube y baja con los
rendimientos en su liga y en el plano internacional.

Sirve sobre todo para que **el mercado sea coherente**: un jugador no se va a
cualquier lado. Si la reputacion del club que lo busca esta muy por debajo de
la suya, no acepta; si esta muy por arriba, el club no lo mira. Eso le pone
techo y piso al mercado sin necesidad de reglas artificiales.

### Regiones y coeficiente de ligas
El mundo se divide en regiones: **America, Europa, Asia y Oceania**. Cada
region organiza sus propias copas.

Cada liga tiene un coeficiente que sale de como le fue a sus clubes en las
copas de su region en los ultimos anos, igual que el coeficiente de UEFA. El
coeficiente reparte **cupos** por pais: las ligas que rinden ganan lugares y
las que no, los pierden.

Es lo que convierte la carrera en un proyecto largo con progreso medible. El
desafio deja de ser "salir campeon otra vez" y pasa a ser *"hacer que Bolivia
sea la mejor liga del mundo"*, y ese progreso se ve en una tabla que se mueve
de a poco, temporada tras temporada, no en un cartel de campeon.

**Consecuencia:** obliga a que el mundo tenga varios paises, competencias
internacionales y memoria de varios anos de resultados por pais.

### Las copas de America
America es **una sola region**, de punta a punta: Sudamerica, Mexico, Estados
Unidos, Canada, Centroamerica y todo el Caribe compiten en el mismo sistema.
Un club mexicano y uno boliviano se cruzan en la misma copa.

Hay tres competencias, que forman una escalera:

| Copa | Que es | Como se entra |
| --- | --- | --- |
| **Libertadores** | La grande | Cupos por coeficiente, a los mejores de cada liga |
| **Sudamericana** | La segunda | Cupos por coeficiente, mas el campeon de la Panamericana |
| **Panamericana** | La puerta de entrada | Campeones de las federaciones chicas y los que quedan afuera de las otras dos |

La Panamericana es la que hace que un club de una liga chica tenga a donde
jugar y de donde empezar a subir. Ganarla da un lugar en la Sudamericana del
ano siguiente, y ahi arranca la escalera. Sin ella, un club del Caribe no
tendria ningun camino internacional y el coeficiente de su pais nunca se
moveria.

**Consecuencia de escala:** America con todos sus paises es un mundo grande.
La estimacion, contando inferiores de 12 a 18, esta en el orden de decenas de
miles de jugadores y de varios MB de guardado. Es perfectamente manejable en
IndexedDB, pero confirma que hay que salir de localStorage antes de empezar.

### Juveniles de 12 anos a reserva
Cada club tiene divisiones inferiores desde los 12 anos hasta reserva. Se los
ve crecer ano a ano, y ahi aparecen las promesas del club, que se sienten como
proyectos propios mucho antes de debutar. **Recien a partir de los 15 pueden
subir al primer equipo.**

**Consecuencia:** multiplica la cantidad de jugadores del mundo y obliga a que
la ficha de un chico de 12 no se lea como la de un profesional.

### Instalaciones
El club tiene instalaciones que se pueden mejorar y que impactan en dos
lugares: el desarrollo de los jugadores y el funcionamiento del club. El
predio de entrenamiento, las inferiores, la parte medica y el estadio son
palancas distintas, no un solo numero.

### Potencial alcanzable
Cada jugador tiene un potencial maximo. **Solo se supera si realmente se
destaca**, y no es lo normal. Que lo alcance o se quede lejos depende de tres
cosas: el nivel del predio de entrenamiento, los minutos que juega y su
rendimiento.

**Consecuencia:** hace falta una nota de rendimiento por partido, que hoy no
existe. Tambien la necesita la reputacion.

### Dos presupuestos separados
La caja del club se divide en dos:

- **Deportivo:** fichajes, sueldos de jugadores, operaciones del futbol.
- **Institucional:** sueldos del personal, mantenimiento, instalaciones y todo
  lo que sostiene al club.

Se puede pasar presupuesto de uno al otro, pero **el institucional nunca puede
quedar en quiebra**. Si entra en negativo, el club empieza a degradarse.

Esto le da al manejo de la plata una decision real y permanente, en vez de un
solo numero que sube y baja.

## Decisiones abiertas

Cada una cambia codigo, no solo texto. La recomendacion es una opinion, no una
decision tomada.

### 1. Con que parte del mundo arranca
El mundo final son cuatro regiones, y America completa de punta a punta. Falta
decidir por donde se empieza a construir, porque el coeficiente necesita varios
anos de historia para que se note.
**Recomendado:** America entera primero, con las tres copas funcionando. Es la
region que el juego mas quiere, y arrancar con ella deja probar el coeficiente
de verdad: ligas grandes, ligas chicas y una escalera entre medio. Las otras
regiones despues, cuando la maquinaria este andando.

### 2. Cuanto detalle tiene el mundo lejano
Todos los jugadores del mundo con el mismo detalle, o detalle completo cerca
tuyo y ficha reducida lejos.
**Recomendado:** detalle completo en tu pais y en los clubes con los que
competis, ficha reducida en el resto, que se completa si los observas. Con
juveniles desde los 12 en cada club del mundo, guardar todo con el mismo
detalle no entra en el telefono.

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

### 5. Que se ve de un juvenil de 12
Un chico de 12 no puede tener la misma ficha que un profesional, pero algo hay
que mostrar para que se sienta una promesa.
**Recomendado:** nada de numeros hasta los 15. Antes de eso, solo lo que dice
el coordinador de inferiores, y que se equivoque a veces.

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

### 13. Que significa degradarse
Cuando el presupuesto institucional queda en negativo, el club se degrada.
Falta definir que se degrada y en que orden: instalaciones que bajan de nivel,
personal que se va, inferiores que dejan de producir, socios que se borran.
**Recomendado:** primero lo invisible y reversible (personal, mantenimiento),
despues lo que duele y cuesta recuperar (nivel de instalaciones, inferiores).
Que la primera senal sea un aviso, no un castigo.

### 14. Las copas internacionales, se juegan o se simulan
Si el mundo es global, aparecen muchos mas partidos por temporada.
**Recomendado:** que se puedan jugar, pero que simular sea comodo. Una
temporada con liga, copa nacional y copa internacional no puede obligar a
jugar cuarenta partidos.

### 15. Africa
Las regiones quedaron en America, Europa, Asia y Oceania. Falta decidir si
Africa entra como quinta region o se reparte.
**Recomendado:** que entre como quinta. El modelo de datos no cambia y evita
un agujero raro en el mapa.

### 16. La escalera de copas, se sube y se baja
La Panamericana da lugar en la Sudamericana al ano siguiente. Falta decidir si
tambien hay caida: si un club grande que fracasa termina jugando la copa chica.
**Recomendado:** que si. La caida es lo que hace que la escalera se sienta
como una tabla y no como un premio.

### 17. Nota de rendimiento por partido
La necesitan la reputacion y el potencial. Falta decidir si es un numero
visible tipo puntaje de diario, o algo interno que solo mueve el desarrollo.
**Recomendado:** visible. Es barato y le da al usuario una razon para mirar la
ficha de sus jugadores despues de cada partido.

## Como se usa este documento

- Antes de agregar una feature, mirar si empuja el norte.
- Si una decision abierta bloquea el trabajo, se decide y se mueve a
  "decisiones tomadas" con una linea de por que.
- Si la realidad contradice una decision tomada, se cambia y se anota. El
  documento sirve si esta vivo.
