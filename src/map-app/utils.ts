

type numberFn = (a: number|undefined|null, b: number|undefined|null) => number;
type numberAryFn = (array: Array<number|undefined|null>) => number;

const max: numberFn = (a, b) =>  Math.max(a ?? Number.NEGATIVE_INFINITY, b ?? Number.NEGATIVE_INFINITY);
const min: numberFn = (a, b) =>  Math.min(a ?? Number.POSITIVE_INFINITY, b ?? Number.POSITIVE_INFINITY);

/// Constructs a function which, given a numberFn, returns a numberAryFn
/// that essentally reduces the array but does so without leaking null or undefined
/// as a function based on Array.reduce would.
function reducer(fn: numberFn): numberAryFn {
  return (ary) => {
    let prev = fn(undefined, undefined);
    for(const item of ary) {
      prev = fn(prev, item);
    }
    return prev;
  }
}

export const arrayMax: numberAryFn = reducer(max);
export const arrayMin: numberAryFn = reducer(min);

