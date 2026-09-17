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
  historia, hay que estar guardando la historia. **Hecho**
  (`src/sim/historial.ts`): cada jugador guarda una fila por temporada con
  club, division, edad, partidos, goles, asistencias, nota promedio y la media
  con la que cerro. Los partidos simulados tambien puntuan, en la misma escala
  que el que se juega en 3D, porque si no la carrera tendria un agujero del
  noventa por ciento.
- **La simulacion va separada del render.** Ya es asi y no se toca: permite
  simular sin pantalla, testear y medir el balance.
- **Todo lo que agregue identidad al jugador pasa por `sim/`,** que es la capa
  testeada. El partido lee esos datos, no los inventa.
- **Sin servidor.** Es una app web estatica: no hay backend, no hay IA en
  tiempo de ejecucion. Lo que parezca redaccion (noticias, declaraciones) sale
  de plantillas con mucha variacion, no de un modelo.
- **El guardado no entra en localStorage.** Medido: hoy la partida pesa 313 kB
  con 592 jugadores, unos 542 bytes por jugador. Con la cantera sub 18 en cada
  club se va a 0,43 MB en un solo pais, y con diez paises a 4,3 MB, contra un
  limite de alrededor de 5 MB. Un pais solo entra; America entera no. Antes de
  sumar paises hay que mudar el guardado a IndexedDB, que no tiene ese techo.
  El historial por jugador, en cambio, entra sobrado: son 63 bytes por jugador
  y temporada, o sea 0,53 MB despues de quince temporadas.

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

### Cantera sub 18
Cada club tiene una cantera de **15 a 18 anos**, unos doce chicos. Se los ve
crecer ano a ano, y ahi aparecen las promesas del club, que se sienten como
proyectos propios antes de debutar. **Recien a partir de los 16 pueden subir al
primer equipo.**

*Antes esto decia de 12 anos a reserva, subibles desde los 15. Se cambio porque
el propio documento (decision 5 de diseno) dice que hasta los 15 un chico no
muestra numeros: de 12 a 15 era un nombre y una opinion, que no se puede
evaluar ni usar ni vender. Eran tres anos de filas inertes y veintiun juveniles
por club, una lista que nadie lee, justo lo contrario de encarinarse con ellos.
Con doce se los conoce por nombre, y a los 16 es cuando debuta un pibe de
verdad. El ano de 15 se deja para poder verlo antes de poder subirlo.*

**Consecuencia:** sigue multiplicando la cantidad de jugadores del mundo, pero
la mitad que antes. Medido: +126 kB por pais contra +220 kB de la version
vieja. **No alcanza para evitar IndexedDB**: America entera con diez paises da
4,3 MB contra un limite de alrededor de 5 MB, asi que la mudanza del guardado
sigue siendo obligatoria antes de sumar paises.

**Depende de la historia,** que ya esta: cada temporada guarda la media con la
que cerro, asi que se puede ver a un chico pasar de 48 a 61 en dos anos en vez
de leer solo el numero de hoy. La cantera ya no esta bloqueada por eso.

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

**Consecuencia:** hace falta una nota de rendimiento por partido. **Ya existe**
(`src/sim/rendimiento.ts`): cada partido reparte un puntaje de uno a diez a
partir de goles, asistencias, remates, pases completados, quites, faltas,
tarjetas y, para el arquero, atajadas y goles recibidos. Y **ya se acumula por
temporada** en el historial del jugador, asi que el dato que necesitan el
potencial y la reputacion esta disponible: queda escribir los dos sistemas.

### Dos presupuestos separados
La caja del club se divide en dos:

- **Deportivo:** fichajes, sueldos de jugadores, operaciones del futbol.
- **Institucional:** sueldos del personal, mantenimiento, instalaciones y todo
  lo que sostiene al club.

Se puede pasar presupuesto de uno al otro, pero **el institucional nunca puede
quedar en quiebra**. Si entra en negativo, el club empieza a degradarse.

Esto le da al manejo de la plata una decision real y permanente, en vez de un
solo numero que sube y baja.

## Decisiones tomadas en diseno

Salieron de las recomendaciones, con el visto bueno del autor. Cualquiera se
puede dar vuelta, pero mientras no se de vuelta, se programa asi.

1. **Con que parte del mundo arranca.** America entera primero, con las tres
   copas andando. Las otras regiones despues.
2. **Detalle del mundo.** El usuario elige cuantas ligas corren con detalle
   completo. Las demas son **ligas livianas**: guardan posicion final, campeon
   de copa, los tres mejores jugadores y la tabla de goleadores, y nada mas.
   Alcanza para el coeficiente, para el mercado y para que el mundo se sienta
   vivo, sin guardar cien mil jugadores.
