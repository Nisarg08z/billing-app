import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';
import { getState } from '@/lib/data';
import BillingApp from '@/components/BillingApp';

export const dynamic = 'force-dynamic';

export default async function Home() {
  if (!(await isAuthed())) redirect('/login');
  // Bills from the last 30 hours always cover "today" in the phone's time zone; the phone filters them
  const now = Date.now();
  let initial = null, error = null;
  try { initial = { ...(await getState(now - 36e5 * 30)), loadedAt: now }; }
  catch (e) { console.error(e); error = 'Could not reach the database. Check MONGODB_URI and that MongoDB Atlas allows this server\'s IP address.'; }
  if (error) return <main className="login"><div className="login-box card pad" style={{ textAlign: 'center' }}><h2 className="serif">Database not reachable</h2><p style={{ color: 'var(--mute)' }}>{error}</p></div></main>;
  return <BillingApp initial={initial} />;
}
