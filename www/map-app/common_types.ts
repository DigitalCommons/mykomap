// Define some utility types


// Maps any type K to a type V
//
// Elements are explicitly optional, courtesy of Partial
export type Assoc<K extends keyof any, V> = Partial<Record<K, V>>;

// Maps strings to a type V (which defaults to string)
//
// Elements are explicitly optional, courtesy of Partial
export type Dictionary<V = string> = Assoc<string, V>;

// A 2 dimensional point tuple
export type Point2d = [number, number];

// A 2 dimensional bounding box
export type Box2d = [Point2d, Point2d];