3. **Que hace especial a un jugador.** Un par de caracteristicas visibles para
   planificar, y una oculta que aparece despues de varios partidos. **Hecho**
   (`src/sim/rasgos.ts`): quince rasgos, cada uno con efecto real dentro del
   partido, no una etiqueta. El oculto se destapa a los doce partidos.
4. **Numeros o sensaciones.** Numeros en tu plantel; palabras en los de afuera
   hasta que los observes. Asi el ojeador sirve y el mercado tiene riesgo.
5. **Un juvenil no muestra numeros.** Hasta los 16 solo se ve lo que dice el
   coordinador de inferiores, y a veces se equivoca. Con la cantera empezando a
   los 15, eso es un ano de leerlo a ciegas antes de poder subirlo.
6. **El usuario es un personaje** con nombre e historia. Que te echen no
   termina la carrera: empieza un capitulo nuevo con ofertas segun lo que
   hiciste.
7. **Una sola carrera, sin volver atras.** El apego necesita que duela.
8. **Una carrera apunta a diez o quince temporadas.** Eso condiciona cuanto
   puede durar un partido y obliga a que el cambio de temporada tenga momentos
   fuertes.
9. **El que se va queda en el mundo.** Lo seguis viendo en otros clubes y tu
   historia con el no se borra.
10. **La hinchada opina de nombres propios,** no de una barra de animo.
11. **Lesiones de las dos clases,** con las graves poco frecuentes.
12. **Espanol,** sin dejar texto suelto tirado en el codigo del juego.
13. **Degradarse es progresivo.** Primero lo reversible (personal,
    mantenimiento), despues lo que cuesta recuperar (instalaciones,
    inferiores). La primera senal es un aviso, no un castigo.
14. **Las copas internacionales se pueden jugar,** pero simular tiene que ser
    comodo: una temporada no puede obligar a jugar cuarenta partidos.
15. **Africa entra como quinta region.**
16. **La escalera de copas tambien baja.** Un grande que fracasa termina en la
    copa chica.
17. **La nota de rendimiento por partido es visible,** tipo puntaje de diario.
    **Hecho:** se muestra al terminar el partido, ordenada de mejor a peor y
    con la figura marcada.

## Lo que falta definir

Solo queda una: **como se llama el juego**. Por ahora sigue siendo Futbol
Manager Arcade, que es provisorio. No frena nada.

## Detalle del mundo y fichajes

Tres decisiones que cierran el tema del mundo grande.

### Cuantas ligas con detalle: las que quiera
No hay tope. El usuario elige cuantas ligas corren con detalle completo,
**sabiendo que cada una suma peso al guardado y tiempo a cada semana
simulada**. La responsabilidad de avisar es del juego: al elegir tiene que
verse el costo, no descubrirlo despues cuando todo se pone lento.

**Consecuencia:** hay que medir y mostrar cuanto cuesta cada liga, y que el
juego siga siendo usable con muchas. Las ligas livianas no se tocan: siguen
guardando posicion final, campeon de copa, los tres mejores jugadores y la
tabla de goleadores.

### El detalle se puede sumar en el medio
Una liga liviana puede pasar a detalle completo en cualquier momento de la
carrera. Al pasar, esa liga se completa: se le generan los planteles de
verdad respetando lo que ya habia pasado (quien salio campeon, quien hizo los
goles), para que no se contradiga con la historia que el usuario ya vio.

### Fichar siempre se puede, convencer es otra cosa
Se puede ir a buscar a cualquier jugador del mundo, de cualquier liga. Lo
dificil es que acepte.

La decision es del jugador, no del club. Pesan:

- **La diferencia de reputacion.** Si estas en una liga chica y el esta en una
  grande, la respuesta normal es que no.
- **Los minutos que le prometas.** Es la carta fuerte para dar vuelta un no:
  prometerle que va a ser titular puede convencer a alguien que en su club no
  juega.
- **Su decision, igual.** Aun con todo a favor, **el jugador puede negarse a
  negociar**. No es una formula que se resuelve: es alguien que puede decir
  que no.

**Consecuencia:** las promesas hay que guardarlas y hay que cumplirlas. Si le
prometiste titularidad y lo tenes en el banco, se tiene que enterar, bajarle
la moral y querer irse. Una promesa que no se puede romper no es una promesa.

## Como se usa este documento

- Antes de agregar una feature, mirar si empuja el norte.
- Si una decision abierta bloquea el trabajo, se decide y se mueve a
  "decisiones tomadas" con una linea de por que.
- Si la realidad contradice una decision tomada, se cambia y se anota. El
  documento sirve si esta vivo.
