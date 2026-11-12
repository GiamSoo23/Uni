import { CATEGORIES } from '@uni/core'
import Link from 'next/link'
import type { ReactNode } from 'react'
import type { ViewParams } from '@/lib/search-params'

const fieldClass =
  'rounded-md border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900'

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
      {label}
      {children}
    </label>
  )
}

/** Formulario GET: los filtros viven en la URL y funcionan sin JavaScript. */
export function FilterForm({ params, terms }: { params: ViewParams; terms: string[] }) {
  const termOptions =
    terms.includes(params.term) || params.term === 'all' ? terms : [params.term, ...terms]

  return (
    <form method="get" action="/" className="flex flex-wrap items-end gap-3">
      <Field label="Buscar">
        <input
          type="search"
          name="q"
          defaultValue={params.q}
          placeholder="Empresa o título"
          maxLength={100}
          className={`${fieldClass} w-56`}
        />
      </Field>
      <Field label="Temporada">
        <select name="term" defaultValue={params.term} className={fieldClass}>
          <option value="all">Todas</option>
          {termOptions.map((term) => (
            <option key={term} value={term}>
              {term}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Categoría">
        <select name="category" defaultValue={params.category} className={fieldClass}>
          <option value="all">Todas</option>
          {CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {category}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Región">
        <select name="region" defaultValue={params.region} className={fieldClass}>
          <option value="us">EE. UU. y remoto US</option>
          <option value="any">Cualquiera</option>
        </select>
      </Field>
      <Field label="Elegibilidad">
        <select name="eligible" defaultValue={params.eligible} className={fieldClass}>
          <option value="hide">Ocultar sin sponsorship o con ciudadanía</option>
          <option value="show">Mostrar todas</option>
        </select>
      </Field>
      <Field label="Publicada">
        <select name="days" defaultValue={params.days} className={fieldClass}>
          <option value="all">Cualquier fecha</option>
          <option value="3">Últimos 3 días</option>
          <option value="7">Última semana</option>
          <option value="14">Últimas 2 semanas</option>
          <option value="30">Último mes</option>
        </select>
      </Field>
      <button
        type="submit"
        className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
      >
        Filtrar
      </button>
      <Link
        href="/"
        className="py-1.5 text-sm text-zinc-500 underline hover:text-zinc-800 dark:hover:text-zinc-200"
      >
        Restablecer
      </Link>
    </form>
  )
}
