/**
 * Perkecil foto sebelum diunggah. Hosting serverless membatasi isi permintaan (sekitar 4,5 MB di Vercel),
 * sedangkan foto HP bisa 5–15 MB. Yang dibatasi adalah jumlah piksel, bukan sisi terpanjang, supaya struk yang
 * panjang dan sempit tetap terbaca. Kalau apa pun gagal, file asli dikembalikan.
 */
export async function compressImage(file: File, maxPixels = 2_500_000, maxSide = 3000, quality = 0.85): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, Math.sqrt(maxPixels / (bitmap.width * bitmap.height)), maxSide / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) { bitmap.close(); return file }
    ctx.fillStyle = '#ffffff' // PNG transparan jadi latar putih saat diubah ke JPEG
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(bitmap, 0, 0, width, height)
    bitmap.close()

    const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', quality))
    if (!blob || (scale === 1 && blob.size >= file.size)) return file
    return new File([blob], `${file.name.replace(/\.[^.]+$/, '') || 'struk'}.jpg`, { type: 'image/jpeg' })
  } catch {
    return file
  }
}
