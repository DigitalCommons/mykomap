import type {
  Dictionary,
} from './common_types';

import {
  bindNew,
} from './bind-new';

/* Utilities for transforming (typically CSV-derived) object streams into 
 * other object streams 
 */

// Defines a function transforming from an object type I into an object type O
export type ObjTransformFunc<I extends object, O extends object> = (input: I) => O;

// Defines a function transforming one type into another.
export type TransformFunc<I, O> = (input: I) => O;

// Data is assumed to be a string, a null, or absent (undefined)
export type DataVal = string | undefined |  null;

// Defines a transform from a named object property
export class PropTransform<I, O> {
  constructor(readonly from: (input: I) => DataVal, readonly transform: TransformFunc<DataVal, O>) {
  }
}

// Defines a transform from one object to another (record-based) object.
//
// I is the type of the input type, and has no particular requirements.
// O is the type of the output type, and is expected to have well defined properties.
//
// The input type is inspected using a PropTransform, which combines a property name with
// a TransformFunc.
export type ObjTransform<I, O extends object> = {
  [P in keyof O]: PropTransform<I, O[P]>
};

// Defines a transform of a DataVal to another value, without defining the property name.
export abstract class ValTransform<O> {
  abstract transform(input: DataVal): O;

  // Declares that the data should come from the source property named
  from<I extends Dictionary<DataVal>>(property: keyof I): PropTransform<I, O> {
    return new PropTransform((input: I) => { return input[property] }, (i: DataVal) => this.transform(i)); 
  }

  // Declares that the data does not come from any properties, but a fixed value
  fixed<I>(value: O): PropTransform<I, O> {
    return new PropTransform((_: I) => null, (_: DataVal) => value);
  }
}

// Common code for derived ValTransforms
//
// Nominally a null-permitting transform - i.e. O assumed 
// to include null, but not undefined. Derived classes can
// narrow this behavour to disallow nulls too.
//
// Note, undefined is used to mean a different thing to null here.
// See #default.
export abstract class CommonValTransform<O> extends ValTransform<O> {

  // This can be one of:
  // - undefined: invalid values should throw
  // - anything else (including null): invalid values should be converted to this.
  default?: O;

  constructor(defaultVal?: O) {
    super();
    this.default = defaultVal;
  }

  // Validates and converts a value.
  //
  // Case 1: The value validates and a transformed value of O is returned
  // Case 2: The value doesn't validate...
  //   Case 2a: The parameterised type disallows nulls: the value 
  //            is transformed to a default value of O
  //   Case 2b: The parameterised type allows nulls, and the value is transformed
  //            to the default value of O, which is null
  //   Case 2c: There is no default (it is undefined), so an error is raised. 
  //
  // This scheme depends on undefined being used to mean "no default", and null
  // can mean "default is null", but obviously only if O includes null.
  //
  // Implementations should return a value of O, which may be the value of #defined if it is
  // not left undefined. If #defined is undefined, then it should thrown an exception
  // whose message explains "why?" and can be appended to "because... "
  abstract transform(input: DataVal): O;

  // A convenience function enacpsulating the invalid value result
  //
  // It throws an error with the why message if #default is undefined,
  // otherwise it returns #default.
  protected invalidCase(why: string): O {
    if (this.default === undefined)
      // Failures should throw
      throw new Error(why);

    // Failures should default.
    return this.default;
  }
}


// A DataVal -> string|null transform
export class NullableTextTransform extends CommonValTransform<string|null> {

  constructor(defaultVal?: string|null) {
    super(defaultVal);
  }

  override transform(input: DataVal): string|null {
    // Convert "" into null. In text fields, converting a null back into a ""
    // can be done by setting the default, but converting a "" into a  null isn't
    // possible.  Therefore, by doing this, we allow both interpretations, configurably.
    if (input === "")
      input = null;
    
    if (input === undefined) {
      return this.invalidCase(`undefined values are not permitted here`);
    }

    // Value is a string, which is fine in all cases.
    return input;
  }
}


// A DataVal -> string transform
export class StrictTextTransform extends CommonValTransform<string> {

  constructor(defaultVal?: string) {
    super(defaultVal);
  }

  override transform(input: DataVal): string {
    // Treat "" as null. By the same token as in NullableTextTransform
    // conversion of "" to null, we interpret "" as null because if we
    // don't there's no easy way to detect and disallow it.
    if (input === "" || input === undefined || input === null) {
      return this.invalidCase(`null or undefined values are not permitted here`);
    }

    // Value is a string, which is fine in all cases.
    return input;
  }
}

