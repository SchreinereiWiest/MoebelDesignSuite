import type { TagCategory } from '@/types'

export type DesignOption = {
  name: string
  slug: string
  category: Exclude<TagCategory, 'TECHNICAL'>
  swatch?: string
}

export type DesignGroup = {
  key: string
  label: string
  shortLabel: string
  description: string
  category: DesignOption['category']
  options: DesignOption[]
}

export const DESIGN_GROUPS: DesignGroup[] = [
  {
    key: 'room',
    label: 'Welcher Raum entsteht?',
    shortLabel: 'Raum',
    description: 'Wähle den Bereich, für den du Inspiration suchst.',
    category: 'ROOM',
    options: [
      { name: 'Küche', slug: 'kueche', category: 'ROOM', swatch: 'linear-gradient(135deg,#d9d0bf,#988e78)' },
      { name: 'Wohnzimmer', slug: 'wohnzimmer', category: 'ROOM', swatch: 'linear-gradient(135deg,#b9aa91,#6f725e)' },
      { name: 'Schlafzimmer', slug: 'schlafzimmer', category: 'ROOM', swatch: 'linear-gradient(135deg,#d8d2ca,#8a7c76)' },
      { name: 'Ankleide', slug: 'ankleide', category: 'ROOM', swatch: 'linear-gradient(135deg,#c5b8a5,#71685e)' },
      { name: 'Bad', slug: 'bad', category: 'ROOM', swatch: 'linear-gradient(135deg,#cfd5d0,#75837f)' },
      { name: 'Homeoffice', slug: 'homeoffice', category: 'ROOM', swatch: 'linear-gradient(135deg,#b9a58a,#58645d)' },
    ],
  },
  {
    key: 'furniture',
    label: 'Was soll gestaltet werden?',
    shortLabel: 'Möbel',
    description: 'Definiere den Möbeltyp oder kombiniere mehrere Bereiche.',
    category: 'FURNITURE',
    options: [
      { name: 'Einbauschrank', slug: 'einbauschrank', category: 'FURNITURE' },
      { name: 'Sideboard', slug: 'sideboard', category: 'FURNITURE' },
      { name: 'Regal', slug: 'regal', category: 'FURNITURE' },
      { name: 'Tisch', slug: 'tisch', category: 'FURNITURE' },
      { name: 'Sitzmöbel', slug: 'sitzmoebel', category: 'FURNITURE' },
      { name: 'Raumteiler', slug: 'raumteiler', category: 'FURNITURE' },
    ],
  },
  {
    key: 'material',
    label: 'Welche Materialien passen?',
    shortLabel: 'Material',
    description: 'Lege die haptische und handwerkliche Richtung fest.',
    category: 'MATERIAL',
    options: [
      { name: 'Eiche', slug: 'eiche', category: 'MATERIAL', swatch: 'repeating-linear-gradient(94deg,#b68a59 0 8px,#c69a65 8px 15px)' },
      { name: 'Nussbaum', slug: 'nussbaum', category: 'MATERIAL', swatch: 'repeating-linear-gradient(94deg,#5c3927 0 7px,#744a32 7px 15px)' },
      { name: 'Esche', slug: 'esche', category: 'MATERIAL', swatch: 'repeating-linear-gradient(94deg,#d5c29c 0 8px,#e1cfaa 8px 16px)' },
      { name: 'Lack', slug: 'lack', category: 'MATERIAL', swatch: 'linear-gradient(135deg,#ddd9cf,#aaa69c)' },
      { name: 'Naturstein', slug: 'naturstein', category: 'MATERIAL', swatch: 'linear-gradient(135deg,#bab5aa,#e1ded6 48%,#928c82 50%,#c8c3b9)' },
      { name: 'Metall', slug: 'metall', category: 'MATERIAL', swatch: 'linear-gradient(135deg,#777b78,#c5c6c1,#60635f)' },
    ],
  },
  {
    key: 'color',
    label: 'Welche Farbwelt fühlt sich richtig an?',
    shortLabel: 'Farbe',
    description: 'Mehrfachauswahl ist möglich – wir zeigen passende Kombinationen.',
    category: 'COLOR',
    options: [
      { name: 'Warmweiß', slug: 'warmweiss', category: 'COLOR', swatch: '#eee9dc' },
      { name: 'Sand', slug: 'sand', category: 'COLOR', swatch: '#c9b99e' },
      { name: 'Greige', slug: 'greige', category: 'COLOR', swatch: '#a99f90' },
      { name: 'Salbeigrün', slug: 'salbeigruen', category: 'COLOR', swatch: '#899080' },
      { name: 'Anthrazit', slug: 'anthrazit', category: 'COLOR', swatch: '#414440' },
      { name: 'Terrakotta', slug: 'terrakotta', category: 'COLOR', swatch: '#a45f43' },
    ],
  },
  {
    key: 'style',
    label: 'Welcher Ausdruck soll bleiben?',
    shortLabel: 'Stil',
    description: 'Wähle eine Stilrichtung als roten Faden für das Konzept.',
    category: 'STYLE',
    options: [
      { name: 'Zeitlos', slug: 'zeitlos', category: 'STYLE' },
      { name: 'Minimalistisch', slug: 'minimalistisch', category: 'STYLE' },
      { name: 'Japandi', slug: 'japandi', category: 'STYLE' },
      { name: 'Skandinavisch', slug: 'skandinavisch', category: 'STYLE' },
      { name: 'Modern', slug: 'modern', category: 'STYLE' },
      { name: 'Natürlich', slug: 'natuerlich', category: 'STYLE' },
    ],
  },
  {
    key: 'feature',
    label: 'Welche Details sind wichtig?',
    shortLabel: 'Details',
    description: 'Verfeinere deine Auswahl mit konstruktiven Merkmalen.',
    category: 'FEATURE',
    options: [
      { name: 'Grifflose Front', slug: 'grifflose-front', category: 'FEATURE' },
      { name: 'Rahmenfront', slug: 'rahmenfront', category: 'FEATURE' },
      { name: 'Offenes Regal', slug: 'offenes-regal', category: 'FEATURE' },
      { name: 'Schiebetür', slug: 'schiebetuer', category: 'FEATURE' },
      { name: 'LED-Beleuchtung', slug: 'led-beleuchtung', category: 'FEATURE' },
      { name: 'Runde Kanten', slug: 'runde-kanten', category: 'FEATURE' },
    ],
  },
]

export const VISIBILITY_LABELS = {
  PRIVATE: 'Eigene Firma',
  RESTRICTED: 'Firmenübergreifend',
  PUBLIC: 'Öffentlich',
} as const

export const CATEGORY_LABELS: Record<TagCategory, string> = {
  ROOM: 'Raum',
  FURNITURE: 'Möbel',
  MATERIAL: 'Material',
  COLOR: 'Farbe',
  STYLE: 'Stil',
  FEATURE: 'Detail',
  TECHNICAL: 'Technisch',
}
