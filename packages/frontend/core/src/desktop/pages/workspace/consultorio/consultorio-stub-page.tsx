import {
  ViewBody,
  ViewHeader,
  ViewTitle,
} from '@affine/core/modules/workbench';

import { ConsultorioGuard, useConsultorioRole } from './consultorio-guard';

const templateCatalog = [
  '5W2H',
  'Concept Map',
  'Flowchart',
  'SMART',
  'SWOT',
  '4P Marketing Matrix',
  'Storyboard',
  'User Journey Map',
  'Business Proposal',
  'Data Analysis',
  'Simple Presentation',
  'Fishbone Diagram',
  'Gantt Chart',
  'Monthly Calendar',
  'Project Planning',
  'Project Tracking Kanban',
] as const;

type BuiltInTemplateName = (typeof templateCatalog)[number];

export function ConsultorioStubPage({
  title,
  requireAdmin,
  suggestedTemplates,
  hidePlaceholder,
}: {
  title: string;
  requireAdmin?: boolean;
  suggestedTemplates?: BuiltInTemplateName[];
  hidePlaceholder?: boolean;
}) {
  const role = useConsultorioRole();

  return (
    <ConsultorioGuard requireAdmin={requireAdmin}>
      <ViewTitle title={title} />
      <ViewHeader>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 600 }}>{title}</h1>
          <span style={{ opacity: 0.7, fontSize: 12 }}>Role: {role}</span>
        </div>
      </ViewHeader>
      <ViewBody>
        {hidePlaceholder ? null : (
          <div style={{ opacity: 0.8, padding: '12px 0' }}>
            {'Vista en integracion (sin quitar nada de lo existente).'}
          </div>
        )}

        {suggestedTemplates?.length ? (
          <div style={{ padding: '8px 0' }}>
            <div style={{ fontSize: 12, opacity: 0.75, marginBottom: 8 }}>
              Plantillas sugeridas (incluidas en el proyecto)
            </div>
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: 8,
                opacity: 0.95,
              }}
            >
              {suggestedTemplates.map(name => (
                <div
                  key={name}
                  style={{
                    padding: '6px 10px',
                    borderRadius: 8,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'rgba(255,255,255,0.04)',
                    fontSize: 12,
                  }}
                >
                  {name}
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </ViewBody>
    </ConsultorioGuard>
  );
}
