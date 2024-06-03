import { assert } from "./utils";

/// Represents an undoable action, with type-dependent attributes,
/// which changes the previous state S' -> S via an action Action<S>.
export class StateChange<S, C> {
  constructor(
    readonly action: C,
    readonly result: S,
  ) {}
}


/// A stack with a pointer which can be moved back and forward through the items.
///
/// Push occurs at the pointer, and drops all items after the current item.
///
/// An initial stack item must always be present at the first position
/// - this guarantees there is always an item to inspect, and reduces
/// the defenisive programming required.
export class WalkableStack1<T> {
  private index: number = 0; // Should never be negative
  private storage: T[]; // Should  always have > 0 entries

  constructor(initial: T) {
    this.storage = [initial];
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
    assert(this.index >= 0, "index should never be negative")
    assert(this.storage.length > this.index, "storage should always have the initial state element");
    
    this.index += 1;
    this.storage[this.index] = obj;
    
    // remove later items from the stack
    this.storage.length = this.index + 1; 
  }

  // Get the current item in the stack
  get current(): T {
    assert(this.index >= 0, "index should never be negative")
    assert(this.storage.length > this.index, "storage should always have the initial state element");
    
    return this.storage[this.index];
  }

  // Set the current item in the stack
  set current(obj: T) {
    this.storage[this.index] = obj;
  }

  // Move the current item to the previous item (unless there isn't one, in which case do nothing)
  back(): void {
    assert(this.storage.length > this.index, "storage should always have the initial state element");
    if (this.index > 0)
      this.index -= 1;
  }

  // Move the current item to the next item (unless there isn't one, in which case do nothing)
  forward(): void {
    assert(this.storage.length > this.index, "storage should always have the initial state element");
    if (this.index < this.storage.length - 1)
      this.index += 1;
  }

  // Check if we have any previous items
  isAtStart(): boolean {
    return this.index === 0;
  }

  // Check if we have any next items
  isAtEnd(): boolean {
    return this.index >= this.storage.length - 1
  }

  // Empty the stack and go to the first item
  clear(): void {
    this.index = 0;
    this.storage.length = 1; 
  }
}

// An application undo stack class
export class UndoStack<State, Change> extends WalkableStack1<StateChange<State, Change | undefined>> {
  constructor(initial: State) {
    super(new StateChange(undefined, initial));
  }
}
