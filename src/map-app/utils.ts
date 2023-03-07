import { Box2d, Point2d } from "./common-types";

/// A function which aggregates an array of numbers (or null/undefined) into a single number.
export type numberAryFn = (array: Array<number|undefined|null>) => number | undefined;

/// Returns the largest of an array if numbers - non-numbers get converted to negative infinity.
export const arrayMax: numberAryFn = (ary) => ary.reduce<number|undefined>((a, b) => highest(a, b), undefined);

/// Returns the smallest of an array if numbers - non-numbers get converted to positive infinity.
export const arrayMin: numberAryFn = (ary) => ary.reduce<number|undefined>((a, b) => lowest(a, b), undefined);

/// Predicate which checks whether x is a booleans
export const isBool = (x: unknown): x is boolean => typeof x === 'boolean';

/// Predicate which checks whether x is a string
export const isString = (x: unknown): x is string => typeof x === 'string';

/// Converts anything not an actual string into the default value y (which itself defaults to the empty string)
export const toString = <T = string>(x: unknown, y: T|string = ''): string|T => typeof x === 'string'? x : y;

/// Removes any NaN value from x, replaces it with a default value y (which itself defaults to 0) 
export const toYesANumber = <T = number>(x: number, y: T|number = 0) => isNaN(x) ? y : x ;

/// Predicate which checks whether x is a number
export const isNumber = (x: unknown): x is number => typeof x === 'number';

/// Predicate which checks whether x is a number
export const yesANumber = (x: unknown): x is number => typeof x === 'number' && !isNaN(x);

/// Converts anything not an actual number (including NaNs) into the default value y (which itself defaults to 0)
export function toNumber<T = number>(x: unknown, y: T|number = 0): number|T {
  switch(typeof x) {
    case 'number': return toYesANumber(x, y);
    case 'string':return toYesANumber(Number.parseFloat(x), y);
    default: return y;
  }
}

/// Strictly checks whether the parameter is a 2-element array of two numbers
/// (which are not NaN)
export function isPoint2d(x: unknown): x is Point2d {
  if (!(x instanceof Array)) return false;
  if (x.length < 2) return false;
  if (x.length !== 2) return false;
  if (typeof x[0] !== 'number' || isNaN(x[0])) return false;
  if (typeof x[1] !== 'number' || isNaN(x[1])) return false;
  return true;
}

/// Converts anything not an actual (or approximate) Point2d into the default value y (which itself defaults to [0,0])
///
/// We assume most inputs will be valid, and attempt to return valid values unchanged, as fast as possible.
/// Nearly Point2d values will be converted to full Point2d. So,
/// - extra elements will be dropped
/// - an object which looks like an array with elements 0 and 1 will be converted
/// - reasonable attempts to convert string values to numbers will be made
/// - nulls and undefined values are not accepted.
/// - NaNs are not accepted.
export function toPoint2d<T = Point2d>(x: unknown, y: T|Point2d = [0,0]): Point2d | T {
  if (x instanceof Array) {
    if (x.length == 2) {
      if (typeof x[0] === 'number' && typeof x[1] === 'number')
        return x as Point2d; // unchanged, just validated
    }
    if (x.length < 2)
      return y;
    const p0 = toNumber(x[0], null);
    const p1 = toNumber(x[1], null);
    if (typeof p0 === 'number' && typeof p1 === 'number')
      return [p0, p1]; // rescue arrays of >= 2 numbers or strings which are numbers
    return y; // No dice
  }
  if (x instanceof Object) {
    if ('0' in x && '1' in x) {
      const p0 = toNumber(x[0], null);
      const p1 = toNumber(x[1], null);
      if (typeof p0 === 'number' && typeof p1 === 'number')
        return [p0, p1]; // rescue array-like objects with elements 0 and 1 which are numbers or strings which are numbers
    }
    return y; // No dice
  }
  return y; // No dice
}


