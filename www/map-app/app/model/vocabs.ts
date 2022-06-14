import type { Dictionary } from '../../common_types';
import type { Initiative, PropDefs, PropDef } from './sse_initiative';

interface VocabMeta {
  languages: string[];
  queries: string[];
  vocab_srcs: {
    defaultGraphUri: string;
    endpoint: string;
    uris: { [uri: string]: string };
  };
}

interface Vocab {
  title: string;
  terms: Dictionary;
}

export interface LocalisedVocab {
  [lang: string]: Vocab;
}

export interface VocabIndex {
  abbrevs: Dictionary;
  meta: VocabMeta;
  prefixes: Dictionary;
  vocabs: { [prefix: string]: LocalisedVocab };
}

export interface VocabSource {
  endpoint: string;
  defaultGraphUri?: string;
  uris: Dictionary<string>;
}

interface VocabInterface {
  // Abbreviates a URI using the prefixes/abbreviations defined in vocabs
  //
  // Keeps trying until all abbreviations applied.
  abbrevUri(uri: string): string;
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

  // Gets a vocab term value, given an (possibly prefixed) vocab and term uris
  // Returns '?' if there is no value found
  getVocabTerm(vocabUri: string, termUri: string, language: string): string;

  // Gets a localised map of vocab titles to the relevant vocab
  // prefixes (in the given language). (May be empty or only partially
  // populated!)
  getVocabTitlesAndVocabIDs(language: string): Dictionary;
}

export class Vocabs implements VocabInterface {
  readonly vocabs: VocabIndex;
  readonly fallBackLanguage: string;
  
  constructor(data: VocabIndex, fallBackLanguage: string) {
    this.vocabs = data;
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
      .keys(this.vocabs.prefixes)
      .sort((a, b) => b.length - a.length)
      .forEach(prefix => {
        const abbrev = this.vocabs.prefixes[prefix];
        abbrevs[abbrev] = prefix;
        prefixes[prefix] = abbrev;
      });

    this.vocabs.prefixes = prefixes;
    this.vocabs.abbrevs = abbrevs;
    if (!this.vocabs.vocabs)
      this.vocabs.vocabs = {}; // Ensure this is here
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

    let vocabLang = this.fallBackLanguage;

    for (const vocabID in vocabFilteredFields) {
      vocabLang = this.vocabs.vocabs[vocabID][language] ? language : this.fallBackLanguage;

      const vocabTitle = this.vocabs.vocabs[vocabID][vocabLang].title;
      usedTerms[vocabTitle] = {};
    }

    for (const initiativeUid in initiativesByUid) {
      const initiative = initiativesByUid[initiativeUid];

      for (const vocabID in vocabFilteredFields) {
        vocabLang = this.vocabs.vocabs[vocabID][language] ? language : this.fallBackLanguage;

        const vocabTitle = this.vocabs.vocabs[vocabID][vocabLang].title;
        const propName = vocabFilteredFields[vocabID];
        const id = initiative[propName];
        const propDef = propertySchema[propName];
        if (!propDef) console.warn(`couldn't find a property called '${propName}'`);

        // Currently still keeping the output data strucutre the same, so use id not term
        if (!usedTerms[vocabTitle][id] && id)
          usedTerms[vocabTitle][id] = this.vocabs.vocabs[vocabID][vocabLang].terms[id];
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
    
    // Assume propertySchema's vocabUris are validated. But language availability can't be
    // checked so easily.
    const vocab = this.vocabs.vocabs[this.abbrevUri(propDef.uri)];
    if (!vocab) {
      throw new Error(`no vocab defined with URI ${propDef.uri} ` +
        `(expecting one of: ${Object.keys(this.vocabs.vocabs).join(', ')})`);
    }
    const vocabLang = vocab[language] ? language : this.fallBackLanguage;
    const localVocab = vocab[vocabLang];
    if (!localVocab) {
      throw new Error(`no title in lang ${vocabLang} for property: '${id}'`);
    }

    return localVocab;
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
    const vocabLang = this.vocabs.vocabs["aci:"][language] ? language : this.fallBackLanguage;

    let verboseValues: LocalisedVocab = {};

    for (const id in this.vocabs.vocabs) {
      verboseValues[id] = this.vocabs.vocabs[id][vocabLang];
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

      if (abbrev in this.vocabs.abbrevs) // Expand this abbreviation
        uri = this.vocabs.abbrevs[abbrev] + uri.substring(delimIx + 1);
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
