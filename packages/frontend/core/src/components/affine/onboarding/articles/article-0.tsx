import { CounterNote } from '../switch-widgets/counter-note';
import type { OnboardingBlockOption } from '../types';
import bookmark1png from './assets/article-0-bookmark-1.png';
import bookmark2png from './assets/article-0-bookmark-2.png';
import embed1png from './assets/article-0-embed-1.png';
import { BlogLink } from './blog-link';

export const article0: Array<OnboardingBlockOption> = [
  {
    children: <h1>CÓMO: Ser más productivo con Ecodigital</h1>,
    offset: { x: -150, y: 0 },
  },
  {
    bg: '#f5f5f5',
    children: (
      <>
        <p>
          “Con todo el tiempo que pasas viendo la televisión”, me dice, “ya podrías
          haber escrito una novela”. Es difícil no estar de acuerdo con el sentimiento:
          escribir una novela es, sin duda, un mejor uso del tiempo que ver la televisión,
          pero ¿qué pasa con la suposición oculta? Tales comentarios implican que el tiempo
          es “fungible”, que el tiempo dedicado a ver la televisión puede emplearse con la
          misma facilidad en escribir una novela. Y, lamentablemente, ese no es el caso.
        </p>
        <p>
          El tiempo tiene varios niveles de calidad. Si voy caminando a la estación del metro
          y he olvidado mi cuaderno, me resulta bastante difícil escribir más de un par de
          párrafos. Y es difícil concentrarse cuando te interrumpen constantemente. También
          hay un componente mental: a veces me siento feliz, motivado y listo para trabajar
          en algo, pero otras veces me siento tan cansado que solo puedo ver la televisión.
        </p>
      </>
    ),
    offset: { x: -120, y: 80 },
    sub: {
      children: (
        <CounterNote
          index={1}
          width={290}
          label="El tiempo no es intercambiable; su calidad varía según las circunstancias y el estado mental."
          animationDelay={300}
          color="#6E52DF"
        />
      ),
      enterDelay: 300,
      position: {},
      style: {
        bottom: 'calc(100% + 20px)',
        left: -40,
      },
      edgelessOnly: true,
    },
  },
  {
    bg: '#F9E8FF',
    children: (
      <>
        <img draggable={false} width="100%" src={bookmark1png} />
        <p>
          Si quieres ser más productivo, debes reconocer este hecho y lidiar con él.
          Primero, tienes que aprovechar al máximo cada tipo de tiempo. Y segundo,
          debes intentar que tu tiempo sea de mayor calidad utilizando herramientas como Ecodigital.
        </p>
        <h3>Usa tu tiempo eficientemente</h3>
      </>
    ),
    offset: { x: 250, y: 100 },
  },

  {
    bg: '#E1EFFF',
    children: (
      <>
        <h2>Elige buenos problemas</h2>
        <p>
          La vida es corta, ¿por qué desperdiciarla haciendo algo irrelevante? Es fácil
          empezar a trabajar en algo porque es conveniente, pero siempre deberías
          cuestionarte al respecto. ¿Hay algo más importante en lo que puedas trabajar?
          ¿Por qué no haces eso en su lugar? Estas preguntas son difíciles de afrontar,
          pero cada pequeño paso te hace más productivo en Ecodigital.
        </p>
        <p>
          <em style={{ background: '#ADF8E9' }}>
            Esto no quiere decir que todo tu tiempo deba dedicarse al problema más
            importante del mundo. El mío ciertamente no lo es. Pero es definitivamente
            el estándar con el que mido mi vida.
          </em>
        </p>
      </>
    ),
    offset: { x: -600, y: -130 },
    sub: {
      children: (
        <CounterNote
          index={2}
          width={290}
          label="Prioriza, cuestiona y trabaja hacia una productividad real."
          animationDelay={800}
          color="#6E52DF"
        />
      ),
      edgelessOnly: true,
      enterDelay: 800,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    bg: '#DFF4E8',
    children: (
      <>
        <h2>Ten varios proyectos</h2>
        <p>
          Otro mito común es que harás más si eliges un solo problema y te enfocas en él
          exclusivamente. Casi nunca es cierto. Tener muchos proyectos diferentes te da
          trabajo para diferentes calidades de tiempo. Además, tendrás otras cosas en las
          que trabajar si te bloqueas o te aburres.
        </p>
        <p>
          Ecodigital te permite organizar estos múltiples flujos de trabajo de manera
          coherente, fomentando la creatividad al aplicar lo que aprendes en un campo
          a otro.
        </p>
      </>
    ),
    offset: { x: -50, y: -50 },
    sub: {
      children: (
        <CounterNote
          index={3}
          width={290}
          label="Tareas diversas mejoran la productividad, la creatividad y combaten el aburrimiento."
          animationDelay={1200}
          color="#6E52DF"
        />
      ),
      edgelessOnly: true,
      enterDelay: 1200,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    bg: '#DFF4F3',
    children: (
      <>
        <h2>Haz una lista</h2>
        <p>
          Idear varias cosas en las que trabajar no debería ser difícil. Pero si intentas
          mantenerlo todo en tu cabeza, rápidamente se vuelve abrumador. La solución es
          simple: escríbelo en Ecodigital.
        </p>
        <p>
          Una vez que tengas una lista de todo lo que quieres hacer, puedes organizarla
          por tipo. Ecodigital facilita esta clasificación para que puedas realizar cada
          tarea cuando tengas el tipo de tiempo adecuado.
        </p>
      </>
    ),
    offset: { x: 800, y: -400 },
    sub: {
      children: (
        <CounterNote
          index={4}
          width={290}
          label="Organiza tareas por categoría para gestionar listas abrumadoras eficientemente."
          animationDelay={1500}
          color="#6E52DF"
        />
      ),
      edgelessOnly: true,
      enterDelay: 1500,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    children: <img draggable={false} width={418} src={bookmark2png} />,
    edgelessOnly: true,
    position: { x: 700, y: 230 },
    fromPosition: { x: 1000, y: 0 },
  },

  {
    bg: '#FFE1E1',
    children: (
      <>
        <h2>Integra la lista en tu vida</h2>
        <p>
          Una vez que tengas esta lista en Ecodigital, el problema es recordar mirarla.
          La mejor manera es hacer que consultarla sea parte de tu rutina natural.
          Aprovechar al máximo el tiempo que tienes es solo el principio; el problema
          más importante es crear más tiempo de alta calidad para ti mismo.
        </p>
        <BlogLink />
      </>
    ),
    offset: { x: 1200, y: -1600 },
    sub: {
      children: (
        <CounterNote
          index={5}
          width={290}
          label="Integra tareas en rutinas diarias y crea más tiempo libre de calidad."
          animationDelay={1500}
          color="#6E52DF"
        />
      ),
      edgelessOnly: true,
      enterDelay: 1500,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    children: <img draggable={false} width={450} src={embed1png} />,
    edgelessOnly: true,
    position: { x: 1050, y: 630 },
    fromPosition: { x: 1400, y: 630 },
    enterDelay: 200,
  },
];
