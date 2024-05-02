
import type { Assoc } from './common-types';

/// A list of the ISO639-1 2 character international country
/// codes. Note, this standard changes slowly...
/// From https://www.loc.gov/standards/iso639-2/php/English_list.php
export const ISO639_1_CODES = [
  'AA', 'AB', 'AE', 'AF', 'AK', 'AM', 'AN', 'AR', 'AS', 'AV',
  'AY', 'AZ', 'BA', 'BE', 'BG', 'BH', 'BI', 'BM', 'BN', 'BO', 
  'BR', 'BS', 'CA', 'CE', 'CH', 'CO', 'CR', 'CS', 'CU', 'CV', 
  'CY', 'DA', 'DE', 'DV', 'DZ', 'EE', 'EL', 'EN', 'EO', 'ES', 
  'ET', 'EU', 'FA', 'FF', 'FI', 'FJ', 'FO', 'FR', 'FY', 'GA', 
  'GD', 'GL', 'GN', 'GU', 'GV', 'HA', 'HE', 'HI', 'HO', 'HR', 
  'HT', 'HU', 'HY', 'HZ', 'IA', 'ID', 'IE', 'IG', 'II', 'IK', 
  'IO', 'IS', 'IT', 'IU', 'JA', 'JV', 'KA', 'KG', 'KI', 'KJ', 
  'KK', 'KL', 'KM', 'KN', 'KO', 'KR', 'KS', 'KU', 'KV', 'KW', 
  'KY', 'LA', 'LB', 'LG', 'LI', 'LN', 'LO', 'LT', 'LU', 'LV', 
  'MG', 'MH', 'MI', 'MK', 'ML', 'MN', 'MR', 'MS', 'MT', 'MY', 
  'NA', 'NB', 'ND', 'NE', 'NG', 'NL', 'NN', 'NO', 'NR', 'NV', 
  'NY', 'OC', 'OJ', 'OM', 'OR', 'OS', 'PA', 'PI', 'PL', 'PS', 
  'PT', 'QU', 'RM', 'RN', 'RO', 'RU', 'RW', 'SA', 'SC', 'SD', 
  'SE', 'SG', 'SI', 'SK', 'SL', 'SM', 'SN', 'SO', 'SQ', 'SR', 
  'SS', 'ST', 'SU', 'SV', 'SW', 'TA', 'TE', 'TG', 'TH', 'TI', 
  'TK', 'TL', 'TN', 'TO', 'TR', 'TS', 'TT', 'TW', 'TY', 'UG', 
  'UK', 'UR', 'UZ', 'VE', 'VI', 'VO', 'WA', 'WO', 'XH', 'YI', 
  'YO', 'ZA', 'ZH', 'ZU',
] as const;

export type Iso6391Code = (typeof ISO639_1_CODES)[number];

export function isIso6391Code(str: string): str is Iso6391Code {
  return (ISO639_1_CODES as unknown as string[]).includes(str); // We seem to have to coerce to use .include(str)
}

/// This defines all the phrases which are currently used, by ID.
/// Any language translation should provide all of these.
export interface PhraseBook {
  aboutTitle: string;
  allCountries: string;
  allEntries: string;
  and: string;
  any: string;
  applyFilters: string;
  clearFilters: string;
  clickToSearch: string;
  clickForDetailsHereAndMap: string;
  close: string;
  contact: string;
  contributers: string;
  countries: string;
  datasets: string;
  directory: string;
  directoryEntries: string;
  errorLoading: string;
  hideDirectory: string;
  in: string;
  loading: string;
  mapDisclaimer: string;
  matchingResults: string;
  mixedSources: string;
  noLocation: string;
  notAvailable: string;
  nothingMatched: string;  
  otherData: string;
  poweredBy: string;
  property_shortPostcode: string;
  search: string;
  searchIn: string;
  searchInitiatives: string;
  secondaryActivities: string;
  showDatasets: string;
  showDirectory: string;
  showInfo: string;
  showSearch: string;
  source: string;
  technicalInfo: string;
  underConstruction: string;
  whenSearch: string;
  zoomIn: string;
  zoomOut: string;
}

