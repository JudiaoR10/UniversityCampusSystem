import { FormEvent, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { ApiClientError } from '@smart-campus/api-client';
import { useAuth } from '../lib/auth';
import { BrandMark } from '../components/BrandMark';

export function LoginPage() {
  const { user, login, loading } = useAuth();
  const [email, setEmail] = useState('admin@smartcampus.demo');
  const [password, setPassword] = useState('Admin123!');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!loading && user) return <Navigate to="/ops" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
      } else if (err instanceof TypeError) {
        setError('API indisponível. Abra /health da API, aguarde ~60s (cold start) e tente de novo.');
      } else {
        setError('Falha no login');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div
        className="absolute inset-0 scale-105 bg-cover bg-center"
        style={{
          backgroundImage:
            "url(https://images.unsplash.com/photo-1541339907198-e08756dedf3f?auto=format&fit=crop&w=2000&q=80)",
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-br from-[#0b1c31]/93 via-[#12304a]/78 to-[#1a6b5c]/55" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.12),transparent_35%)]" />

      <div className="relative mx-auto flex min-h-screen min-h-[100dvh] max-w-6xl flex-col justify-center px-4 py-8 sm:px-8 sm:py-12">
        <div className="grid items-center gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:gap-12">
          <div className="login-rise order-2 text-white lg:order-1">
            <div className="text-white">
              <BrandMark />
            </div>
            <h1 className="mt-6 max-w-xl font-display text-3xl font-semibold leading-[1.08] tracking-tight sm:mt-10 sm:text-5xl lg:text-6xl">
              Um campus que pensa consigo.
            </h1>
            <p className="mt-3 max-w-lg text-sm leading-relaxed text-white/80 sm:mt-5 sm:text-base lg:text-lg">
              Entre na plataforma académica da Universidade Joaquim Alberto Chissano — espaço comum para
              aprendizagem, operações e inovação.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {['Mapa do D2', 'Gémeo 3D', 'Aulas e notas', 'IoT ao vivo'].map((item) => (
                <span key={item} className="rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white/90">
                  {item}
                </span>
              ))}
            </div>
          </div>

          <form
            onSubmit={onSubmit}
            className="login-rise-delay order-1 rounded-2xl border border-white/25 bg-white/95 p-5 shadow-panel backdrop-blur-md sm:rounded-3xl sm:p-8 lg:order-2"
          >
            <p className="eyebrow">Acesso académico</p>
            <h2 className="mt-2 font-display text-2xl font-semibold text-campus-ink sm:text-3xl">Bem-vindo</h2>
            <p className="mt-2 text-sm text-campus-deep/70">
              Use as credenciais de demonstração do README para explorar o Core.
            </p>

            <label className="mt-7 block text-sm font-medium text-campus-ink">
              Email institucional
              <input
                className="field-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                required
                autoComplete="username"
              />
            </label>

            <label className="mt-4 block text-sm font-medium text-campus-ink">
              Password
              <input
                className="field-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type="password"
                required
                autoComplete="current-password"
              />
            </label>

            {error ? <p className="mt-4 alert-error">{error}</p> : null}

            <button type="submit" disabled={submitting} className="btn-primary mt-7 w-full">
              {submitting ? 'A autenticar…' : 'Entrar no campus'}
            </button>

            <p className="mt-5 text-center text-xs text-campus-deep/55">UJAC · PTP III · Smart Campus Core</p>
          </form>
        </div>
      </div>
    </div>
  );
}
