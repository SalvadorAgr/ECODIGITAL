import clsx from 'clsx';

import { CounterNote } from '../switch-widgets/counter-note';
import { PageLink } from '../switch-widgets/page-link';
import type { OnboardingBlockOption } from '../types';
import bookmark1png from './assets/article-1-bookmark-1.png';
import illustration1png from './assets/article-1-illustration-1.png';
import Article1Illustration2 from './assets/article-1-illustration-2';
import { hr, link, quote } from './blocks.css';
import { BlogLink } from './blog-link';

export const article1: Array<OnboardingBlockOption> = [
  {
    children: <h1>Software Local-first con Ecodigital</h1>,
    offset: { x: -600, y: 0 },
  },
  {
    bg: '#F5F5F5',
    children: (
      <>
        <h2>Privacidad y Control Total</h2>
        <h3>Tus datos te pertenecen, más allá de la nube</h3>
        <p>
          Las aplicaciones en la nube son populares porque permiten la colaboración
          en tiempo real. Sin embargo, al centralizar el almacenamiento, estas apps
          suelen quitarle la propiedad y el control a los usuarios.{' '}
          <b>
            En Ecodigital, si el servicio se interrumpe, el software sigue funcionando
            y tus datos permanecen seguros en tu dispositivo.
          </b>
        </p>
      </>
    ),
    offset: { x: -570, y: 80 },
    sub: {
      children: (
        <CounterNote
          index={1}
          width={500}
          label="Ecodigital garantiza la propiedad de los datos y la continuidad del trabajo sin depender de la conexión."
          animationDelay={300}
          color="#E660A4"
        />
      ),
      edgelessOnly: true,
      enterDelay: 300,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    bg: '#F3F0FF',
    children: (
      <>
        <img draggable={false} width="100%" src={bookmark1png} />
        <p className={clsx(quote)}>
          Ecodigital utiliza tecnología de vanguardia para asegurar que la
          colaboración sea fluida pero siempre privada y bajo tu control.
        </p>
        <p>
          En este recorrido exploraremos los principios del <PageLink>software local-first</PageLink>{' '}
          que hacen de Ecodigital la herramienta más segura para tu consultorio.
        </p>
      </>
    ),
    offset: { x: -570, y: 200 },
    sub: {
      children: (
        <CounterNote
          index={2}
          width={300}
          label="El enfoque local-first prioriza la colaboración, la propiedad y el control de datos."
          animationDelay={600}
          color="#E660A4"
        />
      ),
      edgelessOnly: true,
      enterDelay: 600,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    bg: '#DFF4F3',
    children: (
      <>
        <p>
          Utilizamos estructuras de datos avanzadas (CRDTs) que permiten el uso
          multiusuario desde su base, siendo fundamentalmente locales y privadas.
          Esto significa que puedes trabajar con tu equipo sin exponer información
          sensible a terceros de manera innecesaria.
        </p>
        <hr className={hr} />
        <p>
          Ecodigital ha sido diseñado para ser robusto en la práctica, explorando
          soluciones de interfaz que facilitan la gestión médica y administrativa
          sin complicaciones técnicas para el usuario final.
        </p>
      </>
    ),
    offset: { x: 290, y: -140 },
    sub: {
      children: (
        <CounterNote
          index={3}
          width={300}
          label="Seguridad avanzada y privacidad por diseño en cada interacción."
          animationDelay={900}
          color="#E660A4"
        />
      ),
      edgelessOnly: true,
      enterDelay: 900,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    bg: '#FFF4D8',
    children: (
      <>
        <p>
          Este sistema está optimizado para el manejo de expedientes clínicos y
          documentación sensible, cumpliendo con los más altos estándares de
          seguridad digital.
        </p>
        <p className={clsx(quote)}>
          Ecodigital: Tu consultorio digital, seguro y eficiente.
          Diseñado para profesionales que valoran la privacidad de sus pacientes.
        </p>

        <p>
          Agradecemos tu confianza en Ecodigital para la gestión de tu práctica profesional.
        </p>
      </>
    ),
    offset: { x: 350, y: -850 },
  },

  {
    bg: '#E1EFFF',
    children: (
      <>
        <h2>Contenidos del Sistema</h2>
        <h3>
          Gestión integral y propiedad de la información.
          <br />
          Los pilares de Ecodigital
        </h3>

        <ol>
          <li>Sin esperas: tu trabajo siempre disponible</li>
          <li>
            <a className={link}>Tus datos no están atrapados en un solo dispositivo</a>
          </li>
          <li>
            <PageLink>La red es opcional para el trabajo diario</PageLink>
          </li>
          <li>Colaboración fluida con tu equipo médico</li>
          <li>
            <PageLink>Disponibilidad a largo plazo</PageLink>
          </li>
          <li>Seguridad y privacidad por defecto</li>
          <li>Tú conservas la propiedad y el control total</li>
        </ol>

        <h3>Modelos de gestión eficientes</h3>
        <ul>
          <li>Arquitectura centrada en la experiencia del usuario</li>
          <li>Infraestructura robusta para el manejo de datos</li>
        </ul>

        <h3>Hacia un futuro digital seguro</h3>
        <ul>
          <li>Tecnología local-first como base</li>
          <li>Herramientas diseñadas para el sector salud</li>
          <li>Soporte continuo y actualizaciones</li>
        </ul>
      </>
    ),
    offset: { x: 300, y: -250 },
    customStyle: { edgeless: { width: 500 } },
    sub: {
      children: (
        <CounterNote
          index={4}
          width={400}
          label="Ideales, seguridad, colaboración y control total de tu consultorio."
          animationDelay={1200}
          color="#E660A4"
        />
      ),
      edgelessOnly: true,
      enterDelay: 1200,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    bg: '#FFE1E1',
    children: (
      <>
        <h3>Motivación: Colaboración y Propiedad</h3>
        <p>
          Es increíble lo fácil que podemos colaborar hoy en día. En Ecodigital,
          llevamos esa facilidad al entorno médico, permitiendo que tú y tu equipo
          gestionen citas, historiales y documentos de manera conjunta y segura.
        </p>
        <p>
          A medida que inviertes más tiempo en Ecodigital, la información se vuelve
          más valiosa. Por eso, nos aseguramos de que esa inversión esté protegida
          y siempre bajo tu mando, sin dependencias externas críticas.
        </p>
        <p>
          Entendemos el valor emocional y profesional de tu trabajo. Cada expediente
          y cada nota es fruto de tu esfuerzo, y merece el mejor resguardo digital.
        </p>
        <BlogLink />
      </>
    ),
    offset: { x: 900, y: -950 },
    sub: {
      children: (
        <CounterNote
          index={5}
          width={400}
          label="Beneficios de la colaboración segura y el valor de tu información profesional."
          animationDelay={1500}
          color="#E660A4"
        />
      ),
      edgelessOnly: true,
      enterDelay: 1500,
      position: {},
      style: { bottom: 'calc(100% + 20px)', left: -40 },
    },
  },

  {
    children: <img width={784} draggable={false} src={illustration1png} />,
    edgelessOnly: true,
    position: { x: -600, y: 1000 },
    fromPosition: { x: -1000, y: 1500 },
    enterDelay: 250,
  },

  {
    children: <Article1Illustration2 />,
    edgelessOnly: true,
    position: { x: 1200, y: 500 },
    fromPosition: { x: 1800, y: -100 },
    enterDelay: 200,
  },
];
