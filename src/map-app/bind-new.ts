
// This adapts some type magick from here:
// https://stackoverflow.com/questions/32807163/call-constructor-on-typescript-class-without-new

// This defines a function which accepts a class, and returns a shim function
// which calls its constructor.
declare function BindNew<
  C extends { new(...args: A): T },
  A extends any[],
  T>(
    klass: { new(...args: A): T }
  ): ((...args: A) => T); // The constructor shim

// Unfortunately, AIUI, that's not really possible to do in TS
// at least in a type-safe way... But it is possible to do in plain JS,
// and we can do it in TS if we ignore the types:
function _bindNew(klass: any) {
  return (...args: any[]) => new klass(...args);
}

// Then we can coerce that into the right type, and Bingo:

// A function which can bind a Class constructor, returning a function with the same parameters
// which creates an instance of that class.
export const bindNew = _bindNew as typeof BindNew;

/* Usage:
class Foo {
  constructor(readonly foo: string) {}
}

const mkFoo = bindNew(Foo);  // mkFoo is type (foo: string) => Foo
const aFoo = mkFoo('hello'); // aFoo is type Foo

console.log(aFoo.foo); // "hello"
*/
