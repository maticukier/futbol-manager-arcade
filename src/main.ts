import './ui/styles.css';
import { App } from './ui/app';

const raiz = document.getElementById('app');
const contenedorPartido = document.getElementById('match-root');

if (!raiz || !contenedorPartido) {
  throw new Error('Falta el contenedor de la aplicacion en el HTML');
}

const app = new App(raiz, contenedorPartido);
app.refrescar();

// Util para depurar desde la consola del navegador.
Object.assign(window, { app });
