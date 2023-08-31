import type { Dictionary } from '../../common-types';
import { PropDefs, PropDef, DataServicesImpl } from './data-services';
import { Initiative } from './initiative';
import type { DataConsumer } from './data-loader';

export interface Vocab {
  title: string;
  terms: Dictionary;
}

export type LocalisedVocab = Dictionary<Vocab>;

export interface SparqlVocabMeta {
  languages: string[];
  queries: string[];
  vocab_srcs: {
    defaultGraphUri: string;
    endpoint: string;
    uris: { [uri: string]: string };
  }[];
}

/// Describes vocabs and their prefixes.
///
/// prefixes - maps long vocab URIs to their abbreviations (without colons)
/// vocabs - maps short vocab URIs (appreviation followed by colon) to
/// LocalisedVocab objects, which index language codes to definitions for that language.
export interface VocabIndex {
  prefixes: Dictionary;
  vocabs: Record<string, LocalisedVocab>;
}

export type SparqlVocabResponse = VocabIndex & {
  meta: SparqlVocabMeta;
}

export type VocabLookup = (url: string) => Vocab;

export function isSparqlVocabResponse(value: unknown): value is SparqlVocabResponse {
  if (typeof(value) !== 'object')
    return false;
  return true; // FIXME this is a temporary hack until I get some more heavyweight typechecking 
}

export function isVocabIndex(value: unknown): value is VocabIndex {
  if (typeof(value) !== 'object')
    return false;
  return true; // FIXME this is a temporary hack until I get some more heavyweight typechecking 
}

// Supplies query functions for a VocabIndex
export interface VocabServices {
  // Gets the fallBackLanguage used
  getFallBackLanguage(): string;
  
  // Abbreviates a URI using the prefixes/abbreviations defined in vocabs
  //
  // Keeps trying until all abbreviations applied.
  abbrevUri(uri: string): string;

  
  // Expands a URI using the prefixes/abbreviations defined in vocabs
  expandUri(uri: string): string;
  
  // Gets a vocab for the given URI / language
  // Throws an exception if the URI can't be found.
  // Uses the value of getFallBackLanguage() if the language can't be found.
  // Returns the Vocab found.
  getVocabForUri(uri: string, language: string): Vocab;
  
  // Gets a vocab term value, given an (possibly prefixed) vocab and term uris
  // Returns '?' if there is no value found
  getVocabTerm(vocabUri: string, termUri: string, language: string): string;

  // Gets the vocab for a property, given the property schema
  //
  // Returns a vocab index (for the currently set language).
  //
  // Throws an exception if there is some reason this fails. The
  // exception will have a short description indicating the problem.
  getVocabForProperty(id: string, propDef: PropDef, language: string): Vocab;

  // Gets a LocalisedVocab for the given language (which may be empty
  // or only partially populated!)
  getLocalisedVocabs(language: string): LocalisedVocab;

  // Gets a vocab term from the (possibly abbreviated) URI in the given language
  // Falls back to the default fall-back language if no language given, or
  // the term is not localised in that language
  getTerm(termUri: string, language?: string): string;
  
  // Construct the object of terms for advanced search
  //
  // Returns a Dictionary of localised vocab titles, to Dictionaries
  // of vocab ID to term label (in the given language, if available,
  // else the fallBackLanguage)
  getTerms(language: string,
           initiativesByUid: Dictionary<Initiative>,
           propertySchema: PropDefs): Dictionary<Dictionary>;

  // Returns a localised Dictionary of vocab titles to Dictionaries of
  // vocab IDs to vocab terms - in the target langugage, where
  // available, or the fallBackLanguage if not.
  getVerboseValuesForFields(language: string): Dictionary<Dictionary>;

  // Gets a localised map of vocab titles to the relevant vocab
  // prefixes (in the given language). (May be empty or only partially
  // populated!)
  getVocabTitlesAndVocabIDs(language: string): Dictionary;
}

// Supplies query functions for a VocabIndex
export class VocabServiceImpl implements VocabServices {
  readonly vocabs: VocabIndex & { abbrevs: Dictionary };
  readonly fallBackLanguage: string;
  
