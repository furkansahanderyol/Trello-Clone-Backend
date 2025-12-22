import { User } from '@prisma/client';
import passport from 'passport';
import { Strategy } from 'passport-google-oauth20';
import { prisma } from '../lib/prisma';

passport.use(
  new Strategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      const googleId = profile.id;
      const email = profile.emails?.[0].value;
      const name = profile.name;

      let user = await prisma.user.findFirst({
        where: {
          OR: [{ googleId: googleId }, { email: email! }],
        },
      });

      //If user already created account with email but not used Google auth.
      if (user && !user.googleId) {
        user = await prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: googleId,
            provider: 'google',
          },
        });
      }

      // If user tries to create account directly with Google auth.
      if (!user) {
        user = await prisma.user.create({
          data: {
            googleId: profile.id,
            email: email!,
            name: name?.givenName!,
            surname: name?.familyName!,
            provider: 'google',
            isVerified: true,
          },
        });
      }

      return done(null, user);
    },
  ),
);

// Choses witch data to write inside of session.
passport.serializeUser((user, done) => {
  done(null, user);
});

// Finds a user from database with info we passed in.
passport.deserializeUser((user: User, done) => {
  done(null, user);
});

export default passport;