// A DataVal -> text transform, which prefixes non-null values with a set prefix
//
// Useful for converting IDs to URIs, for example.
export class NullablePrefixTransform extends CommonValTransform<string|null> {

  constructor(readonly prefix: string, defaultVal?: string|null) {
    super(defaultVal);
  }

  override transform(input: DataVal): string|null {
    if (input === undefined) {
      const val = this.invalidCase(`undefined values are not permitted here`);
      if (val === null)
        return null;
      input = val;
    }

    // Value is a string, which is fine in all cases.
    return this.prefix + input;
  }
}


// A DataVal -> text transform, which prefixes  values with a set prefix
//
// Useful for converting IDs to URIs, for example.
export class StrictPrefixTransform extends CommonValTransform<string> {

  constructor(readonly prefix: string, defaultVal?: string) {
    super(defaultVal);
  }

  override transform(input: DataVal): string {
    if (input === undefined) {
      input = this.invalidCase(`undefined values are not permitted here`);
    }

    // Value is a string, which is fine in all cases.
    return this.prefix + input;
  }
}

// A DataVal -> text transform, but which allows only certain text values, and null
//
// Useful for IDs and fixed lists of values
//
// If "as const" allowed values are passed the constructor, then the
// default is checked to be one of these values, or null.
//
// But beware: if allowed is not "as const", then default is *not*
// checked, and does not have to be in the allowed list. The return
// type of #transform will reflect this and be a string[]|null

// T is an readonly array of strings, and T[number] is a union type of those as string literals.
//
// Note, see this question about union types from string arrays:
// https://stackoverflow.com/questions/44480644/string-union-to-string-array
export class NullableSymbolTransform<T extends readonly string[], A extends T[number]> extends CommonValTransform<A|null> {

  // Note, that to get the fully narrowed type of A, a union of the values of T,
  // you have to pass the array `allowed` with the `as const` suffix. So:
  //     new NullableSymbolTransform(['a','b'] as const)
  constructor(readonly allowed: T, defaultVal?: A|null) {
    super(defaultVal);
  }

  guard(input: string): input is A {
    return this.allowed.includes(input);
  }

  override transform(input: DataVal): A|null {
    if (input === undefined || input === null) {
      return this.invalidCase(`undefined values are not permitted here`);
    }

    if (!this.guard(input)) {
      return this.invalidCase(`value '${input}' is not one of the permitted symbol values`);
    }      

    // Value is a valid string now
    return input;
  }
}


// A DataVal -> text transform, but which allows only certain text values
//
// Useful for IDs and fixed lists of values
//
// If "as const" allowed values are passed the constructor, then the
// default is checked to be one of these values.
//
// But beware: if allowed is not "as const", then default is *not*
// checked, and does not have to be in the allowed list. The return
// type of #transform will reflect this and be a string[]
//
// T is an readonly array of strings, and T[number] is a union type of those as string literals.
export class StrictSymbolTransform<T extends readonly string[], A extends T[number]> extends CommonValTransform<A> {

  // Note, that to get the fully narrowed type of A, a union of the values of T,
  // you have to pass the array `allowed` with the `as const` suffix. So:
  //     new StrictSymbolTransform(['a','b'] as const)
  constructor(readonly allowed: T, defaultVal?: A) {
    super(defaultVal);
  }

  guard(input: string): input is A {
    return this.allowed.includes(input);
  }

  override transform(input: DataVal): A {
    if (input === undefined || input === null) {
      return this.invalidCase(`undefined values are not permitted here`);
    }

    if (!this.guard(input)) {
      return this.invalidCase(`value '${input}' is not one of the permitted symbol values`);
    }      

    // Value is a valid string now
    return input;
  }
}


// A DataVal -> text transform, but which allows only certain text
// values, and null, which are mapped to some other values using an
// index.
//
// Useful for fixed lists of values which need to be mapped to IDs
//
// If "as const" allowed values are passed the constructor, then the
// default is checked to be one of these values, or null.
//
// But beware: if allowed is not "as const", then default is *not*
// checked, and does not have to be in the allowed list. The return
// type of #transform will reflect this and be a string[]|null
//
// T is an readonly array of strings, and T[number] is a union type of those as string literals.
//
// Note, see this question about union types from string arrays:
// https://stackoverflow.com/questions/44480644/string-union-to-string-array
export class NullableLookupTransform
  <V, T extends readonly string[],
