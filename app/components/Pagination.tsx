'use client'

interface PaginationProps {
  currentPage: number
  totalItems: number
  itemsPerPage: number
  onPageChange: (page: number) => void
}

export default function Pagination({ currentPage, totalItems, itemsPerPage, onPageChange }: PaginationProps) {
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsPerPage))
  const from = totalItems > 0 ? ((currentPage - 1) * itemsPerPage) + 1 : 0
  const to = Math.min(currentPage * itemsPerPage, totalItems)

  return (
    <div className="mt-4 pagination-flex">
      <div className="text-sm text-gray-500 order-2 sm:order-1">
        Mostrando {from} - {to} de {totalItems}
      </div>
      <div className="pagination-controls flex flex-wrap items-center justify-center sm:justify-end gap-2 order-1 sm:order-2">
        <button
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
          className="px-3 py-1 rounded-lg border bg-white text-sm disabled:opacity-50 btn-sm"
        >
          Anterior
        </button>
        <span className="text-sm text-gray-600 whitespace-nowrap">Página {currentPage} / {totalPages}</span>
        <button
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
          className="px-3 py-1 rounded-lg border bg-white text-sm disabled:opacity-50 btn-sm"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}
