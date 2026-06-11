// Utility functions for formatting and calculations
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

export interface PdfInputSource {
  bytes: Uint8Array;
  type: string;
  name: string;
}

function wrapText(text: string, maxWidth: number, font: any, fontSize: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const width = font.widthOfTextAtSize(testLine, fontSize);
    if (width > maxWidth) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function generateF1PdfBytes(submission: any, grandTotal: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.27, 841.89]);
  
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
  
  // Draw Logo text
  page.drawText('PT. NUSANTARA MINERAL SUKSES ABADI', { x: 40, y: 795, size: 14, font: fontBold });
  page.drawText('VOUCHER SYSTEM PLATFORM', { x: 40, y: 780, size: 8, font: fontRegular });
  
  // Draw Code and Date Box top right
  page.drawRectangle({
    x: 370,
    y: 770,
    width: 185,
    height: 35,
    borderColor: rgb(0,0,0),
    borderWidth: 1.5,
    color: rgb(0.95, 0.95, 0.95)
  });
  page.drawText(submission.kode || '', { x: 380, y: 782, size: 10, font: fontMono });
  page.drawText(`Tanggal : ${formatDateIndonesian(submission.tanggal)}`, { x: 370, y: 755, size: 9, font: fontRegular });

  // Draw title in box
  page.drawRectangle({
    x: 40,
    y: 700,
    width: 515,
    height: 35,
    color: rgb(1, 1, 1),
    borderColor: rgb(0,0,0),
    borderWidth: 1.5,
  });
  page.drawText('BUKTI PENGELUARAN KAS / BANK', { x: 175, y: 712, size: 12, font: fontBold });

  // Draw metadata fields
  const yStart = 675;
  page.drawText('Dibayarkan Kepada  :   ' + (submission.dibayarkanKepada || ''), { x: 45, y: yStart, size: 10, font: fontBold });
  
  page.drawText('Jenis Pengajuan       :   ' + (submission.jenisPengajuan || ''), { x: 45, y: yStart - 18, size: 10, font: fontRegular });
  page.drawText('Kode                       :   ' + (submission.kode || ''), { x: 45, y: yStart - 36, size: 10, font: fontMono });
  
  // Dibayarkan dengan
  page.drawText('Dibayarkan dengan   : ', { x: 45, y: yStart - 54, size: 10, font: fontRegular });
  
  // Draw Checkboxes
  page.drawRectangle({ x: 165, y: yStart - 56, width: 25, height: 12, borderColor: rgb(0,0,0), borderWidth: 1 });
  page.drawText(submission.dibayarkanDengan === 'Tunai' ? 'X' : '', { x: 174, y: yStart - 53, size: 9, font: fontBold });
  page.drawText('Tunai', { x: 195, y: yStart - 54, size: 9, font: fontRegular });
  
  page.drawRectangle({ x: 235, y: yStart - 56, width: 25, height: 12, borderColor: rgb(0,0,0), borderWidth: 1 });
  page.drawText(submission.dibayarkanDengan === 'Cek/Transfer' ? 'X' : '', { x: 244, y: yStart - 53, size: 9, font: fontBold });
  page.drawText('Cek / Transfer', { x: 265, y: yStart - 54, size: 9, font: fontRegular });

  // Draw table
  page.drawRectangle({
    x: 40,
    y: 530,
    width: 515,
    height: 25,
    borderColor: rgb(0,0,0),
    borderWidth: 1.5,
    color: rgb(1,1,1)
  });
  page.drawText('JENIS PENGAJUAN', { x: 50, y: 539, size: 9, font: fontBold });
  page.drawText('JUMLAH', { x: 490, y: 539, size: 9, font: fontBold });

  let curY = 530;
  const items = submission.items || [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const itemTextWrapped = wrapText(item.item || '', 350, fontRegular, 9);
    const rowHeight = itemTextWrapped.length * 14 + 15;
    
    page.drawRectangle({
      x: 40,
      y: curY - rowHeight,
      width: 515,
      height: rowHeight,
      borderColor: rgb(0,0,0),
      borderWidth: 1,
    });
    // col check line
    page.drawLine({ start: { x: 390, y: curY }, end: { x: 390, y: curY - rowHeight }, thickness: 1 });

    for (let l = 0; l < itemTextWrapped.length; l++) {
      page.drawText(itemTextWrapped[l], { x: 50, y: curY - 15 - (l * 12), size: 9, font: fontBold });
    }
    
    page.drawText('Rp ' + formatRupiah(item.total), { x: 400, y: curY - 15, size: 10, font: fontBold });
    curY -= rowHeight;
  }

  // Draw total row
  page.drawRectangle({
    x: 40,
    y: curY - 25,
    width: 515,
    height: 25,
    borderColor: rgb(0,0,0),
    borderWidth: 1.5,
    color: rgb(0.98,0.98,0.98)
  });
  page.drawLine({ start: { x: 390, y: curY }, end: { x: 390, y: curY - 25 }, thickness: 1.5 });
  page.drawText('Total', { x: 50, y: curY - 17, size: 10, font: fontBold });
  page.drawText('Rp ' + formatRupiah(grandTotal), { x: 400, y: curY - 17, size: 10, font: fontBold });
  curY -= 25;

  // Draw Terbilang
  page.drawRectangle({
    x: 40,
    y: curY - 45,
    width: 515,
    height: 35,
    borderColor: rgb(0,0,0),
    borderWidth: 1,
    color: rgb(0.98,0.98,0.98)
  });
  page.drawText('Terbilang :', { x: 48, y: curY - 25, size: 9, font: fontBold });
  const wrappedTerbilang = wrapText('"' + numberToTerbilang(grandTotal) + '"', 420, fontRegular, 9);
  for (let l = 0; l < Math.min(wrappedTerbilang.length, 2); l++) {
    page.drawText(wrappedTerbilang[l], { x: 110, y: curY - 15 - (l * 11), size: 9, font: fontRegular });
  }
  curY -= 45;

  // Draw columns signature table block
  const sigTableY = curY - 95;
  page.drawRectangle({
    x: 40,
    y: sigTableY,
    width: 515,
    height: 80,
    borderColor: rgb(0,0,0),
    borderWidth: 1.5,
  });
  
  // Column dividers
  const blockW = 515 / 4;
  page.drawLine({ start: { x: 40 + blockW, y: curY - 15 }, end: { x: 40 + blockW, y: sigTableY }, thickness: 1 });
  page.drawLine({ start: { x: 40 + blockW * 2, y: curY - 15 }, end: { x: 40 + blockW * 2, y: sigTableY }, thickness: 1 });
  page.drawLine({ start: { x: 40 + blockW * 3, y: curY - 15 }, end: { x: 40 + blockW * 3, y: sigTableY }, thickness: 1 });

  // Table header box background
  page.drawRectangle({
    x: 40,
    y: curY - 15,
    width: 515,
    height: 15,
    color: rgb(0.95,0.95,0.95),
    borderColor: rgb(0,0,0),
    borderWidth: 1
  });
  
  page.drawText('Diverifikasi', { x: 40 + 25, y: curY - 11, size: 8, font: fontBold });
  page.drawText('Disetujui', { x: 40 + blockW + 35, y: curY - 11, size: 8, font: fontBold });
  page.drawText('Disetujui', { x: 40 + blockW * 2 + 35, y: curY - 11, size: 8, font: fontBold });
  page.drawText('Dibukukan', { x: 40 + blockW * 3 + 30, y: curY - 11, size: 8, font: fontBold });

  // Signature names
  page.drawText(submission.diverifikasiOleh || '', { x: 45, y: sigTableY + 15, size: 8, font: fontBold });
  page.drawText(submission.diverifikasiJabatan || '', { x: 45, y: sigTableY + 5, size: 7, font: fontRegular });

  page.drawText(submission.disetujuiOleh || '', { x: 45 + blockW, y: sigTableY + 15, size: 8, font: fontBold });
  page.drawText('Dir Keuangan', { x: 45 + blockW, y: sigTableY + 5, size: 7, font: fontRegular });

  page.drawText(submission.disetujuiOleh2 || '', { x: 45 + blockW * 2, y: sigTableY + 15, size: 8, font: fontBold });
  page.drawText(submission.disetujuiJabatan2 || 'DIREKTUR', { x: 45 + blockW * 2, y: sigTableY + 5, size: 7, font: fontRegular });

  page.drawText(submission.dibukukanOleh || '', { x: 45 + blockW * 3, y: sigTableY + 15, size: 8, font: fontBold });
  page.drawText(submission.dibukukanJabatan || '', { x: 45 + blockW * 3, y: sigTableY + 5, size: 7, font: fontRegular });

  return await pdfDoc.save();
}

