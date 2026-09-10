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

/** Liga de 12 equipos: temporada de 22 jornadas, buena para sesiones de celular. */
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
