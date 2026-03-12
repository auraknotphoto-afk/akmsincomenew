import type { NextAuthOptions } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';

const appLoginUsername = process.env.APP_LOGIN_USERNAME || 'admin';
const appLoginPassword = process.env.APP_LOGIN_PASSWORD || 'admin123';
const appLoginUserId =
  process.env.APP_LOGIN_USER_ID || '00000000-0000-0000-0000-000000000001';

export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      id: 'basic-login',
      name: 'Username Password',
      credentials: {
        username: { label: 'Username', type: 'text' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.username || !credentials?.password) {
          throw new Error('Username and password required');
        }

        if (
          credentials.username !== appLoginUsername ||
          credentials.password !== appLoginPassword
        ) {
          throw new Error('Invalid username or password');
        }

        return {
          id: appLoginUserId,
          phone: credentials.username,
          name: credentials.username,
        };
      },
    }),
  ],
  pages: {
    signIn: '/auth/login',
    signOut: '/auth/logout',
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.phone = user.phone;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.phone = token.phone as string;
      }
      return session;
    },
  },
  session: {
    strategy: 'jwt',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  jwt: {
    secret: process.env.NEXTAUTH_SECRET,
  },
};
