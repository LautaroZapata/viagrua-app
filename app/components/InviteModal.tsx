'use client'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import InvitacionQR from './InvitacionQR'

interface InviteModalProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    empresaId: string | null
}

export default function InviteModal({ open, onOpenChange, empresaId }: InviteModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Invitar Chofer</DialogTitle>
                </DialogHeader>
                {/* key: al reabrir el modal se descarta el codigo anterior */}
                <InvitacionQR key={String(open)} empresaId={empresaId} />
            </DialogContent>
        </Dialog>
    )
}
