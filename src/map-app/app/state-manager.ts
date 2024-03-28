import { Dictionary } from "../common-types";
import { StateChange, UndoStack } from "../undo-stack";
import { compactArray, filterSet } from "../utils";
import { Initiative } from "./model/initiative";

export type Action = TextSearch | PropEquality | ClearPropEquality | ClearPropEqualities;
export type Handler<T> = (value: T) => void;
export type StateChangeHandler = Handler<StateChange<AppState, Action|undefined>>;

export class AppStateChange extends StateChange<AppState, Action|undefined> {}

/// Represents the current state of the application
///
/// The aspects of it we care about, at least. For now this is just
/// the list of visible initiatives. Changes in it will be represented by
/// by items on the undo stack, and those items include instances of this.
export class AppState {
  // DEVNOTE: consider this class immutable, in the sense that you should
  // not alter it but create an altered copy.  (Currently this
  // property is not enforcable via TypeScript I believe) e.g. When
  // changing propFilters, create a copy, insert into new AppState
  // instance, return that.
  // Although see: https://stackoverflow.com/questions/43120022/i-want-totally-immutable-object-in-ts
  
  constructor(
    readonly allInitiatives: Set<Initiative>,
    readonly visibleInitiatives: Set<Initiative> = allInitiatives,
    readonly textSearch: TextSearch = new TextSearch(''),
    readonly propFilters: Dictionary<PropEquality> = {},
  ) {}

  // Helper function which applies string search to initiative set
  private applyTextSearch(initiatives: Set<Initiative>, textSearch?: TextSearch): Set<Initiative> {
    if (!textSearch)
      return initiatives;
    if (textSearch.willMatch())
      return initiatives;
    return filterSet(initiatives, textSearch.predicate);
  }

  // Helper function which applies property filters to initiative array
  private applyPropFilters(initiatives: Set<Initiative>, propFilters?: Dictionary<PropEquality>): Set<Initiative> {
    if (!propFilters)
      return initiatives;
    for(const propName in propFilters) {
      const filter = propFilters[propName];
      if (filter)
        initiatives = filterSet(initiatives, filter.predicate);
    }
    return initiatives;
  }

  /// Finds all the possible values for propName not excluded by the other filters
  ///
  /// i.e. if we wanted to select another PropEquality value for propName,
  /// what could we pick?
  altValues(propName: string): Set<unknown> {
    // We can't easily check if propName is a valid one here...
    // If it is, an empty set will be returned.

    let initiatives = this.applyTextSearch(this.allInitiatives, this.textSearch);

    // Filter all initiatives but the one for propName
    for(const filterPropName in this.propFilters) {
      if (propName === filterPropName)
        continue; // skip the filter for this property
      const filter = this.propFilters[filterPropName];
      if (filter)
        initiatives = filterSet(initiatives, filter.predicate);
    }

    // Find the variation in the property, not including undefined.
    // Assume any arrays are multi-valued fields
    // (this is possibly a bit slack but it works for now)
    const fieldVals = compactArray(Array.from(initiatives).flatMap(it => it[propName]));
    return new Set(fieldVals);
  }

  get hasPropFilters(): boolean {
    return Object.keys(this.propFilters).length > 0;
  }
  
  get hasTextSearch(): boolean {
    return this.textSearch.willMatch();
  }
  
  addTextSearch(textSearch: TextSearch): AppStateChange|undefined {
    if (textSearch.searchText === this.textSearch.searchText)
      return undefined; // No change.

    let initiatives = this.applyTextSearch(this.allInitiatives, textSearch);
    initiatives = this.applyPropFilters(initiatives, this.propFilters);
    
    const result = new AppState(
      this.allInitiatives,
      new Set(initiatives),
      textSearch,
      this.propFilters,
    );
    return new AppStateChange(textSearch, result);
  }

  clearTextSearch(): AppStateChange|undefined {
    return this.addTextSearch(new TextSearch(''));
  }
  
  addPropEquality(propEq: PropEquality): AppStateChange|undefined {
    const oldPropFilter = this.propFilters[propEq.propName];
    if (oldPropFilter
      && oldPropFilter.valueRequired === propEq.valueRequired
      && oldPropFilter.propName === propEq.propName)
      return undefined; // No change

    let initiatives = this.applyTextSearch(this.allInitiatives, this.textSearch);

    const propFilters = { ...this.propFilters };
    propFilters[propEq.propName] = propEq;

    initiatives = this.applyPropFilters(initiatives, propFilters);
    
    const result = new AppState(
      this.allInitiatives,
      new Set(initiatives),
      this.textSearch,
      propFilters,
    );
    return new AppStateChange(propEq, result);
  }

  removePropEquality(propName: string): AppStateChange|undefined {
    if (!this.propFilters[propName])
      return undefined; // No change
    
    const action = new ClearPropEquality(propName);
    let initiatives = this.applyTextSearch(this.allInitiatives, this.textSearch);

    const propFilters = { ...this.propFilters };
    delete propFilters[propName];

    initiatives = this.applyPropFilters(initiatives, propFilters);
    const result = new AppState(
      this.allInitiatives,
      new Set(initiatives),
      this.textSearch,
      propFilters,
    );
    return new AppStateChange(action, result);
  }

