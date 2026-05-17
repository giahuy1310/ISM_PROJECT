'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthBackground, AuthFooterLinks, BRAND_NAME, UserAvatarStack } from '../shared-ui';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    const res = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (res?.error) {
      setError('Invalid email or password.');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center relative p-6 bg-surface font-body text-on-surface overflow-hidden">
      <AuthBackground />

      {/* Card */}
      <div className="z-10 w-full max-w-[1100px] grid grid-cols-1 md:grid-cols-2 rounded-xl overflow-hidden shadow-2xl bg-surface-container-lowest">
        {/* Left branding panel */}
        <div className="hidden md:flex flex-col justify-between p-12 bg-primary-container text-white relative">
          <div className="relative z-10">
            <h1 className="font-headline font-bold text-3xl tracking-tight mb-2">
              {BRAND_NAME}
            </h1>
            <div className="h-1 w-12 bg-tertiary-fixed-dim" />
          </div>
          <div className="relative z-10">
            <p className="font-headline text-2xl font-light leading-relaxed mb-6">
              Data is chaotic.<br />
              <span className="font-bold text-tertiary-fixed-dim">Precision</span> is your competitive edge.
            </p>
            <p className="text-on-primary-container text-sm leading-relaxed max-w-sm">
              Access the framework that curates complex supply chain metrics into actionable architectural insights.
            </p>
          </div>
          <div className="relative z-10 flex items-center gap-4">
            <UserAvatarStack
              avatarClassName="w-8 h-8 rounded-full border-2 border-primary-container bg-surface-container-high flex items-center justify-center"
              iconClassName="w-4 h-4 text-primary"
            />
            <span className="text-xs text-on-primary-container">Joined by 2k+ logistics experts</span>
          </div>
        </div>

        {/* Right form panel */}
        <div className="p-8 md:p-16 flex flex-col justify-center bg-surface-container-lowest">
          <div className="mb-10">
            <h2 className="font-headline font-extrabold text-2xl text-primary tracking-tight">
              System Login
            </h2>
            <p className="text-on-surface-variant text-sm mt-2">
              Enter your credentials to access the command center.
            </p>
          </div>

          <form className="space-y-6" onSubmit={handleSubmit}>
            {/* Email */}
            <div className="space-y-2">
              <label
                className="block text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant"
                htmlFor="email"
              >
                Corporate Email
              </label>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary">
                  <MailIcon />
                </span>
                <input
                  id="email"
                  name="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-low border-none rounded-lg focus:ring-0 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline font-medium outline-none"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label
                  className="block text-xs font-label font-bold uppercase tracking-widest text-on-surface-variant"
                  htmlFor="password"
                >
                  Security Key
                </label>
                <a href="#" className="text-xs font-semibold text-secondary hover:text-primary transition-colors">
                  Forgot Password?
                </a>
              </div>
              <div className="relative group">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-outline transition-colors group-focus-within:text-primary">
                  <LockIcon />
                </span>
                <input
                  id="password"
                  name="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-12 pr-4 py-3 bg-surface-container-low border-none rounded-lg focus:ring-0 focus:bg-surface-container-lowest transition-all text-on-surface placeholder:text-outline font-medium outline-none"
                />
              </div>
            </div>

            {/* Error message */}
            {error && (
              <p className="text-error text-sm font-medium">{error}</p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="ui-bubble-button w-full bg-primary-container text-white py-4 rounded-lg font-headline font-bold text-sm tracking-wide hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading ? 'Signing in…' : 'Sign In'}
              <ArrowIcon />
            </button>
          </form>

          {/* Divider */}
          <div className="relative my-10 flex items-center">
            <div className="flex-grow border-t border-outline-variant/30" />
            <span className="px-4 text-[10px] font-bold uppercase tracking-[0.2em] text-outline">
              New here?
            </span>
            <div className="flex-grow border-t border-outline-variant/30" />
          </div>

          <p className="text-center text-sm text-on-surface-variant">
            New to the framework?{' '}
            <Link
              href="/register"
              className="ui-bubble-button inline-flex items-center rounded-md px-2 py-1 font-bold text-primary hover:underline decoration-tertiary-fixed-dim decoration-2 underline-offset-4 transition-all ml-1"
            >
              Create an account
            </Link>
          </p>
        </div>
      </div>

      {/* Footer */}
      <AuthFooterLinks
        containerClassName="fixed bottom-0 w-full flex justify-center pb-8 z-20 pointer-events-none"
        linksWrapperClassName="flex space-x-8 pointer-events-auto bg-surface-container-low/50 backdrop-blur-md px-6 py-2 rounded-full"
        linkClassName="text-[10px] tracking-wide uppercase text-slate-500 hover:text-slate-300 transition-all"
      />
    </main>
  );
}

function MailIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={1.5} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
    </svg>
  );
}
