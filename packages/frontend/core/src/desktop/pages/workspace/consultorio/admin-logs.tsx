import { ConsultorioStubPage } from './consultorio-stub-page';

export const Component = () => {
  return (
    <ConsultorioStubPage
      title="Registros"
      requireAdmin
      suggestedTemplates={['Data Analysis', 'Fishbone Diagram', '5W2H']}
    />
  );
};
