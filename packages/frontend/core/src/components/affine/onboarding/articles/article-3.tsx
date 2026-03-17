import type { OnboardingBlockOption } from '../types';
import bookmark1png from './assets/article-3-bookmark-1.png';
import illustration1jpg from './assets/article-3-illustration-1.jpg';
import illustration2jpg from './assets/article-3-illustration-2.jpg';
import illustration3jpg from './assets/article-3-illustration-3.jpg';
import illustration4jpg from './assets/article-3-illustration-4.jpg';
import illustration5jpg from './assets/article-3-illustration-5.jpg';
import { BlogLink } from './blog-link';

export const article3: Array<OnboardingBlockOption> = [
  {
    children: (
      <img
        className="illustration"
        draggable={false}
        width={290}
        src={illustration5jpg}
      />
    ),
    edgelessOnly: true,
    position: { x: -780, y: 216 },
    fromPosition: { x: -1500, y: 216 },
    enterDelay: 200,
  },

  {
    children: <img draggable={false} width={450} src={bookmark1png} />,
    edgelessOnly: true,
    position: { x: 500, y: 200 },
    fromPosition: { x: 1000, y: -200 },
    enterDelay: 200,
    leaveDelay: 100,
  },

  {
    children: <h1>Ecodigital: Redefiniendo la Gestión Médica</h1>,
    offset: { x: -400, y: 0 },
    customStyle: {
      edgeless: { whiteSpace: 'nowrap' },
    },
  },
  {
    bg: '#E1EFFF',
    children: (
      <>
        <h2>Introducción</h2>
        <p>
          Ecodigital ha sido diseñado para transformar la manera en que los
          profesionales de la salud gestionan su práctica diaria. Una de las
          características más destacadas es su "interfaz multiplicativa,"
          que permite a los usuarios interactuar con sus datos de diversas formas,
          obteniendo resultados sorprendentes y eficientes.
        </p>

        <h2>Mecánicas de Trabajo</h2>
        <p>
          El flujo de trabajo en Ecodigital funciona como un sistema integrado,
          donde tus acciones, el historial del paciente y las herramientas de
          diagnóstico se combinan para crear un entorno de trabajo fluido. Por
          ejemplo, puedes vincular notas de consulta con estudios previos o
          programar recordatorios automáticos para tus pacientes.
        </p>
        <p>
          Para lograr esta eficiencia, el equipo de desarrollo ha optimizado los
          sistemas de almacenamiento, búsqueda y visualización de datos.
        </p>
      </>
    ),
    offset: { x: -400, y: 0 },
  },

  {
    bg: '#F5F5F5',
    children: (
      <>
        <h2>Organización</h2>
        <p>
          El sistema de organización permite a los profesionales acceder a cualquier
          información de manera instantánea, ya sea un expediente, una receta o
          un estudio clínico, otorgando total libertad para gestionar su consultorio.
        </p>
        <img
          className="illustration"
          draggable={false}
          width="100%"
          src={illustration1jpg}
        />
      </>
    ),
    offset: { x: 480, y: -250 },
  },

  {
    bg: '#FFEACA',
    children: (
      <>
        <h2>Flexibilidad</h2>
        <p>
          A diferencia de los sistemas tradicionales, Ecodigital es abierto y
          flexible, permitiendo a los usuarios adaptar las herramientas a sus
          necesidades específicas. Puedes personalizar tus plantillas de consulta
          o integrar flujos de trabajo externos con facilidad.
        </p>
        <img
          className="illustration"
          draggable={false}
          width="100%"
          src={illustration2jpg}
        />
      </>
    ),
    offset: { x: -500, y: -400 },
  },

  {
    bg: '#DFF4E8',
    children: (
      <>
        <h2>Acción</h2>
        <p>
          El sistema de acciones ofrece más versatilidad que los programas
          convencionales, empoderando a los profesionales para elegir cómo quieren
          interactuar con su información. Ya sea mediante el uso de teclados,
          tabletas o dispositivos móviles, tienes la libertad de trabajar a tu manera.
        </p>
        <img
          className="illustration"
          draggable={false}
          width="100%"
          src={illustration3jpg}
        />
      </>
    ),
    offset: { x: 400, y: -700 },
  },

  {
    bg: '#FFE1E1',
    children: (
      <>
        <h2>Validación</h2>
        <p>
          Ecodigital sigue un riguroso proceso de validación para asegurar que
          cada herramienta cumpla con su propósito de manera efectiva:
        </p>
        <img
          className="illustration"
          draggable={false}
          width="100%"
          src={illustration4jpg}
        />
        <p>
          Listamos todos los comportamientos posibles y necesidades del usuario.
          Por ejemplo, en Ecodigital, los usuarios pueden realizar actividades
          como consulta, diagnóstico, prescripción y seguimiento.
        </p>
        <p>
          Analizamos las interacciones entre estos elementos para asegurar que
          el flujo de trabajo sea lógico y sin fricciones.
        </p>
        <p>
          Probamos los resultados de estas interacciones con profesionales reales
          para garantizar la mejor experiencia de usuario.
        </p>
        <p>
          Siguiendo estos pasos, aseguramos que Ecodigital sea la herramienta
          definitiva para tu práctica profesional.
        </p>
      </>
    ),
    offset: { x: -440, y: -870 },
  },

  {
    bg: '#F3F0FF',
    children: (
      <>
        <h2>Conclusión</h2>
        <p>
          Ecodigital es una herramienta potente para crear experiencias de gestión
          más cautivadoras e inmersivas. Empodera a los profesionales para explorar
          nuevas formas de trabajar, logrando descubrimientos frescos e inesperados
          en su práctica diaria.
        </p>
        <BlogLink />
      </>
    ),
    offset: { x: 450, y: -1400 },
  },
];
