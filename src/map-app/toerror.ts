

/// Transform an unknown error as returned to a catch clause into an Error object.
export function toError(e: unknown): Error {
  if (e instanceof Error)
    return e;

  if (typeof e === 'string')
    return new Error(e);

  if (e === null || e === undefined)
    return new Error();
  
  return new Error(String(e));
}
