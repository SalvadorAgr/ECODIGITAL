import { ConsultorioStubPage } from './consultorio-stub-page';

export const Component = () => {
  return (
    <ConsultorioStubPage
      title="Archivos"
      suggestedTemplates={[
        'Flowchart',
        'Business Proposal',
        'Simple Presentation',
      ]}
    />
  );
};