export async function generateF2PdfBytes(submission: any, grandTotal: number): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595.27, 841.89]);
  
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);
  
  // Draw Logo text
  page.drawText('PT. NUSANTARA MINERAL SUKSES ABADI', { x: 40, y: 795, size: 14, font: fontBold });
  page.drawText('VOUCHER SYSTEM PLATFORM', { x: 40, y: 780, size: 8, font: fontRegular });
  
  // Draw title in box
  page.drawRectangle({
    x: 40,
    y: 720,
    width: 515,
    height: 35,
    color: rgb(0.85, 0.85, 0.85),
    borderColor: rgb(0, 0, 0),
    borderWidth: 1.5,
  });
  page.drawText('FORMULIR PENGAJUAN HO', { x: 195, y: 732, size: 12, font: fontBold });

  // Draw metadata box
  page.drawRectangle({
    x: 40,
    y: 620,
    width: 515,
    height: 80,
    borderColor: rgb(0, 0, 0),
    borderWidth: 1.5,
  });
  
  const txtLokasi = `Lokasi                      :  ${submission.lokasi || ''}`;
  const txtTanggal = `Tanggal                    :  ${formatDateIndonesian(submission.tanggal)}`;
  const txtJenis = `Jenis Pengajuan       :  ${submission.jenisPengajuan || ''}`;
  const txtKode = `Kode                       :  ${submission.kode || ''}`;
  
  page.drawText(txtLokasi, { x: 55, y: 680, size: 10, font: fontRegular });
  page.drawText(txtTanggal, { x: 55, y: 663, size: 10, font: fontRegular });
  page.drawText(txtJenis, { x: 55, y: 646, size: 10, font: fontRegular });
  page.drawText(txtKode, { x: 55, y: 629, size: 10, font: fontMono });

  // Draw Table header
  page.drawRectangle({
    x: 40,
    y: 575,
    width: 515,
    height: 25,
    color: rgb(0.9, 0.9, 0.9),
    borderColor: rgb(0,0,0),
    borderWidth: 1,
  });
  
  page.drawText('NO', { x: 45, y: 583, size: 8, font: fontBold });
  page.drawText('ITEM DETIL (INVOICE / DESKRIPSI)', { x: 75, y: 583, size: 8, font: fontBold });
  page.drawText('VOLUME', { x: 325, y: 583, size: 8, font: fontBold });
  page.drawText('TOTAL (RP)', { x: 400, y: 583, size: 8, font: fontBold });
  page.drawText('KETERANGAN', { x: 475, y: 583, size: 8, font: fontBold });

  let curY = 575;
  const items = submission.items || [];
  
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const descWrapped = wrapText(item.item || '', 240, fontRegular, 8);
    const ketWrapped = wrapText(item.keterangan || '-', 70, fontRegular, 8);
    const rowHeight = Math.max(descWrapped.length, ketWrapped.length, 1) * 12 + 10;
    
    // Draw row rectangle
    page.drawRectangle({
      x: 40,
      y: curY - rowHeight,
      width: 515,
      height: rowHeight,
      borderColor: rgb(0,0,0),
      borderWidth: 1,
    });
    
    // Draw columns vertical separation borders
    page.drawLine({ start: { x: 65, y: curY }, end: { x: 65, y: curY - rowHeight }, thickness: 1 });
    page.drawLine({ start: { x: 320, y: curY }, end: { x: 320, y: curY - rowHeight }, thickness: 1 });
    page.drawLine({ start: { x: 390, y: curY }, end: { x: 390, y: curY - rowHeight }, thickness: 1 });
    page.drawLine({ start: { x: 470, y: curY }, end: { x: 470, y: curY - rowHeight }, thickness: 1 });

    // Fill row texts
    page.drawText(String(i + 1), { x: 48, y: curY - 15, size: 8, font: fontMono });
    
    for (let dLine = 0; dLine < descWrapped.length; dLine++) {
      page.drawText(descWrapped[dLine], { x: 75, y: curY - 15 - (dLine * 11), size: 8, font: fontBold });
    }
    
    page.drawText(item.jumlahVolume || '-', { x: 325, y: curY - 15, size: 8, font: fontRegular });
    page.drawText(formatRupiah(item.total), { x: 395, y: curY - 15, size: 8, font: fontBold });
    
    for (let kLine = 0; kLine < ketWrapped.length; kLine++) {
      page.drawText(ketWrapped[kLine], { x: 475, y: curY - 15 - (kLine * 11), size: 8, font: fontRegular });
    }
    
    curY -= rowHeight;
  }
  
  // Total Row
  page.drawRectangle({
    x: 40,
    y: curY - 25,
    width: 515,
    height: 25,
    color: rgb(0.95, 0.95, 0.95),
    borderColor: rgb(0,0,0),
    borderWidth: 1.5,
  });
  page.drawLine({ start: { x: 390, y: curY }, end: { x: 390, y: curY - 25 }, thickness: 1.5 });
  page.drawText('TOTAL PENYERAHAN', { x: 150, y: curY - 17, size: 9, font: fontBold });
  page.drawText(formatRupiah(grandTotal), { x: 395, y: curY - 17, size: 9, font: fontBold });
  
  curY -= 25;
  
  // Signatures
  const sigY = curY - 80;
  page.drawText('Dibuat Oleh', { x: 90, y: curY - 30, size: 10, font: fontRegular });
  page.drawText(submission.dibuatOleh || '', { x: 70, y: sigY, size: 10, font: fontBold });
  page.drawLine({ start: { x: 60, y: sigY - 2 }, end: { x: 200, y: sigY - 2 }, thickness: 1 });
  
  page.drawText('Disetujui', { x: 410, y: curY - 30, size: 10, font: fontRegular });
  page.drawText(submission.disetujuiOleh || '', { x: 390, y: sigY, size: 10, font: fontBold });
  page.drawLine({ start: { x: 370, y: sigY - 2 }, end: { x: 500, y: sigY - 2 }, thickness: 1 });
  
  // Notes block
  curY = sigY - 50;
  page.drawText('NOTE :', { x: 40, y: curY, size: 9, font: fontBold });
  page.drawRectangle({
    x: 40,
    y: curY - 50,
    width: 515,
    height: 40,
    borderColor: rgb(0,0,0),
    borderWidth: 1,
  });
  const wrappedNotes = wrapText(submission.notes || 'Tidak ada catatan tambahan.', 550, fontRegular, 8);
  for (let nLine = 0; nLine < Math.min(wrappedNotes.length, 3); nLine++) {
    page.drawText(wrappedNotes[nLine], { x: 45, y: curY - 14 - (nLine * 11), size: 8, font: fontRegular });
  }
  
  return await pdfDoc.save();
}

