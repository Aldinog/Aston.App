/*
 *  ================================================================
 *  PANDUAN MENAMBAH MATERI (LEARN CONTENT)
 *  ================================================================
 *  File ini adalah Pusat Data untuk fitur Learn. Anda bisa menambah materi tanpa coding UI.
 *
 *  CARA MENAMBAH KAMUS (GLOSSARY):
 *  1. Cari object dengan id: 'glossary'.
 *  2. Tambahkan item baru ke dalam array 'content':
 *     { term: 'Istilah Baru', def: 'Penjelasan istilah...' },
 *
 *  CARA MENAMBAH POLA CANDLE (GRID_IMAGE):
 *  1. Cari object dengan id: 'candles'.
 *  2. Tambahkan item baru ke dalam array 'content':
 *     { 
 *       title: 'Nama Pola', 
 *       type: 'BULLISH' | 'BEARISH' | 'NEUTRAL', 
 *       desc: 'Penjelasan pola...',
 *       image: require('../../assets/nama-file.png') // Pastikan file ada di folder assets
 *     },
 *
 *  CARA MENAMBAH PANDUAN (GUIDE):
 *  1. Cari object dengan id: 'app-guide'.
 *  2. Tambahkan item baru:
 *     {
 *       title: 'Judul Panduan',
 *       steps: ['Langkah 1', 'Langkah 2', 'Langkah 3']
 *     },
 *
 *  ================================================================
 */

export type ModuleType = 'GRID_IMAGE' | 'ARTICLE' | 'GLOSSARY' | 'GUIDE';

export interface LearnModule {
    id: string;
    title: string;
    icon: string;
    color: string;
    type: ModuleType;
    description: string;
    content: any[];
}

export const LEARN_MODULES: LearnModule[] = [
    {
        id: 'glossary',
        title: 'Kamus Trader',
        icon: 'book-open-page-variant',
        color: '#f59e0b',
        type: 'GLOSSARY',
        description: 'Istilah gaul pasar saham yang wajib tau.',
        content: [
            { term: 'ARA', def: 'Auto Reject Atas. Kenaikan harga tertinggi dalam sehari (20%-35%).' },
            { term: 'ARB', def: 'Auto Reject Bawah. Penurunan harga terendah dalam sehari.' },
            { term: 'Bandar', def: 'Pihak bermodal besar yang bisa menggerakkan harga saham.' },
            { term: 'Haka', def: 'Hajar Kanan. Beli saham langsung di harga offer (tanpa antri).' },
            { term: 'Haki', def: 'Hajar Kiri. Jual saham langsung di harga bid.' },
            { term: 'Scalping', def: 'Trading super cepat (hitungan menit/detik) cari cuan tipis.' },
            { term: 'Swing', def: 'Trading santai, beli dan hold beberapa hari/minggu ikuti tren.' },
            { term: 'Pucuk', def: 'Beli di harga tertinggi, lalu harga turun (Nyangkut).' },
            { term: 'Serok', def: 'Beli di harga bawah saat harga sedang turun.' },
        ]
    },
    {
        id: 'candles',
        title: 'Candlestick Guide',
        icon: 'chart-bar',
        color: '#ef4444',
        type: 'GRID_IMAGE',
        description: 'Pola candlestick reversal & continuation.',
        content: [
            {
                title: 'Bullish Engulfing',
                type: 'BULLISH',
                desc: 'Candle hijau besar "memakan" candle merah sebelumnya. Tanda pembalikan arah naik yang kuat.',
                // image: require('../../assets/learn/bullish-engulfing.png') // Setup later
            },
            {
                title: 'Hammer',
                type: 'BULLISH',
                desc: 'Bodi kecil di atas, ekor bawah panjang. Menunjukkan tekanan beli mulai melawan.',
            },
            {
                title: 'Shooting Star',
                type: 'BEARISH',
                desc: 'Kebalikan Hammer. Bodi kecil di bawah, ekor atas panjang. Tanda seller mulai menekan.',
            },
            {
                title: 'Doji',
                type: 'NEUTRAL',
                desc: 'Harga open = close. Menunjukkan keraguan pasar (Indecision). Tunggu candle konfirmasi.',
            },
        ]
    },
    {
        id: 'app-guide',
        title: 'Panduan Aplikasi',
        icon: 'cellphone-information',
        color: '#3b82f6',
        type: 'GUIDE',
        description: 'Cara maksimal menggunakan fitur Bot.',
        content: [
            {
                title: 'Cara Pakai Screener',
                steps: [
                    'Buka menu Screener di Home.',
                    'Pilih sektor yang diminati (atau All).',
                    'Cari label "BULLISH" atau "High Score".',
                    'Klik emiten untuk analisa chart.'
                ]
            },
            {
                title: 'Rumus Kalkulator Saham',
                steps: [
                    'Masukkan Harga Modal & Lot saat ini.',
                    'Masukkan Harga Beli Baru (P2).',
                    'Pilih mode "Target Avg" untuk tau butuh berapa lot.',
                    'Gunakan fitur Copy Plan untuk simpan rencana.'
                ]
            },
        ]
    }
];
