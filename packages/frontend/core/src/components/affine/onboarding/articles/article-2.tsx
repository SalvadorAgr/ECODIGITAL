import type { OnboardingBlockOption } from '../types';
import embed1png from './assets/article-2-embed-1.png';
import illustration1png from './assets/article-2-illustration-1.jpg';
import illustration2png from './assets/article-2-illustration-2.jpg';
import note1png from './assets/article-2-note-1.png';
import note2png from './assets/article-2-note-2.png';
import { BlogLink } from './blog-link';

export const article2: Array<OnboardingBlockOption> = [
  {
    children: <h1>Aprendizaje y Práctica con Ecodigital</h1>,
    offset: { x: -824, y: 0 },
  },
  {
    bg: '#DFF4E8',
    children: (
      <h2>
        ¿Existen técnicas específicas para que el proceso de aprendizaje sea más efectivo?
      </h2>
    ),
    offset: { x: -800, y: 100 },
  },

  {
    bg: '#DFF4E8',
    children: (
      <>
        <p>
          A menudo releemos o subrayamos materiales pensando que nos ayudará a aprender mejor.
          Sin embargo, el mejor método para convertir la información en memoria a largo plazo
          es utilizar la “práctica de recuperación”.
        </p>
        <img
          className="illustration"
          draggable={false}
          width="100%"
          src={illustration1png}
        />
        <p>
          Simplemente significa intentar recuperar la información de tu propio cerebro en lugar
          de mirar una hoja de papel. Cada vez que traes esas ideas a la mente, las fortaleces.
          Ecodigital te ayuda a organizar tus notas y conocimientos para facilitar este proceso.
        </p>
      </>
    ),
    offset: { x: -800, y: 100 },
  },

  {
    bg: '#FFF4D8',
    children: <h2>¿Cómo aprender de manera más efectiva?</h2>,
    offset: { x: 100, y: -300 },
  },

  {
    bg: '#FFF4D8',
    children: (
      <>
        <p>
          El mejor método para un aprendizaje eficiente es evitar la multitarea. La Técnica
          Pomodoro ayuda con esto. Para realizar un Pomodoro, simplemente elimina todas las
          distracciones, pon un temporizador de 25 minutos y concéntrate plenamente.
          Ecodigital ofrece un entorno limpio y sin distracciones para que puedas enfocarte
          en lo que realmente importa.
        </p>
        <img
          className="illustration"
          draggable={false}
          width="100%"
          src={illustration2png}
        />
      </>
    ),
    offset: { x: 100, y: -300 },
  },

  {
    bg: '#DFF4F3',
    children: (
      <>
        <h2>¿Cómo recordar más y olvidar menos?</h2>
        <p>
          Si quieres recordar más, la práctica de recuperación con repetición espaciada es tu
          mejor opción. Ecodigital te permite estructurar tu información de manera que sea
          fácil de revisar y actualizar, adaptándote a nueva información o corrigiendo errores.
        </p>
        <h2>¿Cómo hacer que el aprendizaje digital sea más efectivo?</h2>
        <p>
          El aprendizaje digital es cada vez más común por su conveniencia. Ecodigital potencia
          esta experiencia al proporcionar herramientas interactivas que facilitan la
          comunicación y el intercambio de conocimientos entre profesionales y estudiantes.
        </p>
      </>
    ),
    offset: { x: -750, y: -530 },
  },

  {
    bg: '#F3F0FF',
    children: (
      <>
        <h2>
          Uso de medios digitales para el aprendizaje
        </h2>
        <p>
          Hay excelentes materiales disponibles en línea, pero debemos ser cautelosos con el
          tiempo que pasamos en redes sociales. Ecodigital te ayuda a filtrar el ruido y
          centrarte en el contenido de valor, creando un espacio de trabajo dedicado y
          profesional.
        </p>
        <BlogLink />
      </>
    ),
    offset: { x: 150, y: -680 },
  },

  {
    children: <img draggable={false} width={380} src={embed1png} />,
    edgelessOnly: true,
    position: { x: -200, y: -50 },
    fromPosition: { x: 300, y: -300 },
  },

  {
    children: <img draggable={false} width={309} src={note1png} />,
    edgelessOnly: true,
    position: { x: -260, y: -70 },
    fromPosition: { x: -360, y: -100 },
    enterDelay: 300,
    customStyle: {
      page: {
        transform: 'rotate(-10deg) translateY(-100px)',
      },
    },
  },

  {
    children: <img draggable={false} width={1800} src={note2png} />,
    edgelessOnly: true,
    position: { x: 50, y: 0 },
    fromPosition: { x: 2000, y: -2000 },
  },
];
