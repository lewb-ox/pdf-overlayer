import { useEffect, useId, useState } from 'react';
import type { Legend } from './model';

function LegendField({ label, value, maxLength, multiline = false, onSave }: { label: string; value: string; maxLength: number; multiline?: boolean; onSave: (value: string) => void }) {
  const [draft, setDraft] = useState(value);
  const id = useId();
  useEffect(() => setDraft(value), [value]);
  const attributes = { value: draft, maxLength, onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setDraft(e.target.value), onBlur: () => { if (draft !== value) onSave(draft); } };
  return <div className="legend-field"><label htmlFor={id}>{label}</label>{multiline ? <textarea id={id} {...attributes} rows={3}/> : <input id={id} {...attributes}/>}</div>;
}

export function LegendFields({ legend, defaultTitle, onChange }: { legend: Legend; defaultTitle: string; onChange: (update: Partial<Legend>) => void }) {
  return <details className="legend-fields"><summary>Edit legend text</summary>
    <LegendField label="Legend title" value={legend.title ?? defaultTitle} maxLength={300} onSave={title => onChange({ title })}/>
    <LegendField label="Legend subtitle" value={legend.subtitle ?? 'AV category overlay'} maxLength={300} onSave={subtitle => onChange({ subtitle })}/>
    <LegendField label="Legend notes" value={legend.note ?? ''} maxLength={1000} multiline onSave={note => onChange({ note })}/>
    <LegendField label="Legend footer" value={legend.footer ?? ''} maxLength={300} multiline onSave={footer => onChange({ footer })}/>
  </details>;
}
