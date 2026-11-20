import { redirect } from 'next/navigation';
import Workspace from '../../../components/Workspace';
import { getSession } from '../../../lib/server-session';
export const dynamic = 'force-dynamic';
export default async function PrivatePage({ params }: { params: Promise<{ section?: string[] }> }) {
  const session = await getSession();
  if (!session) redirect('/login');
  const section = (await params).section?.[0] || 'overview';
  return <Workspace user={session.user} csrfToken={session.csrfToken} section={section} />;
}
