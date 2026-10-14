import CuentaForm from '../page';

export default async function EditCuentaPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  return <CuentaForm cuentaId={resolvedParams.id} />;
}
