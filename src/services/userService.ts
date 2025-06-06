import bcrypt from 'bcrypt';
import { boolean } from 'zod';

export class userService {
  name: string;
  surname: string;
  email: string;
  password: string;

  constructor(name: string, surname: string, email: string, password: string) {
    this.name = name;
    this.surname = surname;
    this.email = email;
    this.password = password;
  }

  static async login(email: string, password: string) {
    const hashedPassword = bcrypt.hashSync(password, 10);

    return { email: email, password: hashedPassword };
  }

  static async register(name: string, surname: string, email: string, password: string) {
    const hashedPassword = bcrypt.hashSync(password, 10);

    return {
      name: name,
      surname: surname,
      email: email,
      password: hashedPassword,
    };
  }
}