export type PhraseBooks = Assoc<Iso6391Code, PhraseBook>;

// FIXME add ticket about UI languages
export const phraseBooks: PhraseBooks = {
  EN: {
    aboutTitle: "About",
    allCountries: "All Countries",
    allEntries: "All Entries",
    and: "AND",
    any: "Any",
    applyFilters: "Apply filters",
    clearFilters: "Clear filters",
    clickToSearch: "Click to search",
    clickForDetailsHereAndMap: "Click to see details here and on map",
    close: "Close ",
    contact: "Contact",
    contributers: "contributers",
    countries: "Countries",
    datasets: "Datasets",
    directory: "Directory",
    directoryEntries: "directory entries",
    errorLoading: "Error loading",
    hideDirectory: "Hide directory",
    in: "in",
    loading: "Loading",
    mapDisclaimer: "This map contains indications of areas where there are disputes over territories. The ICA does not endorse or accept the boundaries depicted on the map.",
    matchingResults: "matching results",
    mixedSources: "Mixed Sources",
    noLocation: "No location available",
    notAvailable: "N / A",
    nothingMatched: "Nothing matched the search",
    otherData: "Other data",
    poweredBy: "Powered by Geoapify",
    property_shortPostcode: "Short postcode",
    search: "Search",
    searchIn: "Search in ?",
    searchInitiatives: "Search initiatives",
    secondaryActivities: "Secondary Activities",
    showDatasets: "Show datasets",
    showDirectory: "Show directory",
    showInfo: "Show info",
    showSearch: "Show search",
    source: "The source data of the content is here:",
    technicalInfo: "Technical information about the technology behind this map and directory can be found here:",
    underConstruction: "This section is under construction.",
    whenSearch: "When you search, or click on map markers, you'll see the results here",
    zoomIn: "Zoom in",
    zoomOut: "Zoom out",
  },
  FR: {
    aboutTitle: "À propos",
    allCountries: "Tous les pays",
    allEntries: "Toutes les entrées",
    and: "ET",
    any: "Tout afficher",
    applyFilters: "Appliquer les filtres",
    clearFilters: "Réinitialiser les filtres",
    clickToSearch: "Cliquez pour rechercher",
    clickForDetailsHereAndMap: "Cliquez pour voir les détails ici et sur la carte",
    close: "Fermer ",
    contact: "Contact",
    contributers: "Contributeurs",
    countries: "Des pays",
    datasets: "Ensembles de données",
    directory: "Annuaire",
    directoryEntries: "entrées d'annuaire",
    errorLoading: "FIXME",
    hideDirectory: "Masquer l’annuaire",
    in: "dans",
    loading: "Chargement des données",
    mapDisclaimer: "Cette carte contient des indications sur les zones où il y a des différends au sujet territorial. L'ACI n'approuve ni n'accepte les frontières représentées sur la carte.",
    matchingResults: "résultats correspondants",
    mixedSources: "Sources mixtes",
    noLocation: "Aucun emplacement disponible",
    notAvailable: "Pas disponible",
    nothingMatched: "Rien ne correspond à la recherche",
    otherData: "Autres données",
    poweredBy: "Créé par Geoapify",
    property_shortPostcode: "Code postal court",
    search: "Rechercher",
    searchIn: "Rechercher dans ?",
    searchInitiatives: "Rechercher des initiatives",
    secondaryActivities: "Activités secondaires",
    showDatasets: "Afficher les ensembles de données",
    showDirectory: "Afficher l’annuaire",
    showInfo: "Afficher les informations",
    showSearch: "Afficher la recherche",
    source: "Les données sources de ce contenu se trouvent ici:",
    technicalInfo: "Des informations techniques sur la technologie derrière cette carte et ce répertoire peuvent être trouvées ici:",
    underConstruction: "Cette section est en construction.",
    whenSearch: "Lorsque vous effectuez une recherche ou cliquez sur les repères de la carte, les résultats s’affichent ici.",
    zoomIn: "Zoom avant",
    zoomOut: "Zoom arrière",
  },
  ES: {
    aboutTitle: "Sobre este mapa",
    allCountries: "Todos los países",
    allEntries: "Todas las entradas",
    and: "Y",
    any: "Qualquiera",
    applyFilters: "Aplicar filtros",
    clearFilters: "Borrar filtros",
    clickToSearch: "Haga clic para buscar",
    clickForDetailsHereAndMap: "Haga clic para ver detalles aquí y en el mapa",
    close: "Cerrar ",
    contact: "Contacto",
    contributers: "Colaboradores",
    countries: "Países",
    datasets: "Conjuntos de datos",
    directory: "Directorio",
    directoryEntries: "entradas de directorio",
    errorLoading: "FIXME",
    hideDirectory: "Ocultar directorio",
    in: "en",
    loading: "Cargando…",
    mapDisclaimer: "Este mapa contiene indicaciones de zonas donde hay disputas territoriales. La ACI no respalda ni acepta las fronteras representadas en el mapa.",
    matchingResults: "resultados coincidentes",
    mixedSources: "Fuentes mixtas",
    noLocation: "No hay ubicación disponible",
    notAvailable: "No disponible",
    nothingMatched: "Nada coincidió con la búsqueda",
    otherData: "Otros datos",
    poweredBy: "Desarrollado por Geoapify",
    property_shortPostcode: "Código postal corto",
    search: "Buscar",
    searchIn: "Buscar en…",
    searchInitiatives: "Buscar iniciativas",
    secondaryActivities: "Actividades secundarias",
    showDatasets: "Mostrar conjuntos de datos",
    showDirectory: "Mostrar directorio",
    showInfo: "Mostrar información",
    showSearch: "Mostrar búsqueda",
    source: "Los datos de origen de este contenido están aquí:",
    technicalInfo: "Consulta aquí la información técnica sobre la tecnología con la que se han elaborado el mapa y el directorio:",
    underConstruction: "Esta sección está en construcción.",
    whenSearch: "Los resultados de la búsqueda o selección en los marcadores del mapa se mostrarán aquí.",
    zoomIn: "Acercar",
    zoomOut: "Alejar",
  },
  KO: {
    aboutTitle: "정보",
    allCountries: "모든 나라들",
    allEntries: "모든 항목들",
    and: "그리고",
    any: "아무거나",
    applyFilters: "필터 적용",
    clearFilters: "필터 지우기",
    clickToSearch: "클릭하여 검색",
    clickForDetailsHereAndMap: "여기와 지도에서 세부정보를 보려면 클릭하세요.",
    close: "닫기",
    contact: "연락",
    contributers: "기여자",
    countries: "국가",
    datasets: "데자료",
    directory: "디렉토리",
    directoryEntries: "디렉토리 항목",
    errorLoading: "FIXME",
    hideDirectory: "디렉토리 숨기기",
    in: "에",
    loading: "로딩",
    mapDisclaimer: "이 지도에는 영토에 대한 분쟁이 있는 지역의 표시가 포함되어 있습니다. ICA는 지도에 표시된 경계를 승인하거나 수락하지 않습니다.",
    matchingResults: "일치하는 결과",
    mixedSources: "혼합",
    noLocation: "사용 가능한 위치 없음",
    notAvailable: "사용 불가",
    nothingMatched: "검색과 일치하는 항목이 없습니다",
    otherData: "다른 자료",
    poweredBy: "Geoapify에 의해 구동됨",
    property_shortPostcode: "짧은 우편번호",
    search: "검색",
    searchIn: "검색?",
    searchInitiatives: "이니셔티브 찾기",
    secondaryActivities: "보조 활동",
    showDatasets: "자료 표시",
    showDirectory: "디렉토리 표시",
    showInfo: "정보 표시",
    showSearch: "검색 표시",
    source: "이 콘텐츠의 소스 데이터는 여기:",
    technicalInfo: "이 지도 및 디렉토리 이면의 기술에 대한 기술 정보를 찾을 수 있습니다 여기:",
    underConstruction: "이 섹션은 공사 중입니다.",
    whenSearch: "검색시 혹은 지도표지를 클릭할시 결과는 여기서 볼수 있음.",
    zoomIn: "쥼인",
    zoomOut: "쥼아웃",
  }
} as const;

export const functionalLabels = phraseBooks; // Alias for backcompat
