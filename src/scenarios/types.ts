export interface State<T, R> {
  readonly type: T
  readonly payload: R
}

export type Scenario<A, B, C, D> = (prev: State<A, B>) => Promise<State<C, D>>
