import { article, articleWrapper, text, title } from '../curve-paper/paper.css';
import type { ArticleId, ArticleOption, EdgelessSwitchState } from '../types';
// TODO(@catsjuice): lazy load
import { article0 } from './article-0';
import { article1 } from './article-1';
import { article2 } from './article-2';
import { article3 } from './article-3';
import { article4 } from './article-4';

const ids = ['0', '1', '2', '3', '4'] as Array<ArticleId>;

/** locate paper */
const paperLocations = {
  '0': {
    x: 0,
    y: 0,
  },
  '1': {
    x: -240,
    y: -30,
  },
  '2': {
    x: 240,
    y: -35,
  },
  '3': {
    x: -480,
    y: 40,
  },
  '4': {
    x: 480,
    y: 50,
  },
};

/** paper enter animation config */
const paperEnterAnimationOriginal = {
  '0': {
    curveCenter: 3,
    curve: 292,
    delay: 800,
    fromZ: 1230,
    fromX: -76,
    fromY: 100,
    fromRotateX: 185,
    fromRotateY: -166,
    fromRotateZ: 252,
    toZ: 0,
    // toX: 12,
    // toY: -30,
    toRotateZ: 6,
    duration: '2s',
    easing: 'ease',
  },
  '1': {
    curveCenter: 4,
    curve: 390,
    delay: 0,
    fromZ: 3697,
    fromX: 25,
    fromY: -93,
    fromRotateX: 331,
    fromRotateY: 360,
    fromRotateZ: -257,
    toZ: 0,
    // toX: -18,
    // toY: -28,
    toRotateZ: -8,
    duration: '2s',
    easing: 'ease',
  },
  '2': {
    curveCenter: 3,
    curve: 1240,
    delay: 1700,
    fromZ: 27379,
    fromX: 2,
    fromY: -77,
    fromRotateX: 0,
    fromRotateY: 0,
    fromRotateZ: 0,
    toZ: 0,
    // toX: -3,
    // toY: -21,
    toRotateZ: 2,
    duration: '2s',
    easing: 'ease',
  },
  '3': {
    curveCenter: 1,
    curve: 300,
    delay: 1500,
    fromZ: 4303,
    fromX: -37,
    fromY: -100,
    fromRotateX: 360,
    fromRotateY: 360,
    fromRotateZ: 8,
    toZ: 0,
    // toX: -30,
    // toY: -9,
    toRotateZ: 2,
    duration: '2s',
    easing: 'ease',
  },
  '4': {
    curveCenter: 4,
    curve: 470,
    delay: 1571,
    fromZ: 1876,
    fromX: 65,
    fromY: 48,
    fromRotateX: 101,
    fromRotateY: 188,
    fromRotateZ: -200,
    toZ: 0,
    // toX: 24,
    // toY: -2,
    toRotateZ: 8,
    duration: '2s',
    easing: 'ease',
  },
};

export type PaperEnterAnimation = (typeof paperEnterAnimationOriginal)[0];
export const paperEnterAnimations = paperEnterAnimationOriginal as Record<
  any,
  PaperEnterAnimation
>;

/** Brief content */
const paperBriefs = {
  '0': (
    <div className={articleWrapper}>
      <article className={article}>
        <h1 className={title}>CÓMO: Ser más productivo con Ecodigital</h1>
        <p className={text}>
          “Con todo el tiempo que pasas viendo la televisión”, me dice, “ya podrías
          haber escrito una novela”. Es difícil no estar de acuerdo con el sentimiento...
        </p>
      </article>
    </div>
  ),
  '3': (
    <div className={articleWrapper}>
      <article className={article}>
        <h1 className={title}>Ecodigital: Redefiniendo la Gestión Médica</h1>
        <p className={text}>
          Ecodigital ha sido diseñado para transformar la manera en que los
          profesionales de la salud gestionan su práctica diaria. Una de las...
        </p>
      </article>
    </div>
  ),
  '2': (
    <div className={articleWrapper}>
      <article className={article}>
        <h1 className={title}>Aprendizaje y Práctica con Ecodigital</h1>
        <p className={text}>
          ¿Existen técnicas específicas para que el proceso de aprendizaje sea más efectivo?
        </p>
        <p className={text}>
          A menudo releemos o subrayamos materiales pensando que nos ayudará a aprender mejor...
        </p>
      </article>
    </div>
  ),
  '1': (
    <div className={articleWrapper}>
      <article className={article}>
        <h1 className={title}>
          Software Local-first
          <br />
          Tus datos te pertenecen, más allá de la nube
        </h1>
        <p className={text}>
          Las aplicaciones en la nube son populares porque permiten la colaboración
          en tiempo real. Sin embargo, al centralizar el almacenamiento...
        </p>
      </article>
    </div>
  ),
  '4': (
    <div className={articleWrapper}>
      <article className={article}>
        <h1 className={title}>Más es Diferente con Ecodigital</h1>
        <p className={text}>
          Simetría rota y la naturaleza de la estructura jerárquica de la ciencia
        </p>
        <p className={text}>
          La hipótesis reduccionista puede seguir siendo un tema de controversia,
          pero entre la gran mayoría de los científicos activos creo que se acepta...
        </p>
      </article>
    </div>
  ),
};

const contents = {
  '0': article0,
  '1': article1,
  '2': article2,
  '3': article3,
  '4': article4,
};

const states: Partial<Record<ArticleId, EdgelessSwitchState>> = {
  '0': {
    scale: 0.5,
    offsetX: -330,
    offsetY: -380,
  },
  '1': {
    scale: 0.4,
    offsetX: -330,
    offsetY: -500,
  },
  '2': {
    scale: 0.45,
    offsetX: 0,
    offsetY: -380,
  },
  '3': {
    scale: 0.4,
    offsetX: 100,
    offsetY: -320,
  },
  '4': {
    scale: 0.48,
    offsetX: 10,
    offsetY: -220,
  },
};

export const articles: Record<ArticleId, ArticleOption> = ids.reduce(
  (acc, id) => {
    return Object.assign(acc, {
      [id]: {
        id,
        location: paperLocations[id],
        enterOptions: paperEnterAnimations[id],
        brief: paperBriefs[id],
        blocks: contents[id],
        initState: states[id],
      } satisfies ArticleOption,
    });
  },
  {} as Record<ArticleId, ArticleOption>
);
