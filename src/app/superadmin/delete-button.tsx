'use client';

import { deleteBusiness } from './actions';
import { Trash2 } from '@/components/icons';

export function DeleteBusinessForm({ slug, name }: { slug: string; name: string }) {
  return (
    <form
      action={deleteBusiness}
      onSubmit={(e) => {
        if (!confirm(`¿Estás seguro de que quieres eliminar "${name}" completamente? Se borrará todo (usuarios, citas, servicios, etc.)`)) {
          e.preventDefault();
        }
      }}
    >
      <input type="hidden" name="slug" value={slug} />
      <button
        type="submit"
        className="inline-flex min-h-9 items-center gap-2 rounded-lg bg-danger-bg px-2 text-xs font-medium text-danger-text transition-colors duration-200 hover:bg-danger-border"
      >
        <Trash2 className="h-4 w-4" />
        Eliminar
      </button>
    </form>
  );
}