R extends Record<T[number],V|null>> extends CommonValTransform<V|null> {
  readonly index: R;
  readonly allowed: T[number][];
  
  // Note, that to get the fully narrowed type of T[number], a union of the values of T,
  // you have to pass the array `allowed` with the `as const` suffix. So:
  //     new NullableLookupTransform({allowed: ['a','b'] as const, index: {a: 1, b: 2})
  constructor(params: { index: R, allowed?: T[number][], default?: V|null }) {
    super(params.default);
    this.index = params.index;
    this.allowed = params.allowed ?? Object.keys(params.index);
  }

  guard(input: string): input is T[number] {
    return this.allowed.includes(input);
  }
    
  override transform(input: DataVal): V|null {
    if (input === undefined || input === null) {
      return this.invalidCase(`undefined values are not permitted here`);
    }

    if (!this.guard(input)) {
      return this.invalidCase(`value '${input}' is not one of the permitted lookup values`);
    }

    // input is a valid key of this.index now
    const val = this.index[input];
    
    return val;
  }
}

// A DataVal -> text transform, but which allows only certain text
// values, which are mapped to some other values using an
// index.
//
// Useful for fixed lists of values which need to be mapped to IDs
//
// If "as const" allowed values are passed the constructor, then the
// default is checked to be one of these values, or null.
//
// But beware: if allowed is not "as const", then default is *not*
// checked, and does not have to be in the allowed list. The return
// type of #transform will reflect this and be a string[]|null
//
// T is an readonly array of strings, and T[number] is a union type of those as string literals.
//
// Note, see this question about union types from string arrays:
// https://stackoverflow.com/questions/44480644/string-union-to-string-array
export class StrictLookupTransform
  <T extends readonly string[], V,
R extends Record<T[number],V>> extends CommonValTransform<V> {
  readonly index: R;
  readonly allowed: T[number][];
  
  // Note, that to get the fully narrowed type of T[number], a union of the values of T,
  // you have to pass the array `allowed` with the `as const` suffix. So:
  //     new StrictLookupTransform({allowed: ['a','b'] as const, index: {a: 1, b: 2})
  constructor(params: { index: R, default?: V }) {
    super(params.default);
    this.index = params.index;
    this.allowed = Object.keys(params.index);
  }

  guard(input: string): input is T[number] {
    return this.allowed.includes(input);
  }
    
  override transform(input: DataVal): V {
    if (input === undefined || input === null) {
      return this.invalidCase(`undefined values are not permitted here`);
    }

    if (!this.guard(input)) {
      return this.invalidCase(`value '${input}' is not one of the permitted lookup values`);
    }

    // input is a valid key of this.index now
    const val = this.index[input];
    
    return val;
  }
}

// A DataVal -> number|null transform
export class NullableNumberTransform extends CommonValTransform<number|null> {

  constructor(defaultVal?: number|null) {
    super(defaultVal);
  }

  override transform(input: DataVal): number|null {
    if (input === undefined || input === null) {
      return this.invalidCase(`null values are not permitted here`)
    }

    // To exclude '0z' as a number we need isNan(+input)
    if (isNaN(+input)) {
      return this.invalidCase(`not a valid number`);
    }

    // To exclude '' we need isNaN(num)
    const num = Number.parseFloat(input);
    if (isNaN(num)) {    
      return this.invalidCase(`not a valid number`);
    }

    return num;
  }
}

// A DataVal -> number transform
export class StrictNumberTransform extends CommonValTransform<number> {

  constructor(defaultVal?: number) {
    super(defaultVal);
  }

  override transform(input: DataVal): number {
    if (input === undefined || input === null) {
      return this.invalidCase(`null values are not permitted here`)
    }

    // To exclude '0z' as a number we need isNan(+input)
    if (isNaN(+input)) {
      return this.invalidCase(`not a valid number`);
    }

    // To exclude '' we need isNaN(num)
    const num = Number.parseFloat(input);
    if (isNaN(num)) {    
      return this.invalidCase(`not a valid number`);
    }

    return num;
  }
}

// A DataVal -> boolean|null transform
export class NullableBooleanTransform extends CommonValTransform<boolean|null> {

  constructor(defaultVal?: boolean|null) {
    super(defaultVal);
  }

  override transform(input: string): boolean|null {   
    if (input === undefined || input === null) {
      return this.invalidCase(`null values are not permitted here`)
    }

    // Value is a string. Convert it.
    const bool = Boolean(input);
    return bool;
  }
}

