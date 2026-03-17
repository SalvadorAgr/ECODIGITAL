import {
  ViewBody,
  ViewHeader,
  ViewTitle,
} from '@affine/core/modules/workbench';

import { ConsultorioGuard, useConsultorioRole } from './consultorio-guard';

export function ConsultorioStubPage({
  title,
  requireAdmin,
}: {
  title: string;
  requireAdmin?: boolean;
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
        <div style={{ opacity: 0.8, padding: '12px 0' }}>
          {'Vista en integracion (sin quitar nada de lo existente).'}
        </div>
      </ViewBody>
    </ConsultorioGuard>
  );
}
