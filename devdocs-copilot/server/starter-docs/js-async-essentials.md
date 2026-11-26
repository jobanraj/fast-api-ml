# JavaScript async essentials

## Promises
A Promise is pending, fulfilled, or rejected. `.then()` handles success, `.catch()` handles errors.
`Promise.all([a, b])` fails fast if any rejects; `Promise.allSettled` waits for all and reports each outcome.

## async / await
An `async` function always returns a Promise. `await` pauses that function until the Promise settles.
Wrap awaits in `try/catch` for errors. Awaiting inside a loop runs sequentially; use `Promise.all` with `map`
to run tasks in parallel.

```js
async function loadUsers(ids) {
  try {
    return await Promise.all(ids.map((id) => fetch(`/api/users/${id}`).then((r) => r.json())));
  } catch (error) {
    console.error("Failed to load users", error);
    return [];
  }
}
```

## Closures
A closure is a function that remembers variables from the scope where it was created. Common bug:
`var` in a loop shares one variable across callbacks; `let` creates one per iteration.

## fetch
`fetch` only rejects on network failure. Check `response.ok` yourself before calling `response.json()`.