// A DataVal -> boolean transform
export class StrictBooleanTransform extends CommonValTransform<boolean> {

  constructor(defaultVal?: boolean) {
    super(defaultVal);
  }

  override transform(input: string): boolean {   
    if (input === undefined || input === null) {
      return this.invalidCase(`null values are not permitted here`)
    }

    // Value is a string. Convert it.
    const bool = Boolean(input);
    return bool;
  }
}

// A DataVal -> Date|null transform
export class NullableDateTransform extends CommonValTransform<Date|null> {

  constructor(defaultVal?: Date|null) {
    super(defaultVal);
  }

  override transform(input: string): Date|null {   
    if (input === undefined || input === null) {
      return this.invalidCase(`null values are not permitted here`)
    }

    // Value is a string. Convert it.
    // FIXME validate?
    const date = new Date(input);
    return date;
  }
}

// A DataVal -> Date transform
export class StrictDateTransform extends CommonValTransform<Date> {

  constructor(defaultVal?: Date) {
    super(defaultVal);
  }

  override transform(input: string): Date {   
    if (input === undefined || input === null) {
      return this.invalidCase(`null values are not permitted here`)
    }

    // Value is a string. Convert it.
    // FIXME validate?
    const date = new Date(input);
    return date;
  }
}


// A DataVal -> Array transform
export class StrictMultiTransform<O> extends CommonValTransform<O[]> {
  readonly of: ValTransform<O>;
  readonly splitRx: RegExp;
  readonly unescapeRx: RegExp;
  readonly omit: O[];

  constructor(params: {
    of: ValTransform<O>;
    default?: O[];
    delim?: string; // Pattern to split on. Can be a regex string. Defaults to ';'
    escape?: string; // Pattern to escape values. Can be a regex string. Defalts to '\'
    omit?: O|O[]; // Values to omit (typically blanks or nulls).
  }) {
    super(params.default ?? []);
    this.of = params.of;
    const escape = params.escape ?? '\\';
    const delim = params.delim ?? ';';
    this.splitRx = new RegExp(`(?<!${escape.replace('\\', '\\\\')})${delim.replace('\\', '\\\\')}`);
    this.unescapeRx = new RegExp(`${escape.replace('\\', '\\\\')}(.)`, 'g');
    this.omit =
      params.omit == null? [] :
      params.omit instanceof Array ? params.omit :
      [params.omit];
  }

  override transform(input: string): O[] {
    if (input === undefined || input === null) {
      return this.invalidCase(`null values are not permitted here`)
    }

    // Value is a string. Split it and unescape the pieces
    const properties = input
      .split(this.splitRx)
      .map(f => f.replace(this.unescapeRx, (_, m1) => m1));

    const result = properties
      .map(f => this.of.transform(f))
      .filter(f => !this.omit.includes(f));

    return result;
  }
}

// Generates an ObjTransformFunc from an ObjTransform instance
export function mkObjTransformer<I extends Record<string, DataVal>, O extends object>(objTransform: ObjTransform<I, O>): ObjTransformFunc<I, O> {

  return (input: I) => {
    const result: Partial<Record<keyof O, O[keyof O]>> = {};
    for(const okey in objTransform) {
      const trans: PropTransform<I, O[keyof O]> = objTransform[okey];
      const val = trans.from(input);
      result[okey] = trans.transform(val);
    }
    return result as O; // FORCED! We can be sure that all the keys of O are present, objTransform guaranteed to have them all
  };
}

// A convenient index for these long-named things
export const Transforms = {
  text: bindNew(StrictTextTransform),
  prefixed: bindNew(StrictPrefixTransform),
  symbol: bindNew(StrictSymbolTransform),
  lookup: bindNew(StrictLookupTransform),
  number: bindNew(StrictNumberTransform),
  boolean: bindNew(StrictBooleanTransform),
  date: bindNew(StrictDateTransform),
  multi: bindNew(StrictMultiTransform),

  nullable: {
    text: bindNew(NullableTextTransform),
    prefixed: bindNew(NullablePrefixTransform),
    symbol: bindNew(NullableSymbolTransform),
    lookup: bindNew(NullableLookupTransform),
    number: bindNew(NullableNumberTransform),
    boolean: bindNew(NullableBooleanTransform),
    date: bindNew(NullableDateTransform),
//    multi: bindNew(NullableMultiTransform), // Not very useful as [] is equivalent to null
  },
};