  constructor(data: VocabIndex, fallBackLanguage: string) {
    this.fallBackLanguage = fallBackLanguage;
    
    // Add an inverted look-up `abbrevs` mapping abbreviations to uris
    // obtained from `prefixes`.
    //
    // Sort it and `prefixes` so that longer prefixes are listed
    // first (Ecmascript objects preserve the order of addition).
    // This is to make matching the longest prefix simpler later.
    const prefixes: Dictionary = {};
    const abbrevs: Dictionary = {};
    Object
      .keys(data.prefixes)
      .sort((a, b) => b.length - a.length)
      .forEach(prefix => {
        const abbrev = data.prefixes[prefix];
        if (!abbrev)
          throw new Error(`VocabIndex used for VocabServiceImpl has an undefined abbreviation for prefix '${prefix}'`);
        
        abbrevs[abbrev] = prefix;
        prefixes[prefix] = abbrev;
      });

    this.vocabs = {
      abbrevs, prefixes, vocabs: data.vocabs ?? {}
    };
   }

  getFallBackLanguage(): string {
    return this.fallBackLanguage;
  }
  
  // Returns a localised Dictionary of vocab titles to Dictionaries of
  // vocab IDs to vocab terms - in the target langugage, where
  // available, or the fallBackLanguage if not.
  getVerboseValuesForFields(language: string): Dictionary<Dictionary> {

    const entries = Object
      .entries(this.vocabs.vocabs)
      .map(([vocabUri, vocab]) => {
        let vocabLang = vocab[language];
        if (!vocabLang && language !== this.fallBackLanguage) {
          console.warn(`No localisations of vocab ${vocabUri} for language ${language}, ` +
            `falling back to ${this.fallBackLanguage}`);
          vocabLang = vocab[this.fallBackLanguage];
        }
        if (!vocabLang)
          throw new Error(`No localisations of vocab ${vocabUri} for language ${language}, `+
            `and no localisations for the fallback ${this.fallBackLanguage} either!`);

        return [vocabLang.title, vocabLang.terms];
      });

    return Object.fromEntries(entries);
  }
  
  /// Construct the object of terms for advanced search
  ///
  /// For each initiative in initiativesByUid, this iterates over the
  /// properties in propertySchema, finds those properties which are
  /// vocabs, and constructs an index of:
  ///
  /// - vocab titles (in the specified language, if present in the
  ///   vocab), to
  /// - vocab term IDs seen in the initiatives, to
  /// - the corresponding vocab term names (again, in the specified
  ///   language, if present in the vocab)
  ///
  /// (See test-vocab-services.ts for test case examples of this)
  getTerms(language: string, initiativesByUid: Dictionary<Initiative>, propertySchema: PropDefs): Dictionary<Dictionary> {

    let usedTerms: Dictionary<Dictionary> = {};
    const vocabProps = DataServicesImpl.vocabPropDefs(propertySchema);
    
    for (const initiativeUid in initiativesByUid) {
      const initiative = initiativesByUid[initiativeUid];
      if (!initiative)
        continue;

      for(const propName in propertySchema) {
        const vocabPropDef = vocabProps[propName];
        if (!vocabPropDef)
          continue;
        
        let vocabID = vocabPropDef.uri;

        // If a MultiPropDef, initiative[propName] should be an array already, but could be null/undefined. Convert to an array.
        // If a VocabPropDef, it should *not* be an array, but equally could be null/undefined. Convert to an array of zero/one value.
        let uris: unknown[] | undefined;
        const val = initiative[propName];
        if (vocabPropDef.type === 'multi') {
          if (val instanceof Array)
            uris = val;
          else if (val == null) // or undef
            uris = [];
          else {
            console.warn(`initiative has non-array value in MultiPropDef property ${propName} -  ignoring property`, initiative);
            continue;
          }
        }
        else if (vocabPropDef.type === 'vocab') {
          if (typeof val === 'string')
            uris = [val]
          else if (val == null) // or undef
            uris = [];
          else { 
            console.warn(`initiative has non-string value in VocabPropDef property ${propName} -  ignoring property`, initiative);
            continue;
          }
        }
        else {
          // Shouldn't ever get here, but it keeps the compiler happy
          console.warn(`initiative has unknown VocabPropDef type for property ${propName} -  ignoring property`, initiative);
          continue;
        }

        const vocab = this.vocabs.vocabs[vocabID];
        const localisedVocab = vocab[language] ?? vocab[this.fallBackLanguage];

        if (!localisedVocab)
          throw new Error(`No localisations of vocab ${vocabID}'s title for `+
            `language ${language} or the fallback language ${this.fallBackLanguage}`);

        const vocabTitle = localisedVocab.title;
        
        // Currently still keeping the output data structure the same, so use uri not term
        const temp = usedTerms[vocabTitle] ?? (usedTerms[vocabTitle] = {});
        uris.forEach(uri => {
          if (uri == null) return;
          const key = this.abbrevUri(String(uri));
          if (key in temp) return;
          temp[key] = localisedVocab.terms[key];
        });
      }
    }

    return usedTerms;
  }

