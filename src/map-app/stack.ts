
// A general purpose stack class
export class Stack<T> {
  private index: number = 0;
  private storage: T[] = [];

  constructor() {
  }

  append(obj: T) {
    // This implementation adds things to the very end, so the stack grows and grows:
    this.storage.push(obj);
    this.index = this.storage.length - 1;
  }

  current(): T | undefined {
    // returns undefined if the stack is empty
    return this.storage[this.index];
  }
  previous(): T | undefined {
    if (this.index > 0) {
      this.index--;
    }
    return this.current();
  }
  next(): T | undefined {
    if (this.index < this.storage.length - 1) {
      this.index++;
    }
    return this.current();
  }
  isAtStart(): boolean {
    return this.storage.length === 0 || this.index === 0;
  }
  isAtEnd(): boolean {
    return (
      this.storage.length === 0 || this.index === this.storage.length - 1
    );
  }
  gotoEnd(): void {
    this.index = this.storage.length-1;
  }
}
