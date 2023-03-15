
// A general purpose stack class
export class Stack<T> {
  private index: number = 0; // Should never be negative
  private storage: T[] = [];

  constructor() {
  }

  // Add an item to the stack, so that it is the last item in the
  // stack.
  //
  // In other words, this removes any forward entries higher than the
  // index. This is the normal behaviour for an undo stack!  If you
  // undo, then redo, this means the forward history gets cleared.
  //
  // After a push, .isAtEnd() will always be true.
  //
  push(obj: T) {
    // When length == 0 and index == 0, or more generally:
    if (this.storage.length <= this.index)
      this.storage.length = this.index+1; //truncates storage
    else
      this.index += 1; // usual case

    this.storage[this.index] = obj; // sets storage.length to index+1
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
