import { describe, expect, it } from 'vitest'
import { decodeEntities, htmlToText, splitSentences } from './text'

describe('decodeEntities', () => {
  it('decodes named, decimal and hex entities and keeps unknown ones', () => {
    expect(decodeEntities('A &amp; B &#8217; &#x2014; &rsquo; &bogus;')).toBe('A & B ’ — ’ &bogus;')
  })

  it('leaves code points beyond Unicode as written', () => {
    expect(decodeEntities('&#99999999;')).toBe('&#99999999;')
  })
})

describe('htmlToText', () => {
  it('turns block elements into lines and drops other tags', () => {
    expect(
      htmlToText(
        '<h3>ITAR</h3><p>Must be a <strong>U.S.&nbsp;person</strong>.</p><ul><li>One</li><li>Two</li></ul>',
      ),
    ).toBe('ITAR\nMust be a U.S. person .\nOne\nTwo')
  })

  it('drops scripts, styles and comments', () => {
    expect(htmlToText('<style>p{}</style><script>alert(1)</script><!-- x --><p>Text</p>')).toBe(
      'Text',
    )
  })

  it('reads Greenhouse content once it is unescaped', () => {
    expect(htmlToText(decodeEntities('&lt;p&gt;Must be a U.S. citizen&lt;/p&gt;'))).toBe(
      'Must be a U.S. citizen',
    )
  })
})

describe('splitSentences', () => {
  it('keeps "U.S." inside its sentence', () => {
    expect(splitSentences('Applicants must be a U.S. person. We sponsor nothing.')).toEqual([
      'Applicants must be a U.S. person.',
      'We sponsor nothing.',
    ])
  })

  it('keeps U.S.C. citations and list markers together', () => {
    expect(
      splitSentences('Must be a (i) U.S. citizen, or (iv) asylee under 8 U.S.C. § 1158. Next one.'),
    ).toEqual(['Must be a (i) U.S. citizen, or (iv) asylee under 8 U.S.C. § 1158.', 'Next one.'])
  })

  it('treats each line as its own sentence', () => {
    expect(splitSentences('ITAR Requirements\nMust be a U.S. citizen')).toEqual([
      'ITAR Requirements',
      'Must be a U.S. citizen',
    ])
  })

  it('splits on question and exclamation marks', () => {
    expect(splitSentences('Do you need a visa? We can help! Great.')).toEqual([
      'Do you need a visa?',
      'We can help!',
      'Great.',
    ])
  })
})