export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

const INDONESIAN_MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
];

export function formatDateIndonesian(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return dateString;

  const day = date.getDate().toString().padStart(2, '0');
  const month = INDONESIAN_MONTHS[date.getMonth()];
  const year = date.getFullYear();

  return `${day} ${month} ${year}`;
}

export function numberToTerbilang(angka: number): string {
  const nominal = Math.floor(Math.abs(angka));
  if (nominal === 0) return 'Nol Rupiah';
  
  const prefix = angka < 0 ? 'Minus ' : '';
  const hasil = terbilangHelper(nominal).replace(/\s+/g, ' ').trim();
  return hasil ? prefix + hasil + ' Rupiah' : 'Nol Rupiah';
}

function terbilangHelper(nominal: number): string {
  const huruf = [
    '', 'Satu', 'Dua', 'Tiga', 'Empat', 'Lima', 
    'Enam', 'Tujuh', 'Delapan', 'Sembilan', 'Sepuluh', 'Sebelas'
  ];
  
  if (nominal < 12) {
    return ' ' + huruf[nominal];
  } else if (nominal < 20) {
    return terbilangHelper(nominal - 10) + ' Belas';
  } else if (nominal < 100) {
    return terbilangHelper(Math.floor(nominal / 10)) + ' Puluh' + terbilangHelper(nominal % 10);
  } else if (nominal < 200) {
    return ' Seratus' + terbilangHelper(nominal - 100);
  } else if (nominal < 1000) {
    return terbilangHelper(Math.floor(nominal / 100)) + ' Ratus' + terbilangHelper(nominal % 100);
  } else if (nominal < 2000) {
    return ' Seribu' + terbilangHelper(nominal - 1000);
  } else if (nominal < 1000000) {
    return terbilangHelper(Math.floor(nominal / 1000)) + ' Ribu' + terbilangHelper(nominal % 1000);
  } else if (nominal < 1000000000) {
    return terbilangHelper(Math.floor(nominal / 1000000)) + ' Juta' + terbilangHelper(nominal % 1000000);
  } else if (nominal < 1000000000000) {
    return terbilangHelper(Math.floor(nominal / 1000000000)) + ' Milyar' + terbilangHelper(nominal % 1000000000);
  } else if (nominal < 1000000000000000) {
    return terbilangHelper(Math.floor(nominal / 1000000000000)) + ' Triliun' + terbilangHelper(nominal % 1000000000000);
  }
  return '';
}

