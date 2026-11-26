# React hooks essentials

## useState
`useState(initial)` returns `[value, setValue]`. State updates are asynchronous and batched, so
`setCount(count + 1)` called twice in one handler only adds one. Use the updater form
`setCount(c => c + 1)` when the next value depends on the previous one. Never mutate state:
create a new object or array (`setItems([...items, newItem])`).

## useEffect
`useEffect(fn, deps)` runs after render. An empty array runs once after mount; omitting the array runs
after every render. Return a cleanup function to unsubscribe, clear timers, or abort fetches.
A missing dependency causes stale values; an object created inline as a dependency causes an infinite loop.
Do not use an effect to compute values from props or state; calculate them during render.

## useRef
`useRef(initial)` holds a mutable `.current` that survives renders without triggering one. Use it for DOM
nodes (`ref={inputRef}`) or values such as timer ids.

## useMemo and useCallback
`useMemo(() => compute(a), [a])` caches a computed value; `useCallback(fn, deps)` caches a function.
Use them to avoid expensive recalculation or to keep props stable for `React.memo` children, not by default.

## Lists and keys
Give each list item a stable unique `key` (an id, not the array index when items can reorder).
