import { getShipModeStats } from '../dashboard/analytics-api';
import { ShipmentsView } from './_components/ShipmentsView';

export default async function ShipmentsPage() {
  const stats = await getShipModeStats({}).catch(() => []);
  return <ShipmentsView initialStats={stats} />;
}