export async function convertImageToPdf(imageBytes: Uint8Array, mimeType: string): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  let image;
  try {
    if (mimeType === 'image/png' || mimeType.includes('png')) {
      image = await pdfDoc.embedPng(imageBytes);
    } else {
      image = await pdfDoc.embedJpg(imageBytes);
    }
  } catch (err) {
    console.warn('Failed to embed image in PDF directly, attempting to embed as JPEG anyway:', err);
    try {
      image = await pdfDoc.embedJpg(imageBytes);
    } catch (e2) {
      throw new Error('Format gambar tidak didukung atau rusak.');
    }
  }

  // Get image dimensions
  const dims = image.scale(1);
  
  // Standard A4 dimensions in points: 595.27 x 841.89
  const a4Width = 595.27;
  const a4Height = 841.89;
  
  // Create page with A4 dimensions
  const page = pdfDoc.addPage([a4Width, a4Height]);
  
  // Calculate scaling factor to fit image on page with some margins (e.g. 20pt)
  const margin = 20;
  const maxWidth = a4Width - (margin * 2);
  const maxHeight = a4Height - (margin * 2);
  
  let scale = 1;
  if (dims.width > maxWidth || dims.height > maxHeight) {
    const scaleX = maxWidth / dims.width;
    const scaleY = maxHeight / dims.height;
    scale = Math.min(scaleX, scaleY);
  }
  
  const width = dims.width * scale;
  const height = dims.height * scale;
  
  // Center image on the page
  const x = (a4Width - width) / 2;
  const y = (a4Height - height) / 2;
  
  page.drawImage(image, {
    x,
    y,
    width,
    height,
  });
  
  return await pdfDoc.save();
}
