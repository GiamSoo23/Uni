export {
  DETECTOR_VERSION,
  detectRestrictions,
  MAX_QUOTE_LENGTH,
  RESTRICTION_KINDS,
  strongestFlag,
  type DescriptionFlag,
  type RestrictionKind,
} from './detector'
export {
  createDescriptionReader,
  type DescriptionRead,
  type DescriptionReader,
  type DescriptionReaderOptions,
} from './reader'
export {
  descriptionFromResponse,
  descriptionSourceFor,
  type DescriptionAts,
  type DescriptionParse,
  type DescriptionSource,
} from './sources'
export { decodeEntities, htmlToText, normalizeText, splitSentences } from './text'
export { EMPTY_DESCRIPTION_INDEX, type DescriptionIndex } from './description-index'
