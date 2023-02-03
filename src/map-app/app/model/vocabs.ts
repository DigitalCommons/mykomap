import type { Dictionary } from '../../common_types';
import type { Initiative, PropDefs, PropDef } from './dataservices';
import type { DataConsumer } from './dataloader';

export interface Vocab {
  title: string;
  terms: Dictionary;
}

export interface LocalisedVocab {
  [lang: string]: Vocab;
}

export interface SparqlVocabMeta {
  languages: string[];
  queries: string[];
  vocab_srcs: {
    defaultGraphUri: string;
    endpoint: string;
    uris: { [uri: string]: string };
  }[];
}

export interface VocabIndex {
  prefixes: Dictionary;
  vocabs: Record<string, LocalisedVocab>;
}

export type SparqlVocabResponse = VocabIndex & {
  meta: SparqlVocabMeta;
}

export type VocabLookup = (url: string) => Vocab;

export function isSparqlVocabResponse(value: any): value is SparqlVocabResponse {
  if (typeof(value) !== 'object')
    return false;
  return true; // FIXME this is a temporary hack until I get some more heavyweight typechecking 
}

export function isVocabIndex(value: any): value is VocabIndex {
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
           vocabFilteredFields: Dictionary,
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
          console.warn(`No localisations for language ${language}, ` +
            `falling back to ${this.fallBackLanguage}`);
          vocabLang = vocab[this.fallBackLanguage];
        }
        return [vocabLang.title, vocabLang.terms];
      });

    return Object.fromEntries(entries);
  }
  
  //construct the object of terms for advanced search
  getTerms(language: string, vocabFilteredFields: Dictionary, initiativesByUid: Dictionary<Initiative>, propertySchema: PropDefs) {

    let usedTerms: Dictionary<Dictionary> = {};

    for (const vocabID in vocabFilteredFields) {
      const vocabLang = this.vocabs.vocabs[vocabID][language] ? language : this.fallBackLanguage;

      const vocabTitle = this.vocabs.vocabs[vocabID][vocabLang].title;
      usedTerms[vocabTitle] = {};
    }

    for (const initiativeUid in initiativesByUid) {
      const initiative = initiativesByUid[initiativeUid];
      if (!initiative)
        continue;

      for (const vocabID in vocabFilteredFields) {
        const propName = vocabFilteredFields[vocabID];
        if (!propName)
          continue;
        
        const id = initiative[propName];
        if (!id)
          continue;

        const vocabLang = this.vocabs.vocabs[vocabID][language] ? language : this.fallBackLanguage;

        const vocabTitle = this.vocabs.vocabs[vocabID][vocabLang].title;
        
        
        const propDef = propertySchema[propName];
        if (!propDef) console.warn(`couldn't find a property called '${propName}'`);

        // Currently still keeping the output data structure the same, so use id not term
        const temp = usedTerms[vocabTitle] ?? (usedTerms[vocabTitle] = {});
        if (!temp[id])
          temp[id] = this.vocabs.vocabs[vocabID][vocabLang].terms[id];
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
    const vocab = this.vocabs.vocabs[prefix]?.[language];
    
    let term = vocab?.terms?.[termUri];
    if (term !== undefined)
      return term;

    // Fall back to the default language if none found in the target language
    term = this.vocabs.vocabs[prefix]?.[this.fallBackLanguage]?.terms?.[termUri];
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

    for (const vocabID in this.vocabs.vocabs) {
      const vocabLang = this.vocabs.vocabs[vocabID][language] ? language : this.fallBackLanguage;
      vocabTitlesAndVocabIDs[this.vocabs.vocabs[vocabID][vocabLang].title] = vocabID;
    }

    return vocabTitlesAndVocabIDs;
  }

  getLocalisedVocabs(language: string): LocalisedVocab {
    let verboseValues: LocalisedVocab = {};

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
