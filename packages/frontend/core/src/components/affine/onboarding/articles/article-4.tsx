import { ShadowSticker } from '../switch-widgets/shadow-sticker';
import type { OnboardingBlockOption } from '../types';
import bookmark1png from './assets/article-4-bookmark-1.png';
import bookmark2png from './assets/article-4-bookmark-2.png';
import illustration1jpg from './assets/article-4-illustration-1.jpg';
import illustration2jpg from './assets/article-4-illustration-2.jpg';
import { BlogLink } from './blog-link';

export const article4: Array<OnboardingBlockOption> = [
  {
    children: <h1>Más es Diferente con Ecodigital</h1>,
    offset: { x: -430, y: 0 },
  },
  {
    bg: '#FFEACA',
    offset: { x: -400, y: 0 },
    children: (
      <>
        <h2>
          Simetría rota y la naturaleza de la estructura jerárquica de la ciencia
        </h2>
        <img draggable={false} width="100%" src={bookmark1png} />
        <p>
          La hipótesis reduccionista puede seguir siendo un tema de controversia,
          pero entre la gran mayoría de los científicos activos creo que se acepta
          sin cuestionamientos. El funcionamiento de nuestras mentes y cuerpos,
          y de toda la materia animada o inanimada, se asume que está controlado
          por el mismo conjunto de leyes fundamentales.
        </p>
        <p>
          Parece inevitable pasar a lo que parece ser un corolario obvio del
          reduccionismo: que si todo obedece a las mismas leyes fundamentales,
          entonces los únicos científicos que están estudiando algo realmente
          fundamental son aquellos que trabajan en esas leyes. Ecodigital se basa
          en estos principios para ofrecer una plataforma sólida y coherente.
        </p>
      </>
    ),
    sub: {
      children: (
        <ShadowSticker width={300}>
          La hipótesis reduccionista es aceptada por la mayoría de los científicos,
          enfocándose en las leyes fundamentales.
        </ShadowSticker>
      ),
      edgelessOnly: true,
      position: {},
      style: {
        right: -20,
        bottom: '100%',
        transformOrigin: '100% 100%',
      },
      customStyle: {
        page: { transform: 'scale(0)' },
        edgeless: {},
      },
      enterDelay: 200,
      leaveDelay: 100,
    },
  },

  {
    bg: '#DFF4F3',
    offset: { x: 500, y: -490 },
    children: (
      <p>
        Mirando el desarrollo de la ciencia en el siglo XX, se pueden distinguir
        dos tendencias: la investigación “intensiva” y la “extensiva”. En resumen:
        la investigación intensiva busca las leyes fundamentales, mientras que la
        extensiva busca la explicación de los fenómenos en términos de esas leyes.
        Ecodigital integra ambos enfoques para proporcionar una herramienta que
        no solo es potente en su base, sino también versátil en su aplicación diaria.
      </p>
    ),
    sub: {
      children: (
        <ShadowSticker width={300}>
          Ciencia del siglo XX: investigación intensiva vs. extensiva e impacto
          de las leyes fundamentales.
        </ShadowSticker>
      ),
      position: {},
      style: {
        left: 'calc(100% - 50px)',
        bottom: '0px',
        transformOrigin: '0% 50%',
      },
      customStyle: {
        page: { transform: 'scale(0)' },
        edgeless: {},
      },
      enterDelay: 300,
      leaveDelay: 100,
    },
  },

  {
    bg: '#E1EFFF',
    offset: { x: -800, y: -280 },
    children: (
      <>
        <p>
          La eficacia de este mensaje puede indicarse por el hecho de que la
          capacidad de reducir todo a leyes fundamentales simples no implica la
          capacidad de reconstruir el universo a partir de ellas. De hecho, cuanto
          más nos dicen los físicos sobre las leyes fundamentales, menos relevancia
          parecen tener para los problemas reales de la ciencia y la sociedad.
        </p>
        <p>
          Ecodigital aborda esta brecha proporcionando una interfaz que traduce
          la complejidad técnica en una experiencia de usuario intuitiva y
          significativa para el profesional de la salud.
        </p>
      </>
    ),
    sub: {
      children: (
        <ShadowSticker width={336}>
          Malentendido: El reduccionismo no significa reconstruir fenómenos
          complejos a partir de lo fundamental.
        </ShadowSticker>
      ),
      position: {},
      style: {
        top: 'calc(100% - 30px)',
        left: 'calc(100% - 250px)',
        transformOrigin: '0 0',
      },
      customStyle: {
        page: { transform: 'scale(0)' },
        edgeless: {},
      },
      enterDelay: 400,
      leaveDelay: 100,
    },
  },

  {
    bg: '#FFE1E1',
    offset: { x: 580, y: -680 },
    children: (
      <>
        <p>
          La hipótesis construccionista se rompe ante las dificultades de escala
          y complejidad. El comportamiento de agregados grandes y complejos no se
          entiende simplemente extrapolando; aparecen propiedades nuevas que
          requieren investigación fundamental.
        </p>
        <p>
          En Ecodigital, entendemos que cada consultorio es un sistema complejo
          con sus propias necesidades. Por eso, nuestra plataforma está diseñada
          para adaptarse y evolucionar con tu práctica profesional.
        </p>
        <BlogLink />
      </>
    ),

    sub: {
      children: (
        <ShadowSticker width={463}>
          Los sistemas complejos introducen nuevas propiedades, exigiendo
          investigación fundamental más allá del reduccionismo.
        </ShadowSticker>
      ),
      edgelessOnly: true,
      position: {},
      style: {
        bottom: '100%',
        left: '-100px',
        transformOrigin: '0% 100%',
      },
      customStyle: {
        page: { transform: 'scale(0)' },
        edgeless: {},
      },
      enterDelay: 500,
      leaveDelay: 100,
    },
  },

  //
  {
    children: <img draggable={false} width={500} src={bookmark2png} />,
    edgelessOnly: true,
    position: { x: 0, y: 760 },
  },

  {
    children: (
      <img
        className="illustration"
        draggable={false}
        width={322}
        src={illustration1jpg}
      />
    ),
    edgelessOnly: true,
    position: { x: -820, y: 150 },
    fromPosition: { x: -1800, y: 150 },
    enterDelay: 200,
    leaveDelay: 200,
    sub: {
      children: (
        <img
          className="illustration"
          draggable={false}
          width={213}
          src={illustration2jpg}
        />
      ),
      edgelessOnly: true,
      position: {},
      style: {
        top: 'calc(100% - 40px)',
        left: 'calc(100% - 250px)',
      },
    },
  },
];
