Field types currently in existance:
vocabs(vocabId)
- baseMembershipType (bmt) from baseMembershipType
- countryId (coun) from countryId
- primaryActivity (aci) from primaryActivity
- regionId (reg) from regionId
- superRegionId (sreg) from superRegionId

- activity (aci) from activity (writable)
- qualifier (aci!?) from qualifier
- regorg (os) from regorg

vocab collections:
- otherActivities (aci) from activity (writable)
- qualifiers (aci) from qualifier (writable)
- orgStructure (os) from regorg (writable)


values:
- dataset
- desc
- email
- facebook
- lat (writable)
- lng (writable)
- locality
- manLat (writable)
- manLng (writable)
- name
- postcode
- region
- street
- tel
- twitter
- uniqueId from uri
- uri
- within
- www


synthesised:
- searchstr (string)
- shortPostcode (string)


fromCode AKA vocabs
-    { propertyName: 'activity', paramName: 'activity', init: fromCode, writable: true, vocabUri: 'aci:' },
-    { propertyName: 'baseMembershipType', paramName: 'baseMembershipType', init: fromCode, vocabUri: 'bmt:' },
-    { propertyName: 'countryId', paramName: 'countryId', init: fromCode, vocabUri: 'coun:' },
-    { propertyName: 'primaryActivity', paramName: 'primaryActivity', init: fromCode, vocabUri: 'aci:' },
-    { propertyName: 'qualifier', paramName: 'qualifier', init: fromCode, vocabUri: 'aci:' }, // note dupe paramName following
-    { propertyName: 'regionId', paramName: 'regionId', init: fromCode, vocabUri: 'reg:' },
-    { propertyName: 'regorg', paramName: 'regorg', init: fromCode, vocabUri: 'os:' },
-    { propertyName: 'superRegionId', paramName: 'superRegionId', init: fromCode, vocabUri: 'sreg:' },


asList AKA multi vocabs
-    { propertyName: 'qualifiers', paramName: 'qualifier', init: asList, writable: true, vocabUri: 'aci:' },
-    { propertyName: 'orgStructure', paramName: 'regorg', init: asList, writable: true, vocabUri: 'os:' },
-    { propertyName: 'otherActivities', paramName: 'activity', init: asList, writable: true, vocabUri :'aci:' },

fromParam AKA values
-    { propertyName: 'dataset', paramName: 'dataset', init: fromParam },
-    { propertyName: 'desc', paramName: 'desc', init: fromParam },
-    { propertyName: 'email', paramName: 'email', init: fromParam },
-    { propertyName: 'facebook', paramName: 'facebook', init: fromParam },
-     { propertyName: 'lat', paramName: 'lat', init: fromParam, writable: true },
-     { propertyName: 'lng', paramName: 'lng', init: fromParam, writable: true },
-    { propertyName: 'locality', paramName: 'locality', init: fromParam },
-    { propertyName: 'manLat', paramName: 'manLat', init: fromParam, writable: true },
-    { propertyName: 'manLng', paramName: 'manLng', init: fromParam, writable: true },
-    { propertyName: 'name', paramName: 'name', init: fromParam },
-    { propertyName: 'postcode', paramName: 'postcode', init: fromParam },
-    { propertyName: 'region', paramName: 'region', init: fromParam },
-    { propertyName: 'street', paramName: 'street', init: fromParam },
-    { propertyName: 'tel', paramName: 'tel', init: fromParam },
-    { propertyName: 'twitter', paramName: 'twitter', init: fromParam },
-    { propertyName: 'uniqueId', paramName: 'uri', init: fromParam },
-    { propertyName: 'uri', paramName: 'uri', init: fromParam },
-    { propertyName: 'within', paramName: 'within', init: fromParam },
-    { propertyName: 'www', paramName: 'www', init: fromParam },


Special case, search str
-    { propertyName: 'searchstr', paramName: '_', init: asSearchStr, writable: true },


Special case, custom value
-    {
-      propertyName: 'shortPostcode', paramName: 'postcode',
-      init: (def: PropDef, params: InitiativeObj) => ?

