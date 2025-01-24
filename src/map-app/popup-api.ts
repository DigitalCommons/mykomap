import { DataServices, isVocabPropDef } from "./app/model/data-services";
import type { Vocab, VocabServices } from "./app/model/vocabs";
import { Initiative } from "./app/model/initiative";
import { PhraseBook } from "./localisations";
import { toString as _toString } from "./utils";

// Options for PopupApi.link()
export type LinkOpts = {
  as?: 'propName'|'literal',
  text?: string,
  template?: string,
  baseUri?: string | Record<string,string>
};

// A helper class for Pop-up dialog implementations
//
// This includes a lot of the plumbing a popup.js implementation will
// need to function. It aims to avoid the copy-pasta salad which used
// to be commonly seen in pop-ups.
//
// Note, the DataServices object must have loaded its vocabs for this
// class to be bound to it, or there will be an error. Typically this
// has normally already happened in the context of a pop-up.
export class PopupApi {
  static readonly qNameRegex = this.mkQNameRegex();
  private readonly dataServices: DataServices;
  private readonly vocabs: VocabServices;
  readonly lang: string;
  readonly labels: PhraseBook;
  addressFields: string[] = [ // Historical defaults. Can be overridden.
    'street',
    'locality',
    'region',
    'postcode',
    'countryId',
  ];

  // Builds qNameRegex, which matches an XML ncname
  // as per https://www.w3.org/TR/REC-xml-names/#NT-QName
  private static mkQNameRegex(): RegExp {
    const nameStartChar = ['_A-Z',
                           'a-z',
                           '\u00C0-\u00D6',
                           '\u00D8-\u00F6',
                           '\u00F8-\u02FF',
                           '\u0370-\u037D',
                           '\u037F-\u1FFF',
                           '\u200C-\u200D',
                           '\u2070-\u218F',
                           '\u2C00-\u2FEF',
                           '\u3001-\uD7FF',
                           '\uF900-\uFDCF',
                           '\uFDF0-\uFFFD',
                           '\u10000-\u{EFFFF}'].join('');
    const nameChar = nameStartChar + ['.0-9',
                                      '\u00B7',
                                      '\u0300-\u036F',
                                      '\u203F-\u2040',
                                      '-'].join(''); // note trailing - is significant
    return new RegExp(`^([${nameStartChar}][${nameChar}]*):(.*)`);
  }
  
  constructor(private readonly initiative: Initiative, dataServices: DataServices) {
    this.dataServices = dataServices;
    const vocabs = dataServices.getVocabs();
    if (vocabs === undefined)
      throw new Error("datservices must have loaded its vocabs to be used here");
    this.vocabs = vocabs;
    this.lang = dataServices.getLanguage();
    this.labels = dataServices.getFunctionalLabels();
  }
  
  getTitle(vocabUri: string, defaultVal?: string): string {
    const title = this.vocabs.getVocab(vocabUri, this.lang)?.title;
    if (title)
      return title;
    if (defaultVal !== undefined)
      return defaultVal;
    return this.labels.notAvailable;
  }
  
  getTerms(propertyName: string): string[] {
    const propDef = this.dataServices.getPropertySchema(propertyName);
    const propVal = this.initiative[propertyName];
    if (isVocabPropDef(propDef)) {
      if (propDef.type === 'multi' && propVal instanceof Array) {
        return propVal.map((val:unknown) => this.vocabs.getTerm(String(val), this.lang));
      }
      if (typeof propVal === 'string')
        return [this.vocabs.getTerm(propVal, this.lang)];
      if (propVal === undefined)
        return [this.labels.notAvailable];
      throw new Error(`invalid vocab property value for ${propertyName}: ${propVal}`);
    }
    throw new Error(`can't get term for non-vocab property ${propertyName}`);
  }
  
  getTerm(propertyName: string, defaultVal?: string): string {
    const vals = this.getTerms(propertyName);
    if (vals.length > 0)
      return vals[0];
    if (defaultVal !== undefined)
      return defaultVal;
    return this.labels.notAvailable;
  }