  // Gets the vocab for a property, given the property schema
  //
  // Returns a vocab index (for the currently set language).
  //
  // Throws an exception if there is some reason this fails. The
  // exception will have a short description indicating the problem.
  getVocabForProperty(id: string, propDef: PropDef, language: string): Vocab {

    if (propDef.type !== 'vocab')
      throw new Error(`property ${id} is not a vocab property`);

    try {
      return this.getVocabForUri(propDef.uri, language);
    }
    catch(e) {
      if (e instanceof Error) {
        e.message += `, for property ${id}`;
        throw(e);
      }
      else {
        throw new Error(`${e}. for property ${id}`);
      }
    }
  }

  getVocabForUri(uri: string, language: string = this.fallBackLanguage): Vocab {
    // Assume propertySchema's vocabUris are validated. But language availability can't be
    // checked so easily.
    const vocab = this.vocabs.vocabs[this.abbrevUri(uri)];
    if (!vocab)
      throw new Error(`no vocab defined with URI ${uri} ` +
        `(expecting one of: ${Object.keys(this.vocabs.vocabs).join(', ')})`);

    const vocabLang = vocab[language]? language : this.fallBackLanguage;
    const localVocab = vocab[vocabLang];
    if (!localVocab)
      throw new Error(`no title in lang ${language} for uri ${uri}'`);

    return localVocab;
  }
  
  // Gets a vocab term from the (possibly abbreviated) URI in the given language
  // Falls back to the default fall-back language if no language given, or
  // the term is not localised in that language
  getTerm(termUri: string, language?: string) {
    language ??= this.fallBackLanguage;
    termUri = this.abbrevUri(termUri);
    
    const [prefix, id] = termUri.split(':', 2);
    const vocab = this.vocabs.vocabs[prefix+':']?.[language]; // FIXME that colon is a bit ugly.
    
    let term = vocab?.terms?.[termUri];
    if (term !== undefined)
      return term;

    // Fall back to the default language if none found in the target language
    term = this.vocabs.vocabs[prefix+':']?.[this.fallBackLanguage]?.terms?.[termUri];
    if (term !== undefined)
      return term;

    // Even the fallback failed! 
    console.error(`No term for ${termUri}, not even in the fallback language ${this.fallBackLanguage}`);
    return '?';
  }
  
  // Gets a vocab term value, given an (possibly prefixed) vocab and term uris
  // Returns '?' if there is no value found
  getVocabTerm(vocabUri: string, termUri: string, language: string): string {
    termUri = this.abbrevUri(termUri);
    // We don't (yet) expand or abbreviate vocabUri. We assume it matches.
    const prefix = this.abbrevUri(vocabUri);
    const vocab = this.vocabs.vocabs[prefix][language];

    let term = vocab?.terms?.[termUri];
    if (term !== undefined)
      return term;

    // Fall back if there are no terms.
    term = this.vocabs.vocabs[vocabUri]?.[this.fallBackLanguage]?.terms?.[termUri];
    if (term !== undefined)
      return term;

    // Even the fallback failed! 
    console.error(`No term for ${termUri}, not even in the fallback language ${this.fallBackLanguage}`);
    return '?';
  }
  
