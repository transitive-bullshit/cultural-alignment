export type JsonLdData = {
  readonly [property: string]: JsonLdValue | undefined
}

type JsonLdValue =
  | JsonLdData
  | readonly JsonLdValue[]
  | boolean
  | null
  | number
  | string

type JsonLdProps = {
  readonly data: JsonLdData
  readonly scope: 'page' | 'site'
}

export function JsonLd({ data, scope }: JsonLdProps) {
  return (
    <script
      type='application/ld+json'
      data-json-ld={scope}
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  )
}

export function serializeJsonLd(data: JsonLdData) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
