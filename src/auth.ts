import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

const resolvedAuthSecret =
  process.env.AUTH_SECRET ??
  process.env.NEXTAUTH_SECRET ??
  (process.env.NODE_ENV === 'development' ? 'dev-only-auth-secret' : undefined);

export const { handlers, auth, signIn, signOut } = NextAuth({
  secret: resolvedAuthSecret,
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      authorize: async (credentials) => {
        // TODO: remove before production
        if (credentials.email === 'admin@test.com' && credentials.password === 'admin123') {
          return { id: '0', email: 'admin@test.com', role: 'admin', accessToken: 'test-token' };
        }

        const res = await fetch(`${process.env.BACKEND_URL}/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: credentials.email,
            password: credentials.password,
          }),
        });

        if (!res.ok) return null;

        const data = await res.json() as { access_token: string; user: { id: number; email: string; role: string } };
        return {
          id: String(data.user.id),
          email: data.user.email,
          role: data.user.role,
          accessToken: data.access_token,
        };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = (user as { role?: string }).role;
        token.accessToken = (user as { accessToken?: string }).accessToken;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        (session.user as { role?: string }).role = token.role as string;
        (session as { accessToken?: string }).accessToken = token.accessToken as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
  session: { strategy: 'jwt' },
});
