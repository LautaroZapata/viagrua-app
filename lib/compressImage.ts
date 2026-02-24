/**
 * Comprime una imagen antes de subirla
 * @param file - Archivo de imagen original
 * @param maxWidth - Ancho máximo (default: 1200px)
 * @param quality - Calidad de compresión (0-1, default: 0.7)
 * @returns Blob comprimido
 */
export async function compressImage(
    file: File,
    maxWidth: number = 1200,
    quality: number = 0.7
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader()
        reader.readAsDataURL(file)
        reader.onload = (event) => {
            const img = new Image()
            img.src = event.target?.result as string
            img.onload = () => {
                const canvas = document.createElement('canvas')
                let width = img.width
                let height = img.height

                // Redimensionar si es necesario
                if (width > maxWidth) {
                    height = Math.round((height * maxWidth) / width)
                    width = maxWidth
                }

                canvas.width = width
                canvas.height = height

                const ctx = canvas.getContext('2d')
                if (!ctx) {
                    reject(new Error('No se pudo obtener contexto del canvas'))
                    return
                }

                // Dibujar imagen redimensionada
                ctx.drawImage(img, 0, 0, width, height)

                // Convertir a blob con compresión
                canvas.toBlob(
                    (blob) => {
                        if (blob) {
                            resolve(blob)
                        } else {
                            reject(new Error('Error al comprimir imagen'))
                        }
                    },
                    'image/jpeg',
                    quality
                )
            }
            img.onerror = () => reject(new Error('Error al cargar imagen'))
        }
        reader.onerror = () => reject(new Error('Error al leer archivo'))
    })
}

/**
 * Formatea el tamaño de archivo para mostrar
 */
export function formatFileSize(bytes: number): string {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
