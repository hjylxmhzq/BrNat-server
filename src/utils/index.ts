import { rejects } from 'assert'

export function promisfy<T>(fn, thisObj) {
  return async function(...args) {
    return new Promise<T>((resolve, reject) => {
      fn.call(thisObj, ...args, (err, d) => {
        if (err) {
          rejects(err);
        } else {
          resolve(d);
        }
      })
    })
  }
}