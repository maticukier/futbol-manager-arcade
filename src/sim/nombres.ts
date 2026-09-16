/** Nombres inventados: nada de clubes ni jugadores reales, para evitar licencias. */

export const NOMBRES = [
  'Matias', 'Lautaro', 'Facundo', 'Nicolas', 'Emiliano', 'Thiago', 'Bruno', 'Ezequiel',
  'Gonzalo', 'Ivan', 'Joaquin', 'Ramiro', 'Santiago', 'Tomas', 'Valentin', 'Agustin',
  'Damian', 'Federico', 'Ignacio', 'Julian', 'Leandro', 'Mauro', 'Rodrigo', 'Alan',
  'Benjamin', 'Cristian', 'Diego', 'Elias', 'Franco', 'German', 'Hernan', 'Kevin',
  'Lucas', 'Marcos', 'Nahuel', 'Pablo', 'Rafael', 'Sebastian', 'Ulises', 'Walter',
];

export const APELLIDOS = [
  'Peralta', 'Quiroga', 'Vergara', 'Sosa', 'Almada', 'Bustos', 'Carrizo', 'Duarte',
  'Escobar', 'Ferreyra', 'Gauna', 'Herrera', 'Ibarra', 'Juarez', 'Ledesma', 'Maidana',
  'Nieva', 'Ojeda', 'Paredes', 'Ramallo', 'Salvatierra', 'Tejeda', 'Urbano', 'Vallejos',
  'Zalazar', 'Aguirre', 'Barrientos', 'Cabrera', 'Del Valle', 'Echeverria', 'Falcon',
  'Godoy', 'Heredia', 'Insaurralde', 'Jaramillo', 'Leiva', 'Molina', 'Noriega',
  'Orellana', 'Pizarro', 'Rojas', 'Sarmiento', 'Toledo', 'Villalba', 'Zapata',
];

export interface PlantillaClub {
  nombre: string;
  abrev: string;
  colorPrimario: string;
  colorSecundario: string;
  reputacion: number;
  estadio: string;
  capacidad: number;
}

/** Primera division: 12 equipos, temporada de 22 jornadas. */
export const CLUBES_LIGA: PlantillaClub[] = [
  { nombre: 'Atletico Riachuelo', abrev: 'RIA', colorPrimario: '#1e5fd8', colorSecundario: '#f4c542', reputacion: 82, estadio: 'La Caldera', capacidad: 48000 },
  { nombre: 'Club Puerto Norte', abrev: 'PNO', colorPrimario: '#d02b2b', colorSecundario: '#ffffff', reputacion: 79, estadio: 'El Muelle', capacidad: 42000 },
  { nombre: 'Deportivo Palermo', abrev: 'PAL', colorPrimario: '#0f9d58', colorSecundario: '#0b1220', reputacion: 74, estadio: 'Parque Central', capacidad: 35000 },
  { nombre: 'Union Barracas', abrev: 'UBA', colorPrimario: '#8e44ad', colorSecundario: '#f2f2f2', reputacion: 68, estadio: 'El Galpon', capacidad: 28000 },
  { nombre: 'Racing del Sur', abrev: 'RDS', colorPrimario: '#00a6c8', colorSecundario: '#0b1220', reputacion: 65, estadio: 'Cilindro Austral', capacidad: 31000 },
  { nombre: 'Ferro Oeste', abrev: 'FOE', colorPrimario: '#2e7d32', colorSecundario: '#fdd835', reputacion: 61, estadio: 'Los Talleres', capacidad: 24000 },
  { nombre: 'Sportivo Andes', abrev: 'AND', colorPrimario: '#e67e22', colorSecundario: '#2c3e50', reputacion: 57, estadio: 'La Cordillera', capacidad: 21000 },
  { nombre: 'Nautico Pilar', abrev: 'NPI', colorPrimario: '#16a085', colorSecundario: '#ecf0f1', reputacion: 53, estadio: 'La Laguna', capacidad: 18000 },
  { nombre: 'Central Belgrano', abrev: 'CBE', colorPrimario: '#c0392b', colorSecundario: '#2c3e50', reputacion: 49, estadio: 'El Ferroviario', capacidad: 16000 },
  { nombre: 'Estrella del Plata', abrev: 'EDP', colorPrimario: '#f1c40f', colorSecundario: '#1b1b1b', reputacion: 45, estadio: 'El Dorado', capacidad: 14000 },
  { nombre: 'Defensores del Alto', abrev: 'DAL', colorPrimario: '#34495e', colorSecundario: '#e74c3c', reputacion: 41, estadio: 'La Barranca', capacidad: 12000 },
  { nombre: 'Juventud Obrera', abrev: 'JOB', colorPrimario: '#7f8c8d', colorSecundario: '#f39c12', reputacion: 36, estadio: 'El Sindicato', capacidad: 9000 },
];

