'use client'
import { Button } from '@/components/ui/button'

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
      <div className="text-sm text-muted-foreground order-2 sm:order-1">
        Mostrando {from} - {to} de {totalItems}
      </div>
      <div className="pagination-controls flex flex-wrap items-center justify-center sm:justify-end gap-2 order-1 sm:order-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.max(1, currentPage - 1))}
          disabled={currentPage <= 1}
        >
          Anterior
        </Button>
        <span className="text-sm text-muted-foreground whitespace-nowrap">Pagina {currentPage} / {totalPages}</span>
        <Button
          variant="outline"
          size="sm"
          onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
          disabled={currentPage >= totalPages}
        >
          Siguiente
        </Button>
      </div>
    </div>
  )
}
