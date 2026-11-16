import { redirect } from 'next/navigation';
import { isAuthed } from '@/lib/auth';
import LoginForm from './LoginForm';

export const metadata = { title: 'Sign in · Bapa Sitaram' };
export const dynamic = 'force-dynamic';

export default async function Login() {
  if (await isAuthed()) redirect('/');
  return (
    <main className="login">
      <div className="login-box">
        <div className="hero">
          <svg viewBox="0 0 120 120" aria-hidden="true">
            <defs><linearGradient id="lg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f0d08f" /><stop offset="1" stopColor="#a9772c" /></linearGradient></defs>
            <circle cx="60" cy="60" r="38" fill="none" stroke="#f4efe6" strokeWidth="7" />
            <circle cx="60" cy="60" r="15" fill="url(#lg)" />
          </svg>
          <h1>Bapa Sitaram</h1>
          <p>Restaurant billing · sign in to continue</p>
        </div>
        <LoginForm />
      </div>
    </main>
  );
}