/** Segunda division: los que pelean por subir. */
export const CLUBES_SEGUNDA: PlantillaClub[] = [
  { nombre: 'Talleres del Sud', abrev: 'TSU', colorPrimario: '#1e6091', colorSecundario: '#ffffff', reputacion: 38, estadio: 'La Fundicion', capacidad: 11000 },
  { nombre: 'Atletico Los Olmos', abrev: 'AOL', colorPrimario: '#b5651d', colorSecundario: '#1b1b1b', reputacion: 35, estadio: 'La Arboleda', capacidad: 9500 },
  { nombre: 'Deportivo Cienaga', abrev: 'DCI', colorPrimario: '#6a994e', colorSecundario: '#f2f2f2', reputacion: 34, estadio: 'El Bajo', capacidad: 8000 },
  { nombre: 'Racing de Lomas', abrev: 'RLO', colorPrimario: '#457b9d', colorSecundario: '#f1faee', reputacion: 33, estadio: 'Las Lomas', capacidad: 8500 },
  { nombre: 'Union Ferroviaria', abrev: 'UFE', colorPrimario: '#9d0208', colorSecundario: '#ffba08', reputacion: 32, estadio: 'El Taller', capacidad: 7500 },
  { nombre: 'Sportivo Almagro', abrev: 'SAL', colorPrimario: '#7209b7', colorSecundario: '#ffffff', reputacion: 31, estadio: 'El Parque', capacidad: 7000 },
  { nombre: 'Club Viento Sur', abrev: 'CVS', colorPrimario: '#0096c7', colorSecundario: '#03045e', reputacion: 29, estadio: 'La Rambla', capacidad: 6500 },
  { nombre: 'Defensores del Puerto', abrev: 'DPU', colorPrimario: '#2d6a4f', colorSecundario: '#d8f3dc', reputacion: 28, estadio: 'El Espigon', capacidad: 6000 },
  { nombre: 'Juventud del Norte', abrev: 'JNO', colorPrimario: '#e07a5f', colorSecundario: '#3d405b', reputacion: 26, estadio: 'El Monte', capacidad: 5500 },
  { nombre: 'Central Canteras', abrev: 'CCA', colorPrimario: '#5f6c7b', colorSecundario: '#fffffe', reputacion: 25, estadio: 'La Cantera', capacidad: 5000 },
  { nombre: 'Sol de Mayo', abrev: 'SDM', colorPrimario: '#f4a261', colorSecundario: '#264653', reputacion: 23, estadio: 'El Solar', capacidad: 4500 },
  { nombre: 'Barrio Nuevo FC', abrev: 'BNU', colorPrimario: '#8d99ae', colorSecundario: '#ef233c', reputacion: 21, estadio: 'El Barrio', capacidad: 4000 },
];

/** Ligas inventadas del exterior, para el mercado internacional. */
export interface LigaExtranjera {
  nombre: string;
  /** 1-100: de que nivel salen los jugadores que ofrece. */
  nivel: number;
}

export const LIGAS_EXTRANJERAS: LigaExtranjera[] = [
  { nombre: 'Liga Continental', nivel: 88 },
  { nombre: 'Premier del Norte', nivel: 84 },
  { nombre: 'Serie Adriatica', nivel: 79 },
  { nombre: 'Liga Iberica', nivel: 76 },
  { nombre: 'Bundesliga del Este', nivel: 72 },
  { nombre: 'Liga Cafetera', nivel: 62 },
  { nombre: 'Liga del Pacifico', nivel: 55 },
  { nombre: 'Liga Caribena', nivel: 48 },
];

/** Nombres con otra sonoridad, para que se note que el jugador viene de afuera. */
export const NOMBRES_EXTRANJEROS = [
  'Andrei', 'Bjorn', 'Cedric', 'Dimitri', 'Emeka', 'Florian', 'Goran', 'Hugo',
  'Ibrahim', 'Jonas', 'Kwame', 'Lukas', 'Marek', 'Nuno', 'Oskar', 'Pietro',
  'Rashid', 'Stefan', 'Tomasz', 'Viktor', 'Yannick', 'Zoran', 'Diego', 'Rafael',
];

export const APELLIDOS_EXTRANJEROS = [
  'Andersen', 'Bianchi', 'Costa', 'Dragomir', 'Eriksen', 'Fontaine', 'Gruber',
  'Halvorsen', 'Ivanov', 'Janssen', 'Kovac', 'Lindgren', 'Moreau', 'Novak',
  'Oyelaran', 'Petrov', 'Quintero', 'Rossi', 'Silva', 'Toure', 'Ubeda',
  'Vlahovic', 'Wagner', 'Zielinski',
];
