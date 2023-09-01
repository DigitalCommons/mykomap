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
  //
  // Returns the Vocab found.
  getVocab(uri: string, language: string): Vocab;
  
  // Gets a vocab term from the (possibly abbreviated) URI in the given language
  //
  // Throws an exception if there is no such term.
  getTerm(termUri: string, language: string): string;
  
  // Returns a localised Dictionary of vocab titles to Dictionaries of
  // vocab IDs to vocab terms - in the target langugage, where
  // available, or the fallBackLanguage if not.
  getVerboseValuesForFields(language: string): Dictionary<Dictionary>;
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
  
  getVocab(uri: string, language: string): Vocab {
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
  //
  // Throws an exception if there is no such term.  
  getTerm(termUri: string, language: string): string {
    termUri = this.abbrevUri(termUri);
    
    const [prefix, _] = termUri.split(':', 2);
    const vocab = this.vocabs.vocabs[prefix+':']?.[language]; // FIXME that colon is a bit ugly.
    
    let term = vocab?.terms?.[termUri];
    if (term !== undefined)
      return term;

    // Fall back to the default language if none found in the target language
    term = this.vocabs.vocabs[prefix+':']?.[this.fallBackLanguage]?.terms?.[termUri];
    if (term !== undefined)
      return term;

    // Even the fallback failed! 
    throw new Error(`No term for ${termUri}, not even in the fallback language ${this.fallBackLanguage}`);
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