/// Strictly checks whether the parameter is a 2-element array of two Point2d items.
export function isBox2d(x: unknown): x is Box2d {
  if (!(x instanceof Array)) return false;
  if (x.length < 2) return false;
  if (x.length !== 2) return false;
  if (!isPoint2d(x[0])) return false;
  if (!isPoint2d(x[1])) return false;
  return true;
}

/// Converts anything not an actual (or approximate) Box2d into the default value y (which itself defaults to [0,0])
///
/// We assume most inputs will be valid, and attempt to return valid values unchanged, as fast as possible.
/// Nearly Box2d values will be converted to full Box2d. So,
/// - extra elements will be dropped
/// - an object which looks like an array with elements 0 and 1 will be converted
/// - reasonable attempts to convert string values to numbers will be made
/// - nulls and undefined values are not accepted.
/// - NaNs are not accepted.
export function toBox2d<T = Box2d>(x: unknown, y: Box2d | T = [[0,0],[0,0]]): Box2d | T {
  if (x instanceof Array) {
    if (x.length >= 2) {
      if (isPoint2d(x[0]) && isPoint2d(x[1])) {
        if (x.length === 2)
          return x as Box2d; // Exactly right, return as is.

        // If we get here, it's got extra elements.  Chop them off.
        return [x[0], x[1]] as Box2d;
      }

      // If we get here, the first two elements aren't Point2ds
      // so attempt to convert them.
      const b1 = toPoint2d(x[0], null);
      const b2 = toPoint2d(x[0], null);

      if (b1 && b2)
        return [b1, b2];
    }
  }
  return y;
}

/// Returns the union of two Box2ds.
/// If only one is defined, returns that. If neither are, returns undefined.
export function box2dUnion(a?: Box2d, b?: Box2d): Box2d | undefined {
  if (a) {
    if (b)
      return [[Math.min(a[0][0], a[1][0], b[0][0], b[1][0]),
               Math.min(a[0][1], a[1][1], b[0][1], b[1][1])],
              [Math.max(a[0][0], a[1][0], b[0][0], b[1][0]),
               Math.max(a[0][1], a[1][1], b[0][1], b[1][1])]]; // Combine both
    else
      return a; // Just a
  }
  else {
    if (b)
      return b; // Just b
    else
      return undefined; // Neither
  }
}

/// Returns the highest of two numbers, or undefined if they are both undefined/null.
/// If only one is defined, returns that.
///
/// Note - Math.min cannot handle nulls/undefined correctly (it converts to 0!)
export function lowest(x?: number|null, y?: number|null): number | undefined {
  if (x == null) { // == null matches undefined
    if (y == null)
      return undefined
    else
      return y;
  }
  if (y == null) return x;
  return x < y? x : y;
}

/// Returns the lowest of two numbers, or undefined if they are both undefined/null.
/// If only one is defined, returns that.
///
/// Note - Math.min cannot handle nulls/undefined correctly (it converts to 0!)
export function highest(x?: number|null, y?: number|null): number | undefined {
  if (x == null) { // == null matches undefined
    if (y == null)
      return undefined
    else
      return y;
  }
  if (y == null) return x;
  return x > y? x : y;
}

/// Converts two arrays of x and y coordinates into a Box2d encompassing the range
///
/// The box will span the range of x and y coordinates.  However, if
/// either access has no span, an undefined value is returned.
export function arrays2Box2d(x: Array<number|undefined|null>, y: Array<number|undefined|null>): Box2d | undefined {
  let minx: number | undefined = arrayMin(x);
  if (minx === undefined) return undefined;

  let miny: number | undefined = arrayMin(y);
  if (miny === undefined) return undefined;

  let maxx: number | undefined = arrayMax(x);
  if (maxx === undefined) return undefined;

  let maxy: number | undefined = arrayMax(y);
  if (maxy === undefined) return undefined;
  
  return [[minx, miny],[maxx, maxy]];
}

/// Promote an unknown value into an array of unknowns - converting single values into an array if not already
export function promoteToArray<T = unknown[]>(x: unknown): T | unknown[] {
  if (x instanceof Array)
    return x;
  if (x == null) // or undefined
    return [];
  return [x];
}