  getVal(propertyName: string, defaultVal?: string): string {
    const propVal = this.initiative[propertyName];
    if (propVal !== undefined && propVal !== null) // null or undefined
      return String(propVal);
    if (defaultVal !== undefined)
      return defaultVal;
    return this.labels.notAvailable;
  }

  getVocab(uri: string): Vocab {
    return this.vocabs.getVocab(uri, this.lang);
  }

  // Converts a pure id, or a vocab URI, into the equivalent label in the current language
  getLabel(uri: string, defaultVal?: string): string {
    if (uri.indexOf(':') < 0)
      return (
        (this.labels as unknown as Record<string, string|undefined>)[uri]
          ?? defaultVal
          ?? this.labels.notAvailable
      );
    return this.vocabs.getTerm(uri, this.lang, defaultVal);   
  }

  // Expands a qualified name using the dictionary given.
  //
  // The dictionary maps abbreviations to URL bases to prepend when they are
  // found.
  //
  // If there is no qualified name abbreviation, or it is not in the
  // dictionary, the defaultValue parameter is returned instead.
  //
  // If the defaultValue is undefined, then the original qname is
  // returned, unchanged except for being trimmed of whitespace.
  qname2uri(qname: string, dict: Record<string, string>, defaultValue?: string): string {
    qname = qname.trim();
    // Parse the qname 
    const [_, abbrev, rest] = PopupApi.qNameRegex.exec(qname) || [];
    if (_ != null && abbrev in dict) { // note loose match also matches undefined
      const expansion = dict[abbrev];
      return expansion + rest.replace(/^[/]+/, '');
    }
    return defaultValue ?? qname;
  }

  // Returns an array of at least one string, which may be empty.
  //
  // Makes a best-effort attempt for various types of primitive and objects,
  // but from the point of view of showing property values. Null and
  // undefined values convert to the defaultValue. Numbers as numbers, booleans
  // as booleans, URILs as urls, dates as (the canonical format) date.
  // Anything else becomes the defaultValue.
  stringify(value: unknown, defaultValue: string = ''): string[] {
    switch(typeof value) {
      case 'string': return [value];
      case 'number':
      case 'boolean':
        return [String(value)];
      case 'object':
        if (value instanceof String)
          return [value.toString()];
        
        if (value instanceof Number || value instanceof BigInt)
          return [value.toString()];
        
        if (value instanceof Date)
          return [value.toDateString()];

        if (value instanceof URL)
          return [value.toString()];

        if (value instanceof Array) {
          const vals = value.flatMap(item => this.stringify(item));
          if (vals.length > 0)
            return vals;
          else
            return [defaultValue]; // Ensure at least one element
        }
        // Other objects? Note - no plain objects expected.
        // Fall through.
      default:
        return [defaultValue];  
    }
  }
  
