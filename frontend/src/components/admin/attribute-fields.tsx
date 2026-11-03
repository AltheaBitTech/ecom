import type { ReactNode } from 'react';

/**
 * Renders the tenant's custom product attributes as a form, driven entirely by
 * their draft-07 `product_attribute_schema`. The store owner defines the schema
 * in Settings; this component reflects it with zero per-tenant code — a new
 * attribute in the schema becomes a new field here automatically. The backend is
 * the authority: it re-validates every value against the same schema on save.
 */

interface JsonSchemaProperty {
  type?: 'string' | 'number' | 'integer' | 'boolean';
  title?: string;
  description?: string;
  enum?: (string | number)[];
  format?: string;
}

interface JsonSchema {
  type?: string;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
}

export function AttributeFields({
  schema,
  value,
  onChange,
}: {
  schema: Record<string, unknown>;
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
}) {
  const s = schema as JsonSchema;
  const properties = s.properties ?? {};
  const keys = Object.keys(properties);
  const required = new Set(s.required ?? []);

  if (keys.length === 0) {
    return (
      <p className="text-sm text-ink-faint">
        No custom attributes are defined for this store. Add some under Settings to capture
        category-specific details (size, material, expiry, …).
      </p>
    );
  }

  function set(key: string, next: unknown) {
    const draft = { ...value };
    if (next === '' || next === undefined) {
      delete draft[key];
    } else {
      draft[key] = next;
    }
    onChange(draft);
  }

  return (
    <div className="space-y-4">
      {keys.map((key) => {
        const prop = properties[key];
        const label = prop.title ?? key;
        const req = required.has(key);
        const current = value[key];

        return (
          <Field key={key} label={label} required={req} hint={prop.description}>
            {prop.enum ? (
              <select
                className="input"
                value={current === undefined ? '' : String(current)}
                onChange={(e) => set(key, coerceEnum(e.target.value, prop))}
                required={req}
              >
                <option value="">Select…</option>
                {prop.enum.map((opt) => (
                  <option key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </option>
                ))}
              </select>
            ) : prop.type === 'boolean' ? (
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={current === true}
                  onChange={(e) => set(key, e.target.checked ? true : undefined)}
                />
                <span className="text-ink-soft">Yes</span>
              </label>
            ) : prop.type === 'number' || prop.type === 'integer' ? (
              <input
                type="number"
                step={prop.type === 'integer' ? '1' : 'any'}
                className="input"
                value={current === undefined ? '' : String(current)}
                onChange={(e) => set(key, e.target.value === '' ? undefined : Number(e.target.value))}
                required={req}
              />
            ) : (
              <input
                type={prop.format === 'date' ? 'date' : 'text'}
                className="input"
                value={current === undefined ? '' : String(current)}
                onChange={(e) => set(key, e.target.value)}
                required={req}
              />
            )}
          </Field>
        );
      })}
    </div>
  );
}

function coerceEnum(raw: string, prop: JsonSchemaProperty): unknown {
  if (raw === '') return undefined;
  if (prop.type === 'number' || prop.type === 'integer') return Number(raw);
  return raw;
}

function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-ink-faint">{hint}</p>}
    </div>
  );
}
