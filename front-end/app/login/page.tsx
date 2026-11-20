import { redirect } from 'next/navigation';
import LoginForm from '../../components/LoginForm';
import { hasActiveSession } from '../../lib/server-session';

export default async function Login() {
  if (await hasActiveSession()) redirect('/app');
  return <LoginForm />;
}