  escapeHtml(something: unknown, defaultValue: string = ''): string {
    const text = this.stringify(something, defaultValue).join('');

    return text
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  escapeUri(something: unknown, defaultValue: string = ''): string {
    const text = this.stringify(something, defaultValue).join('');

    return encodeURI(text);
  }

  // Create a link.
  //
  // literalOrProp: indicates what the link target should be.
  // opts: options.
  //
  //
  // If opts.as is not set, literalOrProp can be a literal string,
  // or a property name prefixed with a period.
  //
  // If opts.as is 'propName' then it's a property name.
  // If opts.as is 'literal' then it's a literal value.
  //
  // If opts.template is set, this is used as a template, with %u being
  // replaced with the URI-escaped target URI, and %s with the html
  // escaped value of opt.text, if set - else the HTML-escaped URI
  //
  // If opts.baseUri is set to a string, then this is prepended to the URI, with
  // any leading / delimiters stripped off the front of the URI.
  //
  // If opts.baseUri is set to an object, this is assumed to be a
  // QName look-up table, and any abbreviated prefix is prefixed with
  // appropriate URI matching the prefix in the table (likewise with
  // leading / delimiters stripped)
  link(literalOrProp: string,
       opts: LinkOpts = {}): string {
    
    // Interpret the value, when appropriate
    let value: unknown;
    switch (opts.as) {
      case 'literal': // don't interpret value, it's a pure literal
        value = literalOrProp;
        break;
      case 'propName': // interpret as a property name
        value = this.initiative[literalOrProp];
        break;
      default: // A literal, unless prefixed with a period        
        if (literalOrProp.startsWith('.'))
          value = this.initiative[literalOrProp.substring(1)];
        else
          value = literalOrProp;
        break;
    }

    // Empty values should not be expanded
    if (typeof value !== 'string')
      return '';
    if (value === '')
      return '';
    
    const text = this.escapeHtml(opts.text == undefined? value : opts.text);
    const template = opts.template ?? '<a href="%u" target="_blank" >%s</a>';
    
    let uri: string = value;

    // Prepend the baseUri if given, and there is no URI scheme
    if (opts.baseUri !== undefined && !uri.match(/^\w+:[/][/]/)) {
      // There are two sorts of prepend, depending on the
      // baseUri option type.
      
      if (typeof opts.baseUri === 'string') {
        // Perform simple prefixing of the URI with baseUri as a string
        uri = opts.baseUri + uri.replace(/^[/]+/, '');
      }
      else {
        // Perform qualified name expansion, when baseUri is a look-up hash
        uri = this.qname2uri(uri, opts.baseUri);
      }
    }

    uri = encodeURI(uri);
    
    return template
      .replaceAll(/%s/g, text)
      .replaceAll(/%u/g, uri)
      .replaceAll('%%', '%');
  }
  
  facebookLink(propertyName: string, opts: LinkOpts = {}): string {
    return this.link(propertyName,
                     {...opts,
                      template: '<a class="fab fa-facebook" href="%u" target="_blank" ></a>',
                      baseUri: 'https://facebook.com/'});
  }
  
  twitterLink(propertyName: string, opts: LinkOpts = {}): string {
    return this.link(propertyName,
                     {...opts,
                      template: '<a class="fab fa-twitter" href="%u" target="_blank" ></a>',
                      baseUri: 'https://x.com/'});
  }
  
  mailLink(propertyName: string, opts: LinkOpts = {}): string {
    return this.link(propertyName,
                     {...opts,
                      template: '<a class="fa fa-at" href="%u" target="_blank" ></a>',
                      baseUri: 'mailto:'});
  }
  
  telLink(propertyName: string, opts: LinkOpts = {}): string {
    let phone = this.initiative.tel;
    if (typeof(phone) !== 'string')
      return '';
    phone = phone.replaceAll(/\D+/g, '');
    return this.link(propertyName,
                     {...opts,
                      template: '<a class="fa fa-phone" href="%u" target="_blank" ></a>',
                      baseUri: 'tel:'});
  }
  
  address(): string {

    // We want to add the whole address into a single para
    // Not all orgs have an address
    const addressAry = this.addressFields.flatMap(field => {
      const value = this.initiative[field];
      if (typeof value !== 'string')
        return [];
      let str: string = value.trim();
      if (str === '')
        return [];
      
      str = this
        .escapeHtml(str)
        .replaceAll(/\s*[,\n;]+\s*/g, "<br/>")
        .replaceAll(/\s+/g, " ");
      
      /* FIXME expand terms      
      if (this.initiative.countryId) {
        const countryName = this.getTerm('countryId');
        address += (address.length ? "<br/>" : "") + (countryName || this.initiative.countryId);
        }*/
      return str;
    });
    
    if ((!this.initiative.lat || !this.initiative.lng)
      && (!this.initiative.manLat || !this.initiative.manLat)) {
      addressAry.push(`<i>${this.escapeHtml(this.labels.noLocation)}</i>`);
    }

    if (addressAry.length) {
      return `<p class="sea-initiative-address">${addressAry.join('</br>')}</p>`;
    }
    
    return '';
  }
}
