'use client';

import { useState, FormEvent } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AuthBackground, AuthFooterLinks, BRAND_NAME, UserAvatarStack } from '../shared-ui';

export default function RegisterPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    if (!agreed) {
      setError('You must agree to the Terms of Service.');
      return;
    }

    setLoading(true);

    const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, password }),
    });

    if (!res.ok) {
      const data = await res.json() as { message?: string };
      setError(data.message ?? 'Registration failed. Please try again.');
      setLoading(false);
      return;
    }

    // Auto sign-in after registration
    const signInRes = await signIn('credentials', {
      email,
      password,
      redirect: false,
    });

    setLoading(false);

    if (signInRes?.error) {
      router.push('/login');
      return;
    }

    router.push('/dashboard');
  }

  return (
    <main className="min-h-screen flex items-center justify-center relative p-6 bg-surface font-body text-on-surface overflow-hidden">
      <AuthBackground />
      <div className="z-10 w-full max-w-[1100px] grid grid-cols-1 md:grid-cols-2 rounded-xl overflow-hidden shadow-2xl bg-surface-container-lowest">
        {/* Left panel */}
        <div className="hidden md:flex architectural-gradient p-12 flex-col justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center space-x-3 mb-12">
              <ArchitectureIcon />
              <h1 className="font-headline font-extrabold tracking-tight text-white text-2xl uppercase">
                {BRAND_NAME}
              </h1>
            </div>
            <div className="space-y-6">
              <h2 className="font-headline text-4xl font-bold text-white leading-tight">
                The Precision <br /> Curator for Global <br /> Supply Chains.
              </h2>
              <p className="text-on-primary-container text-lg max-w-md">
                Join the framework that treats data as an editorial masterpiece. Curate insights, optimize logistics, and command your enterprise with architectural precision.
              </p>
            </div>
          </div>
          <div className="relative z-10">
            <div className="flex items-center space-x-4 mb-4">
              <UserAvatarStack
                avatarClassName="w-10 h-10 rounded-full border-2 border-primary-container bg-surface-container-high flex items-center justify-center"
                iconClassName="w-5 h-5 text-primary"
              />
              <span className="text-on-primary-container text-sm font-medium">
                Trusted by 500+ global enterprises
              </span>
            </div>
          </div>
          {/* Abstract bg element */}
          <div className="absolute bottom-0 right-0 w-full h-full opacity-10 pointer-events-none">
            <div className="w-full h-full bg-gradient-to-br from-primary-fixed to-transparent" />
          </div>
        </div>

        {/* Right form panel */}
        <div className="bg-surface-container-lowest p-8 md:p-16 flex flex-col justify-center">
          {/* Mobile logo */}
          <div className="mb-10 md:hidden flex items-center space-x-2">
            <ArchitectureIcon />
            <span className="font-headline font-extrabold tracking-tight text-primary text-xl uppercase">
              {BRAND_NAME}
            </span>
          </div>

          <div className="max-w-md mx-auto w-full">
            <header className="mb-8">
              <h3 className="font-headline text-3xl font-bold text-on-surface tracking-tight mb-2">
                Create Account
              </h3>
              <p className="text-on-surface-variant font-medium">
                Start orchestrating your intelligence today.
              </p>
            </header>

            <form className="space-y-5" onSubmit={handleSubmit}>
              {/* Full Name */}
              <div className="space-y-1.5">
                <label
                  className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                  htmlFor="full-name"
                >
                  Full Name
                </label>
                <input
                  id="full-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Alexander Wright"
                  className="w-full bg-surface-container-low border-none rounded-lg p-3.5 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none"
                />
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <label
                  className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                  htmlFor="work-email"
                >
                  Work Email
                </label>
                <input
                  id="work-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@company.ai"
                  className="w-full bg-surface-container-low border-none rounded-lg p-3.5 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none"
                />
              </div>

              {/* Password + Confirm */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-1.5">
                  <label
                    className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                    htmlFor="reg-password"
                  >
                    Password
                  </label>
                  <input
                    id="reg-password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-surface-container-low border-none rounded-lg p-3.5 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label
                    className="block text-xs font-bold uppercase tracking-widest text-on-surface-variant"
                    htmlFor="confirm-password"
                  >
                    Confirm Password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    required
                    value={confirm}
                    onChange={(e) => setConfirm(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full bg-surface-container-low border-none rounded-lg p-3.5 text-on-surface placeholder:text-outline focus:ring-1 focus:ring-primary focus:bg-surface-container-lowest transition-all outline-none"
                  />
                </div>
              </div>

              {/* Terms */}
              <div className="flex items-start space-x-3 pt-2">
                <input
                  id="terms"
                  type="checkbox"
                  checked={agreed}
                  onChange={(e) => setAgreed(e.target.checked)}
                  className="h-4 w-4 mt-0.5 rounded border-outline-variant accent-primary"
                />
                <label htmlFor="terms" className="text-sm text-on-surface-variant font-medium">
                  I agree to the{' '}
                  <a href="#" className="text-primary hover:underline decoration-1 underline-offset-4">
                    Terms of Service
                  </a>{' '}
                  and{' '}
                  <a href="#" className="text-primary hover:underline decoration-1 underline-offset-4">
                    Privacy Policy
                  </a>.
                </label>
              </div>

              {/* Error */}
              {error && (
                <p className="text-error text-sm font-medium">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-primary-container text-on-primary py-4 rounded-lg font-headline font-bold text-base hover:bg-primary transition-colors mt-6 shadow-sm disabled:opacity-60"
              >
                {loading ? 'Creating account…' : 'Create Account'}
              </button>
            </form>

            <footer className="mt-10 pt-8 border-t border-outline-variant/15 text-center">
              <p className="text-on-surface-variant font-medium">
                Already have an account?{' '}
                <Link
                  href="/login"
                  className="text-primary font-bold hover:underline underline-offset-4 ml-1"
                >
                  Login here
                </Link>
              </p>
            </footer>
          </div>
        </div>
      </div>

      {/* Footer links */}
      <AuthFooterLinks
        containerClassName="fixed bottom-0 w-full flex justify-center pb-8 bg-transparent z-10"
        linksWrapperClassName="flex space-x-8"
        linkClassName="text-xs tracking-wide uppercase text-slate-400 hover:underline"
      />
    </main>
  );
}

function ArchitectureIcon() {
  return (
    <svg className="w-8 h-8 text-primary-fixed" fill="currentColor" viewBox="0 0 24 24">
      <path d="M2 20h2v-4h3v4h2v-7l-3.5-3L2 13v7zm8 0h2v-9h3v9h2V9l-5-5-5 5v5h3V20zm10 0h2v-4h-2v4z" />
    </svg>
  );
}