  getVocabTitlesAndVocabIDs(language: string): Dictionary {
    const vocabTitlesAndVocabIDs: Dictionary = {}

    for (const vocabUri in this.vocabs.vocabs) {
      const vocab = this.vocabs.vocabs[vocabUri];
      const localVocab = vocab[language] ?? vocab[this.fallBackLanguage];
      if (!localVocab)
        throw new Error(`No localisations of vocab ${vocabUri} for language ${language}, `+
          `and no localisations for the fallback ${this.fallBackLanguage} either!`);

      vocabTitlesAndVocabIDs[localVocab.title] = vocabUri;
    }

    return vocabTitlesAndVocabIDs;
  }

  /// Removes all language definitions not equal to the parameter.
  ///
  /// Returns a dictionary of Vocabs
  getLocalisedVocabs(language: string): Dictionary<Vocab> {
    let verboseValues: Dictionary<Vocab> = {};

    for (const id in this.vocabs.vocabs) {
      const vocab = this.vocabs.vocabs[id];
      if (vocab)
        verboseValues[id] = vocab[language] ?? vocab[this.fallBackLanguage];
    }

    return verboseValues;
  }

  // Expands a URI using the prefixes/abbreviations defined in vocabs
  //
  // Keeps trying until all expansions applied.
  expandUri(uri: string) {
    while (true) {
      const delimIx = uri.indexOf(':');
      if (delimIx < 0)
        return uri; // Shouldn't normally happen... expanded URIs have `http(s):`

      const abbrev = uri.substring(0, delimIx);
      if (abbrev == 'http' || abbrev == 'https')
        return uri; // No more expansion needed

      if (abbrev in this.vocabs.abbrevs) { // Expand this abbreviation
        uri = this.vocabs.abbrevs[abbrev] + uri.substring(delimIx + 1);
        continue;
      }

      // If we get here, there's an unexpandable abbreviation
      throw new Error(`unrecognised abbreviation: '${abbrev}' in uri '${uri}'`)
    }
  }

  // Abbreviates a URI using the prefixes/abbreviations defined in vocabs
  //
  // Keeps trying until all abbreviations applied.
  abbrevUri(uri: string): string {
    uri = this.expandUri(uri); // first expand it, if necessary

    // Find a prefix match
    const prefix = Object
      .keys(this.vocabs.prefixes) // NOTE: assumes this object is sorted largest-key first
      .find(p => uri.startsWith(p));

    // Substitute the match with the abbreviation.
    if (prefix)
      return this.vocabs.prefixes[prefix] + ':' + uri.substring(prefix.length);

    return uri; // No abbreviation possible.
  }

}


export class VocabAggregator implements DataConsumer<VocabIndex> {
  readonly prefixes: Dictionary = {};
  readonly vocabs: Record<string, LocalisedVocab> = {};
  onItemComplete?: (id: string) => void;
  onSetComplete?: (id: string) => void;
  onSetFail?: (id: string, error: Error) => void;

  constructor(readonly fallbackLanguage: string) {}
  
  // Add a batch of data. May be called multiple times.
  addBatch(id: string, data: VocabIndex[]): void {

    data.forEach((vi, ix) => {
      Object.assign(this.prefixes, vi.prefixes);
      Object.assign(this.vocabs, vi.vocabs);
      // FIXME detect clobbering?
      console.log("loaded vocab", id, ix); // DEBUG
      this.onItemComplete?.(id);
    });
  }

  // Finishes the load successfully after all data has been seen
  complete(id: string): void {
    this.onSetComplete?.(id);
  }

  // Finishes the load unsuccessfully after an error occurs  
  fail(id: string, error: Error): void {
    this.onSetFail?.(id, error);
  }

  // Finishes the load after all data has been seen.
  allComplete(): VocabServices {
    const vocabIndex: VocabIndex = {
      prefixes: this.prefixes,
      vocabs: this.vocabs,
    };
    console.log("loaded vocabs", vocabIndex);
    return new VocabServiceImpl(vocabIndex, this.fallbackLanguage);
  }
}
