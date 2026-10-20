# Dompetku Multi-Agent System (MAS)

Sistem pencatatan dan manajemen keuangan pribadi berbasis **LangGraph**, **Gemini API**, **SQLite**, dan **Discord Bot** yang siap dijalankan 24/7 di **Fly.io**.

## Daftar Agen
1. **Supervisor Agent**: Mengidentifikasi maksud pesan user (ubah limit budget, catat transaksi baru, atau analisis keuangan).
2. **Budget Manager Agent**: Mengubah limit budget bulanan per kategori langsung lewat chat.
3. **Parser Agent**: Mengekstrak transaksi dari kalimat natural bahasa Indonesia ke SQLite.
4. **Budget Guard Agent**: Memeriksa persentase pemakaian budget setiap ada pengeluaran baru.
5. **Financial Advisor Agent**: Menyusun rangkuman dan saran finansial.

## Cara Menjalankan di Lokal
1. Duplikat `.env.example` menjadi `.env` lalu isi `GEMINI_API_KEY` dan `DISCORD_TOKEN`.
2. Install dependensi:
   ```bash
   pip install -r requirements.txt
   ```
3. Uji via terminal (CLI):
   ```bash
   python main.py
   ```
4. Jalankan bot Discord:
   ```bash
   python discord_bot.py
   ```
