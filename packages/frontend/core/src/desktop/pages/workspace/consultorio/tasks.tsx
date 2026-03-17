import { ConsultorioStubPage } from './consultorio-stub-page';

export const Component = () => {
  return (
    <ConsultorioStubPage
      title="Tareas"
      suggestedTemplates={[
        'Project Tracking Kanban',
        'Gantt Chart',
        'Project Planning',
      ]}
    />
  );
};
