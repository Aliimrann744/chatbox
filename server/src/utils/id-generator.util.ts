export class IdGenerator {
  static generateObjectId(): string {
    const timestamp = Math.floor(new Date().getTime() / 1000).toString(16);
    const random = Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    return timestamp + random;
  }

  static generate24CharId(): string {
    return this.generateObjectId();
  }
}