  removePropEqualities(): AppStateChange|undefined {
    if (Object.keys(this.propFilters).length === 0)
      return undefined; // No change
    
    let initiatives = this.applyTextSearch(this.allInitiatives, this.textSearch);

    const action = new ClearPropEqualities();
    const result = new AppState(
      this.allInitiatives,
      new Set(initiatives),
      this.textSearch
    );
    return new AppStateChange(action, result);
  }
}



/// Represents a text search
export class TextSearch {
  readonly normSearchText: string; // Normalised text for matching
  readonly predicate = (it?: Initiative): it is Initiative =>
    it !== undefined && typeof it.searchstr === 'string' && it.searchstr.includes(this.normSearchText);
  
  constructor(
    /// What was searched for
    readonly searchText: string,
  ) {
    this.normSearchText = TextSearch.normalise(searchText);
  }

  /// Normalises a text string into an indexable form.
  ///
  /// Performs these steps:
  /// - Upper-cases it
  /// - Eliminates non word-breaking punctuation (`\`'`)
  /// - Converts all other punctuation to space characters.
  /// - Deduplicates whitespace
  /// - Trims whitespace from front and back of the string.
  static normalise(text: string): string {
    return text.toUpperCase()
      .replace(/['`]/, '')      // eliminate non word-breaking punctuation
      .replace(/[^\w ]+/g, ' ') // all other punctuation to space
      .replace(/\s+/g, ' ')     // deduplicate whitespace
      .trim();                  // trim whitespace from front and back
  }

  willMatch() {
    return this.normSearchText === '';
  }
}

/// Represents a property equality filter addition
export class PropEquality {
  readonly predicate;
  
  constructor(
    /// What property should be filtered
    readonly propName: string,
    /// What value was selected
    readonly valueRequired: unknown,
    readonly isMulti: boolean,
  ) {
    if (isMulti)
      this.predicate = (it?: Initiative): it is Initiative => {
        if (it === undefined) return false;
        const val = it[this.propName];
        if (val instanceof Array)
          return val.includes(this.valueRequired);
        else
          return false;
      }
    else
      this.predicate = (it?: Initiative): it is Initiative =>
      it !== undefined && it[this.propName] == this.valueRequired;
  }
}

/// Represents a property equality filter removal
export class ClearPropEquality {
  constructor(
    readonly propName: string,
  ) {}
}

/// Represents complete property equality filter removal
export class ClearPropEqualities {
  constructor() {}
}


/// This manages the state of the map
///
/// Specifically, the search and filter state.
export class StateManager {
  private readonly stack: UndoStack<AppState, Action>;
  
  constructor(initialState: AppState, readonly onChange: StateChangeHandler) {
    this.stack = new UndoStack(initialState);
  }
  
  get isAtStart(): boolean {
    return this.stack.isAtStart();
  }

  get isAtEnd(): boolean {
    return this.stack.isAtEnd();
  }

  get lastChange() { return this.stack.current; }

  get currentState(): AppState { return this.stack.current.result; }

  reset(initiatives?: Initiative[]): void {
    const lastState = this.stack.current;
    this.stack.clear();

    if (initiatives) {
      const initiativesSet = new Set(initiatives);
      const state = new AppState(initiativesSet);
      const change = new StateChange(undefined, state);
      this.stack.current = change;
      this.onChange(change); // This is unambiguously a change!
    }
    else {
      // This is only a change if the stack state changed.
      if (this.stack.current !== lastState)
        this.onChange(this.stack.current);
    }
  }

  back(): void {
    this.stack.back();
    this.onChange(this.stack.current);
  }

  forward(): void {
    this.stack.forward();
    this.onChange(this.stack.current);
  }
  
  textSearch(textSearch: TextSearch): void {
    const stateChange = this.stack.current.result.addTextSearch(textSearch);
    if (stateChange === undefined)
      return; // No change
    this.stack.push(stateChange);
    this.onChange(stateChange);
  }

  clearTextSearch(): void {
    return this.textSearch(new TextSearch(''));
  }

  propFilter(propEq: PropEquality): void {
    const stateChange = this.stack.current.result.addPropEquality(propEq);
    if (stateChange === undefined)
      return; // No change
    this.stack.push(stateChange);
    this.onChange(stateChange);
  }

  clearPropFilter(propName: string): void {
    const stateChange = this.stack.current.result.removePropEquality(propName);
    if (stateChange === undefined)
      return; // No change
    this.stack.push(stateChange);
    this.onChange(stateChange);
  }

  clearPropFilters(): void {
    const stateChange = this.stack.current.result.removePropEqualities();
    if (stateChange === undefined)
      return; // No change
    this.stack.push(stateChange);
    this.onChange(stateChange);
  }

  altValues(propName: string) {
    return this.stack.current.result.altValues(propName);
  }
}
