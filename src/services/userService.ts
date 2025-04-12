import bcrypt from 'bcrypt';

export class userService {
  email: string;
  password: string;

  constructor(email: string, password: string) {
    this.email = email;
    this.password = password;
  }

  static login(email: string, password: string) {
    const hashedPassword = bcrypt.hashSync(password, 10);

    return { email: email, password: hashedPassword };
  }
}
